"use server";

import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { verifyAdminSecretKey, requireAdmin } from "@/lib/rbac";

export interface ActionResult {
  success: boolean;
  error?: string;
}

interface SessionContextUser {
  id?: string | number;
  email?: string;
  name?: string;
  role?: string;
  user_role?: string;
}

/**
 * Server Action: claimAdminWithSecretKey (PROJECT.md § Server Action Contracts)
 *
 * Security Lifecycle:
 * 1. Resolves caller session context (Next-Auth auth() or test harness override).
 * 2. Pre-checks rate limit for key `admin_elevation:${userId}` (read-only, increment = false).
 * 3. Inspects user account in user_auth_tbl; rejects OAuth-only accounts without password.
 * 4. Validates secretKey using timingSafeEqual via verifyAdminSecretKey() without candidate trimming.
 *    - On failure: increments rate limiter (increment = true) and returns error.
 * 5. On success: clears rate limit and updates user_auth_tbl.user_role = 'admin'.
 *    - Does NOT increment token_version, preserving active session continuity.
 */
export async function claimAdminWithSecretKey(secretKey: string): Promise<ActionResult> {
  const testSession = (
    globalThis as unknown as {
      __TEST_AUTH_SESSION__?: {
        user?: SessionContextUser;
      } | null;
    }
  ).__TEST_AUTH_SESSION__;

  let userId: string | number | undefined = testSession?.user?.id;

  if (!userId) {
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch {
      // Outside request context
    }
  }

  if (!userId) {
    return { success: false, error: "Unauthorized: Active session required." };
  }

  const numericUserId = Number(userId);

  // 1. Rate limit pre-check (read-only, no increment)
  const rateLimit = await checkRateLimit(`admin_elevation:${userId}`, false);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: "Too many failed admin elevation attempts. Account is temporarily locked.",
    };
  }

  // 2. Query user account and verify password gating status
  let userRow: { user_id: number; password_hash: string | null; user_role: string } | undefined;
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id, password_hash, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [numericUserId]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      userRow = rows[0] as { user_id: number; password_hash: string | null; user_role: string };
    }
  } catch (err) {
    console.error("Error querying user for admin elevation:", err);
  }

  if (!userRow) {
    return { success: false, error: "User account not found." };
  }

  // 3. Password Gating Guard: OAuth accounts without passwords cannot claim admin
  if (userRow.password_hash === null || userRow.password_hash === undefined || userRow.password_hash === "") {
    return {
      success: false,
      error:
        "Password Required: You must establish an account password before claiming administrative privileges.",
    };
  }

  // 4. Secret Key Verification with constant-time SHA-256 comparison
  if (!secretKey || typeof secretKey !== "string") {
    await checkRateLimit(`admin_elevation:${userId}`, true);
    return { success: false, error: "Invalid admin secret key." };
  }

  const isValid = verifyAdminSecretKey(secretKey);
  if (!isValid) {
    await checkRateLimit(`admin_elevation:${userId}`, true);
    return { success: false, error: "Invalid admin secret key." };
  }

  // 5. Successful elevation: clear rate limit, update database role
  await clearRateLimit(`admin_elevation:${userId}`);

  await db.query(
    "UPDATE user_auth_tbl SET user_role = 'admin' WHERE user_id = ?",
    [numericUserId]
  );

  // Sync in-memory test session if active
  if (testSession?.user) {
    testSession.user.role = "admin";
    testSession.user.user_role = "admin";
  }

  return { success: true };
}

/**
 * Server Action: promoteUser (PROJECT.md § Server Action Contracts)
 *
 * Elevates a user to 'maintainer' or 'admin'. Requires caller to be admin.
 * Enforces staff password gating (rejects OAuth accounts without password).
 * Requires adminSecretKey when promoting to 'admin'.
 */
export async function promoteUser(
  targetUserId: number,
  targetRole: "maintainer" | "admin",
  adminSecretKey?: string
): Promise<ActionResult> {
  const caller = await requireAdmin();
  if (!caller) {
    return { success: false, error: "Unauthorized: Administrator privileges required." };
  }

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT user_id, password_hash, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
    [targetUserId]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "Target user not found." };
  }

  const targetUser = rows[0];

  // Staff Password Gating Guard
  if (targetUser.password_hash === null || targetUser.password_hash === undefined || targetUser.password_hash === "") {
    return {
      success: false,
      error: "Password Required: Target user has not established a password and cannot be granted staff access.",
    };
  }

  if (targetRole === "admin") {
    if (!adminSecretKey || !verifyAdminSecretKey(adminSecretKey)) {
      return {
        success: false,
        error: "Invalid admin secret key required for administrator promotion.",
      };
    }
  }

  await db.query(
    "UPDATE user_auth_tbl SET user_role = ? WHERE user_id = ?",
    [targetRole, targetUserId]
  );

  return { success: true };
}

/**
 * Server Action: demoteUser (PROJECT.md § Server Action Contracts)
 *
 * Demotes target user to 'user'. Requires caller to be admin.
 * Blocks self-demotion ("Cannot demote yourself").
 */
export async function demoteUser(targetUserId: number): Promise<ActionResult> {
  const caller = await requireAdmin();
  if (!caller) {
    return { success: false, error: "Unauthorized: Administrator privileges required." };
  }

  if (caller.id === String(targetUserId)) {
    return { success: false, error: "Self-demotion blocked: You cannot demote yourself from Admin." };
  }

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT user_id, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
    [targetUserId]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "Target user not found." };
  }

  await db.query(
    "UPDATE user_auth_tbl SET user_role = 'user' WHERE user_id = ?",
    [targetUserId]
  );

  return { success: true };
}

/**
 * Types & Action: getAdminUsers (PROJECT.md § Server Action Contracts)
 */
export interface AdminUserRecord {
  user_id: number;
  email: string;
  username: string;
  user_role: string;
  has_password: boolean;
  is_email_verified: boolean;
}

export async function getAdminUsers(
  query?: string,
  roleFilter?: string,
  passwordFilter?: string
): Promise<{ users: AdminUserRecord[] }> {
  const caller = await requireAdmin();
  if (!caller) {
    throw new Error("Unauthorized: Administrator privileges required.");
  }

  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  // 1. Search Query (case-insensitive substring match on email or username)
  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    whereClauses.push("(LOWER(u.email) LIKE LOWER(?) OR LOWER(COALESCE(p.username, CONCAT('player_', u.user_id))) LIKE LOWER(?))");
    params.push(q, q);
  }

  // 2. Role Filter ('admin' | 'maintainer' | 'user')
  if (roleFilter && roleFilter !== "all") {
    whereClauses.push("u.user_role = ?");
    params.push(roleFilter);
  }

  // 3. Password Status Filter ('Password Set' | 'OAuth-Only')
  if (passwordFilter && passwordFilter !== "all") {
    if (passwordFilter === "Password Set") {
      whereClauses.push("(u.password_hash IS NOT NULL AND u.password_hash != '')");
    } else if (passwordFilter === "OAuth-Only") {
      whereClauses.push("(u.password_hash IS NULL OR u.password_hash = '')");
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const sql = `
    SELECT 
      u.user_id,
      u.email,
      COALESCE(p.username, CONCAT('player_', u.user_id)) AS username,
      u.user_role,
      (u.password_hash IS NOT NULL AND u.password_hash != '') AS has_password,
      (u.is_email_verified = 1) AS is_email_verified
    FROM user_auth_tbl u
    LEFT JOIN player_tbl p ON u.user_id = p.user_id
    ${whereSql}
    ORDER BY u.user_id ASC
  `;

  const [rows] = await db.query<RowDataPacket[]>(sql, params);

  const users: AdminUserRecord[] = (rows as RowDataPacket[]).map((r) => ({
    user_id: Number(r.user_id),
    email: String(r.email),
    username: String(r.username),
    user_role: String(r.user_role),
    has_password: Boolean(r.has_password),
    is_email_verified: Boolean(r.is_email_verified),
  }));

  return { users };
}

/**
 * Types & Action: getAdminAnalytics (PROJECT.md § Server Action Contracts)
 */
export interface PlatformAnalytics {
  totalQuizzes: number;
  categories: { category: string; count: number }[];
  difficulties: { difficulty: string; count: number }[];
  contributors: { authorId: number; totalUnits: number }[];
}

export async function getAdminAnalytics(): Promise<PlatformAnalytics> {
  const caller = await requireAdmin();
  if (!caller) {
    throw new Error("Unauthorized: Administrator privileges required.");
  }

  // 1. Total Quizzes Count (sum of JSON quizzes in unit_tbl and rows in quiz_tbl, fallback to total units)
  const [totalRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      (SELECT COUNT(*) FROM quiz_tbl) + 
      (SELECT COALESCE(SUM(JSON_LENGTH(unit_quiz_json)), 0) FROM unit_tbl) AS totalQuizzes
  `);
  let totalQuizzes = Number(totalRows[0]?.totalQuizzes ?? 0);
  if (totalQuizzes === 0) {
    const [unitCount] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS totalUnits FROM unit_tbl");
    totalQuizzes = Number(unitCount[0]?.totalUnits ?? 0);
  }

  // 2. Category Distribution (joining cat_tbl with quiz_tbl and unit_tbl.unit_quiz_json)
  const [catRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      c.cat_name AS category,
      COUNT(all_q.cat_id) AS count
    FROM cat_tbl c
    LEFT JOIN (
      SELECT cat_id FROM quiz_tbl WHERE cat_id IS NOT NULL
      UNION ALL
      SELECT jt.cat_id 
      FROM unit_tbl u,
      JSON_TABLE(
        u.unit_quiz_json,
        "$[*]" COLUMNS (
          cat_id INT PATH "$.cat_id"
        )
      ) AS jt
      WHERE jt.cat_id IS NOT NULL
    ) AS all_q ON c.cat_id = all_q.cat_id
    GROUP BY c.cat_id, c.cat_name
    ORDER BY count DESC, c.cat_name ASC
  `);

  // 3. Difficulty Distribution (joining difficulty_tbl with quiz_tbl and unit_tbl.unit_quiz_json)
  const [diffRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      LOWER(d.difficulty_name) AS difficulty,
      COUNT(all_q.difficulty_id) AS count
    FROM difficulty_tbl d
    LEFT JOIN (
      SELECT difficulty_id FROM quiz_tbl WHERE difficulty_id IS NOT NULL
      UNION ALL
      SELECT jt.difficulty_id 
      FROM unit_tbl u,
      JSON_TABLE(
        u.unit_quiz_json,
        "$[*]" COLUMNS (
          difficulty_id INT PATH "$.difficulty_id"
        )
      ) AS jt
      WHERE jt.difficulty_id IS NOT NULL
    ) AS all_q ON d.difficulty_id = all_q.difficulty_id
    GROUP BY d.difficulty_id, d.difficulty_name
    ORDER BY d.difficulty_id ASC
  `);

  // 4. Contributor Submission Metrics (joining unit_tbl, unit_approved_tbl, pending_tbl)
  const [contribRows] = await db.query<RowDataPacket[]>(`
    SELECT 
      p.author_id AS authorId,
      COUNT(u.unit_id) AS totalUnits
    FROM unit_tbl u
    JOIN unit_approved_tbl a ON u.unit_id = a.unit_id
    JOIN pending_tbl p ON a.pending_id = p.pending_id
    WHERE p.author_id IS NOT NULL
    GROUP BY p.author_id
    ORDER BY totalUnits DESC, authorId ASC
  `);

  return {
    totalQuizzes,
    categories: (catRows as RowDataPacket[]).map((r) => ({
      category: String(r.category),
      count: Number(r.count),
    })),
    difficulties: (diffRows as RowDataPacket[]).map((r) => ({
      difficulty: String(r.difficulty),
      count: Number(r.count),
    })),
    contributors: (contribRows as RowDataPacket[]).map((r) => ({
      authorId: Number(r.authorId),
      totalUnits: Number(r.totalUnits),
    })),
  };
}

/**
 * Types & Action: getAdminReviewQueue (PROJECT.md § Server Action Contracts)
 */
export interface PendingReviewItem {
  pending_id: number;
  author_id: number | null;
  unit_title: string;
  sec_id: number;
  pending_status: string;
  pending_note: string | null;
  pending_name: string;
}

export async function getAdminReviewQueue(): Promise<PendingReviewItem[]> {
  const caller = await requireAdmin();
  if (!caller) {
    throw new Error("Unauthorized: Administrator privileges required.");
  }

  const [rows] = await db.query<RowDataPacket[]>(`
    SELECT 
      pending_id,
      author_id,
      unit_title,
      sec_id,
      pending_status,
      pending_note,
      pending_name
    FROM pending_tbl
    WHERE pending_status = 'pending'
    ORDER BY pending_id ASC
  `);

  return (rows as RowDataPacket[]).map((r) => ({
    pending_id: Number(r.pending_id),
    author_id: r.author_id !== null && r.author_id !== undefined ? Number(r.author_id) : null,
    unit_title: String(r.unit_title ?? ""),
    sec_id: Number(r.sec_id ?? 1),
    pending_status: String(r.pending_status ?? "pending"),
    pending_note: r.pending_note !== null && r.pending_note !== undefined ? String(r.pending_note) : null,
    pending_name: String(r.pending_name ?? "Anonymous"),
  }));
}

export { reviewPendingQuiz } from "@/app/actions/quiz";

