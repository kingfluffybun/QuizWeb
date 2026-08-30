"use server";

import argon2 from "argon2";
import { db } from "@/lib/db";
import { randomInt } from "crypto";
import { sendEmail } from "@/lib/email";
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

// Req OTP
export async function reqPassReset(email: string) {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return { error: "Please enter a valid email address." };
    }

    try {
        // Check if user exists in user_auth_tbl
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );

        const genericMessage = "OTP sent successfully. Please check your email.";

        if (users.length === 0) {
            return { success: true, message: genericMessage };
        }

        const userId = users[0].user_id;
        const username = users[0].username || "User";

        // Generate la code
        const otpCode = String(randomInt(100000, 999999));

        // Expire 10 mins
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Invalidate any existing unused OTPs for this user
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
            [userId, "password_reset"]
        );

        // Insert new OTP
        await db.query(
            "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, ?, ?)",
            [userId, otpCode, expiresAt, 0, "password_reset"]
        );

        // Send to email
        await sendEmail({
            to: email,
            subject: "QuizWeb - Password Reset",
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
                        .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
                        .logo { text-align: center; margin-bottom: 24px; font-size: 24px; font-weight: 700; color: #1a1a1a; }
                        .greeting { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; }
                        .message { font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px; }
                        .otp-box { background: #f8f9fa; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
                        .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a; font-family: 'SF Mono', monospace; }
                        .otp-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
                        .expiry { font-size: 13px; color: #e5484d; text-align: center; margin-bottom: 24px; }
                        .footer { font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 24px; }
                        .footer a { color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">QuizWeb</div>
                        <p class="greeting">Hi ${username},</p>
                        <p class="message">We received a request to reset your password. Use the code below to verify your identity:</p>
                        
                        <div class="otp-box">
                            <div class="otp-label">Your verification code</div>
                            <div class="otp-code">${otpCode}</div>
                        </div>
                        
                        <p class="expiry">⏱️ This code expires in 10 minutes</p>
                        
                        <p class="message">If you didn't request a password reset, you can safely ignore this email.</p>
                        
                        <div class="footer">
                            <p>QuizWeb — Learn Web Development</p>
                            <p>Need help? <a href="mailto:support@yourdomain.com">Contact support</a></p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        return {
            success: true,
            message: genericMessage,
        };
    } catch (error) {
        console.error("Password reset database error:", error);
        return { error: "Failed to send OTP. Please try again." };
    }
}

// Verify OTP
export async function verifyOTP(email: string, otpCode: string) {
    if (!email || !otpCode) {
        return { error: "Email and OTP code are required." };
    }

    try {
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );

        if (users.length === 0) {
            return { error: "Invalid email." };
        }

        const userId = users[0].user_id;

        // Find valid OTP
        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        if (otps.length === 0) {
            return { error: "Invalid or expired OTP" };
        }

        const otp = otps[0];

        // Check if expired
        if (new Date(otp.expires_at) < new Date()) {
            return { error: "OTP has expired. Please request a new one." };
        }

        // Check if matches
        if (otp.otp_code !== otpCode) {
            return { error: "Invalid OTP. Please try again." };
        }

        // Mark OTP as used
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?",
            [otp.otp_id]
        );

        return { success: true, message: "OTP verified successfully." };
    } catch (error) {
        console.error("Verify OTP error: ", error);
        return { error: "Failed to verify OTP. Please try again" };
    }
}

// Reset Pass
export async function resetPass(email: string, otpCode: string, newPassword: string) {
    // Validate
    if (!newPassword || newPassword.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    try {
        // Get user frome email
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );

        if (users.length === 0){
            return { error: "Invalid email." };
        }

        const userId = users[0].user_id;

        // Verify again
        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        if (otps.length === 0 || otps[0].otp_code !== otpCode || otps[0].is_used === 0) {
            return { error: "Invalid or expired OTP" };
        }

        // Hash the new pass
        const hashed = await argon2.hash(newPassword);

        // Update
        await db.query(
            "UPDATE user_auth_tbl SET password_hash = ? WHERE user_id = ?",
            [hashed, userId]
        );

        // Invalidate all OTPs for this user
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ?",
            [userId, "password_reset"]
        );

        // Send confirmation email
        await sendEmail({
            to: email,
            subject: "QuizWeb - Password Reset Confirmation",
            html: `
                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px;">
                    <h2 style="color: #1a1a1a;">Password Updated</h2>
                    <p style="color: #555; line-height: 1.6;">Your QuizWeb password has been successfully changed.</p>
                    <p style="color: #999; font-size: 13px;">If you didn't make this change, please contact support immediately.</p>
                </div>
            `
        });

        return { success: true, message: "Password reset successfully." };
    } catch (error) {
        console.error("Reset pass error: ", error);
        return { error: "Failed to reset password. Please try again." };
    }
}