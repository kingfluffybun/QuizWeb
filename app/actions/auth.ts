"use server";

import argon2 from "argon2";
import { db } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export async function signUp(formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!username || !email || !password || !confirmPassword) {
        return { error: "All fields are required." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    const connection = await db.getConnection();

    try {
        const [existingEmail] = await connection.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );
        if (existingEmail.length > 0) {
            return { error: "An account with this email already exists." };
        }

        const [existingUsername] = await connection.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [username]
        );
        if (existingUsername.length > 0) {
            return { error: "This username is already taken." };
        }

        const hashed = await argon2.hash(password);

        await connection.beginTransaction();

        const [authResult] = await connection.query<ResultSetHeader>(
            "INSERT INTO user_auth_tbl (email, password_hash, is_email_verified, created_at) VALUES (?, ?, false, NOW())",
            [email, hashed]
        );

        const newUserId = authResult.insertId;
        
        await connection.query(
            "INSERT INTO player_tbl (user_id, username, xp, max_streak) VALUES (?, ?, 0, 0)",
            [newUserId, username]
        );

        await connection.commit();
        return { success: true };

    } catch (error) {
        
        await connection.rollback();
        console.error("Database error during sign up:", error);
        return { error: "An internal server error occurred." };
    } finally {
        
        connection.release();
    }
}