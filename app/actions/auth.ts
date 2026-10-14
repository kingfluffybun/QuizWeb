"use server";

import argon2 from "argon2";
import crypto from "crypto";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { randomInt } from "crypto";
import { sendEmail } from "@/lib/email";
import { auth, signOut } from "@/auth";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

function timingSafeEqualStr(a: string, b: string): boolean {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Helper: Server-side Google reCAPTCHA v3 verification (SEC-09)
 */
async function verifyRecaptchaToken(token: string | null | undefined): Promise<{ success: boolean; score?: number }> {
    if (!token || typeof token !== "string" || !token.trim()) {
        return { success: false };
    }

    const trimmed = token.trim();

    // 1. Support test environments: bypass tokens strictly scoped to non-production
    if (process.env.NODE_ENV !== "production") {
        const testBypass = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
        if (trimmed === testBypass || trimmed === "test-bypass-token") {
            return { success: true, score: 1.0 };
        }
    }

    // 2. Secret key resolution
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        if (process.env.NODE_ENV === "test") {
            return { success: true, score: 1.0 };
        }
        console.error("Missing RECAPTCHA_SECRET_KEY in server environment.");
        return { success: false };
    }

    // 3. Verify against Google siteverify endpoint
    try {
        const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
        const response = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey,
                response: trimmed,
            }),
        });

        if (!response.ok) {
            return { success: false };
        }

        const data = await response.json();
        if (!data.success || (typeof data.score === "number" && data.score < 0.5)) {
            return { success: false };
        }

        return { success: true, score: data.score };
    } catch (err) {
        console.error("reCAPTCHA siteverify error:", err);
        return { success: false };
    }
}

export async function signUp(formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const recaptchaToken = (
        formData.get("recaptchaToken") ||
        formData.get("recaptcha_token") ||
        formData.get("g-recaptcha-response")
    ) as string;

    if (!username || !email || !password || !confirmPassword) {
        return { error: "All fields are required." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    // SEC-09: Enforce Google reCAPTCHA v3 server-side verification before any DB operations
    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    if (!captchaResult.success) {
        return { error: "reCAPTCHA verification failed." };
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedUsername = username.trim();

        // Check if the email already exists to a verified account
        const [existingEmail] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (existingEmail.length > 0) {
            return { error: "An account with this email already exists." };
        }

        // Check if the username is already taken
        const [existingUsername] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [trimmedUsername]
        );
        if (existingUsername.length > 0) {
            return { error: "This username is already taken." };
        }

        // Remove pending verification
        await db.query(
            `DELETE FROM user_vrfy_tbl WHERE email = ? OR username = ?`,
            [normalizedEmail, trimmedUsername]
        );

        const hashed = await argon2.hash(password);

        const rawVerificationToken = crypto.randomBytes(32).toString("hex");
        const hashedVerificationToken = hashToken(rawVerificationToken);
        const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);

        // Store temporarily
        await db.query<ResultSetHeader>(
            `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)`,
            [trimmedUsername, normalizedEmail, hashed, hashedVerificationToken, verificationExpires]
        );

        const verificationLink = `https://quizweb.dev/verify-email/${rawVerificationToken}`;

        // Send email for verification
        await sendEmail({
            to: email,
            subject: "QuizWeb - Email Verification",
            html: `
            <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Verification — QuizWeb</title>
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

                        <div class="greeting">Hi, ${trimmedUsername}!</div>
                        <div class="message">
                            We received an account creation using this email address.<br/>
                            Please click the link below to verify your email address.
                        </div>
                        <div class="button">
                            <a href="${verificationLink}">Verify Email</a>
                        </div>
                        <div class="expiry">
                            This link will expire in 5 minutes.
                        </div>
                        <div class="footer">
                            <p style="margin: 0 0 8px; font-weight: 600; color: #333333;">QuizWeb — Learn Web Development</p>
                            <p style="margin: 0;">Need help? <a href="mailto:support@quizweb.dev">Contact support</a></p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        return {
            success: true,
            message: "Check your email to verify your email address.",
        };
    } catch {
        return {
            error: "An internal error occurred. Please try again later.",
        };
    }
}

// Verify Email
export async function verifyEmail(token: string) {
    if (!token || typeof token !== "string" || !token.trim()) {
        return {
            success: false,
            message: "Invalid verification link.",
        };
    }

    const hashedToken = hashToken(token.trim());
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Check token existence and lockout before row locking to handle consumed tokens and locked accounts cleanly
        const [preCheck] = await connection.query<RowDataPacket[]>(
            `SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1`,
            [hashedToken]
        );

        if (Array.isArray(preCheck)) {
            if (preCheck.length === 0) {
                await connection.rollback();
                return {
                    success: false,
                    message: "This verification link is invalid or has already been used.",
                };
            }

            const initialCheck = preCheck[0];
            if (initialCheck && ((initialCheck.locked_until && new Date() < new Date(initialCheck.locked_until)) || initialCheck.attempts >= 5)) {
                await connection.rollback();
                return {
                    success: false,
                    message: "This verification link has been locked due to too many failed attempts.",
                };
            }
        }

        // Find pending verification with pessimistic row lock (SEC-13)
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1 FOR UPDATE`,
            [hashedToken]
        );

        if (rows.length === 0) {
            await connection.rollback();
            return {
                success: false,
                message: "This verification link is invalid or has already been used.",
            };
        }

        const pendingUser = rows[0];

        // Check lockout status
        if ((pendingUser.locked_until && new Date() < new Date(pendingUser.locked_until)) || pendingUser.attempts >= 5) {
            await connection.rollback();
            return {
                success: false,
                message: "This verification link has been locked due to too many failed attempts.",
            };
        }

        // Check expiration
        const expiresAt = new Date(pendingUser.expires_at);

        if (new Date() > expiresAt) {
            await connection.query(
                `DELETE FROM user_vrfy_tbl WHERE verify_id = ?`,
                [pendingUser.verify_id]
            );
            await connection.commit();

            return {
                success: false,
                message: "This verification link has expired. Please sign up again.",
            };
        }

        // Check if email already exists
        const [existingEmail] = await connection.query<RowDataPacket[]>(
            `SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1 FOR UPDATE`,
            [pendingUser.email]
        );

        if (existingEmail.length > 0) {
            await connection.rollback();

            return {
                success: false,
                message: "An account already exists with this email address.",
            };
        }

        // Check if username already exists
        const [existingUsername] =
            await connection.query<RowDataPacket[]>(
                `SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1 FOR UPDATE`,
                [pendingUser.username]
            );
        
        if (existingUsername.length > 0) {
            await connection.rollback();

            return {
                success: false,
                message: "This username is already taken.",
            };
        }

        // Create acc
        const [authResult] = 
            await connection.query<ResultSetHeader>(
                `INSERT INTO user_auth_tbl (email, password_hash, is_email_verified, user_role) VALUES (?, ?, ?, ?)`,
                [pendingUser.email, pendingUser.password_hash, 1, "user"]
            );
        
        const newUserId = authResult.insertId;

        // Create player
        await connection.query(
            `INSERT INTO player_tbl (user_id, username) VALUES (?, ?)`,
            [newUserId, pendingUser.username]
        );

        // Delete temp verification
        await connection.query(
            `DELETE FROM user_vrfy_tbl WHERE verify_id = ?`,
            [pendingUser.verify_id]
        );

        // Commit transaction
        await connection.commit();

        return {
            success: true,
            message: "Email verified successfully. You may now close this tab.",
        };
    } catch (error) {
        console.error(error);
        try {
            await connection.rollback();
        } catch {
            // ignore rollback failure on closed connection
        }
        return {
            success: false,
            message: "An internal error occurred. Please try again later.",
        };
    } finally {
        connection.release();
    }
}

// Req OTP
export async function reqPassReset(email: string) {
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return { error: "Please enter a valid email address." };
    }

    const normalizedEmail = email.trim().toLowerCase();

    // SEC-10: Rate limiting against email flooding
    const rateLimit = await checkRateLimit(`req_reset_${normalizedEmail}`, true);
    if (!rateLimit.allowed) {
        return { error: "Too many password reset requests. Please try again later." };
    }

    const genericMessage = "If an account exists with this email, a reset code has been sent.";

    try {
        // SEC-08: Check if user exists in user_auth_tbl
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (users.length === 0) {
            return { success: true, message: genericMessage };
        }

        const userId = users[0].user_id;

        // Get username from player_tbl
        const [player] = await db.query<RowDataPacket[]>(
            "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
            [userId]
        );
        const username = player?.[0]?.username || "User";

        // Generate OTP
        const rawOtp = String(randomInt(100000, 999999));
        const hashedOtp = hashToken(rawOtp);

        // Expire 5 mins
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Invalidate any existing unused OTPs for this user
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 2 WHERE user_id = ? AND purpose = ? AND is_used = 0",
            [userId, "password_reset"]
        );

        // Insert new OTP with hashed code and attempt tracking
        await db.query(
            "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)",
            [userId, hashedOtp, expiresAt, 0, "password_reset"]
        );

        // Send to email
        await sendEmail({
            to: normalizedEmail,
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
                            <div class="otp-code">${rawOtp}</div>
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
    if (!email || !otpCode || typeof otpCode !== "string") {
        return { error: "Email and OTP code are required." };
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (users.length === 0) {
            return { error: "Invalid email." };
        }

        const userId = users[0].user_id;
        const hashedInputOtp = hashToken(otpCode.trim());

        // Find valid OTP
        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used, attempts, locked_until FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        if (otps.length === 0) {
            return { error: "Invalid or expired OTP" };
        }

        const otp = otps[0];

        // Check lockout status
        if (otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until))) {
            return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
        }

        // Server-side rate limiting (SEC-01 / ASVS 2.2.1, 3.7.1)
        const rateLimit = await checkRateLimit(`otp_verify_${normalizedEmail}`, false);
        if (!rateLimit.allowed) {
            return { error: "Too many OTP verification attempts. Please try again later." };
        }

        // Check if expired
        if (new Date(otp.expires_at) < new Date()) {
            return { error: "OTP has expired. Please request a new one." };
        }

        // Check if matches
        const isMatch = timingSafeEqualStr(otp.otp_code, hashedInputOtp);
        if (!isMatch) {
            const rlResult = await checkRateLimit(`otp_verify_${normalizedEmail}`, true);
            await db.query(
                "UPDATE user_otp_tbl SET attempts = attempts + 1, locked_until = IF(attempts + 1 >= 5, NOW(), locked_until) WHERE otp_id = ?",
                [otp.otp_id]
            );

            if ((otp.attempts || 0) + 1 >= 5) {
                return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
            }
            if (!rlResult.allowed) {
                return { error: "Too many OTP verification attempts. Please try again later." };
            }
            return { error: "Invalid OTP. Please try again." };
        }

        // Clear rate limit on successful verification
        await clearRateLimit(`otp_verify_${normalizedEmail}`);

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
        const normalizedEmail = email.trim().toLowerCase();

        // Get user from email
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (users.length === 0){
            return { error: "Invalid email." };
        }

        const userId = users[0].user_id;
        const hashedInputOtp = hashToken(otpCode.trim());

        // Verify again: check is_used = 1 and unexpired (SEC-02)
        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        if (
            otps.length === 0 ||
            !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) ||
            otps[0].is_used !== 1 ||
            new Date(otps[0].expires_at) < new Date()
        ) {
            return { error: "Invalid or expired OTP" };
        }

        // Hash the new pass
        const hashed = await argon2.hash(newPassword);

        // Update password and increment token_version to revoke active sessions (SEC-05)
        await db.query(
            "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
            [hashed, userId]
        );

        // Transition OTP record to consumed status (is_used = 2) to prevent replay (SEC-02)
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?",
            [otps[0].otp_id]
        );

        // Send confirmation email
        await sendEmail({
            to: normalizedEmail,
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

/**
 * Server action to sign out user and revoke active session tokens by incrementing token_version (SEC-05).
 */
export async function signOutAction() {
    try {
        const session = await auth();
        if (session?.user?.id) {
            await db.query(
                "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
                [session.user.id]
            );
        }
    } catch (err) {
        console.error("Error updating token_version during signOutAction:", err);
    }
    await signOut({ redirectTo: "/login" });
}

export async function logoutUser(userId?: string | number) {
    let targetUserId = userId;
    if (!targetUserId) {
        try {
            const session = await auth();
            targetUserId = session?.user?.id;
        } catch {
            // auth() not available in test context
        }
    }
    if (targetUserId) {
        await db.query(
            "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
            [targetUserId]
        );
    }
    try {
        await signOut({ redirectTo: "/login" });
    } catch {
        // signOut may redirect in Next.js
    }
    return { success: true };
}