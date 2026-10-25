"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { unstable_cache, updateTag, revalidateTag } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";

export interface LeaderboardEntry {
    userId: number;
    username: string;
    xp: number;
    avatar_color?: string;
}

export type LeaderboardEntriesByPeriod = Record<LeaderboardPeriod, LeaderboardEntry[]>;

interface LeaderboardRow extends RowDataPacket {
    user_id: number;
    username: string;
    xp: number | string;
    avatar_color?: string;
}

const periods: LeaderboardPeriod[] = ["daily", "weekly", "monthly", "all-time"];

const periodConditions: Record<LeaderboardPeriod, string> = {
    daily: "a.activity_date = CURDATE()",
    weekly: "a.activity_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND a.activity_date <= CURDATE()",
    monthly: "a.activity_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND a.activity_date <= CURDATE()",
    "all-time": "1 = 1",
};

async function getEntriesForPeriod(
    period: LeaderboardPeriod,
    limit: number | null = 10,
): Promise<LeaderboardEntry[]> {
    if (!Object.hasOwn(periodConditions, period)) {
        throw new Error("Invalid leaderboard period");
    }

    let rows: LeaderboardRow[];

    if (period === "all-time") {
        const [allTimeRows] = await db.query<LeaderboardRow[]>(
            `SELECT p.user_id, p.username, p.xp, u.avatar_color
            FROM player_tbl p
            LEFT JOIN user_auth_tbl u ON p.user_id = u.user_id
            WHERE p.xp > 0
            ORDER BY p.xp DESC, p.username ASC, p.user_id ASC
            ${limit === null ? "" : "LIMIT ?"}`,
            limit === null ? [] : [limit],
        );
        rows = allTimeRows;
    } else {
        const [periodRows] = await db.query<LeaderboardRow[]>(
            `SELECT p.user_id, p.username, SUM(a.xp_earned) AS xp, u.avatar_color
            FROM user_activity_tbl a
            INNER JOIN player_tbl p ON p.user_id = a.user_id
            LEFT JOIN user_auth_tbl u ON p.user_id = u.user_id
            WHERE ${periodConditions[period]}
            GROUP BY p.user_id, p.username, u.avatar_color
            ORDER BY SUM(a.xp_earned) DESC, p.username ASC, p.user_id ASC
            ${limit === null ? "" : "LIMIT ?"}`,
            limit === null ? [] : [limit],
        );
        rows = periodRows;
    }

    return rows.map((row) => ({
        userId: Number(row.user_id),
        username: row.username,
        xp: Number(row.xp),
        avatar_color: row.avatar_color,
    }));
}

async function requireAuthenticatedUser(): Promise<void> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Authentication required to view the leaderboard");
    }
}

const fetchLeaderboardEntriesByPeriod = async (
    includeAll: boolean,
): Promise<LeaderboardEntriesByPeriod> => {
    const [daily, weekly, monthly, allTime] = await Promise.all(
        periods.map((period) =>
            getEntriesForPeriod(period, includeAll ? null : 10)
        )
    );

    return {
        daily,
        weekly,
        monthly,
        "all-time": allTime,
    };
};

const getCachedLeaderboardEntriesByPeriod = unstable_cache(
    fetchLeaderboardEntriesByPeriod,
    ["leaderboard-entries-by-period"],
    {
        revalidate: 60,
        tags: ["leaderboard"],
    }
);

export async function invalidateLeaderboardCache(): Promise<void> {
    try {
        updateTag("leaderboard");
    } catch {
        try {
            revalidateTag("leaderboard", { expire: 0 });
        } catch {
            // Silently ignore if invoked outside Next.js request/action context (e.g. tests)
        }
    }
}

export async function getLeaderboardEntries(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
    await requireAuthenticatedUser();
    if (!Object.hasOwn(periodConditions, period)) {
        throw new Error("Invalid leaderboard period");
    }
    try {
        const entries = await getCachedLeaderboardEntriesByPeriod(false);
        return entries[period];
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("incrementalCache missing")) {
            const entries = await fetchLeaderboardEntriesByPeriod(false);
            return entries[period];
        }
        throw err;
    }
}

export async function getLeaderboardEntriesByPeriod(
    options: { includeAll?: boolean } = {},
): Promise<LeaderboardEntriesByPeriod> {
    await requireAuthenticatedUser();
    try {
        return await getCachedLeaderboardEntriesByPeriod(Boolean(options.includeAll));
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("incrementalCache missing")) {
            return fetchLeaderboardEntriesByPeriod(Boolean(options.includeAll));
        }
        throw err;
    }
}
