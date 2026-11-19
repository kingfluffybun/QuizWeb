import crypto from "node:crypto";
import argon2 from "argon2";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { ARGON2_OPTIONS, hashToken } from "@/lib/server/crypto";
import { renderVerificationEmail } from "@/lib/server/email-templates";
import { verifyRecaptchaToken } from "./recaptcha";

const AVATAR_COLOR_PALETTE = [
  "#FFB3BA", "#FFBFB3", "#FFCBB3", "#FFD8B3", "#FFE5B3", "#FFF2B3",
  "#FDFFB3", "#E8F8B3", "#D3F5B3", "#BFF2B8", "#B3F0C8", "#B3EEDA",
  "#B3ECEC", "#B3E0F5", "#B3D3FA", "#B3C6FF", "#BFB8FF", "#CDB8FF",
  "#DBB8FF", "#E8B8FF", "#F3B8F5", "#FFB8E6", "#FFB8D3", "#FFB8C6",
];

function getRandomPaletteColor(): string {
  return AVATAR_COLOR_PALETTE[
    crypto.randomInt(0, AVATAR_COLOR_PALETTE.length)
  ];
}

export async function signUpImpl(formData: FormData) {
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

  const captchaResult = await verifyRecaptchaToken(recaptchaToken);
  if (!captchaResult.success) {
    return { error: "reCAPTCHA verification failed." };
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    const [[existingEmail], [existingUsername]] = await Promise.all([
      db.query<RowDataPacket[]>(
        "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
        [normalizedEmail],
      ),
      db.query<RowDataPacket[]>(
        "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1",
        [trimmedUsername],
      ),
    ]);

    if (existingEmail.length > 0) {
      return { error: "An account with this email already exists." };
    }
    if (existingUsername.length > 0) {
      return { error: "This username is already taken." };
    }

    await db.query(
      "DELETE FROM user_vrfy_tbl WHERE email = ? OR username = ?",
      [normalizedEmail, trimmedUsername],
    );

    const hashed = await argon2.hash(password, ARGON2_OPTIONS);
    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = hashToken(rawVerificationToken);
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);

    await db.query<ResultSetHeader>(
      `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at, attempts, locked_until)
       VALUES (?, ?, ?, ?, ?, 0, NULL)`,
      [
        trimmedUsername,
        normalizedEmail,
        hashed,
        hashedVerificationToken,
        verificationExpires,
      ],
    );

    const baseUrl =
      process.env.NODE_ENV === "production"
        ? "https://quizweb.dev"
        : "http://localhost:3000";
    const verificationLink = `${baseUrl}/verify-email/${rawVerificationToken}`;

    await sendEmail({
      to: email,
      subject: "QuizWeb - Email Verification",
      html: renderVerificationEmail(trimmedUsername, verificationLink),
    });

    return {
      success: true,
      message: "Check your email to verify your email address.",
    };
  } catch (err) {
    console.error("SignUp error:", err);
    return {
      error: "An internal error occurred. Please try again later.",
    };
  }
}

export async function verifyEmailImpl(token: string) {
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

    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until
       FROM user_vrfy_tbl
       WHERE verification_token = ?
       LIMIT 1
       FOR UPDATE`,
      [hashedToken],
    );

    if (rows.length === 0) {
      await connection.rollback();
      return {
        success: false,
        message: "This verification link is invalid or has already been used.",
      };
    }

    const pendingUser = rows[0];

    if (
      (pendingUser.locked_until &&
        new Date() < new Date(pendingUser.locked_until)) ||
      pendingUser.attempts >= 5
    ) {
      await connection.rollback();
      return {
        success: false,
        message:
          "This verification link has been locked due to too many failed attempts.",
      };
    }

    const expiresAt = new Date(pendingUser.expires_at);
    if (new Date() > expiresAt) {
      await connection.query(
        "DELETE FROM user_vrfy_tbl WHERE verify_id = ?",
        [pendingUser.verify_id],
      );
      await connection.commit();
      return {
        success: false,
        message: "This verification link has expired. Please sign up again.",
      };
    }

    const [[existingEmail], [existingUsername]] = await Promise.all([
      connection.query<RowDataPacket[]>(
        "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1 FOR UPDATE",
        [pendingUser.email],
      ),
      connection.query<RowDataPacket[]>(
        "SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1 FOR UPDATE",
        [pendingUser.username],
      ),
    ]);

    if (existingEmail.length > 0) {
      await connection.rollback();
      return {
        success: false,
        message: "An account already exists with this email address.",
      };
    }

    if (existingUsername.length > 0) {
      await connection.rollback();
      return {
        success: false,
        message: "This username is already taken.",
      };
    }

    const avatarColor = getRandomPaletteColor();
    const [authResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO user_auth_tbl (email, password_hash, is_email_verified, user_role, avatar_color)
       VALUES (?, ?, ?, ?, ?)`,
      [pendingUser.email, pendingUser.password_hash, 1, "user", avatarColor],
    );

    const newUserId = authResult.insertId;

    await connection.query(
      "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
      [newUserId, pendingUser.username],
    );

    await connection.query("DELETE FROM user_vrfy_tbl WHERE verify_id = ?", [
      pendingUser.verify_id,
    ]);

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
