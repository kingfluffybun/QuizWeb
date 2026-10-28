"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLeaderboardDateRange } from "@/lib/leaderboard-period";
import { getAppLocalDate } from "@/lib/timezone";
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

async function getEntriesForPeriod(
    period: LeaderboardPeriod,
    asOfDate: string,
    limit: number | null = 10,
): Promise<LeaderboardEntry[]> {
    if (!periods.some((validPeriod) => validPeriod === period)) {
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
        const { startDate, endDate } = getLeaderboardDateRange(period, asOfDate);
        const params: (string | number)[] = [startDate, endDate];
        if (limit !== null) params.push(limit);

        const [periodRows] = await db.query<LeaderboardRow[]>(
            `SELECT p.user_id, p.username,
                LEAST(SUM(a.xp_earned), COALESCE(p.xp, 0)) AS xp,
                u.avatar_color
            FROM user_activity_tbl a
            INNER JOIN player_tbl p ON p.user_id = a.user_id
            LEFT JOIN user_auth_tbl u ON p.user_id = u.user_id
            WHERE a.activity_date BETWEEN ? AND ?
                AND a.xp_earned BETWEEN 0 AND CASE WHEN a.activity_type = 'quiz' THEN 500 ELSE 100 END
            GROUP BY p.user_id, p.username, p.xp, u.avatar_color
            ORDER BY xp DESC, p.username ASC, p.user_id ASC
            ${limit === null ? "" : "LIMIT ?"}`,
            params,
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
    asOfDate: string,
): Promise<LeaderboardEntriesByPeriod> => {
    const [daily, weekly, monthly, allTime] = await Promise.all(
        periods.map((period) =>
            getEntriesForPeriod(period, asOfDate, includeAll ? null : 10)
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
    if (!periods.some((validPeriod) => validPeriod === period)) {
        throw new Error("Invalid leaderboard period");
    }
    const asOfDate = getAppLocalDate();
    try {
        const entries = await getCachedLeaderboardEntriesByPeriod(false, asOfDate);
        return entries[period];
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("incrementalCache missing")) {
            const entries = await fetchLeaderboardEntriesByPeriod(false, asOfDate);
            return entries[period];
        }
        throw err;
    }
}

export async function getLeaderboardEntriesByPeriod(
    options: { includeAll?: boolean } = {},
): Promise<LeaderboardEntriesByPeriod> {
    await requireAuthenticatedUser();
    const asOfDate = getAppLocalDate();
    try {
        return await getCachedLeaderboardEntriesByPeriod(Boolean(options.includeAll), asOfDate);
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("incrementalCache missing")) {
            return fetchLeaderboardEntriesByPeriod(Boolean(options.includeAll), asOfDate);
        }
        throw err;
    }
}
