"use server";

import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireStaff } from "@/lib/rbac";

/**
 * Interface: MaintainerSubmission
 * Represents a single pending unit submission authored by the maintainer.
 * Matches tests/test-rbac-e2e.ts lines 891–899 and PROJECT.md § Server Action Contracts.
 */
export interface MaintainerSubmission {
  pending_id: number;
  author_id: number | null;
  unit_title: string;
  sec_id: number;
  pending_status: string;
  pending_note: string | null;
  pending_name: string;
}

/**
 * Interface: MaintainerStats
 * Represents aggregated submission counts for the authenticated maintainer.
 * Matches tests/test-rbac-e2e.ts lines 927–932 and PROJECT.md § Server Action Contracts.
 */
export interface MaintainerStats {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface MaintainerSubmissionsResult {
  submissions: MaintainerSubmission[];
}

interface SessionContextUser {
  id?: string | number;
  email?: string;
  name?: string;
  role?: string;
  user_role?: string;
}

interface DbPendingRow extends RowDataPacket {
  pending_id: number;
  author_id: number | null;
  unit_title: string | null;
  sec_id: number | null;
  pending_status: string | null;
  pending_note: string | null;
  pending_name: string | null;
}

interface DbStatsRow extends RowDataPacket {
  total: number | string;
  approved: number | string;
  pending: number | string;
  rejected: number | string;
}

/**
 * Resolves session context from test harness injection override or Next-Auth session.
 */
async function getSessionContext(): Promise<{ user?: SessionContextUser } | null> {
  const testSession = (
    globalThis as unknown as {
      __TEST_AUTH_SESSION__?: { user?: SessionContextUser } | null;
    }
  ).__TEST_AUTH_SESSION__;

  if (testSession?.user) {
    return testSession;
  }

  try {
    const session = await auth();
    if (session?.user) {
      const sessUser = session.user as Record<string, unknown>;
      return {
        user: {
          id: session.user.id,
          email: session.user.email || undefined,
          name: session.user.name || undefined,
          role: (sessUser.role as string) || (sessUser.user_role as string) || "user",
          user_role: (sessUser.user_role as string) || (sessUser.role as string) || "user",
        },
      };
    }
  } catch {
    // Outside request context (e.g. standalone test environments)
  }

  return null;
}

/**
 * Resolves maintainer identifier and username for dual-attribution lookup:
 * author_id = session.user.id OR pending_name = session.user.name
 */
async function resolveMaintainerIdentity(staffId: string | number): Promise<{
  authorId: number | null;
  maintainerName: string;
}> {
  const numericId = Number(staffId);
  const authorId = Number.isFinite(numericId) ? numericId : null;

  const sessionContext = await getSessionContext();
  let maintainerName = (sessionContext?.user?.name || "").trim();

  // If username not in session, query player_tbl by user_id
  if (!maintainerName && authorId !== null) {
    try {
      const [playerRows] = await db.query<RowDataPacket[]>(
        "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
        [authorId]
      );
      if (Array.isArray(playerRows) && playerRows.length > 0 && playerRows[0]?.username) {
        maintainerName = String(playerRows[0].username).trim();
      }
    } catch {
      // Fallback if player_tbl query fails
    }
  }

  // Fallback to email prefix if username still unavailable
  if (!maintainerName && sessionContext?.user?.email) {
    maintainerName = sessionContext.user.email.split("@")[0].trim();
  }

  return { authorId, maintainerName };
}

/**
 * Server Action: getMaintainerSubmissions
 * Retrieves all submissions authored by current maintainer, ordered newest first.
 * Enforces staff access via requireStaff().
 * Dual-attribution query: matches author_id OR pending_name.
 */
export async function getMaintainerSubmissions(): Promise<MaintainerSubmissionsResult> {
  const staff = await requireStaff();
  if (!staff) {
    throw new Error("Unauthorized: Maintainer or Admin access required.");
  }

  const { authorId, maintainerName } = await resolveMaintainerIdentity(staff.id);

  try {
    const [rows] = await db.query<DbPendingRow[]>(
      `SELECT 
        u.unit_id AS pending_id,
        u.author_id,
        u.unit_title,
        u.sec_id,
        u.status AS pending_status,
        u.pending_note,
        COALESCE(p.username, ua.email, '') AS pending_name
      FROM unit_tbl u
      LEFT JOIN player_tbl p ON u.author_id = p.user_id
      LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
      WHERE (? IS NOT NULL AND u.author_id = ?)
         OR (? != '' AND (p.username = ? OR ua.email = ?))
      ORDER BY u.unit_id DESC`,
      [authorId, authorId, maintainerName, maintainerName, maintainerName]
    );

    const submissions: MaintainerSubmission[] = (Array.isArray(rows) ? rows : []).map((row) => ({
      pending_id: Number(row.pending_id),
      author_id: row.author_id !== null && row.author_id !== undefined ? Number(row.author_id) : null,
      unit_title: String(row.unit_title ?? ""),
      sec_id: Number(row.sec_id ?? 0),
      pending_status: String(row.pending_status ?? "pending"),
      pending_note:
        row.pending_note !== null && row.pending_note !== undefined && row.pending_note !== ""
          ? String(row.pending_note)
          : null,
      pending_name: String(row.pending_name ?? ""),
    }));

    return { submissions };
  } catch (error) {
    console.error("Error fetching maintainer submissions:", error);
    throw new Error("Failed to retrieve maintainer submissions from database.");
  }
}

/**
 * Server Action: getMaintainerStats
 * Returns aggregate counts: approved, pending, rejected, and total submissions.
 * Enforces staff access via requireStaff().
 * Atomic SQL aggregation using conditional counts.
 */
export async function getMaintainerStats(): Promise<MaintainerStats> {
  const staff = await requireStaff();
  if (!staff) {
    throw new Error("Unauthorized: Maintainer or Admin access required.");
  }

  const { authorId, maintainerName } = await resolveMaintainerIdentity(staff.id);

  try {
    const [rows] = await db.query<DbStatsRow[]>(
      `SELECT 
        COUNT(*) AS total,
        COUNT(CASE WHEN u.status = 'approved' THEN 1 END) AS approved,
        COUNT(CASE WHEN u.status = 'pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN u.status = 'rejected' THEN 1 END) AS rejected
      FROM unit_tbl u
      LEFT JOIN player_tbl p ON u.author_id = p.user_id
      LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
      WHERE (? IS NOT NULL AND u.author_id = ?)
         OR (? != '' AND (p.username = ? OR ua.email = ?))`,
      [authorId, authorId, maintainerName, maintainerName, maintainerName]
    );

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    return {
      approved: Number(row?.approved ?? 0),
      pending: Number(row?.pending ?? 0),
      rejected: Number(row?.rejected ?? 0),
      total: Number(row?.total ?? 0),
    };
  } catch (error) {
    console.error("Error fetching maintainer stats:", error);
    throw new Error("Failed to retrieve maintainer stats from database.");
  }
}
