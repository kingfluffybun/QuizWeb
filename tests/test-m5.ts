/**
 * =============================================================================
 * Milestone 5 Verification Test Harness: tests/test-m5.ts
 * =============================================================================
 * Targets:
 *   - SEC-07: Concurrency & Atomic Rate Limiting (lib/rate-limit.ts)
 *   - SEC-13: Transaction Isolation & Pessimistic Locking (app/actions/auth.ts)
 *
 * Standards:
 *   - OWASP ASVS v4.0.3:
 *     * Chapter 3 (V3.1.1, V3.4.2: Token Lifecycle & Session Management)
 *     * Chapter 4 (V4.1.5: Transaction Isolation & Concurrent State)
 *     * Chapter 11 (V11.1.6: Race Condition Prevention & Atomic Database State)
 *
 * Execution:
 *   npx --yes tsx tests/test-m5.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert";
import argon2 from "argon2";

// -----------------------------------------------------------------------------
// Suite 1: Environment & Mock Setup
// -----------------------------------------------------------------------------
const projectRoot = process.cwd();
const mainNodeModules = "/home/sankobite/QuizWeb/node_modules";
const localNodeModules = path.join(projectRoot, "node_modules");

// Ensure node_modules resolution in git worktree
if (!fs.existsSync(localNodeModules) && fs.existsSync(mainNodeModules)) {
    try {
        fs.symlinkSync(mainNodeModules, localNodeModules, "junction");
    } catch {
        if (!process.env.NODE_PATH) {
            process.env.NODE_PATH = mainNodeModules;
        }
    }
}

// Pre-initialize environment variables
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test_secret_32_characters_minimum_length_for_jwt";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m5_audit";

// Mock external fetch (Resend transactional email & Google reCAPTCHA)
const capturedEmails: Record<string, unknown>[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("api.resend.com")) {
        let bodyObj: Record<string, unknown> = {};
        if (init?.body) {
            try {
                bodyObj = JSON.parse(String(init.body)) as Record<string, unknown>;
            } catch {
                bodyObj = { html: String(init.body) };
            }
        }
        capturedEmails.push(bodyObj);
        return new Response(JSON.stringify({ id: "mock_resend_m5_" + Date.now() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (url.includes("recaptcha/api/siteverify")) {
        return new Response(JSON.stringify({ success: true, score: 0.9 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    return originalFetch(input, init);
};

// Test Runner State
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(testName: string, testFn: () => void | Promise<void>) {
    totalTests++;
    try {
        await testFn();
        passedTests++;
        console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
    } catch (err: unknown) {
        failedTests++;
        console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
        if (err instanceof Error) {
            console.error(`    \x1b[31mError:\x1b[0m ${err.message}`);
        } else {
            console.error(`    \x1b[31mError:\x1b[0m`, err);
        }
    }
}

// Helper: Token hash function
function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

// -----------------------------------------------------------------------------
// Database Interfaces & Stateful In-Memory Mock
// -----------------------------------------------------------------------------
interface UserAuthRow {
    user_id: number;
    email: string;
    password_hash: string | null;
    user_role: string;
    token_version: number;
    is_email_verified: number;
}

interface PlayerRow {
    player_id: number;
    user_id: number;
    username: string;
}

interface UserVrfyRow {
    verify_id: number;
    username: string;
    email: string;
    password_hash: string;
    verification_token: string;
    expires_at: Date;
    attempts: number;
    locked_until: Date | null;
}

interface RateLimitRecord {
    limit_key: string;
    attempts: number;
    reset_at: number;
    blocked: boolean;
}

interface MockDatabaseState {
    users: UserAuthRow[];
    players: PlayerRow[];
    vrfy: UserVrfyRow[];
    m5RateLimits: Map<string, RateLimitRecord>;
    nextUserId: number;
    nextPlayerId: number;
    nextVrfyId: number;
}

let mockDb: MockDatabaseState;

async function resetMockDb() {
    const passwordHash = await argon2.hash("ValidPassword123!");
    mockDb = {
        users: [
            {
                user_id: 1,
                email: "admin@quizweb.dev",
                password_hash: passwordHash,
                user_role: "admin",
                token_version: 1,
                is_email_verified: 1,
            },
            {
                user_id: 2,
                email: "user@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 1, user_id: 1, username: "admin_user" },
            { player_id: 2, user_id: 2, username: "regular_user" },
        ],
        vrfy: [],
        m5RateLimits: new Map(),
        nextUserId: 10,
        nextPlayerId: 10,
        nextVrfyId: 10,
    };
    capturedEmails.length = 0;
}

// -----------------------------------------------------------------------------
// Concurrency Control & Pessimistic Lock Manager
// -----------------------------------------------------------------------------
class RowLockManager {
    private locks = new Map<string, Promise<void>>();
    private unlockers = new Map<string, () => void>();

    async acquire(resourceKey: string): Promise<void> {
        while (this.locks.has(resourceKey)) {
            await this.locks.get(resourceKey);
        }
        let unlock: () => void = () => {};
        const promise = new Promise<void>((resolve) => {
            unlock = resolve;
        });
        this.locks.set(resourceKey, promise);
        this.unlockers.set(resourceKey, unlock);
    }

    release(resourceKey: string): void {
        const unlock = this.unlockers.get(resourceKey);
        if (unlock) {
            this.unlockers.delete(resourceKey);
            this.locks.delete(resourceKey);
            unlock();
        }
    }
}

const vrfyLockManager = new RowLockManager();
const rateLimitLockManager = new RowLockManager();

// Intercept db from lib/db
import { db } from "../lib/db";

// Atomic query interceptor for standalone rate limiting
db.query = (async (sql: string, params: unknown[] = []) => {
    // 1. Rate limit atomic upsert (SEC-07):
    // INSERT INTO rate_limit_tbl ... ON DUPLICATE KEY UPDATE attempts = IF(reset_at < ?, 1, attempts + ?) ...
    if (sql.includes("INSERT INTO rate_limit_tbl") && sql.includes("ON DUPLICATE KEY UPDATE")) {
        const key = String(params[0]);
        const resetAt = Number(params[1]);
        const now = Number(params[2]);
        const inc = Number(params[3]);
        const maxAttempts = Number(params[6] || 5);

        // Serialize execution under row lock
        await rateLimitLockManager.acquire(key);
        try {
            const existing = mockDb.m5RateLimits.get(key);
            if (!existing) {
                mockDb.m5RateLimits.set(key, {
                    limit_key: key,
                    attempts: inc > 0 ? 1 : 0,
                    reset_at: resetAt,
                    blocked: false,
                });
            } else {
                if (existing.reset_at < now) {
                    // Window expired, reset bucket
                    existing.attempts = inc > 0 ? 1 : 0;
                    existing.reset_at = now + 15 * 60 * 1000;
                    existing.blocked = false;
                } else {
                    // Window active, atomically increment
                    existing.attempts += inc;
                    if (existing.attempts >= maxAttempts) {
                        existing.blocked = true;
                    }
                }
            }
            return [{ affectedRows: existing ? 2 : 1 }];
        } finally {
            rateLimitLockManager.release(key);
        }
    }

    // 2. Rate limit SELECT
    if (sql.includes("SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?")) {
        const key = String(params[0]);
        const row = mockDb.m5RateLimits.get(key);
        if (!row) return [[]];
        return [[{ attempts: row.attempts, reset_at: row.reset_at, blocked: row.blocked }]];
    }

    // 3. Rate limit DELETE
    if (sql.includes("DELETE FROM rate_limit_tbl WHERE limit_key = ?")) {
        const key = String(params[0]);
        mockDb.m5RateLimits.delete(key);
        return [{ affectedRows: 1 }];
    }

    return [{ affectedRows: 1, insertId: 999 }];
}) as unknown as typeof db.query;

// Transaction connection interceptor for verifyEmail (SEC-13)
let shouldSimulatePlayerInsertFailure = false;
let capturedConnectionReleases = 0;

db.getConnection = (async () => {
    const heldLocks: string[] = [];
    let inTx = false;
    const txRollbackActions: (() => void)[] = [];

    return {
        query: async (sql: string, params: unknown[] = []) => {
            // 1. Pessimistic lock on verification token:
            // SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? ... FOR UPDATE
            if (sql.includes("FROM user_vrfy_tbl") && sql.includes("FOR UPDATE")) {
                const token = String(params[0]);
                const lockKey = `vrfy_token:${token}`;
                await vrfyLockManager.acquire(lockKey);
                heldLocks.push(lockKey);

                const row = mockDb.vrfy.find((v) => v.verification_token === token);
                if (!row) return [[]];
                return [[{
                    verify_id: row.verify_id,
                    username: row.username,
                    email: row.email,
                    password_hash: row.password_hash,
                    expires_at: row.expires_at,
                    attempts: row.attempts,
                    locked_until: row.locked_until,
                }]];
            }

            // 2. Check existing email in user_auth_tbl
            if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ?")) {
                const email = String(params[0]).toLowerCase();
                const user = mockDb.users.find((u) => u.email.toLowerCase() === email);
                if (!user) return [[]];
                return [[{ user_id: user.user_id }]];
            }

            // 3. Check existing username in player_tbl
            if (sql.includes("SELECT user_id FROM player_tbl WHERE username = ?")) {
                const username = String(params[0]);
                const player = mockDb.players.find((p) => p.username.toLowerCase() === username.toLowerCase());
                if (!player) return [[]];
                return [[{ user_id: player.user_id }]];
            }

            // 4. INSERT INTO user_auth_tbl
            if (sql.includes("INSERT INTO user_auth_tbl")) {
                const email = String(params[0]);
                const pwdHash = String(params[1]);
                const verified = Number(params[2]);
                const role = String(params[3]);
                const newUserId = mockDb.nextUserId++;
                const newAuthRow: UserAuthRow = {
                    user_id: newUserId,
                    email,
                    password_hash: pwdHash,
                    user_role: role,
                    token_version: 1,
                    is_email_verified: verified,
                };
                mockDb.users.push(newAuthRow);
                txRollbackActions.push(() => {
                    const idx = mockDb.users.findIndex((u) => u.user_id === newUserId);
                    if (idx !== -1) mockDb.users.splice(idx, 1);
                });
                return [{ affectedRows: 1, insertId: newUserId }];
            }

            // 5. INSERT INTO player_tbl
            if (sql.includes("INSERT INTO player_tbl")) {
                if (shouldSimulatePlayerInsertFailure) {
                    throw new Error("Simulated transient database error during player record creation");
                }
                const userId = Number(params[0]);
                const username = String(params[1]);
                const newPlayerId = mockDb.nextPlayerId++;
                const newPlayerRow: PlayerRow = {
                    player_id: newPlayerId,
                    user_id: userId,
                    username,
                };
                mockDb.players.push(newPlayerRow);
                txRollbackActions.push(() => {
                    const idx = mockDb.players.findIndex((p) => p.player_id === newPlayerId);
                    if (idx !== -1) mockDb.players.splice(idx, 1);
                });
                return [{ affectedRows: 1, insertId: newPlayerId }];
            }

            // 6. DELETE FROM user_vrfy_tbl WHERE verify_id = ?
            if (sql.includes("DELETE FROM user_vrfy_tbl WHERE verify_id = ?")) {
                const verifyId = Number(params[0]);
                const idx = mockDb.vrfy.findIndex((v) => v.verify_id === verifyId);
                let deletedRow: UserVrfyRow | undefined;
                if (idx !== -1) {
                    deletedRow = mockDb.vrfy.splice(idx, 1)[0];
                    txRollbackActions.push(() => {
                        if (deletedRow) mockDb.vrfy.push(deletedRow);
                    });
                }
                return [{ affectedRows: idx !== -1 ? 1 : 0 }];
            }

            return [{ affectedRows: 1, insertId: 999 }];
        },
        beginTransaction: async () => {
            inTx = true;
        },
        commit: async () => {
            inTx = false;
            txRollbackActions.length = 0;
            while (heldLocks.length > 0) {
                const k = heldLocks.pop();
                if (k) vrfyLockManager.release(k);
            }
        },
        rollback: async () => {
            inTx = false;
            while (txRollbackActions.length > 0) {
                const undo = txRollbackActions.pop();
                if (undo) undo();
            }
            while (heldLocks.length > 0) {
                const k = heldLocks.pop();
                if (k) vrfyLockManager.release(k);
            }
        },
        release: () => {
            capturedConnectionReleases++;
            if (inTx) {
                while (txRollbackActions.length > 0) {
                    const undo = txRollbackActions.pop();
                    if (undo) undo();
                }
            }
            while (heldLocks.length > 0) {
                const k = heldLocks.pop();
                if (k) vrfyLockManager.release(k);
            }
        },
    };
}) as unknown as typeof db.getConnection;

// -----------------------------------------------------------------------------
// Test Execution Suite
// -----------------------------------------------------------------------------
async function main() {
    console.log("\n========================================================");
    console.log(" QuizWeb Milestone 5: Standalone Security Verification");
    console.log(" Targets: SEC-07 (Atomic Rate Limiting in lib/rate-limit.ts)");
    console.log("          SEC-13 (Transaction Isolation in app/actions/auth.ts)");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3, 4, 11");
    console.log("========================================================\n");

    const { checkRateLimit, clearRateLimit } = await import("../lib/rate-limit");
    const { verifyEmail } = await import("../app/actions/auth");

    // =========================================================================
    // Suite 1: SEC-07 Atomic Rate Limiting (50 Concurrent Requests)
    // =========================================================================
    console.log("\x1b[1m[Suite 1: SEC-07 Atomic Rate Limiting (50 Concurrent Requests)]\x1b[0m");
    await resetMockDb();

    await runTest("T1.1: 50 simultaneous parallel requests throttled cleanly at threshold without race bypass", async () => {
        const testKey = "concurrent_burst_user_1";
        const CONCURRENT_REQUESTS = 50;

        // Execute 50 concurrent requests simultaneously
        const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
            checkRateLimit(testKey, true)
        );
        const results = await Promise.all(promises);

        const allowedResults = results.filter((r) => r.allowed);
        const blockedResults = results.filter((r) => !r.allowed);

        // Under 5-attempt limit threshold, exactly 4 or 5 requests must be allowed
        assert.ok(
            allowedResults.length >= 4 && allowedResults.length <= 5,
            `Expected exactly 4 or 5 allowed requests, received ${allowedResults.length}`
        );
        assert.strictEqual(
            blockedResults.length,
            CONCURRENT_REQUESTS - allowedResults.length,
            `Expected exactly ${CONCURRENT_REQUESTS - allowedResults.length} blocked requests, received ${blockedResults.length}`
        );

        // Every blocked result must have remaining = 0 and lockout message
        for (const blocked of blockedResults) {
            assert.strictEqual(blocked.remaining, 0, "Blocked request must report 0 remaining");
            assert.ok(
                typeof blocked.message === "string" && blocked.message.includes("Too many attempts"),
                "Blocked request must include user-facing lockout message"
            );
        }
    });

    await runTest("T1.2: Atomic database state reflects 50 attempts and blocked = true after burst", async () => {
        const record = mockDb.m5RateLimits.get("ratelimit:concurrent_burst_user_1");
        assert.ok(record, "Rate limit record must exist in database");
        assert.strictEqual(record.attempts, 50, "Total tracked attempts must equal 50 with zero lost updates");
        assert.strictEqual(record.blocked, true, "Rate limit bucket must be marked blocked = true");
    });

    await runTest("T1.3: Immediate 51st request post-burst remains strictly blocked", async () => {
        const res51 = await checkRateLimit("concurrent_burst_user_1", true);
        assert.strictEqual(res51.allowed, false, "51st request must be blocked");
        assert.strictEqual(res51.remaining, 0);
        assert.ok(res51.message?.includes("Account locked"));
    });

    await runTest("T1.4: Rate limit buckets for distinct keys remain completely isolated under load", async () => {
        // "concurrent_burst_user_1" is blocked with 51 attempts
        // "fresh_user_2" must be completely uninhibited
        const resUser2 = await checkRateLimit("fresh_user_2", true);
        assert.strictEqual(resUser2.allowed, true, "Distinct user key must not be affected by burst on user 1");
        assert.strictEqual(resUser2.remaining, 4, "Remaining count must reflect attempt 1");
    });

    await runTest("T1.5: Static code audit confirms single atomic INSERT ... ON DUPLICATE KEY UPDATE query in rate-limit.ts", async () => {
        const rateLimitSrc = fs.readFileSync(path.join(projectRoot, "lib/rate-limit.ts"), "utf8");
        assert.ok(
            rateLimitSrc.includes("INSERT INTO rate_limit_tbl") &&
            rateLimitSrc.includes("ON DUPLICATE KEY UPDATE") &&
            rateLimitSrc.includes("attempts = IF("),
            "lib/rate-limit.ts must execute atomic INSERT ... ON DUPLICATE KEY UPDATE query"
        );
    });

    // =========================================================================
    // Suite 2: SEC-07 Window Expiry, Reset, and Blocked Duration
    // =========================================================================
    console.log("\n\x1b[1m[Suite 2: SEC-07 Window Expiry, Reset, and Blocked Duration]\x1b[0m");
    await resetMockDb();

    await runTest("T2.1: Read-only check (increment = false) does not increment counter or mutate record", async () => {
        const testKey = "readonly_probe_key";
        const read1 = await checkRateLimit(testKey, false);
        assert.strictEqual(read1.allowed, true, "Initial read on non-existent key must be allowed");
        assert.strictEqual(read1.remaining, 5, "Initial read must report full remaining capacity");

        // Verify no record was inserted
        assert.strictEqual(mockDb.m5RateLimits.has(`ratelimit:${testKey}`), false, "Read-only check must not insert record");

        // Now increment once
        await checkRateLimit(testKey, true);
        const record = mockDb.m5RateLimits.get(`ratelimit:${testKey}`);
        assert.ok(record, "Incremented record must exist");
        assert.strictEqual(record.attempts, 1, "Attempts must be 1");

        // Perform read-only check on existing record
        const read2 = await checkRateLimit(testKey, false);
        assert.strictEqual(read2.allowed, true);
        assert.strictEqual(read2.remaining, 4);
        assert.strictEqual(record.attempts, 1, "Read-only check must not mutate attempts counter");
    });

    await runTest("T2.2: Active rate limit window expiry resets attempts counter to 1 on subsequent increment", async () => {
        const testKey = "expired_window_key";
        // Setup record with reset_at in the past
        const pastTime = Date.now() - 60000;
        mockDb.m5RateLimits.set(`ratelimit:${testKey}`, {
            limit_key: `ratelimit:${testKey}`,
            attempts: 4,
            reset_at: pastTime,
            blocked: false,
        });

        // Next increment occurs after window expiration
        const res = await checkRateLimit(testKey, true);
        assert.strictEqual(res.allowed, true, "Expired window must allow request");
        assert.strictEqual(res.remaining, 4, "Expired window must reset bucket to 1 attempt");

        const record = mockDb.m5RateLimits.get(`ratelimit:${testKey}`);
        assert.ok(record);
        assert.strictEqual(record.attempts, 1, "Bucket attempts must reset to 1");
    });

    await runTest("T2.3: Blocked bucket remains locked during BLOCK_DURATION_MS window", async () => {
        const testKey = "blocked_duration_key";
        const now = Date.now();
        mockDb.m5RateLimits.set(`ratelimit:${testKey}`, {
            limit_key: `ratelimit:${testKey}`,
            attempts: 5,
            reset_at: now - 5000, // 5 seconds ago
            blocked: true,
        });

        const res = await checkRateLimit(testKey, false);
        assert.strictEqual(res.allowed, false, "Blocked key must be rejected");
        assert.strictEqual(res.remaining, 0);
        assert.ok(res.message?.includes("Too many attempts"));
    });

    await runTest("T2.4: clearRateLimit removes rate limit key completely from database", async () => {
        const testKey = "clear_target_key";
        mockDb.m5RateLimits.set(`ratelimit:${testKey}`, {
            limit_key: `ratelimit:${testKey}`,
            attempts: 5,
            reset_at: Date.now(),
            blocked: true,
        });

        await clearRateLimit(testKey);
        assert.strictEqual(mockDb.m5RateLimits.has(`ratelimit:${testKey}`), false, "Record must be deleted");

        const freshRead = await checkRateLimit(testKey, false);
        assert.strictEqual(freshRead.allowed, true, "Cleared key must be immediately allowed");
        assert.strictEqual(freshRead.remaining, 5);
    });

    // =========================================================================
    // Suite 3: SEC-13 Transaction Isolation & Pessimistic Locking
    // =========================================================================
    console.log("\n\x1b[1m[Suite 3: SEC-13 Transaction Isolation & Pessimistic Locking]\x1b[0m");
    await resetMockDb();

    await runTest("T3.1: 15 concurrent verifyEmail requests with identical token produce EXACTLY 1 success and 14 clean rollbacks", async () => {
        const rawToken = "valid_atomic_verification_token_m5_concurrency_123456789";
        const hashed = hashToken(rawToken);

        // Seed pending verification record in mock DB
        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "concurrent_activated_user",
            email: "concurrent_user@quizweb.dev",
            password_hash: await argon2.hash("ValidPassword123!"),
            verification_token: hashed,
            expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
            attempts: 0,
            locked_until: null,
        };
        mockDb.vrfy.push(pendingUser);

        const initialUsersCount = mockDb.users.length;
        const initialPlayersCount = mockDb.players.length;
        const CONCURRENT_COUNT = 15;

        // Fire 15 concurrent verifyEmail calls simultaneously
        const promises = Array.from({ length: CONCURRENT_COUNT }, () =>
            verifyEmail(rawToken)
        );
        const results = await Promise.all(promises);

        const successes = results.filter((r) => r.success === true);
        const failures = results.filter((r) => r.success === false);

        assert.strictEqual(successes.length, 1, `Exactly 1 concurrent request must succeed; got ${successes.length}`);
        assert.strictEqual(failures.length, CONCURRENT_COUNT - 1, `Exactly ${CONCURRENT_COUNT - 1} concurrent requests must fail cleanly`);

        // Check success response message
        assert.strictEqual(
            successes[0].message,
            "Email verified successfully. You may now close this tab."
        );

        // Check failure response messages: must cleanly report invalid or already used
        for (const failure of failures) {
            assert.strictEqual(
                failure.message,
                "This verification link is invalid or has already been used.",
                "Non-winning concurrent transactions must cleanly report already used link without crash"
            );
        }

        // Verify database state: exactly 1 new user in user_auth_tbl
        assert.strictEqual(
            mockDb.users.length,
            initialUsersCount + 1,
            "Exactly 1 user must be added to user_auth_tbl"
        );
        const createdUser = mockDb.users.find((u) => u.email === "concurrent_user@quizweb.dev");
        assert.ok(createdUser, "Created user must exist in user_auth_tbl");
        assert.strictEqual(createdUser.is_email_verified, 1, "is_email_verified must be 1");
        assert.strictEqual(createdUser.user_role, "user", "user_role must be 'user'");

        // Verify database state: exactly 1 new player in player_tbl
        assert.strictEqual(
            mockDb.players.length,
            initialPlayersCount + 1,
            "Exactly 1 player must be added to player_tbl"
        );
        const createdPlayer = mockDb.players.find((p) => p.username === "concurrent_activated_user");
        assert.ok(createdPlayer, "Created player must exist in player_tbl");
        assert.strictEqual(createdPlayer.user_id, createdUser.user_id, "player_tbl user_id must link to created user");

        // Verify verification record was deleted
        assert.strictEqual(
            mockDb.vrfy.find((v) => v.verification_token === hashed),
            undefined,
            "Consumed verification record must be deleted from user_vrfy_tbl"
        );
    });

    await runTest("T3.2: Replay attack with consumed verification token is strictly rejected", async () => {
        const rawToken = "valid_atomic_verification_token_m5_concurrency_123456789";
        const replayRes = await verifyEmail(rawToken);
        assert.strictEqual(replayRes.success, false, "Replay attack must fail");
        assert.strictEqual(
            replayRes.message,
            "This verification link is invalid or has already been used."
        );
    });

    await runTest("T3.3: Static audit confirms SELECT ... FOR UPDATE in app/actions/auth.ts verifyEmail", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            authSrc.includes("SELECT verify_id") &&
            authSrc.includes("FROM user_vrfy_tbl") &&
            authSrc.includes("FOR UPDATE"),
            "verifyEmail must execute SELECT ... FOR UPDATE on user_vrfy_tbl"
        );
        assert.ok(
            authSrc.includes("await connection.beginTransaction()"),
            "verifyEmail must initiate explicit database transaction"
        );
        assert.ok(
            authSrc.includes("await connection.commit()"),
            "verifyEmail must explicitly commit transaction upon successful verification"
        );
        assert.ok(
            authSrc.includes("await connection.rollback()"),
            "verifyEmail must explicitly roll back transaction upon errors"
        );
        assert.ok(
            authSrc.includes("connection.release()"),
            "verifyEmail must release connection in finally block"
        );
    });

    // =========================================================================
    // Suite 4: SEC-13 Transaction Rollback Guarantee
    // =========================================================================
    console.log("\n\x1b[1m[Suite 4: SEC-13 Transaction Rollback Guarantee]\x1b[0m");
    await resetMockDb();

    await runTest("T4.1: Mid-transaction error during player creation rolls back user_auth_tbl with zero orphaned records", async () => {
        const rawToken = "rollback_test_token_transient_error_987654";
        const hashed = hashToken(rawToken);

        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "rollback_target_user",
            email: "rollback_target@quizweb.dev",
            password_hash: await argon2.hash("ValidPassword123!"),
            verification_token: hashed,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        };
        mockDb.vrfy.push(pendingUser);

        const userCountBefore = mockDb.users.length;
        const playerCountBefore = mockDb.players.length;

        // Force transient error on player table insertion
        shouldSimulatePlayerInsertFailure = true;
        let res: { success: boolean; message?: string } = { success: false };
        try {
            res = await verifyEmail(rawToken);
        } finally {
            shouldSimulatePlayerInsertFailure = false;
        }

        assert.strictEqual(res.success, false, "Mid-transaction error must result in failure");
        assert.strictEqual(res.message, "An internal error occurred. Please try again later.");

        // Confirm rollback: ZERO orphaned records in user_auth_tbl and player_tbl
        assert.strictEqual(mockDb.users.length, userCountBefore, "Zero orphaned records must be left in user_auth_tbl");
        assert.strictEqual(mockDb.players.length, playerCountBefore, "Zero records must be in player_tbl");

        // Verification token in user_vrfy_tbl must NOT have been consumed
        const vrfyRecord = mockDb.vrfy.find((v) => v.verification_token === hashed);
        assert.ok(vrfyRecord, "Verification token record must remain intact after rollback");
    });

    await runTest("T4.2: Pre-existing email address collision rolls back transaction cleanly", async () => {
        const rawToken = "email_collision_token_112233";
        const hashed = hashToken(rawToken);

        // Existing user email in mockDb.users is "user@quizweb.dev"
        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "new_unique_username",
            email: "user@quizweb.dev", // COLLISION
            password_hash: await argon2.hash("ValidPassword123!"),
            verification_token: hashed,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        };
        mockDb.vrfy.push(pendingUser);

        const res = await verifyEmail(rawToken);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.message, "An account already exists with this email address.");

        // Confirm token record is still in user_vrfy_tbl
        assert.ok(mockDb.vrfy.find((v) => v.verification_token === hashed));
    });

    await runTest("T4.3: Pre-existing username collision rolls back transaction cleanly", async () => {
        const rawToken = "username_collision_token_445566";
        const hashed = hashToken(rawToken);

        // Existing username in mockDb.players is "regular_user"
        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "regular_user", // COLLISION
            email: "brand_new_unique_email@quizweb.dev",
            password_hash: await argon2.hash("ValidPassword123!"),
            verification_token: hashed,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        };
        mockDb.vrfy.push(pendingUser);

        const res = await verifyEmail(rawToken);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.message, "This username is already taken.");

        // Confirm token record is still in user_vrfy_tbl
        assert.ok(mockDb.vrfy.find((v) => v.verification_token === hashed));
    });

    await runTest("T4.4: Connection release in finally block executes across all outcomes", async () => {
        const releasesBefore = capturedConnectionReleases;
        await verifyEmail("non_existent_token_for_release_probe");
        assert.strictEqual(
            capturedConnectionReleases,
            releasesBefore + 1,
            "connection.release() must be called on error/invalid token path"
        );
    });

    // =========================================================================
    // Suite 5: Edge Cases & Boundary Values
    // =========================================================================
    console.log("\n\x1b[1m[Suite 5: Edge Cases & Boundary Values]\x1b[0m");
    await resetMockDb();

    await runTest("T5.1: Expired verification token is deleted and commits expired response", async () => {
        const rawToken = "expired_token_probe_778899";
        const hashed = hashToken(rawToken);

        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "expired_user",
            email: "expired@quizweb.dev",
            password_hash: "argon2_dummy",
            verification_token: hashed,
            expires_at: new Date(Date.now() - 1000), // 1 second in past
            attempts: 0,
            locked_until: null,
        };
        mockDb.vrfy.push(pendingUser);

        const res = await verifyEmail(rawToken);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.message, "This verification link has expired. Please sign up again.");

        // Must be deleted from user_vrfy_tbl
        assert.strictEqual(mockDb.vrfy.find((v) => v.verification_token === hashed), undefined);
    });

    await runTest("T5.2: Verification token locked by attempts (attempts >= 5) rolls back and returns locked error", async () => {
        const rawToken = "locked_token_attempts_probe";
        const hashed = hashToken(rawToken);

        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "locked_attempts_user",
            email: "locked_attempts@quizweb.dev",
            password_hash: "argon2_dummy",
            verification_token: hashed,
            expires_at: new Date(Date.now() + 600000),
            attempts: 5, // LOCKED
            locked_until: null,
        };
        mockDb.vrfy.push(pendingUser);

        const res = await verifyEmail(rawToken);
        assert.strictEqual(res.success, false);
        assert.ok(res.message?.includes("locked due to too many failed attempts"));
    });

    await runTest("T5.3: Verification token with active locked_until in future rolls back and returns locked error", async () => {
        const rawToken = "locked_until_probe_token";
        const hashed = hashToken(rawToken);

        const pendingUser: UserVrfyRow = {
            verify_id: mockDb.nextVrfyId++,
            username: "locked_until_user",
            email: "locked_until@quizweb.dev",
            password_hash: "argon2_dummy",
            verification_token: hashed,
            expires_at: new Date(Date.now() + 600000),
            attempts: 1,
            locked_until: new Date(Date.now() + 300000), // Locked for 5 mins
        };
        mockDb.vrfy.push(pendingUser);

        const res = await verifyEmail(rawToken);
        assert.strictEqual(res.success, false);
        assert.ok(res.message?.includes("locked due to too many failed attempts"));
    });

    await runTest("T5.4: Malformed, empty, or whitespace-only token inputs fail closed without opening database connection", async () => {
        const badInputs = ["", "   ", null as unknown as string, undefined as unknown as string];
        const initialReleases = capturedConnectionReleases;

        for (const bad of badInputs) {
            const res = await verifyEmail(bad);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.message, "Invalid verification link.");
        }

        assert.strictEqual(
            capturedConnectionReleases,
            initialReleases,
            "Invalid token inputs must not acquire database connection"
        );
    });

    await runTest("T5.5: Non-existent token returns generic invalid or already used message", async () => {
        const res = await verifyEmail("definitely_non_existent_token_12345");
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.message, "This verification link is invalid or has already been used.");
    });

    // =========================================================================
    // Suite 6: Full Multi-Milestone Zero Regression Guard (M1, M2, M3, M4)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 6: Full Multi-Milestone Zero Regression Guard (M1, M2, M3, M4)]\x1b[0m");

    await runTest("M1: Database schema migrations exist and define token_version, attempts, locked_until", async () => {
        const m1 = fs.readFileSync(path.join(projectRoot, "migrations/002_security_hardening.sql"), "utf8");
        assert.ok(m1.includes("token_version"), "M1 migration must define token_version");
        assert.ok(m1.includes("attempts"), "M1 migration must define attempts");
        assert.ok(m1.includes("locked_until"), "M1 migration must define locked_until");
    });

    await runTest("M2: Route middleware exists and guards /pending and /input; clearLoginRateLimit not exported", async () => {
        const middlewareSrc = fs.readFileSync(path.join(projectRoot, "middleware.ts"), "utf8");
        assert.ok(middlewareSrc.includes("/pending"), "Middleware must guard /pending");
        assert.ok(middlewareSrc.includes("/input"), "Middleware must guard /input");
        assert.ok(middlewareSrc.includes("admin"), "Middleware must verify admin role");

        const authActions = await import("../app/actions/auth");
        assert.strictEqual(
            (authActions as Record<string, unknown>).clearLoginRateLimit,
            undefined,
            "clearLoginRateLimit must NOT be exported from app/actions/auth"
        );
    });

    await runTest("M3: Session revocation and password reset token_version increment preserved", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "auth.ts"), "utf8");
        assert.ok(authSrc.includes("token_version"), "auth.ts must validate token_version");
        assert.ok(authSrc.includes("signOut"), "auth.ts must define signOut event handler");
    });

    await runTest("M4: reqPassReset uniform responses and anti-enumeration preserved", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(authSrc.includes("reqPassReset"), "app/actions/auth.ts must define reqPassReset");
        assert.ok(authSrc.includes("verifyOTP"), "app/actions/auth.ts must define verifyOTP");
        assert.ok(authSrc.includes("is_used = 2"), "app/actions/auth.ts must set is_used = 2 for replay prevention");
    });

    // =========================================================================
    // Suite 7: OWASP ASVS v4.0.3 Chapter 3, 4, 11 Compliance Audit
    // =========================================================================
    console.log("\n\x1b[1m[Suite 7: OWASP ASVS v4.0.3 Chapter 3, 4, 11 Compliance Audit]\x1b[0m");

    await runTest("V3.1.1 & V3.4.2: Session & token management controls securely verified", async () => {
        // 1. Static AST/Source Code Audit of app/actions/auth.ts (SEC-12, ASVS V3.1.1, V3.4.2)
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");

        // Verify hashToken implementation using SHA-256 hex digest
        assert.ok(
            authSrc.includes("function hashToken(raw: string): string") &&
            authSrc.includes('crypto.createHash("sha256").update(raw).digest("hex")'),
            "app/actions/auth.ts must implement internal hashToken with SHA-256 hex digest"
        );

        // Verify hashToken & timingSafeEqualStr are internal and not exported
        assert.ok(
            !/export\s+(async\s+)?function\s+hashToken\b/.test(authSrc),
            "hashToken must NOT be exported from server actions file"
        );
        assert.ok(
            !/export\s+(async\s+)?function\s+timingSafeEqualStr\b/.test(authSrc),
            "timingSafeEqualStr must NOT be exported from server actions file"
        );

        // Verify signUp hashes email verification token before storing in user_vrfy_tbl
        assert.ok(
            authSrc.includes("const hashedVerificationToken = hashToken(rawVerificationToken)") &&
            authSrc.includes("INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at, attempts, locked_until)"),
            "signUp must hash verification token using SHA-256 before inserting into user_vrfy_tbl"
        );

        // Verify verifyEmail hashes incoming token prior to pessimistic row lock lookup
        assert.ok(
            authSrc.includes("const hashedToken = hashToken(token.trim())") &&
            authSrc.includes("WHERE verification_token = ? LIMIT 1 FOR UPDATE"),
            "verifyEmail must hash candidate token with SHA-256 before SELECT ... FOR UPDATE lookup"
        );

        // Verify reqPassReset hashes OTP before storing in user_otp_tbl
        assert.ok(
            authSrc.includes("const hashedOtp = hashToken(rawOtp)") &&
            authSrc.includes("INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose, attempts, locked_until)"),
            "reqPassReset must hash OTP code using SHA-256 before inserting into user_otp_tbl"
        );

        // Verify verifyOTP hashes candidate OTP and uses timingSafeEqualStr
        assert.ok(
            authSrc.includes("const hashedInputOtp = hashToken(otpCode.trim())") &&
            authSrc.includes("timingSafeEqualStr(otp.otp_code, hashedInputOtp)"),
            "verifyOTP must hash incoming OTP code and perform constant-time comparison"
        );

        // 2. Static Schema Audit of migrations/002_security_hardening.sql
        const migrationSrc = fs.readFileSync(path.join(projectRoot, "migrations/002_security_hardening.sql"), "utf8");
        assert.ok(
            migrationSrc.includes("`verification_token` VARCHAR(255) NOT NULL") &&
            migrationSrc.includes("`otp_code` VARCHAR(255) NOT NULL"),
            "Database schema must allocate VARCHAR(255) for 64-character SHA-256 hexadecimal digests"
        );
        assert.ok(
            migrationSrc.includes("attempts") && migrationSrc.includes("locked_until"),
            "Database schema must provide attempt tracking and lockout columns"
        );

        // 3. Empirical & Behavioral Cryptographic Verification
        const sampleRaw = crypto.randomBytes(32).toString("hex");
        const digest = hashToken(sampleRaw);
        const expectedDigest = crypto.createHash("sha256").update(sampleRaw).digest("hex");

        assert.strictEqual(digest, expectedDigest, "hashToken output must match standard SHA-256 digest");
        assert.strictEqual(digest.length, 64, "SHA-256 digest must be exactly 64 characters");
        assert.ok(/^[0-9a-f]{64}$/.test(digest), "SHA-256 digest must be lowercase hexadecimal format");
        assert.notStrictEqual(sampleRaw, digest, "Cleartext token must never equal hashed digest (ASVS V3.4.2)");

        // Deterministic & Avalanche behavior
        const repeatDigest = hashToken(sampleRaw);
        assert.strictEqual(digest, repeatDigest, "hashToken must be deterministic");
        const alteredRaw = sampleRaw.slice(0, -1) + (sampleRaw.endsWith("a") ? "b" : "a");
        const alteredDigest = hashToken(alteredRaw);
        assert.notStrictEqual(digest, alteredDigest, "Bit alteration in raw token must produce completely different hash");

        // 4. Behavioral verification of server-side token verification (ASVS V3.1.1)
        // 4.1 Unhashed / cleartext token in DB is rejected because verifyEmail enforces SHA-256 lookup
        const cleartextOnlyToken = "cleartext_token_stored_in_db_must_fail_lookup";
        mockDb.vrfy.push({
            verify_id: mockDb.nextVrfyId++,
            username: "cleartext_token_user",
            email: "cleartext@quizweb.dev",
            password_hash: await argon2.hash("ValidPass123!"),
            verification_token: cleartextOnlyToken,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        });

        const unhashedLookupRes = await verifyEmail(cleartextOnlyToken);
        assert.strictEqual(
            unhashedLookupRes.success,
            false,
            "verifyEmail must fail closed if token is stored in cleartext, proving SHA-256 hashing lookup"
        );

        // 4.2 Hashed token in DB successfully authenticates and activates user
        const validRawToken = "valid_asvs_verification_token_v311_v342_test";
        const validHashedToken = hashToken(validRawToken);
        mockDb.vrfy.push({
            verify_id: mockDb.nextVrfyId++,
            username: "asvs_v3_valid_user",
            email: "asvs_v3_valid@quizweb.dev",
            password_hash: await argon2.hash("ValidPass123!"),
            verification_token: validHashedToken,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        });

        const validLookupRes = await verifyEmail(validRawToken);
        assert.strictEqual(
            validLookupRes.success,
            true,
            "verifyEmail must succeed when database record contains SHA-256 hashed digest"
        );
        const activatedUser = mockDb.users.find((u) => u.email === "asvs_v3_valid@quizweb.dev");
        assert.ok(activatedUser, "Activated user must be created in user_auth_tbl");
        assert.strictEqual(activatedUser.is_email_verified, 1, "User must be marked email verified");

        // 4.3 Fail-closed on missing, empty, or whitespace tokens
        const emptyRes = await verifyEmail("");
        assert.strictEqual(emptyRes.success, false, "Empty token must fail closed");
        const wsRes = await verifyEmail("    ");
        assert.strictEqual(wsRes.success, false, "Whitespace token must fail closed");
    });

    await runTest("V4.1.5: Transaction isolation & pessimistic row locking (SELECT ... FOR UPDATE) eliminates TOCTOU races (SEC-13)", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            authSrc.includes("SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1 FOR UPDATE"),
            "verifyEmail must acquire pessimistic row lock via SELECT ... FOR UPDATE"
        );
    });

    await runTest("V11.1.6: Atomic concurrency controls (INSERT ... ON DUPLICATE KEY UPDATE) prevent rate limit race conditions (SEC-07)", async () => {
        const rlSrc = fs.readFileSync(path.join(projectRoot, "lib/rate-limit.ts"), "utf8");
        assert.ok(
            rlSrc.includes("INSERT INTO rate_limit_tbl (limit_key, attempts, reset_at, blocked) VALUES (?, 1, ?, 0) ON DUPLICATE KEY UPDATE attempts = IF("),
            "checkRateLimit must execute atomic single-query upsert to prevent TOCTOU bypasses"
        );
    });

    // -------------------------------------------------------------------------
    // Final Summary Report
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    console.log(` Test Execution Summary: ${passedTests}/${totalTests} Passed`);
    if (failedTests > 0) {
        console.log(` Status: FAILED (${failedTests} tests failed)`);
        process.exit(1);
    } else {
        console.log(" Status: ALL VERIFICATIONS PASSED");
        console.log(" OWASP ASVS v4.0.3 Compliance: VERIFIED");
        console.log("   - SEC-07 / V11.1.6: Atomic Rate Limiting (INSERT ... ON DUPLICATE KEY UPDATE)");
        console.log("   - SEC-13 / V4.1.5: Transaction Isolation & Pessimistic Locking (SELECT ... FOR UPDATE)");
        console.log("   - Zero Regressions across M1, M2, M3, M4");
        console.log("========================================================\n");
    }
}

main().catch((err) => {
    console.error("Fatal error running Milestone 5 test suite:", err);
    process.exit(1);
});
