"use server";

import argon2 from "argon2";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { createHash, createHmac, randomInt } from "crypto";
import { sendEmail } from "@/lib/email";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

async function verifyRecaptchaToken(token?: string | null): Promise<{ valid: boolean; error?: string }> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        console.warn("[reCAPTCHA] RECAPTCHA_SECRET_KEY is not set; skipping verification.");
        return { valid: true };
    }
    if (!token) {
        console.warn("[reCAPTCHA] No token provided for verification.");
        return { valid: false, error: "Please verify that you are not a robot before proceeding." };
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
            signal: AbortSignal.timeout(6000),
        });
        const data = await response.json();
        console.log("[reCAPTCHA] Siteverify response:", data);

        if (!data.success) {
            const errors: string[] = data["error-codes"] || [];
            if (errors.includes("hostname-mismatch")) {
                if (process.env.NODE_ENV !== "production") {
                    console.warn("[reCAPTCHA] Development hostname mismatch detected. Allowing verification for local testing.");
                    return { valid: true };
                }
                console.error("[reCAPTCHA] Hostname mismatch in production. Domain must be added to Google reCAPTCHA Console:", errors);
                return {
                    valid: false,
                    error: "reCAPTCHA domain verification failed (hostname-mismatch). Please ensure this domain is added in the Google reCAPTCHA Admin Console."
                };
            }
            if (errors.includes("timeout-or-duplicate")) {
                return {
                    valid: false,
                    error: "reCAPTCHA token expired or already used. Please click 'I\\'m not a robot' again."
                };
            }
            if (errors.includes("invalid-input-secret")) {
                console.error("[reCAPTCHA] RECAPTCHA_SECRET_KEY is invalid in server environment.");
                return {
                    valid: false,
                    error: "reCAPTCHA configuration error. Please contact the administrator."
                };
            }
            console.warn("[reCAPTCHA] Verification failed with error codes:", errors);
            return {
                valid: false,
                error: `reCAPTCHA verification failed (${errors.join(", ")}). Please try again.`
            };
        }

        if (typeof data.score === "number" && data.score < 0.5) {
            console.warn(`[reCAPTCHA] Confidence score too low: ${data.score}`);
            return {
                valid: false,
                error: "Suspicious activity detected. Please try again later."
            };
        }

        return { valid: true };
    } catch (err) {
        console.error("[reCAPTCHA] Verification network error:", err);
        return {
            valid: false,
            error: "Unable to reach Google reCAPTCHA servers. Please check your internet connection."
        };
    }
}

function generateSignupVerificationToken(email: string): string {
    const secret = process.env.AUTH_SECRET || "quizweb_secret_salt_2026";
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
    const data = `${email}:${expiresAt}`;
    const hmac = createHmac("sha256", secret).update(data).digest("hex");
    return `${data}:${hmac}`;
}

function verifySignupVerificationToken(email: string, token?: string | null): boolean {
    if (!email || !token) return false;
    const secret = process.env.AUTH_SECRET || "quizweb_secret_salt_2026";
    const parts = token.split(":");
    if (parts.length !== 3) return false;
    const [tokenEmail, tokenExpiresStr, tokenHmac] = parts;
    if (tokenEmail.toLowerCase().trim() !== email.toLowerCase().trim()) return false;
    const expiresAt = Number(tokenExpiresStr);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
    const expectedHmac = createHmac("sha256", secret).update(`${tokenEmail}:${tokenExpiresStr}`).digest("hex");
    return tokenHmac === expectedHmac;
}

export async function sendSignupOTP(email: string, username: string, recaptchaToken?: string | null) {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanUsername = username?.trim();

    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
        return { error: "Please enter a valid email address." };
    }
    if (!cleanUsername || cleanUsername.length < 2) {
        return { error: "Username must be at least 2 characters long." };
    }

    // 1. Verify reCAPTCHA to mitigate bot-driven email bombing
    const recaptcha = await verifyRecaptchaToken(recaptchaToken);
    if (!recaptcha.valid) {
        return { error: recaptcha.error || "reCAPTCHA verification failed. Please try again." };
    }

    // 2. Rate limit OTP sending (max 3 requests per 10 minutes)
    const rateKey = `signup_otp:${cleanEmail}`;
    const rateCheck = await checkRateLimit(rateKey);
    if (!rateCheck.allowed) {
        return { error: rateCheck.message || "Too many verification requests. Please try again later." };
    }

    try {
        // 3. Check if email already registered
        const [existingEmail] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [cleanEmail]
        );
        if (existingEmail.length > 0) {
            return { error: "An account with this email already exists. Please sign in instead." };
        }

        // 4. Check if username taken
        const [existingUsername] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [cleanUsername]
        );
        if (existingUsername.length > 0) {
            return { error: "This username is already taken. Please choose another." };
        }

        // 5. Generate cryptographically random 6-digit numeric OTP
        const otpCode = String(randomInt(100000, 1000000));
        const hashedOtp = createHash("sha256").update(otpCode).digest("hex");
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // 6. Invalidate previous unverified signup OTPs for this email
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE email = ? AND purpose = 'signup_verification' AND is_used = 0",
            [cleanEmail]
        );

        // 7. Store hashed OTP in user_otp_tbl
        await db.query(
            "INSERT INTO user_otp_tbl (email, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, 0, 'signup_verification')",
            [cleanEmail, hashedOtp, expiresAt]
        );

        // Increment rate limit counter
        await checkRateLimit(rateKey, true);

        // 8. Send branded verification email
        await sendEmail({
            to: cleanEmail,
            subject: "QuizWeb — Verify Your Email Address",
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Verify Your Email — QuizWeb</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fcfbff; margin: 0; padding: 40px 20px; }
                        .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; border: 1px solid #e0e0e0; }
                        .logo { text-align: center; margin-bottom: 24px; font-size: 24px; font-weight: 800; color: #9966FF; }
                        .greeting { font-size: 18px; font-weight: 600; color: #333333; margin-bottom: 8px; }
                        .message { font-size: 15px; color: #666666; line-height: 1.5; margin-bottom: 24px; }
                        .otp-box { background: #fcfbff; border: 2px solid #9966FF; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px; }
                        .otp-label { font-size: 12px; font-weight: 700; color: #9966FF; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
                        .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #333333; font-family: monospace; }
                        .expiry { font-size: 13px; color: #888888; text-align: center; margin-bottom: 20px; }
                        .footer { font-size: 12px; color: #888888; text-align: center; border-top: 1px solid #eeeeee; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">⚡ QuizWeb</div>
                        <p class="greeting">Welcome to QuizWeb, ${cleanUsername}!</p>
                        <p class="message">Please enter the following 6-digit verification code to verify your email address and continue registration:</p>
                        <div class="otp-box">
                            <div class="otp-label">Verification Code</div>
                            <div class="otp-code">${otpCode}</div>
                        </div>
                        <p class="expiry">This code will expire in 10 minutes.</p>
                        <p class="message">If you did not request this registration, you can safely ignore this email.</p>
                        <div class="footer">
                            <p style="margin: 0;">QuizWeb — Master Web Development with Interactive Quizzes</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        return { success: true, message: `Verification code sent to ${cleanEmail}` };
    } catch (err) {
        console.error("sendSignupOTP error:", err);
        return { error: "Failed to send verification code. Please try again." };
    }
}

export async function verifySignupOTP(email: string, otpCode: string) {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanOtp = otpCode?.trim();

    if (!cleanEmail || !cleanOtp || cleanOtp.length !== 6) {
        return { error: "Please enter a valid 6-digit verification code." };
    }

    // Rate limit verification attempts (max 5 failed attempts per 15 mins)
    const verifyLimitKey = `otp_verify:${cleanEmail}`;
    const rateCheck = await checkRateLimit(verifyLimitKey);
    if (!rateCheck.allowed) {
        return { error: rateCheck.message || "Too many invalid attempts. Please request a new code." };
    }

    try {
        const [rows] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used 
             FROM user_otp_tbl 
             WHERE email = ? AND purpose = 'signup_verification' AND is_used = 0 
             ORDER BY expires_at DESC LIMIT 1`,
            [cleanEmail]
        );

        if (rows.length === 0) {
            return { error: "No active verification code found. Please request a new code." };
        }

        const otp = rows[0];

        // Check if expired
        if (new Date(otp.expires_at) < new Date()) {
            return { error: "Verification code has expired. Please request a new one." };
        }

        const hashedInput = createHash("sha256").update(cleanOtp).digest("hex");
        const matches = otp.otp_code === hashedInput || otp.otp_code === cleanOtp;

        if (!matches) {
            await checkRateLimit(verifyLimitKey, true);
            return { error: "Invalid verification code. Please check your email and try again." };
        }

        // Mark OTP as used immediately to prevent replay attacks
        await db.query("UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?", [otp.otp_id]);

        // Clear rate limit counters
        await clearRateLimit(verifyLimitKey);
        await clearRateLimit(`signup_otp:${cleanEmail}`);

        // Produce tamper-proof HMAC verification token
        const verificationToken = generateSignupVerificationToken(cleanEmail);

        return {
            success: true,
            verificationToken,
            message: "Email verified successfully!",
        };
    } catch (err) {
        console.error("verifySignupOTP error:", err);
        return { error: "Verification failed. Please try again." };
    }
}

export async function resendSignupOTP(email: string, username: string) {
    const cleanEmail = email?.trim().toLowerCase();
    const cleanUsername = username?.trim();

    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
        return { error: "Please enter a valid email address." };
    }

    const resendLimitKey = `resend_signup_otp:${cleanEmail}`;
    const rateCheck = await checkRateLimit(resendLimitKey);
    if (!rateCheck.allowed) {
        return { error: rateCheck.message || "Please wait before requesting another code." };
    }

    await checkRateLimit(resendLimitKey, true);
    return await sendSignupOTP(cleanEmail, cleanUsername || "User", null);
}

export async function signUp(formData: FormData) {
    const rawUsername = formData.get("username") as string;
    const rawEmail = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const verificationToken = formData.get("verificationToken") as string;

    const username = rawUsername?.trim();
    const email = rawEmail?.trim().toLowerCase();

    if (!username || !email || !password || !confirmPassword) {
        return { error: "All fields are required." };
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
        return { error: "Please enter a valid email address." };
    }
    if (username.length < 2) {
        return { error: "Username must be at least 2 characters." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    // Enforce cryptographic proof of email OTP verification
    const isVerified = verifySignupVerificationToken(email, verificationToken);
    if (!isVerified) {
        return { error: "Email verification has expired or is invalid. Please verify your OTP code first." };
    }

    const connection = await db.getConnection();
    try {
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

        // 2. Check if the username is already taken in player_tbl
        const [existingUsername] = await connection.query<RowDataPacket[]>(
            "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
            [username]
        );
        if (existingUsername.length > 0) {
            await connection.rollback();
            return { error: "This username is already taken." };
        }

        const hashed = await argon2.hash(password);

        // 3. Insert the authentication record with is_email_verified = true
        const [authResult] = await connection.query<ResultSetHeader>(
            "INSERT INTO user_auth_tbl (email, password_hash, is_email_verified) VALUES (?, ?, ?)",
            [email, hashed, true]
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
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
        return { error: "Please enter a valid email address." };
    }

    const genericMessage = "If that email address is registered, an OTP has been sent. Please check your inbox.";

    try {
        // Finding 5: Prevent user enumeration and TypeError
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [normalizedEmail]
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