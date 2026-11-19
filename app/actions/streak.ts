"use server";

import { db } from "@/lib/db";
import { invalidateLeaderboardCache } from "@/app/actions/leaderboard";
import { resolveUserId } from "@/lib/server/session";
import { getAdjacentDate, getAppLocalDate, getSundayWeekDates } from "@/lib/timezone";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

const WEEK_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEK_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface WeekDayStatus {
    date: string; // YYYY-MM-DD
    dayOfWeek: number; // 0..6 (0=Sun, 6=Sat)
    dayLetter: string; // 'S' | 'M' | 'T' | 'W' | 'T' | 'F' | 'S'
    dayName: string; // 'Sun' | 'Mon' ...
    isActive: boolean;
    isToday: boolean;
}

export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    todayCompleted: boolean;
    activeDatesInMonth: number[]; // Day numbers active in target month e.g. [1, 2, 19]
    allActiveDates: string[]; // YYYY-MM-DD
    weekDays: WeekDayStatus[];
    targetMonth: number; // 1..12
    targetYear: number;
    todayDate: string; // YYYY-MM-DD
}

function getDaysBetween(d1Str: string, d2Str: string): number {
    const t1 = Date.parse(d1Str + "T00:00:00Z");
    const t2 = Date.parse(d2Str + "T00:00:00Z");
    return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function computeStreaks(sortedDatesAsc: string[], todayStr: string): { currentStreak: number; longestStreak: number } {
    if (sortedDatesAsc.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
    }

    const dateSet = new Set(sortedDatesAsc);
    const yesterdayStr = getAdjacentDate(todayStr, -1);

    // Current streak:
    // If today is completed, count backwards starting today.
    // If today is not completed, but yesterday was, count backwards starting yesterday.
    // If neither, current streak is 0.
    let currentStreak = 0;
    let anchorDate: string | null = null;

    if (dateSet.has(todayStr)) {
        anchorDate = todayStr;
    } else if (dateSet.has(yesterdayStr)) {
        anchorDate = yesterdayStr;
    }

    if (anchorDate) {
        let checkDate = anchorDate;
        while (dateSet.has(checkDate)) {
            currentStreak += 1;
            checkDate = getAdjacentDate(checkDate, -1);
        }
    }

    // Longest streak across all recorded history:
    let longestStreak = 0;
    let currentRun = 0;
    let previousDate: string | null = null;

    for (const d of sortedDatesAsc) {
        if (!previousDate) {
            currentRun = 1;
        } else {
            const diff = getDaysBetween(previousDate, d);
            if (diff === 1) {
                currentRun += 1;
            } else if (diff > 1) {
                currentRun = 1;
            }
        }
        if (currentRun > longestStreak) {
            longestStreak = currentRun;
        }
        previousDate = d;
    }

    return { currentStreak, longestStreak };
}

function buildWeekDays(
    sundayWeekDates: string[],
    todayDate: string,
    activeDateSet?: Set<string>,
): WeekDayStatus[] {
    return sundayWeekDates.map((date, i) => ({
        date,
        dayOfWeek: i,
        dayLetter: WEEK_LETTERS[i],
        dayName: WEEK_NAMES[i],
        isActive: activeDateSet ? activeDateSet.has(date) : false,
        isToday: date === todayDate,
    }));
}

export async function getUserStreakData(
    targetYear?: number,
    targetMonth?: number,
    clientToday?: string,
    explicitUserId?: number,
): Promise<StreakData> {
    // Use clientToday if valid YYYY-MM-DD, otherwise default to application local date (Asia/Manila)
    const todayDate = (clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday))
        ? clientToday
        : getAppLocalDate();

    const [todayYearStr, todayMonthStr] = todayDate.split("-");
    const resolvedYear = targetYear ?? Number(todayYearStr);
    const resolvedMonth = targetMonth ?? Number(todayMonthStr);
    const sundayWeekDates = getSundayWeekDates(todayDate);

    const emptyResult: StreakData = {
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        todayCompleted: false,
        activeDatesInMonth: [],
        allActiveDates: [],
        weekDays: buildWeekDays(sundayWeekDates, todayDate),
        targetMonth: resolvedMonth,
        targetYear: resolvedYear,
        todayDate,
    };

    const userId = await resolveUserId(explicitUserId);
    if (!userId) {
        return emptyResult;
    }

    try {
        const targetDaysInMonth = new Date(Date.UTC(resolvedYear, resolvedMonth, 0)).getUTCDate();
        const targetMonthStart = `${resolvedYear}-${String(resolvedMonth).padStart(2, "0")}-01`;
        const targetMonthEnd = `${resolvedYear}-${String(resolvedMonth).padStart(2, "0")}-${String(targetDaysInMonth).padStart(2, "0")}`;

        // Look up player record to leverage persisted streaks and bound lookback window
        const [playerRows] = await db.query<RowDataPacket[]>(
            `SELECT current_streak, max_streak, last_quiz_date 
             FROM player_tbl 
             WHERE user_id = ? LIMIT 1`,
            [userId]
        );
        const playerCurrentStreak = Number(playerRows[0]?.current_streak ?? 0);
        const playerMaxStreak = Number(playerRows[0]?.max_streak ?? 0);

        // Bounded window: cover at least 60 days (or enough for the active streak) plus target month
        const streakLookbackDays = Math.max(playerCurrentStreak + 7, 60);
        const streakWindowStart = getAdjacentDate(todayDate, -streakLookbackDays);

        // Determine whether target month and streak lookback intervals overlap/touch
        const intervalsOverlap = targetMonthStart <= todayDate && targetMonthEnd >= streakWindowStart;

        let activityQuery: string;
        let activityParams: (number | string)[];

        if (intervalsOverlap) {
            const rangeStart = targetMonthStart < streakWindowStart ? targetMonthStart : streakWindowStart;
            const rangeEnd = targetMonthEnd > todayDate ? targetMonthEnd : todayDate;
            activityQuery = `
                SELECT DISTINCT DATE_FORMAT(activity_date, '%Y-%m-%d') as act_date 
                FROM user_activity_tbl 
                WHERE user_id = ? 
                  AND activity_date >= ? 
                  AND activity_date <= ?
                ORDER BY act_date ASC
            `;
            activityParams = [userId, rangeStart, rangeEnd];
        } else {
            // Disjoint intervals: order chronologically for optimal index scan
            const isTargetInPast = targetMonthEnd < streakWindowStart;
            const [firstStart, firstEnd, secondStart, secondEnd] = isTargetInPast
                ? [targetMonthStart, targetMonthEnd, streakWindowStart, todayDate]
                : [streakWindowStart, todayDate, targetMonthStart, targetMonthEnd];

            activityQuery = `
                SELECT DISTINCT DATE_FORMAT(activity_date, '%Y-%m-%d') as act_date 
                FROM user_activity_tbl 
                WHERE user_id = ? 
                  AND (
                    (activity_date >= ? AND activity_date <= ?)
                    OR
                    (activity_date >= ? AND activity_date <= ?)
                  )
                ORDER BY act_date ASC
            `;
            activityParams = [userId, firstStart, firstEnd, secondStart, secondEnd];
        }

        const [[countRows], [activityRows]] = await Promise.all([
            db.query<RowDataPacket[]>(
                "SELECT COUNT(DISTINCT activity_date) as total_count FROM user_activity_tbl WHERE user_id = ?",
                [userId]
            ),
            db.query<RowDataPacket[]>(activityQuery, activityParams),
        ]);

        const totalActiveDays = Number(countRows[0]?.total_count ?? activityRows.length);
        const allActiveDates: string[] = activityRows.map((r) => r.act_date as string);
        const activeDateSet = new Set(allActiveDates);

        const computed = computeStreaks(allActiveDates, todayDate);
        const todayCompleted = activeDateSet.has(todayDate);
        const yesterdayCompleted = activeDateSet.has(getAdjacentDate(todayDate, -1));

        // Streak is only alive if today or yesterday had activity (computed from true activity dates)
        const currentStreak = (todayCompleted || yesterdayCompleted) ? computed.currentStreak : 0;
        const longestStreak = Math.max(playerMaxStreak, computed.longestStreak, currentStreak);

        // Keep player_tbl synchronized with true activity-based streak
        if (playerCurrentStreak !== currentStreak || playerMaxStreak < longestStreak) {
            try {
                await db.query<ResultSetHeader>(
                    `UPDATE player_tbl
                     SET current_streak = ?,
                         max_streak = GREATEST(COALESCE(max_streak, 0), ?)
                     WHERE user_id = ?`,
                    [currentStreak, longestStreak, userId],
                );
            } catch (err) {
                console.error("Failed to sync player streak in getUserStreakData:", err);
            }
        }

        // Find active days in the target year & month
        const monthPrefix = `${resolvedYear}-${String(resolvedMonth).padStart(2, "0")}-`;
        const activeDatesInMonth: number[] = [];
        for (const date of allActiveDates) {
            if (date.startsWith(monthPrefix)) {
                const dayNum = Number(date.slice(8, 10));
                if (!Number.isNaN(dayNum)) {
                    activeDatesInMonth.push(dayNum);
                }
            }
        }

        const weekDays = buildWeekDays(sundayWeekDates, todayDate, activeDateSet);

        return {
            currentStreak,
            longestStreak,
            totalActiveDays,
            todayCompleted,
            activeDatesInMonth,
            allActiveDates,
            weekDays,
            targetMonth: resolvedMonth,
            targetYear: resolvedYear,
            todayDate,
        };
    } catch (err) {
        console.error("Failed to query user streak data:", err);
        return emptyResult;
    }
}

export async function recordUserActivity(options?: {
    type?: string;
    xp?: number;
    date?: string;
    userId?: number;
}): Promise<{ success: boolean; streak?: number; message?: string; error?: string }> {
    const userId = await resolveUserId(options?.userId);
    if (!userId) {
        return { success: false, error: "Authentication required to log activity" };
    }

    const activityType = options?.type ?? "quiz";
    // Cap activity XP to prevent client-side tampering (0 - 100 XP per activity)
    const xpEarned = typeof options?.xp === "number" ? Math.min(Math.max(0, options.xp), 100) : 4;
    const activityDate = (options?.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date))
        ? options.date
        : getAppLocalDate();

    try {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query<ResultSetHeader>(
                `INSERT INTO user_activity_tbl (user_id, activity_date, activity_type, xp_earned)
                 VALUES (?, ?, ?, ?)`,
                [userId, activityDate, activityType, xpEarned],
            );
            await connection.query<ResultSetHeader>(
                `UPDATE player_tbl
                 SET xp = COALESCE(xp, 0) + ?,
                     last_quiz_date = IF(? = 'quiz', ?, last_quiz_date)
                 WHERE user_id = ?`,
                [xpEarned, activityType, activityDate, userId],
            );
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        await invalidateLeaderboardCache();

        const streakData = await getUserStreakData(undefined, undefined, activityDate, userId);

        return {
            success: true,
            streak: streakData.currentStreak,
            message: "Activity logged successfully",
        };
    } catch (err) {
        console.error("Failed to record user activity:", err);
        return { success: false, error: "Failed to save activity" };
    }
}

export async function recordQuizCompletion(options: {
    xpEarned: number;
    currentStreak?: number;
    bestStreak?: number;
    date?: string;
}): Promise<{ success: boolean; error?: string }> {
    const userId = await resolveUserId();
    if (!userId) {
        return { success: false, error: "Authentication required to save quiz results" };
    }

    if (!Number.isSafeInteger(options.xpEarned) || options.xpEarned < 0) {
        return { success: false, error: "Invalid quiz result values" };
    }

    // Cap quiz XP to prevent client-side tampering (0 - 500 XP per quiz)
    const validatedXp = Math.min(Math.max(0, options.xpEarned), 500);
    const activityDate = (options.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date))
        ? options.date
        : getAppLocalDate();

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query<ResultSetHeader>(
            `INSERT INTO user_activity_tbl (user_id, activity_date, activity_type, xp_earned)
             VALUES (?, ?, 'quiz', ?)`,
            [userId, activityDate, validatedXp],
        );
        await connection.query<ResultSetHeader>(
            `UPDATE player_tbl
             SET xp = COALESCE(xp, 0) + ?,
                 last_quiz_date = ?
             WHERE user_id = ?`,
            [validatedXp, activityDate, userId],
        );
        await connection.commit();
        await invalidateLeaderboardCache();

        await getUserStreakData(undefined, undefined, activityDate, userId);
        return { success: true };
    } catch (err) {
        await connection.rollback();
        console.error("Failed to record quiz completion:", err);
        return { success: false, error: "Failed to save quiz results" };
    } finally {
        connection.release();
    }
}
