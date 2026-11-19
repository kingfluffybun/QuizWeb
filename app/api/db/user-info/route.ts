import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { auth, invalidateUserAuthCache } from "@/auth";
import { USERNAME_REGEX } from "@/lib/server/crypto";
import {
    getAdjacentDate,
    getAppLocalDate,
    getSundayWeekStart,
} from "@/lib/timezone";

export interface UserInfoResponse {
    user_id?: number;
    email?: string;
    username?: string;
    user_role?: string;
    avatar_color?: string;
    daily_xp_goal?: number;
    learning_goal?: number;
    xp?: number;
    current_streak?: number;
    max_streak?: number;
    lessons_completed?: number;
    lessons_completed_this_week?: number;
    xp_earned_this_week?: number;
    created_at?: string;
    completed_lessons?: number;
}

export const GET = async (req?: Request): Promise<Response> => {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let isMinimal = false;
        if (req?.url) {
            try {
                isMinimal = new URL(req.url).searchParams.get("minimal") === "1";
            } catch {
                // Ignore invalid URL in non-HTTP invocation
            }
        }

        if (isMinimal) {
            const [rows] = await db.query<RowDataPacket[]>(
                `SELECT u.user_id, u.email, p.username, u.user_role, u.avatar_color
                 FROM user_auth_tbl u
                 LEFT JOIN player_tbl p ON u.user_id = p.user_id
                 WHERE u.email = ?
                 LIMIT 1`,
                [session.user.email],
            );
            const user = rows[0];
            if (!user) {
                return Response.json({ error: "User not found" }, { status: 404 });
            }
            return Response.json({
                user_id: Number(user.user_id),
                email: user.email,
                username: user.username ?? undefined,
                user_role: user.user_role ?? "user",
                avatar_color: user.avatar_color ?? "#BFB8FF",
            });
        }

        const todayDate = getAppLocalDate();
        const weekStart = getSundayWeekStart(todayDate);
        const nextDay = getAdjacentDate(todayDate, 1);

        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT
                u.user_id,
                u.email,
                p.username,
                u.user_role,
                u.avatar_color,
                u.daily_xp_goal,
                u.learning_goal,
                u.created_at,
                p.xp,
                p.current_streak,
                p.max_streak,
                (
                    SELECT COUNT(*)
                    FROM user_lesson_progress_tbl lp
                    WHERE lp.user_id = u.user_id AND lp.is_completed = 1
                ) AS lessons_completed,
                (
                    SELECT COUNT(*)
                    FROM user_lesson_progress_tbl lp
                    WHERE lp.user_id = u.user_id
                      AND lp.is_completed = 1
                      AND lp.completed_at >= ?
                      AND lp.completed_at < ?
                ) AS lessons_completed_this_week,
                (
                    SELECT COALESCE(SUM(a.xp_earned), 0)
                    FROM user_activity_tbl a
                    WHERE a.user_id = u.user_id
                      AND a.activity_date BETWEEN ? AND ?
                ) AS xp_earned_this_week
            FROM user_auth_tbl u
            LEFT JOIN player_tbl p ON u.user_id = p.user_id
            WHERE u.email = ?
            LIMIT 1`,
            [
                `${weekStart} 00:00:00`,
                `${nextDay} 00:00:00`,
                weekStart,
                todayDate,
                session.user.email,
            ],
        );

        const user = rows[0];
        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        const dailyGoal = Number(user.learning_goal ?? user.daily_xp_goal ?? 50);
        return Response.json({
            ...user,
            daily_xp_goal: dailyGoal,
            learning_goal: dailyGoal,
            completed_lessons: Number(user.lessons_completed ?? 0),
            lessons_completed: Number(user.lessons_completed ?? 0),
            lessons_completed_this_week: Number(user.lessons_completed_this_week ?? 0),
            xp: Number(user.xp ?? 0),
            xp_earned_this_week: Number(user.xp_earned_this_week ?? 0),
            created_at: user.created_at
                ? new Date(String(user.created_at)).toISOString()
                : undefined,
        });
    } catch (error) {
        console.error("Error fetching user info:", error);
        return Response.json(
            { error: "Failed to fetch user info" },
            { status: 500 },
        );
    }
};

export const POST = async (req: Request): Promise<Response> => {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
        let bodyObj: Record<string, unknown>;

        if (contentType.includes("application/json")) {
            try {
                bodyObj = (await req.json()) as Record<string, unknown>;
            } catch {
                return Response.json({ error: "Invalid JSON body" }, { status: 400 });
            }
        } else {
            const formData = await req.formData();
            bodyObj = {
                username: (formData.get("username") as string) ?? undefined,
                learning_goal:
                    (formData.get("learningGoal") as string) ??
                    (formData.get("learning_goal") as string) ??
                    undefined,
                daily_xp_goal: (formData.get("daily_xp_goal") as string) ?? undefined,
            };
        }

        const { username, learning_goal, daily_xp_goal } = bodyObj;

        const [userRows] = await db.query<RowDataPacket[]>(
            `SELECT u.user_id, u.daily_xp_goal, u.learning_goal, p.username
             FROM user_auth_tbl u
             LEFT JOIN player_tbl p ON u.user_id = p.user_id
             WHERE u.email = ?
             LIMIT 1`,
            [session.user.email],
        );

        if (!userRows?.length) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        const userId = Number(userRows[0].user_id);
        const currentUsername = String(userRows[0].username ?? "");
        const currentGoal = Number(
            userRows[0].learning_goal ?? userRows[0].daily_xp_goal ?? 50,
        );

        let nextUsername: string | null = null;
        if (username !== undefined && username !== null) {
            const trimmedUsername = String(username).trim();
            if (trimmedUsername !== currentUsername) {
                if (!USERNAME_REGEX.test(trimmedUsername)) {
                    return Response.json(
                        {
                            error: "Username must be 3-30 characters long and contain only letters, numbers, spaces, dots, hyphens, and underscores.",
                        },
                        { status: 400 },
                    );
                }
                nextUsername = trimmedUsername;
            }
        }

        let targetGoal = currentGoal;
        let shouldUpdateGoal = false;
        const rawGoal = learning_goal ?? daily_xp_goal;
        if (rawGoal !== undefined && rawGoal !== null && String(rawGoal).trim() !== "") {
            const trimmedGoal = String(rawGoal).trim();
            if (!/^\d+$/.test(trimmedGoal)) {
                return Response.json(
                    { error: "Daily XP goal must be a valid positive integer." },
                    { status: 400 },
                );
            }
            const parsedGoal = Number(trimmedGoal);
            if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) {
                return Response.json(
                    { error: "Daily XP goal must be greater than 0." },
                    { status: 400 },
                );
            }
            targetGoal = Math.min(Math.max(parsedGoal, 10), 1000);
            shouldUpdateGoal = true;
        }

        if (nextUsername !== null) {
            const [collision] = await db.query<RowDataPacket[]>(
                "SELECT user_id FROM player_tbl WHERE username = ? AND user_id != ? LIMIT 1",
                [nextUsername, userId],
            );
            if (Array.isArray(collision) && collision.length > 0) {
                return Response.json(
                    { error: `Username '${nextUsername}' is already taken.` },
                    { status: 409 },
                );
            }
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            if (nextUsername !== null) {
                await conn.query<ResultSetHeader>(
                    `INSERT INTO player_tbl (user_id, username)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE username = VALUES(username)`,
                    [userId, nextUsername],
                );
            }

            if (shouldUpdateGoal) {
                await conn.query<ResultSetHeader>(
                    `UPDATE user_auth_tbl SET learning_goal = ?, daily_xp_goal = ? WHERE user_id = ?`,
                    [targetGoal, targetGoal, userId],
                );
            }

            await conn.commit();
        } catch (txErr: unknown) {
            await conn.rollback().catch(() => {});
            const errCode = (txErr as { code?: string })?.code;
            if (errCode === "ER_DUP_ENTRY" && nextUsername) {
                return Response.json(
                    { error: `Username '${nextUsername}' is already taken.` },
                    { status: 409 },
                );
            }
            throw txErr;
        } finally {
            conn.release();
        }

        if (nextUsername !== null) {
            invalidateUserAuthCache(userId);
        }

        return Response.json({
            success: true,
            message: "Profile updated successfully",
            user_id: userId,
            email: session.user.email,
            username: nextUsername ?? currentUsername,
            daily_xp_goal: targetGoal,
            learning_goal: targetGoal,
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        return Response.json(
            { error: "Failed to update profile" },
            { status: 500 },
        );
    }
};
