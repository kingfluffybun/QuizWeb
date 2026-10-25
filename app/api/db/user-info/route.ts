import { db } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { auth } from "@/auth";

export interface UserInfoResponse {
    user_id?: number;
    email?: string;
    username?: string;
    user_role?: string;
    avatar_color?: string;
    learning_goal?: string;
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
                u.learning_goal,
                u.created_at
            FROM user_auth_tbl u
            LEFT JOIN player_tbl p ON u.user_id = p.user_id
            WHERE u.email = ?
            LIMIT 1`,
            [session.user.email]
        );

        const user = rows[0];
        
        if (user) {
            return Response.json(user);
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

        let bodyObj: any;
        
        try {
            bodyObj = await req.json();
        } catch (e) {
            // JSON parsing failed, fallback to FormData
            const formData = await req.formData();
            bodyObj = {
                username: formData.get("username") as string || "",
                learning_goal: formData.get("learningGoal") as string || ""
            };
        }

        const { username, learning_goal } = bodyObj;

        const [userRows] = await db.execute<RowDataPacket[]>(
            `SELECT u.user_id, p.username 
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
        const currentUsername = userRows[0].username;

        // Prepare new values (keep original if empty/unchanged)
        const newUsername = username?.trim() || currentUsername;

        // Update learning_goal
        if (learning_goal?.trim()) {
            await db.execute<ResultSetHeader>(
                `UPDATE user_auth_tbl SET learning_goal = ? WHERE user_id = ?`,
                [learning_goal.trim(), userId]
            );
        }

        // Update player_tbl username
        await db.execute<ResultSetHeader>(
            `UPDATE player_tbl SET username = ? WHERE user_id = ?`,
            [newUsername, userId]
        );
        
        return Response.json({
            success: true,
            message: "Profile updated successfully",
            user_id: userId,
            username: newUsername,
            learning_goal: learning_goal || null
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        return Response.json({ error: "Failed to update profile" }, { status: 500 });
    }
};
