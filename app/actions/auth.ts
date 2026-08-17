"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export async function signUp(formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!username || !email || !password) {
        return { error: "All fields are required." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    const [existing] = await db.query<RowDataPacket[]>(
        "SELECT id FROM user_tb WHERE email = ? LIMIT 1",
        [email]
    );
    if (existing.length > 0) {
        return { error: "An account with this email already exists." };
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
        "INSERT INTO user_tb (username, email, password, createdAt) VALUES (?, ?, ?, NOW())",
        [username, email, hashed]
    );

    return { success: true };
}