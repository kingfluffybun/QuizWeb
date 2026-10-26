import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { auth } from "@/auth";

const USERNAME_REGEX = /^[a-zA-Z0-9_.\- ]{3,30}$/;

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
    created_at?: string;
}

export const GET = async (): Promise<Response> => {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [rows] = await db.execute<RowDataPacket[]>(
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
                p.max_streak
            FROM user_auth_tbl u
            LEFT JOIN player_tbl p ON u.user_id = p.user_id
            WHERE u.email = ?
            LIMIT 1`,
            [session.user.email]
        );

        const user = rows[0];
        
        if (user) {
            const dailyGoal = Number(user.learning_goal ?? user.daily_xp_goal ?? 50);
            return Response.json({
                ...user,
                daily_xp_goal: dailyGoal,
                learning_goal: dailyGoal,
                created_at: user.created_at ? new Date(user.created_at).toISOString() : undefined,
            });
        }

        console.log("No user found in database");
        return Response.json({});
    } catch (error) {
        console.error("Error fetching user info:", error);
        return Response.json({});
    }
};

export const POST = async (req: Request): Promise<Response> => {
    try {
        const session = await auth();

        if (!session?.user?.email) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let bodyObj: Record<string, unknown>;
        
        try {
            bodyObj = (await req.json()) as Record<string, unknown>;
        } catch {
            // JSON parsing failed, fallback to FormData
            const formData = await req.formData();
            bodyObj = {
                username: (formData.get("username") as string) || "",
                learning_goal: (formData.get("learningGoal") as string) || "",
                daily_xp_goal: (formData.get("daily_xp_goal") as string) || "",
            };
        }

        const { username, learning_goal, daily_xp_goal } = bodyObj;

        const [userRows] = await db.execute<RowDataPacket[]>(
            `SELECT u.user_id, u.daily_xp_goal, u.learning_goal, p.username 
                FROM user_auth_tbl u 
                LEFT JOIN player_tbl p ON u.user_id = p.user_id
                WHERE u.email = ?
                LIMIT 1`,
            [session.user.email]
        );

        if (!userRows?.length) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        const userId = userRows[0].user_id;
        const currentUsername = userRows[0].username || "";
        const currentGoal = Number(userRows[0].learning_goal ?? userRows[0].daily_xp_goal ?? 50);

        // Validate and update username if provided
        let finalUsername = currentUsername;
        if (username !== undefined && username !== null) {
            const trimmedUsername = String(username).trim();
            if (trimmedUsername !== currentUsername) {
                if (!USERNAME_REGEX.test(trimmedUsername)) {
                    return Response.json(
                        { error: "Username must be 3-30 characters long and contain only letters, numbers, spaces, dots, hyphens, and underscores." },
                        { status: 400 }
                    );
                }
                const [collision] = await db.query<RowDataPacket[]>(
                    "SELECT user_id FROM player_tbl WHERE LOWER(username) = LOWER(?) AND user_id != ? LIMIT 1",
                    [trimmedUsername, userId]
                );
                if (Array.isArray(collision) && collision.length > 0) {
                    return Response.json(
                        { error: `Username '${trimmedUsername}' is already taken.` },
                        { status: 409 }
                    );
                }
                await db.execute<ResultSetHeader>(
                    `UPDATE player_tbl SET username = ? WHERE user_id = ?`,
                    [trimmedUsername, userId]
                );
                finalUsername = trimmedUsername;
            }
        }

        // Parse and update learning_goal and daily_xp_goal if provided
        let targetGoal = currentGoal;
        const rawGoal = learning_goal ?? daily_xp_goal;
        if (rawGoal !== undefined && rawGoal !== null && String(rawGoal).trim() !== "") {
            const digits = parseInt(String(rawGoal).replace(/\D+/g, ""), 10);
            if (!isNaN(digits) && digits > 0) {
                targetGoal = Math.min(Math.max(digits, 10), 1000);
                await db.execute<ResultSetHeader>(
                    `UPDATE user_auth_tbl SET learning_goal = ?, daily_xp_goal = ? WHERE user_id = ?`,
                    [targetGoal, targetGoal, userId]
                );
            }
        }
        
        return Response.json({
            success: true,
            message: "Profile updated successfully",
            user_id: userId,
            email: session.user.email,
            username: finalUsername,
            daily_xp_goal: targetGoal,
            learning_goal: targetGoal,
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        return Response.json({ error: "Failed to update profile" }, { status: 500 });
    }
};
