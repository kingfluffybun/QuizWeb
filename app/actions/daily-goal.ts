"use server";

import { db } from "@/lib/db";
import { resolveUserId } from "@/lib/server/session";
import { getAdjacentDate, getAppLocalDate, getSundayWeekDates } from "@/lib/timezone";
import type { RowDataPacket } from "mysql2/promise";
import type { DailyGoalData } from "@/lib/daily-goal";

interface ActivityRow extends RowDataPacket {
    activity_date: string;
    xp: number | string;
}

interface LearningGoalRow extends RowDataPacket {
    learning_goal: number | string | null;
    daily_xp_goal: number | string | null;
}

export async function getDailyGoalData(
    clientToday?: string,
    explicitUserId?: number,
): Promise<DailyGoalData> {
    const userId = await resolveUserId(explicitUserId);
    if (!userId) {
        throw new Error("Authentication required to access the daily XP goal");
    }

    const todayDate = (clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday))
        ? clientToday
        : getAppLocalDate();
    const weekDates = getSundayWeekDates(todayDate);
    const currentWeekStart = weekDates[0];
    const previousWeekStart = getAdjacentDate(currentWeekStart, -7);

    try {
        // Single 14-day scan replaces two separate week-range queries on user_activity_tbl
        const [[activityRows], [goalRows]] = await Promise.all([
            db.query<ActivityRow[]>(
                `SELECT DATE_FORMAT(activity_date, '%Y-%m-%d') AS activity_date,
                        SUM(xp_earned) AS xp
                 FROM user_activity_tbl
                 WHERE user_id = ?
                   AND activity_type <> 'daily_checkin'
                   AND activity_date BETWEEN ? AND ?
                 GROUP BY activity_date`,
                [userId, previousWeekStart, weekDates[6]],
            ),
            db.query<LearningGoalRow[]>(
                `SELECT learning_goal, daily_xp_goal
                 FROM user_auth_tbl
                 WHERE user_id = ?
                 LIMIT 1`,
                [userId],
            ),
        ]);

        const xpByDate = new Map<string, number>();
        let previousWeekXp = 0;
        for (const row of activityRows) {
            const xp = Number(row.xp ?? 0);
            if (row.activity_date < currentWeekStart) {
                previousWeekXp += xp;
            } else {
                xpByDate.set(row.activity_date, xp);
            }
        }

        const weekXp = weekDates.map((date) => xpByDate.get(date) ?? 0);
        const todayIndex = weekDates.indexOf(todayDate);

        if (!Number.isFinite(previousWeekXp) || previousWeekXp < 0) {
            throw new Error("Invalid previous-week XP total");
        }

        const goalRow = goalRows[0];
        if (!goalRow) {
            throw new Error("Unable to find the user's learning goal");
        }
        const dailyGoal = Number(goalRow.learning_goal ?? goalRow.daily_xp_goal ?? 50);
        if (!Number.isSafeInteger(dailyGoal) || dailyGoal < 1) {
            throw new Error("Invalid learning goal");
        }

        return {
            todayXp: todayIndex >= 0 ? weekXp[todayIndex] : 0,
            weekXp,
            weekDates,
            previousWeekXp,
            dailyGoal,
        };
    } catch (error) {
        console.error("Failed to load daily XP goal data:", error);
        throw new Error("Unable to load daily XP goal data");
    }
}
