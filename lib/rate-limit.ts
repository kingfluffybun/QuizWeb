import { db } from "./db";
import type { RowDataPacket } from "mysql2";

const MAX_ATTEMPTS = 5;
const WINDOWS_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface RateLimitRow extends RowDataPacket {
    attempts: number;
    reset_at: number;
    blocked: boolean | number;
}

export interface RateLimitCheckResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    message?: string;
}

export async function checkRateLimit(
    key: string,
    increment: boolean = false,
): Promise<RateLimitCheckResult> {
    const now = Date.now();
    const dbkey = `ratelimit:${key}`;

    if (!increment) {
        const [rows] = await db.query<RateLimitRow[]>(
            "SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?",
            [dbkey],
        );
        const entry = rows[0];
        if (!entry) {
            return {
                allowed: true,
                remaining: MAX_ATTEMPTS,
                resetIn: WINDOWS_MS,
            };
        }

        if (entry.blocked) {
            const waitMs = entry.reset_at - now;
            if (waitMs > 0) {
                return {
                    allowed: false,
                    remaining: 0,
                    resetIn: waitMs,
                    message: `Too many attempts. Please try again in ${Math.ceil(waitMs / 60000)} minutes.`,
                };
            }
            return {
                allowed: true,
                remaining: MAX_ATTEMPTS,
                resetIn: WINDOWS_MS,
            };
        }

        if (now > entry.reset_at) {
            return {
                allowed: true,
                remaining: MAX_ATTEMPTS,
                resetIn: WINDOWS_MS,
            };
        }

        return {
            allowed: entry.attempts < MAX_ATTEMPTS,
            remaining: Math.max(0, MAX_ATTEMPTS - entry.attempts),
            resetIn: Math.max(0, entry.reset_at - now),
        };
    }

    // Atomic increment/upsert:
    // - If currently blocked and lock hasn't expired: preserve attempts, reset_at, and blocked=1.
    // - If previous block or attempt window expired: reset attempts=1, reset_at=now+WINDOWS_MS, blocked=0.
    // - Otherwise increment attempts; when reaching MAX_ATTEMPTS, lock for BLOCK_DURATION_MS from now.
    const windowResetAt = now + WINDOWS_MS;
    const blockUntil = now + BLOCK_DURATION_MS;

    await db.query(
        `INSERT INTO rate_limit_tbl (limit_key, attempts, reset_at, blocked)
         VALUES (?, 1, ?, 0)
         ON DUPLICATE KEY UPDATE
           attempts = IF((blocked = 1 AND reset_at <= ?) OR (blocked = 0 AND reset_at < ?), 1, IF(blocked = 1, attempts, attempts + 1)),
           reset_at = IF(blocked = 1 AND reset_at > ?, reset_at, IF((blocked = 1 AND reset_at <= ?) OR (blocked = 0 AND reset_at < ?), ?, IF(attempts >= ?, ?, reset_at))),
           blocked = IF(attempts >= ?, 1, 0)`,
        [
            dbkey,
            windowResetAt,
            now,
            now,
            now,
            now,
            now,
            windowResetAt,
            MAX_ATTEMPTS,
            blockUntil,
            MAX_ATTEMPTS,
        ],
    );

    const [rows] = await db.query<RateLimitRow[]>(
        "SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?",
        [dbkey],
    );

    const fresh = rows[0] || {
        attempts: 1,
        reset_at: windowResetAt,
        blocked: false,
    };

    if (fresh.blocked || fresh.attempts >= MAX_ATTEMPTS) {
        const waitMs = Math.max(0, fresh.reset_at - now);
        return {
            allowed: false,
            remaining: 0,
            resetIn: waitMs || BLOCK_DURATION_MS,
            message: `Too many attempts. Account locked ${Math.max(1, Math.ceil((waitMs || BLOCK_DURATION_MS) / 60000))} minutes.`,
        };
    }

    return {
        allowed: true,
        remaining: Math.max(0, MAX_ATTEMPTS - fresh.attempts),
        resetIn: Math.max(0, fresh.reset_at - now),
    };
}

export async function clearRateLimit(key: string) {
    await db.query("DELETE FROM rate_limit_tbl WHERE limit_key = ?", [
        `ratelimit:${key}`,
    ]);
}
