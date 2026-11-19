"use server";

import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/rbac";
import { getSessionContext } from "@/lib/server/session";

export interface MaintainerSubmission {
  pending_id: number;
  author_id: number | null;
  unit_title: string;
  sec_id: number;
  pending_status: string;
  pending_note: string | null;
  pending_name: string;
}

export interface MaintainerStats {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface MaintainerSubmissionsResult {
  submissions: MaintainerSubmission[];
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

async function resolveMaintainerIdentity(staffId: string | number): Promise<{
  authorId: number | null;
  maintainerName: string;
}> {
  const numericId = Number(staffId);
  const authorId = Number.isFinite(numericId) ? numericId : null;

  const sessionContext = await getSessionContext();
  let maintainerName = (sessionContext.name || "").trim();

  if (!maintainerName && authorId !== null) {
    try {
      const [playerRows] = await db.query<RowDataPacket[]>(
        "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
        [authorId],
      );
      if (Array.isArray(playerRows) && playerRows.length > 0 && playerRows[0]?.username) {
        maintainerName = String(playerRows[0].username).trim();
      }
    } catch {
      // Fallback if player_tbl query fails
    }
  }

  if (!maintainerName && sessionContext.email) {
    maintainerName = sessionContext.email.split("@")[0].trim();
  }

  return { authorId, maintainerName };
}

function buildAuthorFilter(
  authorId: number | null,
  maintainerName: string,
): { whereSql: string; params: Array<number | string> } {
  const predicates: string[] = [];
  const params: Array<number | string> = [];

  if (authorId !== null) {
    predicates.push("u.author_id = ?");
    params.push(authorId);
  }
  if (maintainerName) {
    predicates.push("p.username = ?");
    predicates.push("ua.email = ?");
    params.push(maintainerName, maintainerName);
  }

  if (predicates.length === 0) {
    return { whereSql: "1 = 0", params: [] };
  }

  return { whereSql: predicates.join(" OR "), params };
}

/**
 * Server Action: getMaintainerSubmissions
 * Retrieves all submissions authored by current maintainer, ordered newest first.
 * Enforces staff access via requireStaff().
 */
export async function getMaintainerSubmissions(): Promise<MaintainerSubmissionsResult> {
  const staff = await requireStaff();
  if (!staff) {
    throw new Error("Unauthorized: Maintainer or Admin access required.");
  }

  const { authorId, maintainerName } = await resolveMaintainerIdentity(staff.id);
  const { whereSql, params } = buildAuthorFilter(authorId, maintainerName);

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
      WHERE ${whereSql}
      ORDER BY u.unit_id DESC`,
      params,
    );

    const submissions: MaintainerSubmission[] = (Array.isArray(rows) ? rows : []).map((row) => ({
      pending_id: Number(row.pending_id),
      author_id:
        row.author_id !== null && row.author_id !== undefined ? Number(row.author_id) : null,
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
 */
export async function getMaintainerStats(): Promise<MaintainerStats> {
  const staff = await requireStaff();
  if (!staff) {
    throw new Error("Unauthorized: Maintainer or Admin access required.");
  }

  const { authorId, maintainerName } = await resolveMaintainerIdentity(staff.id);
  const { whereSql, params } = buildAuthorFilter(authorId, maintainerName);

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
      WHERE ${whereSql}`,
      params,
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
