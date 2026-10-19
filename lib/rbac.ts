/**
 * lib/rbac.ts
 * Multi-Tier Role-Based Access Control (RBAC) System for QuizWeb
 *
 * Tier Hierarchy:
 *   - 'admin': Full administrative privileges (/admin, /pending, user role management, analytics, review queue).
 *   - 'maintainer': Staff content authoring (/maintainer, /input, question studio, submission tracking).
 *   - 'user': Standard student/player (/home, /learn, /quiz, profile/settings).
 */

import type { RowDataPacket } from "mysql2";

// -----------------------------------------------------------------------------
// 1. Role Types, Constants & Hierarchy
// -----------------------------------------------------------------------------
export type UserRole = "admin" | "maintainer" | "user";

export const ROLES = {
  ADMIN: "admin",
  MAINTAINER: "maintainer",
  USER: "user",
} as const satisfies Record<string, UserRole>;

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  maintainer: 2,
  user: 1,
} as const;

// -----------------------------------------------------------------------------
// 2. Interfaces
// -----------------------------------------------------------------------------
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email?: string;
  tokenVersion?: number;
}

interface SessionUserPayload {
  id?: string | number;
  role?: string;
  user_role?: string;
  email?: string;
  tokenVersion?: number;
  token_version?: number;
}

interface SessionPayload {
  user?: SessionUserPayload;
}

type RoleResolutionResult =
  | { status: "FOUND"; role: UserRole }
  | { status: "NOT_FOUND" }
  | { status: "INVALID_ROLE" }
  | { status: "DB_UNAVAILABLE" };

// -----------------------------------------------------------------------------
// 3. Pure Predicates & Type Guards (Client-Safe)
// -----------------------------------------------------------------------------
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && (role === ROLES.ADMIN || role === ROLES.MAINTAINER || role === ROLES.USER);
}

export function isAdmin(role: unknown): boolean {
  return role === ROLES.ADMIN;
}

export function isStaff(role: unknown): boolean {
  return role === ROLES.ADMIN || role === ROLES.MAINTAINER;
}

export function isMaintainer(role: unknown): boolean {
  return role === ROLES.MAINTAINER;
}

export function hasRole(currentRole: unknown, requiredRole: UserRole): boolean {
  if (!isValidRole(currentRole)) return false;
  return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[requiredRole];
}

// -----------------------------------------------------------------------------
// 4. Session & Database Resolution Helpers (Server-Only, Dynamic Imports)
// -----------------------------------------------------------------------------
async function resolveSession(): Promise<SessionPayload | null> {
  // Test harness session injection override
  const testSession = (globalThis as unknown as { __TEST_AUTH_SESSION__?: SessionPayload | null }).__TEST_AUTH_SESSION__;
  if (testSession !== undefined) {
    return testSession;
  }
  try {
    const authModule = await import("@/auth");
    const authFn = authModule.auth || (authModule as unknown as { default?: { auth?: () => Promise<unknown> } }).default?.auth;
    if (typeof authFn === "function") {
      const session = await authFn();
      return (session as unknown as SessionPayload) || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAuthoritativeRole(
  userId: string | number,
  isTestSession: boolean
): Promise<RoleResolutionResult> {
  // Offline test mock identifiers are handled without DB lookup in test environments
  if (
    isTestSession &&
    typeof userId === "string" &&
    (userId.startsWith("test_") || userId.startsWith("offline_"))
  ) {
    return { status: "DB_UNAVAILABLE" };
  }

  try {
    const dbModule = await import("@/lib/db");
    const db = dbModule.db || (dbModule as unknown as { default?: { db?: typeof dbModule.db } }).default?.db;
    if (!db || typeof db.query !== "function") {
      return { status: "DB_UNAVAILABLE" };
    }
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return { status: "NOT_FOUND" };
    }
    const rawRole = rows[0]?.user_role;
    if (rawRole && isValidRole(String(rawRole))) {
      return { status: "FOUND", role: String(rawRole) as UserRole };
    }
    return { status: "INVALID_ROLE" };
  } catch {
    return { status: "DB_UNAVAILABLE" };
  }
}

// -----------------------------------------------------------------------------
// 5. Server Authorization Helpers
// -----------------------------------------------------------------------------
export async function requireAuth(): Promise<AuthenticatedUser | false> {
  const isTestSession = (globalThis as unknown as { __TEST_AUTH_SESSION__?: SessionPayload | null }).__TEST_AUTH_SESSION__ !== undefined;
  const session = await resolveSession();
  const userId = session?.user?.id;
  if (!userId) return false;

  const resolution = await fetchAuthoritativeRole(userId, isTestSession);

  if (resolution.status === "FOUND") {
    return {
      id: String(userId),
      role: resolution.role,
      email: session?.user?.email,
    };
  }

  // Fail-closed defense: deleted user (NOT_FOUND) or banned/invalid role (INVALID_ROLE) fails closed immediately
  if (resolution.status === "NOT_FOUND" || resolution.status === "INVALID_ROLE") {
    return false;
  }

  // Fallback to session token role ONLY if database is unavailable during explicit test execution
  if (resolution.status === "DB_UNAVAILABLE" && isTestSession) {
    const sessionRole = session?.user?.role || session?.user?.user_role;
    if (sessionRole && isValidRole(sessionRole)) {
      return {
        id: String(userId),
        role: sessionRole,
        email: session?.user?.email,
      };
    }
  }

  return false;
}

export async function requireStaff(): Promise<AuthenticatedUser | false> {
  const user = await requireAuth();
  if (!user) return false;
  if (!isStaff(user.role)) return false;
  return user;
}

export const requireMaintainerOrAdmin = requireStaff;

export async function requireAdmin(): Promise<AuthenticatedUser | false> {
  const user = await requireAuth();
  if (!user) return false;
  if (!isAdmin(user.role)) return false;
  return user;
}

// -----------------------------------------------------------------------------
// 6. Secret Key Verification (Constant-Time SHA-256)
// -----------------------------------------------------------------------------
export function verifyAdminSecretKey(candidateKey: string | null | undefined): boolean {
  const configuredKey = process.env.ADMIN_SECRET_KEY;
  // Fail closed if server has no secret key configured or is empty
  if (!configuredKey || typeof configuredKey !== "string" || configuredKey.trim().length === 0) {
    return false;
  }
  if (!candidateKey || typeof candidateKey !== "string" || candidateKey.length === 0) {
    return false;
  }

  // Dynamic require of crypto to keep module client-safe
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("node:crypto");
  // Strict exact matching without .trim() per ASVS Chapter 3 & test-rbac-e2e T2-B4-02
  const candidateHash = nodeCrypto.createHash("sha256").update(candidateKey).digest();
  const configuredHash = nodeCrypto.createHash("sha256").update(configuredKey.trim()).digest();

  return nodeCrypto.timingSafeEqual(candidateHash, configuredHash);
}

// -----------------------------------------------------------------------------
// 7. Post-Login Redirection Contract (PROJECT.md § R6, Feature F12)
// -----------------------------------------------------------------------------
export function getPostLoginRedirect(role: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "maintainer":
      return "/maintainer";
    case "user":
    default:
      return "/home";
  }
}

