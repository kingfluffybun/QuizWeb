"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAppLocalDate } from "@/lib/timezone";
import type { RowDataPacket } from "mysql2/promise";
import type { DailyGoalData } from "@/lib/daily-goal";

interface ActivityRow extends RowDataPacket {
    activity_date: string;
    xp: number | string;
}

interface TotalXpRow extends RowDataPacket {
    xp: number | string;
}

function getWeekDates(todayDateStr: string, offsetWeeks = 0): string[] {
    const d = new Date(todayDateStr + "T00:00:00Z");
    const dayOfWeek = d.getUTCDay();
    const sunday = new Date(d);
    sunday.setUTCDate(sunday.getUTCDate() - dayOfWeek + offsetWeeks * 7);

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

export async function getDailyGoalData(clientToday?: string): Promise<DailyGoalData> {
    const session = await auth();
    const userId = getAuthenticatedUserId(session?.user?.id);
    const todayDate = (clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday))
        ? clientToday
        : getAppLocalDate();
    const weekDates = getWeekDates(todayDate);
    const previousWeekDates = getWeekDates(todayDate, -1);

    try {
        const [[activityRows], [previousWeekTotalRows]] = await Promise.all([
            db.query<ActivityRow[]>(
                `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date,
                        SUM(xp_earned) AS xp
                 FROM user_activity_tbl
                 WHERE user_id = ?
                   AND activity_type <> 'daily_checkin'
                   AND activity_date BETWEEN ? AND ?
                 GROUP BY activity_date`,
                [userId, weekDates[0], weekDates[6]],
            ),
            db.query<TotalXpRow[]>(
                `SELECT COALESCE(SUM(xp_earned), 0) AS xp
                 FROM user_activity_tbl
                 WHERE user_id = ?
                   AND activity_type <> 'daily_checkin'
                   AND activity_date BETWEEN ? AND ?`,
                [userId, previousWeekDates[0], previousWeekDates[6]],
            ),
        ]);
        const xpByDate = new Map(
            activityRows.map((row) => [row.activity_date, Number(row.xp)]),
        );
        const weekXp = weekDates.map((date) => xpByDate.get(date) ?? 0);
        const todayIndex = weekDates.indexOf(todayDate);
        const previousWeekXp = Number(previousWeekTotalRows[0]?.xp ?? 0);

        if (!Number.isFinite(previousWeekXp) || previousWeekXp < 0) {
            throw new Error("Invalid previous-week XP total");
        }

        return {
            todayXp: todayIndex >= 0 ? weekXp[todayIndex] : 0,
            weekXp,
            weekDates,
            previousWeekXp,
        };
    } catch (error) {
        console.error("Failed to load daily XP goal data:", error);
        throw new Error("Unable to load daily XP goal data");
    }
}
