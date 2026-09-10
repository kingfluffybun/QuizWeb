"use server";

import argon2 from "argon2";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { createHash, randomInt } from "crypto";
import { sendEmail } from "@/lib/email";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

async function verifyRecaptchaToken(token?: string | null): Promise<boolean> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        console.warn("[reCAPTCHA] RECAPTCHA_SECRET_KEY is not set; skipping verification.");
        return true;
    }
    if (!token) {
        console.warn("[reCAPTCHA] No token provided for verification.");
        return false;
    }
    try {
        const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
        const response = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
            }),
        });
        const data = await response.json();
        console.log("[reCAPTCHA] Siteverify response:", data);

        if (!data.success) {
            const errors: string[] = data["error-codes"] || [];
            // In local development, tolerate hostname-mismatch if localhost wasn't registered in Google Console
            if (process.env.NODE_ENV !== "production" && errors.length === 1 && errors.includes("hostname-mismatch")) {
                console.warn("[reCAPTCHA] Development hostname mismatch detected. Allowing verification for local testing.");
                return true;
            }
            console.warn("[reCAPTCHA] Verification failed with error codes:", errors);
            return false;
        }

        if (typeof data.score === "number" && data.score < 0.5) {
            console.warn(`[reCAPTCHA] Confidence score too low: ${data.score}`);
            return false;
        }

        return true;
    } catch (err) {
        console.error("[reCAPTCHA] Verification network error:", err);
        return false;
    }
}

export async function signUp(formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const recaptchaToken = formData.get("recaptchaToken") as string | null;

    if (!username || !email || !password || !confirmPassword) {
        return { error: "All fields are required." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    // Finding 7: Server-side reCAPTCHA verification
    const isHuman = await verifyRecaptchaToken(recaptchaToken);
    if (!isHuman) {
        return { error: "Bot activity detected or verification failed. Please try again." };
    }

    const connection = await db.getConnection();
    try {
        // Finding 10: Multi-table database transaction
        await connection.beginTransaction();

        // 1. Check if the email already exists in user_auth_tbl
        const [existingEmail] = await connection.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );
        if (existingEmail.length > 0) {
            await connection.rollback();
            return { error: "An account with this email already exists." };
        }

        // 2. Check if the username is already taken in player_tbl (marked Unique in ERD)
        const [existingUsername] = await connection.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [username]
        );
        if (existingUsername.length > 0) {
            await connection.rollback();
            return { error: "This username is already taken." };
        }

        const hashed = await argon2.hash(password);

        // 3. Insert the authentication record 
        const [authResult] = await connection.query<ResultSetHeader>(
            "INSERT INTO user_auth_tbl (email, password_hash, is_email_verified) VALUES (?, ?, ?)",
            [email, hashed, false]
        );

        const newUserId = authResult.insertId;

        // 4. Insert the player profile using the newly generated user_id
        await connection.query(
            "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
            [newUserId, username]
        );

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        console.error("Signup database error:", error);
        return { error: "An internal server error occurred during signup." };
    } finally {
        connection.release();
    }
}

// Req OTP
export async function reqPassReset(email: string) {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        return { error: "Please enter a valid email address." };
    }

    const genericMessage = "If that email address is registered, an OTP has been sent. Please check your inbox.";

    try {
        // Finding 5: Prevent user enumeration and TypeError
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );

        if (!users || users.length === 0) {
            return { success: true, message: genericMessage };
        }

        const userId = users[0].user_id;

        // Get username from player_tbl
        const [player] = await db.query<RowDataPacket[]>(
            "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
            [userId]
        );

        const username = player?.[0]?.username || "User";

        // Generate 6-digit numeric OTP
        const otpCode = String(randomInt(100000, 999999));
        // Finding 6: Hash OTP with SHA-256 before storage
        const hashedOtp = createHash("sha256").update(otpCode).digest("hex");

        // Expire 10 mins
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Invalidate any existing unused OTPs for this user
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
            [userId, "password_reset"]
        );

        // Insert new OTP with hashed token
        await db.query(
            "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, ?, ?)",
            [userId, hashedOtp, expiresAt, 0, "password_reset"]
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
                    <title>Reset Your Password — QuizWeb</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            background: #fcfbff;
                            margin: 0;
                            padding: 40px 20px;
                        }
                        .container {
                            max-width: 480px;
                            margin: 0 auto;
                            background: #ffffff;
                            border-radius: 16px;
                            padding: 48px;
                            border: 1px solid #e0e0e0;
                        }
                        .logo {
                            text-align: center;
                            margin-bottom: 32px;
                            font-size: 22px;
                            font-weight: 700;
                            color: #9966FF;
                            letter-spacing: -0.5px;
                        }
                        .greeting {
                            font-size: 20px;
                            font-weight: 600;
                            color: #333333;
                            margin-bottom: 12px;
                        }
                        .message {
                            font-size: 15px;
                            color: #666666;
                            line-height: 1.6;
                            margin-bottom: 28px;
                        }
                        .otp-box {
                            background: #fcfbff;
                            border: 2px solid #9966FF;
                            border-radius: 12px;
                            padding: 32px;
                            text-align: center;
                            margin-bottom: 24px;
                        }
                        .otp-label {
                            font-size: 12px;
                            font-weight: 600;
                            color: #9966FF;
                            text-transform: uppercase;
                            letter-spacing: 0.12em;
                            margin-bottom: 12px;
                        }
                        .otp-code {
                            font-size: 40px;
                            font-weight: 700;
                            letter-spacing: 10px;
                            color: #333333;
                            font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;
                        }
                        .expiry {
                            font-size: 14px;
                            color: #9966FF;
                            text-align: center;
                            margin-bottom: 28px;
                            font-weight: 500;
                        }
                        .footer {
                            font-size: 13px;
                            color: #666666;
                            text-align: center;
                            border-top: 1px solid #e0e0e0;
                            padding-top: 28px;
                        }
                        .footer a {
                            color: #7D3FFF;
                            text-decoration: none;
                            font-weight: 500;
                        }
                        .footer a:hover {
                            text-decoration: underline;
                        }
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
                        
                        <p class="expiry">This code expires in 10 minutes</p>
                        
                        <p class="message">If you didn't request a password reset, you can safely ignore this email.</p>
                        
                        <div class="footer">
                            <p style="margin: 0 0 8px; font-weight: 600; color: #333333;">QuizWeb — Learn Web Development</p>
                            <p style="margin: 0;">Need help? <a href="mailto:support@quizweb.dev">Contact support</a></p>
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

    const otpKey = `otp:${email.toLowerCase().trim()}`;
    const rateCheck = await checkRateLimit(otpKey);
    if (!rateCheck.allowed) {
        return { error: rateCheck.message || "Too many failed attempts. Please request a new OTP." };
    }

    try {
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );

        if (users.length === 0) {
            return { error: "Invalid email or OTP." };
        }

        const userId = users[0].user_id;

        // Find valid OTP
        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        if (otps.length === 0) {
            return { error: "Invalid or expired OTP." };
        }

        const otp = otps[0];

        // Check if expired
        if (new Date(otp.expires_at) < new Date()) {
            return { error: "OTP has expired. Please request a new one." };
        }

        const hashedInput = createHash("sha256").update(otpCode.trim()).digest("hex");
        const matches = otp.otp_code === hashedInput || otp.otp_code === otpCode.trim();

        if (!matches) {
            await checkRateLimit(otpKey, true);
            return { error: "Invalid OTP. Please try again." };
        }

        // Clear rate limit counter on success
        await clearRateLimit(otpKey);

        // Mark OTP as used
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?",
            [otp.otp_id]
        );

        return { success: true, message: "OTP verified successfully." };
    } catch (error) {
        console.error("Verify OTP error: ", error);
        return { error: "Failed to verify OTP. Please try again." };
    }
}

// Reset Pass
export async function resetPass(email: string, otpCode: string, newPassword: string) {
    // Validate
    if (!newPassword || newPassword.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    try {
        // Get user from email
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );

        if (users.length === 0){
            return { error: "Invalid request." };
        }

        const userId = users[0].user_id;

        // Verify that a valid, non-expired OTP was verified
        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        const hashedInput = createHash("sha256").update(otpCode.trim()).digest("hex");
        const matches = otps[0]?.otp_code === hashedInput || otps[0]?.otp_code === otpCode.trim();
        const isNotExpired = otps[0] && new Date(otps[0].expires_at) > new Date();

        if (otps.length === 0 || !matches || otps[0].is_used !== 1 || !isNotExpired) {
            return { error: "Invalid or expired OTP session. Please request a new OTP." };
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
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Updated — QuizWeb</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            background: #fcfbff;
                            margin: 0;
                            padding: 40px 20px;
                            color: #333333;
                        }
                        .container {
                            max-width: 520px;
                            margin: 0 auto;
                            background: #ffffff;
                            border: 1px solid #e0e0e0;
                            border-radius: 16px;
                            padding: 40px 32px;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 32px;
                        }
                        .header h1 {
                            font-size: 24px;
                            font-weight: 700;
                            color: #9966FF;
                            margin: 0 0 8px;
                        }
                        .body p {
                            font-size: 15px;
                            line-height: 1.6;
                            margin: 0 0 16px;
                        }
                        .footer {
                            margin-top: 32px;
                            padding-top: 24px;
                            border-top: 1px solid #f0eff5;
                            text-align: center;
                            font-size: 13px;
                            color: #999999;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Password Updated</h1>
                        </div>
                        <div class="body">
                            <p>Your QuizWeb account password has been updated successfully.</p>
                            <p>If you did not perform this change, please contact support or reset your password immediately.</p>
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} QuizWeb. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        return { success: true, message: "Password reset successfully." };
    } catch (error) {
        console.error("Reset pass error: ", error);
        return { error: "Failed to reset password. Please try again." };
    }
}