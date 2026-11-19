"use server";

import argon2 from "argon2";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "@/lib/db";
import { invalidateUserAuthCache } from "@/auth";
import {
  ARGON2_OPTIONS,
  PASSWORD_COMPLEXITY_REGEX,
  USERNAME_REGEX,
} from "@/lib/server/crypto";
import { getSessionContext } from "@/lib/server/session";

export interface ActionResult {
  success: boolean;
  error?: string;
}

async function setAndRevokePassword(
  userId: number | string,
  newPassword: string,
  confirmPassword: string,
): Promise<ActionResult> {
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
    [newHash, userId],
  );

  invalidateUserAuthCache(userId);

  return { success: true };
}

/**
 * Server Action: updateUsername (PROJECT.md § Server Action Contracts)
 *
 * Validates format (/^[a-zA-Z0-9_.\- ]{3,30}$/) and enforces global uniqueness
 * in player_tbl against other users (case-insensitive via utf8mb4_0900_ai_ci collation).
 */
export async function updateUsername(newUsername: string): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx.userId) {
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

  const userId = ctx.userId;

  try {
    // Index-friendly collision check in player_tbl for other users (uk_player_username collation is CI)
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT user_id FROM player_tbl WHERE username = ? AND user_id != ? LIMIT 1",
      [newUsername, userId],
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return { success: false, error: `Username '${newUsername}' is already taken.` };
    }

    const [updateResult] = await db.query<ResultSetHeader>(
      "UPDATE player_tbl SET username = ? WHERE user_id = ?",
      [newUsername, userId],
    );

    if (
      updateResult &&
      typeof updateResult.affectedRows === "number" &&
      updateResult.affectedRows === 0
    ) {
      await db.query(
        "INSERT INTO player_tbl (user_id, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username)",
        [userId, newUsername],
      );
    }

    if (process.env.NODE_ENV !== "production") {
      const testSession = (
        globalThis as unknown as {
          __TEST_AUTH_SESSION__?: { user?: { name?: string } } | null;
        }
      ).__TEST_AUTH_SESSION__;
      if (testSession?.user) {
        testSession.user.name = newUsername;
      }
    }

    invalidateUserAuthCache(userId);

    return { success: true };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ER_DUP_ENTRY"
    ) {
      return { success: false, error: `Username '${newUsername}' is already taken.` };
    }
    console.error("Error in updateUsername:", err);
    return { success: false, error: "An unexpected error occurred while updating username." };
  }
}

/**
 * Server Action: changePassword (PROJECT.md § Server Action Contracts)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx.userId) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  const userId = ctx.userId;

  let users: RowDataPacket[] = [];
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id, password_hash, token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId],
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

  return setAndRevokePassword(userId, newPassword, confirmPassword);
}

/**
 * Server Action: setPasswordForOAuth (PROJECT.md § Server Action Contracts)
 */
export async function setPasswordForOAuth(
  newPassword: string,
  confirmPassword: string,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx.userId) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  const userId = ctx.userId;

  let users: RowDataPacket[] = [];
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id, password_hash, token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId],
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

  return setAndRevokePassword(userId, newPassword, confirmPassword);
}
