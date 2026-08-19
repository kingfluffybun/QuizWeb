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

    try {
        // 1. Check if the email already exists in user_auth_tbl
        const [existingEmail] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );
        if (existingEmail.length > 0) {
            return { error: "An account with this email already exists." };
        }

        // 2. Check if the username is already taken in player_tbl (marked Unique in ERD)
        const [existingUsername] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [username]
        );
        if (existingUsername.length > 0) {
            return { error: "This username is already taken." };
        }

        const hashed = await argon2.hash(password);

        // 3. Insert the authentication record 
        const [authResult] = await db.query<ResultSetHeader>(
            "INSERT INTO user_auth_tbl (email, password_hash, is_email_verified) VALUES (?, ?, ?)",
            [email, hashed, false]
        );

        const newUserId = authResult.insertId;

        // 4. Insert the player profile using the newly generated user_id
        await db.query(
            "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
            [newUserId, username]
        );

        return { success: true };
    } catch (error) {
        console.error("Signup database error:", error);
        return { error: "An internal server error occurred during signup." };
    }
}