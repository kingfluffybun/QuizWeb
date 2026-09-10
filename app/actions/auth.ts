"use server";

import argon2 from "argon2";
import crypto from "crypto";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
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
        // Check if the email already exists in user_auth_tbl
        const [existingEmail] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email]
        );
        if (existingEmail.length > 0) {
            return { error: "An account with this email already exists." };
        }

        // Check if the username is already taken in player_tbl (marked Unique in ERD)
        const [existingUsername] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [username]
        );
        if (existingUsername.length > 0) {
            return { error: "This username is already taken." };
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const hashed = await argon2.hash(password);

        // Insert the authentication record 
        const [authResult] = await db.query<ResultSetHeader>(
            "INSERT INTO user_auth_tbl (email, password_hash, is_email_verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?)",
            [email, hashed, false, verificationToken, verificationExpires]
        );

        const newUserId = authResult.insertId;

        // Insert the player profile using the newly generated user_id
        await db.query(
            "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
            [newUserId, username]
        );

        // Send email for verification
        try {
            await sendEmail({
            to: email,
            subject: "QuizWeb - Email Verification",
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
                            .button {
                            text-align: center;
                            margin-bottom: 28px;
                        }

                        .button a {
                            display: inline-block;
                            background: #9966FF;
                            color: #ffffff;
                            text-decoration: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-weight: 600;
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

                        <div class="greeting">Hi, ${username}!</div>
                        <div class="message">
                            We received an account creation tied to this email address.<br/>
                            Please click the link below to verify your email address.
                        </div>
                        <div class="button">
                            <a href="https://quizweb.dev/verify-email/${verificationToken}">Verify Email</a>
                        </div>
                        <div class="expiry">
                            This link will expire in 24 hours.
                        </div>
                        <div class="footer">
                            <p style="margin: 0 0 8px; font-weight: 600; color: #333333;">QuizWeb — Learn Web Development</p>
                            <p style="margin: 0;">Need help? <a href="mailto:support@quizweb.dev">Contact support</a></p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        })
        } catch (emailError) {
            // Remove acc
            await db.query(
                "DELETE FROM player_tbl WHERE user_id = ?",
                [newUserId]
            );

            await db.query(
                "DELETE FROM user_auth_tbl WHERE user_id = ?",
                [newUserId]
            );

            return {
                error: "We couldn't send the verification email. Please try again."
            };
        }

        return { success: true };
    } catch (error) {
        console.error("Signup database error:", error);
        return { error: "An internal server error occurred during signup." };
    }
}

// Verify Email
export async function verifyEmail(token: string) {
    try {
        const [rows] = await db.query<any[]>(
            `SELECT user_id, verification_token FROM user_auth_tbl WHERE verification_token = ? AND is_email_verified = 0 LIMIT 1`,
            [token]
        );

        if (rows.length === 0) {
            return {
                success: false,
                message: "Invalid or expired verification token.",
            };
        }

        const user = rows[0];
        const expiresAt = new Date(user.verification_expires);

        // Check if token has expired
        if (Date.now() > expiresAt.getTime()) {
            // Delete player
            await db.query("DELETE FROM player_tbl WHERE user_id = ?", [user.user_id]);

            // Delete authentication record
            await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [user.user_id]);

            return {
                success: false,
                expired: true,
                message: "This verification link has expired. Your account has been removed.",
            };
        }

        // Verify email
        await db.query(
            `UPDATE user_auth_tbl SET is_email_verified = 1 AND verification_token = NULL AND verification_expires = NULL WHERE user_id = ?`,
            [user.user_id]
        );

        return {
            success: true,
            message: "Email verified successfully.",
        };

    } catch (error) {
        console.error("Email verification error:", error);
        return {
            success: false,
            message: "An internal server error occurred during email verification.",
        };
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

        // Get username from player_tbl
        const [player] = await db.query<RowDataPacket[]>(
            "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
            [users[0].user_id]
        );

        const genericMessage = "If the email is valid, you will receive an email.";

        if (users.length === 0) {
            return { success: true, message: genericMessage };
        }

        const userId = users[0].user_id;
        const username = player[0].username || "User";

        // Generate la code
        const otpCode = String(randomInt(100000, 999999));

        // Expire 5 mins
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

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
                        
                        <p class="expiry">This code expires in 5 minutes</p>
                        
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
                        .heading {
                            font-size: 24px;
                            font-weight: 700;
                            color: #333333;
                            margin: 0 0 16px;
                            text-align: center;
                        }
                        .message {
                            font-size: 15px;
                            color: #666666;
                            line-height: 1.6;
                            margin: 0 0 24px;
                            text-align: center;
                        }
                        .alert {
                            background: #fcfbff;
                            border-left: 4px solid #9966FF;
                            border-radius: 8px;
                            padding: 16px 20px;
                            font-size: 14px;
                            color: #666666;
                            line-height: 1.5;
                        }
                        .alert strong {
                            color: #333333;
                        }
                        .footer {
                            font-size: 13px;
                            color: #666666;
                            text-align: center;
                            border-top: 1px solid #e0e0e0;
                            padding-top: 28px;
                            margin-top: 32px;
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
                        <h2 class="heading">Password Updated</h2>
                        <p class="message">Your QuizWeb password has been successfully changed. You can now sign in with your new password.</p>
                        
                        <div class="alert">
                            <strong>Didn't make this change?</strong><br>
                            If you didn't update your password, please <a href="mailto:support@quizweb.dev">contact support</a> immediately to secure your account.
                        </div>
                        
                        <div class="footer">
                            <p style="margin: 0 0 8px; font-weight: 600; color: #333333;">QuizWeb — Learn Web Development</p>
                            <p style="margin: 0;">Need help? <a href="mailto:support@quizweb.dev">Contact support</a></p>
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

// Check Rate Limit
export async function checkLoginRateLimit(email: string) {
    return await checkRateLimit(`login:${email.toLowerCase().trim()}`);
}

// Failed
export async function recordFailedLogin(email: string) {
    await checkRateLimit(`login:${email.toLowerCase().trim()}`, true);
    return { success: true };
}

// Clear for success
export async function clearLoginRateLimit(email: string) {
    const key = `login:${email.toLowerCase().trim()}`;
    clearRateLimit(key);
    return { success: true };
}