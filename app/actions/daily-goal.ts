"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type { DailyGoalData } from "@/lib/daily-goal";

interface ActivityRow extends RowDataPacket {
    activity_date: string;
    xp: number | string;
}

function getUtcWeekDates(today: Date): string[] {
    const sunday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(sunday);
        date.setUTCDate(sunday.getUTCDate() + index);
        return date.toISOString().slice(0, 10);
    });
}

function getAuthenticatedUserId(userId: string | undefined): number {
    const id = Number(userId);
    if (!userId || !Number.isSafeInteger(id) || id <= 0) {
        throw new Error("Authentication required to access the daily XP goal");
    }
    return id;
}

export async function getDailyGoalData(): Promise<DailyGoalData> {
    const session = await auth();
    const userId = getAuthenticatedUserId(session?.user?.id);
    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10);
    const weekDates = getUtcWeekDates(today);

    try {
        const [activityRows] = await db.query<ActivityRow[]>(
            `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date,
                    SUM(xp_earned) AS xp
             FROM user_activity_tbl
             WHERE user_id = ?
               AND activity_type <> 'daily_checkin'
               AND activity_date BETWEEN ? AND ?
             GROUP BY activity_date`,
            [userId, weekDates[0], weekDates[6]],
        );
        const xpByDate = new Map(
            activityRows.map((row) => [row.activity_date, Number(row.xp)]),
        );
        const weekXp = weekDates.map((date) => xpByDate.get(date) ?? 0);
        const todayIndex = weekDates.indexOf(todayDate);

        return {
            todayXp: todayIndex >= 0 ? weekXp[todayIndex] : 0,
            weekXp,
            weekDates,
        };
    } catch (error) {
        console.error("Failed to load daily XP goal data:", error);
        throw new Error("Unable to load daily XP goal data");
    }
}
