import { db } from "./db";
import type { RowDataPacket } from "mysql2";

const MAX_ATTEMPTS = 5;
const WINDOWS_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitRow extends RowDataPacket {
    attempts: number;
    reset_at: number;
    blocked: boolean;
}

export async function checkRateLimit(key: string, increment: boolean = false) {
    const now = Date.now();
    const dbkey = `ratelimit:${key}`;

    // Get existing
    const [rows] = await db.query<RateLimitRow[]>(
        "SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?",
        [dbkey]
    );

    const entry = rows[0];

    // Clean up old entries
    if (entry && now > entry.reset_at && !entry.blocked) {
        await db.query("DELETE FROM rate_limit_tbl WHERE limit_key = ?", [dbkey]);
    }

    // Check if blocked
    if (entry?.blocked) {
        const unblockAt = entry.reset_at + BLOCK_DURATION_MS;
        const waitMs = unblockAt - now;
        if (waitMs > 0) {
            return {
                allowed: false,
                remaining: 0,
                resetIn: waitMs,
                message: `Too many attempts. Please try again in ${Math.ceil(waitMs / 60000)} minutes.`
            };
        }
        // Block expired, delete
        await db.query("DELETE FROM rate_limit_tbl WHERE limit_key = ?", [dbkey]);
    }

    // Create
    if (!entry || (now > entry.reset_at && !entry.blocked)) {
        await db.query(
            "INSERT INTO rate_limit_tbl (limit_key, attempts, reset_at, blocked) VALUES (?, 0, ?, FALSE) ON DUPLICATE KEY UPDATE attempts = 0, reset_at = ?, blocked = FALSE",
            [dbkey, now + WINDOWS_MS, now + WINDOWS_MS]
        );
    }

    // Get fresh
    const [freshRows] = await db.query<RateLimitRow[]>(
        "SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?",
        [dbkey]
    );
    const fresh = freshRows[0];
    if (!fresh) {
        return {
            allowed: true,
            remaining: MAX_ATTEMPTS,
            resetIn: WINDOWS_MS
        };
    }

    if (!increment) {
        return {
            allowed: fresh.attempts < MAX_ATTEMPTS,
            remaining: Math.max(0, MAX_ATTEMPTS - fresh.attempts),
            resetIn: fresh.reset_at - now,
        };
    }

    // Max reached
    if (fresh.attempts + 1 >= MAX_ATTEMPTS) {
        await db.query(
            "UPDATE rate_limit_tbl SET attempts = attempts + 1, blocked = TRUE, reset_at = ? WHERE limit_key = ?",
            [now, dbkey]
        );
        return {
            allowed: false,
            remaining: 0,
            resetIn: BLOCK_DURATION_MS,
            message: `Too many attempts. Account locked ${Math.ceil(BLOCK_DURATION_MS / 60000)} minutes.`
        };
    }

    // Add attempt
    await db.query(
        "UPDATE rate_limit_tbl SET attempts = attempts + 1 WHERE limit_key = ?",
        [dbkey]
    );

    return {
        allowed: true,
        remaining: MAX_ATTEMPTS - fresh.attempts - 1,
        resetIn: fresh.reset_at - now,
    };
}

export async function clearRateLimit(key: string) {
    await db.query("DELETE FROM rate_limit_tbl WHERE limit_key = ?", 
        [`ratelimit:${key}`]
    );
}