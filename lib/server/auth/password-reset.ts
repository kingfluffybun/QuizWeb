import { randomInt } from "node:crypto";
import argon2 from "argon2";
import type { RowDataPacket } from "mysql2";
import { invalidateUserAuthCache } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import {
  ARGON2_OPTIONS,
  hashToken,
  timingSafeEqualStr,
} from "@/lib/server/crypto";
import {
  renderPasswordResetOtpEmail,
  renderPasswordUpdatedEmail,
} from "@/lib/server/email-templates";

export async function reqPassResetImpl(emailInput: string | FormData) {
  const email =
    typeof emailInput === "object" && emailInput !== null && "get" in emailInput
      ? (emailInput.get("email") as string)
      : emailInput;

  if (
    !email ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return { error: "Please enter a valid email address." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rateLimit = await checkRateLimit(`req_reset_${normalizedEmail}`, true);
  if (!rateLimit.allowed) {
    return {
      error: "Too many password reset requests. Please try again later.",
    };
  }

  const genericMessage =
    "If an account exists with this email, a reset code has been sent.";

  try {
    const [users] = await db.query<RowDataPacket[]>(
      `SELECT u.user_id, p.username
       FROM user_auth_tbl u
       LEFT JOIN player_tbl p ON u.user_id = p.user_id
       WHERE u.email = ?
       LIMIT 1`,
      [normalizedEmail],
    );

    if (users.length === 0) {
      console.warn(
        `[reqPassReset] No verified user found in user_auth_tbl for: ${normalizedEmail}`,
      );
      return { success: true, message: genericMessage };
    }

    const userId = users[0].user_id;
    const username = String(users[0].username || "User");

    const rawOtp = String(randomInt(100000, 1000000));
    const hashedOtp = hashToken(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      "UPDATE user_otp_tbl SET is_used = 2 WHERE user_id = ? AND purpose = ? AND is_used = 0",
      [userId, "password_reset"],
    );

    await db.query(
      "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)",
      [userId, hashedOtp, expiresAt, 0, "password_reset"],
    );

    await sendEmail({
      to: normalizedEmail,
      subject: "QuizWeb - Password Reset",
      html: renderPasswordResetOtpEmail(username, rawOtp),
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

export async function verifyOTPImpl(email: string, otpCode: string) {
  if (!email || !otpCode || typeof otpCode !== "string") {
    return { error: "Email and OTP code are required." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [users] = await db.query<RowDataPacket[]>(
      "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
      [normalizedEmail],
    );

    if (users.length === 0) {
      return { error: "Invalid email." };
    }

    const userId = users[0].user_id;
    const hashedInputOtp = hashToken(otpCode.trim());

    const [otps] = await db.query<RowDataPacket[]>(
      `SELECT otp_id, otp_code, expires_at, is_used, attempts, locked_until
       FROM user_otp_tbl
       WHERE user_id = ? AND purpose = ? AND is_used = 0
       ORDER BY expires_at DESC LIMIT 1`,
      [userId, "password_reset"],
    );

    if (otps.length === 0) {
      return { error: "Invalid or expired OTP" };
    }

    const otp = otps[0];

    if (
      otp.attempts >= 5 ||
      (otp.locked_until !== null && new Date() < new Date(otp.locked_until))
    ) {
      return {
        error:
          "Too many failed attempts. This OTP has been locked. Please request a new one.",
      };
    }

    const rateLimit = await checkRateLimit(`otp_verify_${normalizedEmail}`, false);
    if (!rateLimit.allowed) {
      return {
        error: "Too many OTP verification attempts. Please try again later.",
      };
    }

    if (new Date(otp.expires_at) < new Date()) {
      return { error: "OTP has expired. Please request a new one." };
    }

    const isMatch = timingSafeEqualStr(otp.otp_code, hashedInputOtp);
    if (!isMatch) {
      const [rlResult] = await Promise.all([
        checkRateLimit(`otp_verify_${normalizedEmail}`, true),
        db.query(
          "UPDATE user_otp_tbl SET attempts = attempts + 1, locked_until = IF(attempts + 1 >= 5, NOW(), locked_until) WHERE otp_id = ?",
          [otp.otp_id],
        ),
      ]);

      if ((otp.attempts || 0) + 1 >= 5) {
        return {
          error:
            "Too many failed attempts. This OTP has been locked. Please request a new one.",
        };
      }
      if (!rlResult.allowed) {
        return {
          error: "Too many OTP verification attempts. Please try again later.",
        };
      }
      return { error: "Invalid OTP. Please try again." };
    }

    await Promise.all([
      clearRateLimit(`otp_verify_${normalizedEmail}`),
      db.query("UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?", [
        otp.otp_id,
      ]),
    ]);

    return { success: true, message: "OTP verified successfully." };
  } catch (error) {
    console.error("Verify OTP error: ", error);
    return { error: "Failed to verify OTP. Please try again" };
  }
}

export async function resetPassImpl(
  email: string,
  otpCode: string,
  newPassword: string,
) {
  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    const [users] = await db.query<RowDataPacket[]>(
      "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
      [normalizedEmail],
    );

    if (users.length === 0) {
      return { error: "Invalid email." };
    }

    const userId = users[0].user_id;
    const hashedInputOtp = hashToken(otpCode.trim());
    const hashed = await argon2.hash(newPassword, ARGON2_OPTIONS);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [otps] = await connection.query<RowDataPacket[]>(
        `SELECT otp_id, otp_code, expires_at, is_used
         FROM user_otp_tbl
         WHERE user_id = ? AND purpose = ?
         ORDER BY expires_at DESC LIMIT 1
         FOR UPDATE`,
        [userId, "password_reset"],
      );

      if (
        otps.length === 0 ||
        !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) ||
        otps[0].is_used !== 1 ||
        new Date(otps[0].expires_at) < new Date()
      ) {
        await connection.rollback();
        return { error: "Invalid or expired OTP" };
      }

      await Promise.all([
        connection.query(
          "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
          [hashed, userId],
        ),
        connection.query("UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?", [
          otps[0].otp_id,
        ]),
      ]);

      await connection.commit();
    } catch (txErr) {
      await connection.rollback().catch(() => {});
      throw txErr;
    } finally {
      connection.release();
    }

    invalidateUserAuthCache(userId);

    await sendEmail({
      to: normalizedEmail,
      subject: "QuizWeb - Password Reset Confirmation",
      html: renderPasswordUpdatedEmail(),
    });

    return { success: true, message: "Password reset successfully." };
  } catch (error) {
    console.error("Reset pass error: ", error);
    return { error: "Failed to reset password. Please try again." };
  }
}
