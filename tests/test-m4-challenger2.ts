/**
 * =============================================================================
 * Milestone 4 Challenger 2 Empirical Test Harness: tests/test-m4-challenger2.ts
 * =============================================================================
 * Adversarially challenges:
 *   - SEC-08: Anti-enumeration in reqPassReset
 *   - SEC-10: Rate limiting against email flooding in reqPassReset
 *
 * Runs standalone with npx --yes tsx tests/test-m4-challenger2.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import argon2 from "argon2";

// Environment setup
const projectRoot = process.cwd();
const mainNodeModules = "/home/sankobite/QuizWeb/node_modules";
const localNodeModules = path.join(projectRoot, "node_modules");

if (!fs.existsSync(localNodeModules) && fs.existsSync(mainNodeModules)) {
    try {
        fs.symlinkSync(mainNodeModules, localNodeModules, "junction");
    } catch {
        if (!process.env.NODE_PATH) {
            process.env.NODE_PATH = mainNodeModules;
        }
    }
}

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test_secret_32_characters_minimum_length_for_jwt";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m4_audit";

// Global mock for transactional email
interface CapturedEmail {
    to: string;
    subject: string;
    html: string;
}
let capturedEmails: CapturedEmail[] = [];
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
        capturedEmails.push({
            to: Array.isArray(bodyObj.to) ? String(bodyObj.to[0]) : String(bodyObj.to || ""),
            subject: String(bodyObj.subject || ""),
            html: String(bodyObj.html || ""),
        });
        return new Response(JSON.stringify({ id: "mock_resend_challenger_" + Date.now() }), {
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
const failures: { name: string; error: string }[] = [];

async function runTest(testName: string, testFn: () => void | Promise<void>) {
    totalTests++;
    try {
        await testFn();
        passedTests++;
        console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
    } catch (err: unknown) {
        failedTests++;
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ name: testName, error: msg });
        console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
        console.error(`    \x1b[31mError:\x1b[0m ${msg}`);
    }
}

// Mock Database State Machine
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

interface UserOtpRow {
    otp_id: number;
    user_id: number;
    otp_code: string;
    expires_at: Date;
    is_used: number;
    purpose: string;
    attempts: number;
    locked_until: Date | null;
}

interface RateLimitRow {
    limit_key: string;
    attempts: number;
    reset_at: number;
    blocked: boolean;
}

interface MockDatabaseState {
    users: UserAuthRow[];
    players: PlayerRow[];
    otps: UserOtpRow[];
    rateLimits: Map<string, RateLimitRow>;
    nextUserId: number;
    nextPlayerId: number;
    nextOtpId: number;
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
            {
                user_id: 3,
                email: "target@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 1, user_id: 1, username: "admin_user" },
            { player_id: 2, user_id: 2, username: "regular_user" },
            { player_id: 3, user_id: 3, username: "target_user" },
        ],
        otps: [],
        rateLimits: new Map(),
        nextUserId: 10,
        nextPlayerId: 10,
        nextOtpId: 10,
    };
    capturedEmails = [];
}

// Database Mock
import { db } from "../lib/db";

db.query = (async (sql: string, params: unknown[] = []) => {
    // 1. SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1
    if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1")) {
        const email = String(params[0]);
        const match = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        return match ? [[{ user_id: match.user_id }]] : [[]];
    }

    // 2. SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1
    if (sql.includes("SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1")) {
        const userId = Number(params[0]);
        const match = mockDb.players.find((p) => p.user_id === userId);
        return match ? [[{ username: match.username }]] : [[]];
    }

    // 3. UPDATE user_otp_tbl SET is_used = 1 (or 2) WHERE user_id = ? AND purpose = ? AND is_used = 0
    if (sql.includes("UPDATE user_otp_tbl SET is_used =") && sql.includes("AND is_used = 0")) {
        const userId = Number(params[0]);
        const purpose = String(params[1]);
        for (const otp of mockDb.otps) {
            if (otp.user_id === userId && otp.purpose === purpose && otp.is_used === 0) {
                otp.is_used = sql.includes("is_used = 2") ? 2 : 1;
            }
        }
        return [{ affectedRows: 1 }];
    }

    // 4. INSERT INTO user_otp_tbl
    if (sql.includes("INSERT INTO user_otp_tbl")) {
        const userId = Number(params[0]);
        const otpCode = String(params[1]);
        const expiresAt = params[2] as Date;
        const isUsed = Number(params[3]);
        const purpose = String(params[4]);
        const attempts = Number(params[5] || 0);
        const lockedUntil = (params[6] as Date) || null;
        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: userId,
            otp_code: otpCode,
            expires_at: expiresAt,
            is_used: isUsed,
            purpose,
            attempts,
            locked_until: lockedUntil,
        });
        return [{ affectedRows: 1 }];
    }

    // 5. Rate limit query
    if (sql.includes("SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?")) {
        const key = String(params[0]);
        const row = mockDb.rateLimits.get(key);
        return row ? [[{ ...row }]] : [[]];
    }

    // 6. Delete rate limit
    if (sql.includes("DELETE FROM rate_limit_tbl WHERE limit_key = ?")) {
        const key = String(params[0]);
        mockDb.rateLimits.delete(key);
        return [{ affectedRows: 1 }];
    }

    // 7. Insert / Upsert rate limit
    if (sql.includes("INSERT INTO rate_limit_tbl (limit_key, attempts, reset_at, blocked)")) {
        const key = String(params[0]);
        const resetAt = Number(params[1]);
        const existing = mockDb.rateLimits.get(key);
        if (!existing) {
            mockDb.rateLimits.set(key, { limit_key: key, attempts: 0, reset_at: resetAt, blocked: false });
        } else {
            existing.attempts = 0;
            existing.reset_at = resetAt;
            existing.blocked = false;
        }
        return [{ affectedRows: 1 }];
    }

    // 8. Update rate limit
    if (sql.includes("UPDATE rate_limit_tbl SET attempts = attempts + 1, blocked = TRUE, reset_at = ?")) {
        const resetAt = Number(params[0]);
        const key = String(params[1]);
        const existing = mockDb.rateLimits.get(key);
        if (existing) {
            existing.attempts += 1;
            existing.blocked = true;
            existing.reset_at = resetAt;
        }
        return [{ affectedRows: 1 }];
    }

    if (sql.includes("UPDATE rate_limit_tbl SET attempts = attempts + 1 WHERE limit_key = ?")) {
        const key = String(params[0]);
        const existing = mockDb.rateLimits.get(key);
        if (existing) {
            existing.attempts += 1;
        }
        return [{ affectedRows: 1 }];
    }

    return [[]];
}) as unknown as typeof db.query;

async function main() {
    console.log("========================================================");
    console.log(" Milestone 4 Challenger 2: Adversarial Security Harness ");
    console.log(" Targets: SEC-08 (Anti-Enumeration in reqPassReset)     ");
    console.log("          SEC-10 (Rate Limiting in reqPassReset)        ");
    console.log("========================================================\n");

    const authActions = await import("../app/actions/auth");
    const { reqPassReset } = authActions;

    // =========================================================================
    // SECTION 1: SEC-08 Anti-Enumeration Deep Challenge
    // =========================================================================
    console.log("\x1b[1m[Section 1: SEC-08 Anti-Enumeration & Uniform Responses]\x1b[0m");

    await resetMockDb();

    await runTest("SEC-08.1: Exact response payload parity between registered & unregistered email", async () => {
        const registered = await reqPassReset("user@quizweb.dev");
        const unregistered = await reqPassReset("nonexistent_attacker_target@quizweb.dev");

        assert.deepStrictEqual(
            Object.keys(registered).sort(),
            ["message", "success"].sort(),
            "Registered email response must have keys ['message', 'success']"
        );
        assert.deepStrictEqual(
            Object.keys(unregistered).sort(),
            ["message", "success"].sort(),
            "Unregistered email response must have keys ['message', 'success']"
        );
        assert.strictEqual(registered.success, true);
        assert.strictEqual(unregistered.success, true);
        assert.strictEqual(registered.message, unregistered.message);
        assert.strictEqual(
            registered.message,
            "If an account exists with this email, a reset code has been sent."
        );
    });

    await resetMockDb();

    await runTest("SEC-08.2: Special characters & tag subaddressing (user+tag@domain.com)", async () => {
        const res = await reqPassReset("user+tag@quizweb.dev");
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.message, "If an account exists with this email, a reset code has been sent.");
    });

    await runTest("SEC-08.3: Whitespace handling with leading & trailing spaces", async () => {
        const res = await reqPassReset("   user@quizweb.dev   ");
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.message, "If an account exists with this email, a reset code has been sent.");
        // Check that email was sent to normalized address
        const lastEmail = capturedEmails[capturedEmails.length - 1];
        assert.strictEqual(lastEmail.to, "user@quizweb.dev");
    });

    await runTest("SEC-08.4: Case-insensitivity across uppercase and mixed-case emails", async () => {
        const resUpper = await reqPassReset("ADMIN@QUIZWEB.DEV");
        assert.strictEqual(resUpper.success, true);
        const resMixed = await reqPassReset("TaRgEt@QuizWeb.Dev");
        assert.strictEqual(resMixed.success, true);
    });

    await runTest("SEC-08.5: SQL injection payloads in email field fail safe without syntax crash", async () => {
        const sqliPayloads = [
            "admin@quizweb.dev' OR '1'='1",
            "' OR 1=1; --@quizweb.dev",
            "test' UNION SELECT user_id, 1 FROM user_auth_tbl WHERE '1'='1",
            "'; DROP TABLE user_auth_tbl; --@dev.com",
        ];

        for (const payload of sqliPayloads) {
            const res = await reqPassReset(payload);
            // Must either reject as invalid email format or handle safely without DB error
            if (res.error) {
                assert.strictEqual(res.error, "Please enter a valid email address.");
            } else {
                assert.strictEqual(res.success, true);
                assert.strictEqual(res.message, "If an account exists with this email, a reset code has been sent.");
            }
        }
    });

    await runTest("SEC-08.6: Malformed email syntax is strictly rejected by input validator", async () => {
        const invalidInputs = [
            "",
            "   ",
            "not-an-email",
            "@missinguser.com",
            "missingdomain@",
            "user@domain",
            "user@.com",
            "user name@domain.com",
            null as unknown as string,
            undefined as unknown as string,
            12345 as unknown as string,
            {} as unknown as string,
        ];

        for (const input of invalidInputs) {
            const res = await reqPassReset(input);
            assert.strictEqual(res.success, undefined, `Input "${String(input).slice(0, 20)}" should not succeed`);
            assert.strictEqual(res.error, "Please enter a valid email address.");
        }
    });

    await runTest("SEC-08.7: Oversized email strings fail-safe without crashing the server", async () => {
        const oversized = "a".repeat(1000) + "@domain.com";
        const res = await reqPassReset(oversized);
        // It must handle cleanly without throwing unhandled exceptions
        assert.ok(res.success === true || res.error !== undefined);
    });

    await runTest("SEC-08.8: Prototype pollution attempts (__proto__, constructor) handled safely", async () => {
        const pollutionPayloads = [
            "__proto__@quizweb.dev",
            "constructor@quizweb.dev",
            "prototype@quizweb.dev",
        ];

        for (const payload of pollutionPayloads) {
            const res = await reqPassReset(payload);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.message, "If an account exists with this email, a reset code has been sent.");
        }
    });

    await runTest("SEC-08.9: Timing channel analysis (statistical parity between exists and not exists)", async () => {
        // Reset DB to clean rate limits for these dedicated test keys
        const samples = 30;
        const existsTimings: number[] = [];
        const notExistsTimings: number[] = [];

        for (let i = 0; i < samples; i++) {
            // Use distinct email address to prevent hitting rate limit
            const existEmail = `timing_exist_${i}@quizweb.dev`;
            const notExistEmail = `timing_notexist_${i}@quizweb.dev`;

            // Add existEmail to mockDb
            mockDb.users.push({
                user_id: 100 + i,
                email: existEmail,
                password_hash: "hash",
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            });

            // Measure exist
            const t0 = performance.now();
            await reqPassReset(existEmail);
            const t1 = performance.now();
            existsTimings.push(t1 - t0);

            // Measure not-exist
            const t2 = performance.now();
            await reqPassReset(notExistEmail);
            const t3 = performance.now();
            notExistsTimings.push(t3 - t2);
        }

        const avgExist = existsTimings.reduce((a, b) => a + b, 0) / samples;
        const avgNotExist = notExistsTimings.reduce((a, b) => a + b, 0) / samples;
        const diff = Math.abs(avgExist - avgNotExist);

        console.log(`    [Timing analysis] Avg Exist: ${avgExist.toFixed(3)}ms | Avg NotExist: ${avgNotExist.toFixed(3)}ms | Diff: ${diff.toFixed(3)}ms`);
        // Under mock environment, difference should be tiny (< 5ms)
        assert.ok(diff < 10, `Timing difference (${diff.toFixed(3)}ms) must be within acceptable microsecond range`);
    });

    // =========================================================================
    // SECTION 2: SEC-10 Rate Limiting & Anti-Flooding Challenge
    // =========================================================================
    console.log("\n\x1b[1m[Section 2: SEC-10 Rate Limiting & Email Flooding]\x1b[0m");

    await resetMockDb();

    await runTest("SEC-10.1: Rapid-fire request progression tracking", async () => {
        const victimEmail = "flood_target@quizweb.dev";
        const results: { attempt: number; allowed: boolean; res: unknown }[] = [];

        // Send 7 rapid requests
        for (let i = 1; i <= 7; i++) {
            const res = await reqPassReset(victimEmail);
            results.push({
                attempt: i,
                allowed: res.success === true,
                res,
            });
        }

        console.log(`    [Progression] Attempts: ${results.map(r => `${r.attempt}:${r.allowed ? 'PASS' : 'BLOCKED'}`).join(", ")}`);
        // Requests 1 to 4 succeed
        for (let i = 0; i < 4; i++) {
            assert.strictEqual(results[i].allowed, true, `Request ${i + 1} must be processed`);
        }
        // Exceeding threshold must be blocked
        assert.strictEqual(results[4].allowed, false, "Request 5 (threshold reached) is blocked");
        assert.strictEqual(results[5].allowed, false, "Request 6 must be blocked");
        assert.strictEqual(results[6].allowed, false, "Request 7 must be blocked");
    });

    await resetMockDb();

    await runTest("SEC-10.2: Per-key isolation (Rate limit on User A does NOT block User B)", async () => {
        const emailA = "user_alpha@quizweb.dev";
        const emailB = "user_beta@quizweb.dev";

        // Flood User A until blocked
        for (let i = 1; i <= 6; i++) {
            await reqPassReset(emailA);
        }

        // User A must be blocked
        const resA = await reqPassReset(emailA);
        assert.strictEqual(resA.error, "Too many password reset requests. Please try again later.");

        // User B must still be permitted!
        const resB = await reqPassReset(emailB);
        assert.strictEqual(resB.success, true, "User B must not be affected by User A's rate limit");
    });

    await resetMockDb();

    await runTest("SEC-10.3: Normalization isolation (Case variants share the same bucket)", async () => {
        await reqPassReset("shared_limit@quizweb.dev"); // attempt 1
        await reqPassReset("SHARED_LIMIT@QUIZWEB.DEV"); // attempt 2
        await reqPassReset("Shared_Limit@QuizWeb.Dev"); // attempt 3
        await reqPassReset("  shared_limit@quizweb.dev  "); // attempt 4

        // 5th attempt with another variant should be blocked
        const res5 = await reqPassReset("sHaReD_lImIt@qUiZwEb.dEv");
        assert.strictEqual(res5.error, "Too many password reset requests. Please try again later.");
    });

    await resetMockDb();

    await runTest("SEC-10.4: Rate-limited requests produce ZERO side effects (no email, no OTP)", async () => {
        const victimEmail = "user@quizweb.dev";

        // Exhaust quota
        for (let i = 1; i <= 4; i++) {
            await reqPassReset(victimEmail);
        }

        const emailCountBefore = capturedEmails.length;
        const otpCountBefore = mockDb.otps.length;

        // Blocked attempts
        for (let i = 0; i < 5; i++) {
            const blocked = await reqPassReset(victimEmail);
            assert.strictEqual(blocked.error, "Too many password reset requests. Please try again later.");
        }

        // Verify side effects
        assert.strictEqual(capturedEmails.length, emailCountBefore, "Zero new emails sent during lockout");
        assert.strictEqual(mockDb.otps.length, otpCountBefore, "Zero new OTP records inserted during lockout");
    });

    await resetMockDb();

    await runTest("SEC-10.5: Rate limit applies equally to non-existent email targets", async () => {
        const nonExistentEmail = "nobody_exists_here@quizweb.dev";

        for (let i = 1; i <= 4; i++) {
            const res = await reqPassReset(nonExistentEmail);
            assert.strictEqual(res.success, true);
        }

        const resBlocked = await reqPassReset(nonExistentEmail);
        assert.strictEqual(resBlocked.error, "Too many password reset requests. Please try again later.");
    });

    console.log("\n========================================================");
    console.log(` Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log("========================================================\n");

    if (failedTests > 0) {
        process.exit(1);
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
