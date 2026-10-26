"use server";

import argon2 from "argon2";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { auth, invalidateUserAuthCache } from "@/auth";

// -----------------------------------------------------------------------------
// Validation Constants (Authoritative Contracts per PROJECT.md & test-rbac-e2e)
// -----------------------------------------------------------------------------
const USERNAME_REGEX = /^[a-zA-Z0-9_.\- ]{3,30}$/;
const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,24}$/;

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 32768,
  timeCost: 2,
  parallelism: 1,
};

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface UserCredentialStatusResult {
  success: boolean;
  username?: string;
  hasPassword?: boolean;
  email?: string;
  role?: string;
  error?: string;
}

interface SessionContextUser {
  id: string | number;
  email?: string;
  name?: string;
  role?: string;
  user_role?: string;
}

/**
 * Resolves current authenticated session user, with test harness override support.
 */
async function getSessionUser(): Promise<SessionContextUser | null> {
  const testSession = (
    globalThis as unknown as {
      __TEST_AUTH_SESSION__?: { user?: SessionContextUser } | null;
    }
  ).__TEST_AUTH_SESSION__;

  if (testSession?.user?.id) {
    return testSession.user;
  }

  try {
    const session = await auth();
    if (session?.user?.id) {
      const sessUser = session.user as Record<string, unknown>;
      return {
        id: session.user.id,
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        role: (sessUser.role as string) || (sessUser.user_role as string) || "user",
        user_role: (sessUser.user_role as string) || (sessUser.role as string) || "user",
      };
    }
  } catch {
    // Outside request context (e.g. standalone test environment)
  }

  return null;
}

/**
 * Server Action: updateUsername (PROJECT.md § Server Action Contracts)
 *
 * Validates format (/^[a-zA-Z0-9_.\- ]{3,30}$/) and enforces global uniqueness
 * in player_tbl against other users (case-insensitive).
 */
export async function updateUsername(newUsername: string): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  if (!newUsername || typeof newUsername !== "string") {
    return { success: false, error: "Username must be a valid non-empty string." };
  }

  if (!USERNAME_REGEX.test(newUsername)) {
    return {
      success: false,
      error:
        "Username must be 3-30 characters long and contain only letters, numbers, spaces, dots, hyphens, and underscores.",
    };
  }

  const userId = session.id;

  try {
    // Case-insensitive collision check in player_tbl for other users
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT user_id FROM player_tbl WHERE LOWER(username) = LOWER(?) AND user_id != ? LIMIT 1",
      [newUsername, userId]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return { success: false, error: `Username '${newUsername}' is already taken.` };
    }

    // Upsert into player_tbl
    const [updateResult] = await db.query<ResultSetHeader>(
      "UPDATE player_tbl SET username = ? WHERE user_id = ?",
      [newUsername, userId]
    );

    if (updateResult && typeof updateResult.affectedRows === "number" && updateResult.affectedRows === 0) {
      await db.query(
        "INSERT INTO player_tbl (user_id, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username)",
        [userId, newUsername]
      );
    }

    // Sync in-memory test session if active
    if (session) {
      session.name = newUsername;
    }

    invalidateUserAuthCache(userId);

    return { success: true };
  } catch (err: unknown) {
    // Catch MySQL ER_DUP_ENTRY / 1062 during concurrent claims (Boundary B7)
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ER_DUP_ENTRY") {
      return { success: false, error: `Username '${newUsername}' is already taken.` };
    }
    console.error("Error in updateUsername:", err);
    return { success: false, error: "An unexpected error occurred while updating username." };
  }
}

/**
 * Server Action: changePassword (PROJECT.md § Server Action Contracts)
 *
 * Verifies current password using Argon2, validates new password complexity,
 * hashes new password with Argon2, and increments token_version (SEC-05).
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  const userId = session.id;

  let users: RowDataPacket[] = [];
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id, password_hash, token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId]
    );
    users = Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error("Error querying user for changePassword:", err);
    return { success: false, error: "User account not found." };
  }

  if (users.length === 0) {
    return { success: false, error: "User account not found." };
  }

  const user = users[0];

  if (user.password_hash === null || user.password_hash === undefined) {
    return {
      success: false,
      error:
        "OAuth-only accounts do not have a current password. Please use setPasswordForOAuth instead.",
    };
  }

  if (!currentPassword) {
    return { success: false, error: "Current password is required." };
  }

  try {
    const isCurrentValid = await argon2.verify(user.password_hash, currentPassword);
    if (!isCurrentValid) {
      return { success: false, error: "Incorrect current password." };
    }
  } catch {
    return { success: false, error: "Incorrect current password." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New password and confirmation do not match." };
  }

  if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
    return {
      success: false,
      error:
        "Password must be 8-24 characters and contain uppercase, lowercase, numbers, and special symbols.",
    };
  }

  const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

  // Invalidate previous active sessions across devices by incrementing token_version (SEC-05)
  await db.query(
    "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
    [newHash, userId]
  );

  invalidateUserAuthCache(userId);

  return { success: true };
}

/**
 * Server Action: setPasswordForOAuth (PROJECT.md § Server Action Contracts)
 *
 * Establishes an initial password for OAuth-created accounts that currently have
 * password_hash IS NULL, validating complexity and incrementing token_version (SEC-05).
 */
export async function setPasswordForOAuth(
  newPassword: string,
  confirmPassword: string
): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  const userId = session.id;

  let users: RowDataPacket[] = [];
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id, password_hash, token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId]
    );
    users = Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error("Error querying user for setPasswordForOAuth:", err);
    return { success: false, error: "User account not found." };
  }

  if (users.length === 0) {
    return { success: false, error: "User account not found." };
  }

  const user = users[0];

  if (user.password_hash !== null && user.password_hash !== undefined) {
    return {
      success: false,
      error:
        "Password already set. Please use changePassword to update existing credentials.",
    };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New password and confirmation do not match." };
  }

  if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
    return {
      success: false,
      error:
        "Password must be 8-24 characters and contain uppercase, lowercase, numbers, and special symbols.",
    };
  }

  const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

  // Invalidate previous active sessions across devices by incrementing token_version (SEC-05)
  await db.query(
    "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
    [newHash, userId]
  );

  invalidateUserAuthCache(userId);

  return { success: true };
}

/**
 * Helper to fetch credential status for Settings UI.
 */
export async function getUserCredentialStatus(): Promise<UserCredentialStatusResult> {
  const session = await getSessionUser();
  if (!session) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT a.email, a.password_hash, a.user_role, p.username 
       FROM user_auth_tbl a 
       LEFT JOIN player_tbl p ON a.user_id = p.user_id 
       WHERE a.user_id = ? LIMIT 1`,
      [session.id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: false, error: "User account not found." };
    }

    const row = rows[0];
    return {
      success: true,
      email: row.email,
      username: row.username || "",
      role: row.user_role || "user",
      hasPassword: row.password_hash !== null && row.password_hash !== undefined,
    };
  } catch (err) {
    console.error("Error in getUserCredentialStatus:", err);
    return { success: false, error: "Failed to retrieve credential status." };
  }
}
