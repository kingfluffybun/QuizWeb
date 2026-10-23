import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/auth";

export interface UserInfoResponse {
    user_id?: number;
    email?: string;
    username?: string;
    user_role?: string;
    avatar_color?: string;
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
                u.avatar_color
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
