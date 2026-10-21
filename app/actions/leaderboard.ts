"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";

export interface LeaderboardEntry {
    userId: number;
    username: string;
    xp: number;
}

interface LeaderboardRow extends RowDataPacket {
    user_id: number;
    username: string;
    xp: number | string;
}

const periodConditions: Record<LeaderboardPeriod, string> = {
    daily: "a.activity_date = CURDATE()",
    weekly: "a.activity_date >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND a.activity_date <= CURDATE()",
    monthly: "a.activity_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND a.activity_date <= CURDATE()",
    "all-time": "1 = 1",
};

export async function getLeaderboardEntries(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
    if (!Object.hasOwn(periodConditions, period)) {
        throw new Error("Invalid leaderboard period");
    }

    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Authentication required to view the leaderboard");
    }

    const [rows] = await db.query<LeaderboardRow[]>(
        `SELECT p.user_id, p.username, SUM(a.xp_earned) AS xp
         FROM user_activity_tbl a
         INNER JOIN player_tbl p ON p.user_id = a.user_id
         WHERE ${periodConditions[period]}
         GROUP BY p.user_id, p.username
         ORDER BY SUM(a.xp_earned) DESC, p.username ASC, p.user_id ASC
         LIMIT 10`
    );

    return rows.map((row) => ({
        userId: Number(row.user_id),
        username: row.username,
        xp: Number(row.xp),
    }));
}
