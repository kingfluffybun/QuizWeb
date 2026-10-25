"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { invalidateLeaderboardCache } from "@/app/actions/leaderboard";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

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

function getAdjacentDate(dateStr: string, dayOffset: number): string {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return d.toISOString().slice(0, 10);
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

export async function getUserStreakData(
    targetYear?: number,
    targetMonth?: number,
    clientToday?: string
): Promise<StreakData> {
    const session = await auth();
    const now = new Date();

    // Use clientToday if valid YYYY-MM-DD, otherwise default to server UTC date
    const todayDate = (clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday))
        ? clientToday
        : now.toISOString().slice(0, 10);

    const [todayYearStr, todayMonthStr] = todayDate.split("-");
    const resolvedYear = targetYear ?? Number(todayYearStr);
    const resolvedMonth = targetMonth ?? Number(todayMonthStr);

    const emptyWeekDays: WeekDayStatus[] = (() => {
        const d = new Date(todayDate + "T00:00:00Z");
        const dayOfWeek = d.getUTCDay();
        const sundayStr = getAdjacentDate(todayDate, -dayOfWeek);
        const letters = ["S", "M", "T", "W", "T", "F", "S"];
        const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        return Array.from({ length: 7 }, (_, i) => {
            const date = getAdjacentDate(sundayStr, i);
            return {
                date,
                dayOfWeek: i,
                dayLetter: letters[i],
                dayName: names[i],
                isActive: false,
                isToday: date === todayDate,
            };
        });
    })();

    const emptyResult: StreakData = {
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        todayCompleted: false,
        activeDatesInMonth: [],
        allActiveDates: [],
        weekDays: emptyWeekDays,
        targetMonth: resolvedMonth,
        targetYear: resolvedYear,
        todayDate,
    };

    if (!session?.user?.id) {
        return emptyResult;
    }

    const userId = Number(session.user.id);
    if (!Number.isFinite(userId) || userId <= 0) {
        return emptyResult;
    }

    try {
        const d = new Date(todayDate + "T00:00:00Z");
        const dayOfWeek = d.getUTCDay();
        const sundayStr = getAdjacentDate(todayDate, -dayOfWeek);

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

        // Streak is only alive if today or yesterday had activity
        let currentStreak = 0;
        if (todayCompleted || yesterdayCompleted) {
            currentStreak = Math.max(computed.currentStreak, playerCurrentStreak);
        }

        const longestStreak = Math.max(playerMaxStreak, computed.longestStreak, currentStreak);

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

        // Build week days status
        const letters = ["S", "M", "T", "W", "T", "F", "S"];
        const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        const weekDays: WeekDayStatus[] = Array.from({ length: 7 }, (_, i) => {
            const date = getAdjacentDate(sundayStr, i);
            return {
                date,
                dayOfWeek: i,
                dayLetter: letters[i],
                dayName: names[i],
                isActive: activeDateSet.has(date),
                isToday: date === todayDate,
            };
        });

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

export async function getMonthActivity(
    year: number,
    month: number
): Promise<{ success: boolean; activeDays: number[]; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, activeDays: [], error: "Unauthorized" };
    }

    const userId = Number(session.user.id);
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT DISTINCT DATE_FORMAT(activity_date, '%Y-%m-%d') as act_date 
             FROM user_activity_tbl 
             WHERE user_id = ? AND activity_date >= ? AND activity_date <= LAST_DAY(?)
             ORDER BY act_date ASC`,
            [userId, `${monthPrefix}01`, `${monthPrefix}01`]
        );

        const activeDays = rows
            .map((r) => Number((r.act_date as string).slice(8, 10)))
            .filter((n) => !Number.isNaN(n));

        return { success: true, activeDays };
    } catch (err) {
        console.error("Failed to query month activity:", err);
        return { success: false, activeDays: [], error: "Database query failed" };
    }
}

export async function recordUserActivity(options?: {
    type?: string;
    xp?: number;
    date?: string;
}): Promise<{ success: boolean; streak?: number; message?: string; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required to log activity" };
    }

    const userId = Number(session.user.id);
    if (!Number.isFinite(userId) || userId <= 0) {
        return { success: false, error: "Invalid user session" };
    }

    const activityType = options?.type ?? "quiz";
    // Cap activity XP to prevent client-side tampering (0 - 100 XP per activity)
    const xpEarned = typeof options?.xp === "number" ? Math.min(Math.max(0, options.xp), 100) : 4;
    const activityDate = (options?.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date))
        ? options.date
        : new Date().toISOString().slice(0, 10);

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

        const streakData = await getUserStreakData(undefined, undefined, activityDate);

        // Keep player_tbl current_streak and max_streak synchronized
        try {
            await db.query<ResultSetHeader>(
                `UPDATE player_tbl
                 SET current_streak = ?,
                     max_streak = GREATEST(COALESCE(max_streak, 0), ?)
                 WHERE user_id = ?`,
                [streakData.currentStreak, streakData.longestStreak, userId],
            );
        } catch (err) {
            console.error("Failed to sync player streak in recordUserActivity:", err);
        }

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

function isValidQuizStreak(currentStreak: number, bestStreak: number): boolean {
    return Number.isSafeInteger(currentStreak)
        && Number.isSafeInteger(bestStreak)
        && currentStreak >= 0
        && bestStreak >= currentStreak;
}

export async function updatePlayerQuizStreak(
    currentStreak: number,
    bestStreak: number,
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required to save quiz streak" };
    }

    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return { success: false, error: "Invalid user session" };
    }
    if (!isValidQuizStreak(currentStreak, bestStreak)) {
        return { success: false, error: "Invalid quiz streak values" };
    }

    try {
        await db.query<ResultSetHeader>(
            `UPDATE player_tbl
             SET current_streak = ?, max_streak = GREATEST(max_streak, ?)
             WHERE user_id = ?`,
            [currentStreak, bestStreak, userId],
        );
        return { success: true };
    } catch (err) {
        console.error("Failed to update player quiz streak:", err);
        return { success: false, error: "Failed to save quiz streak" };
    }
}

export async function recordQuizCompletion(options: {
    xpEarned: number;
    currentStreak: number;
    bestStreak: number;
}): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Authentication required to save quiz results" };
    }

    const userId = Number(session.user.id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return { success: false, error: "Invalid user session" };
    }
    if (
        !Number.isSafeInteger(options.xpEarned)
        || options.xpEarned < 0
        || !isValidQuizStreak(options.currentStreak, options.bestStreak)
    ) {
        return { success: false, error: "Invalid quiz result values" };
    }

    // Cap quiz XP to prevent client-side tampering (0 - 500 XP per quiz)
    const validatedXp = Math.min(Math.max(0, options.xpEarned), 500);

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query<ResultSetHeader>(
            `INSERT INTO user_activity_tbl (user_id, activity_date, activity_type, xp_earned)
             VALUES (?, CURRENT_DATE, 'quiz', ?)`,
            [userId, validatedXp],
        );
        await connection.query<ResultSetHeader>(
            `UPDATE player_tbl
             SET xp = COALESCE(xp, 0) + ?,
                 current_streak = ?,
                 max_streak = GREATEST(COALESCE(max_streak, 0), ?),
                 last_quiz_date = CURRENT_DATE
             WHERE user_id = ?`,
            [validatedXp, options.currentStreak, options.bestStreak, userId],
        );
        await connection.commit();
        await invalidateLeaderboardCache();
        return { success: true };
    } catch (err) {
        await connection.rollback();
        console.error("Failed to record quiz completion:", err);
        return { success: false, error: "Failed to save quiz results" };
    } finally {
        connection.release();
    }
}
