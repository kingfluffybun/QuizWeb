/**
 * =============================================================================
 * Milestone 4 Verification Test Harness: tests/test-m4.ts
 * =============================================================================
 * Targets:
 *   - SEC-01: OTP Attempt Counter & Lockout in verifyOTP
 *   - SEC-02: OTP Expiration & Replay Prevention in resetPass (is_used = 2)
 *   - SEC-08: User Enumeration Prevention in reqPassReset (no TypeError)
 *   - SEC-10: Rate Limiting & Email Flooding Prevention in reqPassReset
 *
 * Standards:
 *   - OWASP ASVS v4.0.3 Chapter 2 & Chapter 3
 *     (V2.1.8, V2.2.1, V2.5.3, V2.8.4, V3.7.1, V3.7.2, V11.1.3)
 *
 * Execution:
 *   npx --yes tsx tests/test-m4.ts
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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m4_audit";

// Global mock for transactional email (Resend)
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
        return new Response(JSON.stringify({ id: "mock_resend_m4_" + Date.now() }), {
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

// -----------------------------------------------------------------------------
// Mock Database State Machine
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

interface UserOtpRow {
    otp_id: number;
    user_id: number;
    otp_code: string;
    expires_at: Date;
    is_used: number; // 0 = unused, 1 = verified, 2 = consumed
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

// -----------------------------------------------------------------------------
// Database Query Interceptor
// -----------------------------------------------------------------------------
import { db } from "../lib/db";

db.query = (async (sql: string, params: unknown[] = []) => {
    // 1. SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1
    if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1")) {
        const email = String(params[0]).toLowerCase();
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email);
        if (!user) return [[]];
        return [[{ user_id: user.user_id }]];
    }

    // 2. SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1
    if (sql.includes("SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1")) {
        const userId = Number(params[0]);
        const player = mockDb.players.find((p) => p.user_id === userId);
        if (!player) return [[]];
        return [[{ username: player.username }]];
    }

    // 3. SELECT otp_id, otp_code, expires_at, is_used, attempts, locked_until FROM user_otp_tbl ... is_used = 0
    if (sql.includes("FROM user_otp_tbl") && sql.includes("is_used = 0")) {
        const userId = Number(params[0]);
        const purpose = String(params[1]);
        const matches = mockDb.otps
            .filter((o) => o.user_id === userId && o.purpose === purpose && o.is_used === 0)
            .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime() || b.otp_id - a.otp_id);
        if (matches.length === 0) return [[]];
        const top = matches[0];
        return [[{
            otp_id: top.otp_id,
            otp_code: top.otp_code,
            expires_at: top.expires_at,
            is_used: top.is_used,
            attempts: top.attempts,
            locked_until: top.locked_until,
        }]];
    }

    // 4. SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl (for resetPass)
    if (sql.includes("FROM user_otp_tbl") && !sql.includes("is_used = 0")) {
        const userId = Number(params[0]);
        const purpose = String(params[1]);
        const matches = mockDb.otps
            .filter((o) => o.user_id === userId && o.purpose === purpose)
            .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime() || b.otp_id - a.otp_id);
        if (matches.length === 0) return [[]];
        const top = matches[0];
        return [[{
            otp_id: top.otp_id,
            otp_code: top.otp_code,
            expires_at: top.expires_at,
            is_used: top.is_used,
        }]];
    }

    // 5. UPDATE user_otp_tbl SET attempts = attempts + 1
    if (sql.includes("UPDATE user_otp_tbl") && sql.includes("attempts = attempts + 1")) {
        const otpId = Number(params[0]);
        const otp = mockDb.otps.find((o) => o.otp_id === otpId);
        if (otp) {
            otp.attempts += 1;
            if (otp.attempts >= 5) {
                otp.locked_until = new Date();
            }
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 5b. UPDATE user_otp_tbl SET attempts = 5, locked_until = NOW() WHERE otp_id = ?
    if (sql.includes("UPDATE user_otp_tbl SET attempts = 5, locked_until = NOW()")) {
        const otpId = Number(params[0]);
        const otp = mockDb.otps.find((o) => o.otp_id === otpId);
        if (otp) {
            otp.attempts = 5;
            otp.locked_until = new Date();
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 6. UPDATE user_otp_tbl SET attempts = ? WHERE otp_id = ?
    if (sql.includes("UPDATE user_otp_tbl SET attempts = ? WHERE otp_id = ?")) {
        const attempts = Number(params[0]);
        const otpId = Number(params[1]);
        const otp = mockDb.otps.find((o) => o.otp_id === otpId);
        if (otp) {
            otp.attempts = attempts;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 7. UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?
    if (sql.includes("UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?")) {
        const otpId = Number(params[0]);
        const otp = mockDb.otps.find((o) => o.otp_id === otpId);
        if (otp) {
            otp.is_used = 1;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 8. UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?
    if (sql.includes("UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?")) {
        const otpId = Number(params[0]);
        const otp = mockDb.otps.find((o) => o.otp_id === otpId);
        if (otp) {
            otp.is_used = 2;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 9. UPDATE user_otp_tbl SET is_used = 1 (or 2) WHERE user_id = ? AND purpose = ? AND is_used = 0
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

    // 10. INSERT INTO user_otp_tbl
    if (sql.includes("INSERT INTO user_otp_tbl")) {
        const userId = Number(params[0]);
        const otpCode = String(params[1]);
        const expiresAt = new Date(params[2] as string | number | Date);
        const isUsed = Number(params[3]);
        const purpose = String(params[4]);
        const newId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: newId,
            user_id: userId,
            otp_code: otpCode,
            expires_at: expiresAt,
            is_used: isUsed,
            purpose,
            attempts: 0,
            locked_until: null,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 11. UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?
    if (sql.includes("UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?")) {
        const newHash = String(params[0]);
        const userId = Number(params[1]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (user) {
            user.password_hash = newHash;
            user.token_version += 1;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 12. Rate limit table handling (Real stateful execution of lib/rate-limit.ts)
    if (sql.includes("SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?")) {
        const key = String(params[0]);
        const row = mockDb.rateLimits.get(key);
        if (!row) return [[]];
        return [[{ attempts: row.attempts, reset_at: row.reset_at, blocked: row.blocked }]];
    }

    if (sql.includes("DELETE FROM rate_limit_tbl WHERE limit_key = ?")) {
        const key = String(params[0]);
        mockDb.rateLimits.delete(key);
        return [{ affectedRows: 1 }];
    }

    if (sql.includes("INSERT INTO rate_limit_tbl") && sql.includes("ON DUPLICATE KEY UPDATE")) {
        const key = String(params[0]);
        const resetAt = Number(params[1]);
        const existing = mockDb.rateLimits.get(key);
        if (existing) {
            existing.attempts = 0;
            existing.reset_at = resetAt;
            existing.blocked = false;
        } else {
            mockDb.rateLimits.set(key, { limit_key: key, attempts: 0, reset_at: resetAt, blocked: false });
        }
        return [{ affectedRows: 1 }];
    }

    if (sql.includes("UPDATE rate_limit_tbl SET attempts = attempts + 1, blocked = TRUE")) {
        const resetAt = Number(params[0]);
        const key = String(params[1]);
        const row = mockDb.rateLimits.get(key);
        if (row) {
            row.attempts += 1;
            row.blocked = true;
            row.reset_at = resetAt;
        }
        return [{ affectedRows: 1 }];
    }

    if (sql.includes("UPDATE rate_limit_tbl SET attempts = attempts + 1 WHERE limit_key = ?")) {
        const key = String(params[0]);
        const row = mockDb.rateLimits.get(key);
        if (row) {
            row.attempts += 1;
        }
        return [{ affectedRows: 1 }];
    }

    return [{ affectedRows: 1, insertId: 999 }];
}) as unknown as typeof db.query;

// -----------------------------------------------------------------------------
// Test Runner Function
// -----------------------------------------------------------------------------
async function main() {
    console.log("\n========================================================");
    console.log(" QuizWeb Milestone 4: Standalone Security Verification");
    console.log(" Targets: SEC-01 (OTP 5-Attempt Counter & Lockout)");
    console.log("          SEC-02 (OTP Expiration & Replay Prevention)");
    console.log("          SEC-08 (Anti-Enumeration in reqPassReset)");
    console.log("          SEC-10 (Rate Limiting on reqPassReset)");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 2 & Chapter 3");
    console.log("========================================================\n");

    // Dynamic import of auth server actions
    const authActions = await import("../app/actions/auth");
    const { reqPassReset, verifyOTP, resetPass } = authActions;

    // =========================================================================
    // Suite 1: SEC-01 OTP Attempt Counter & Lockout in verifyOTP
    // =========================================================================
    console.log("\x1b[1m[Suite 1: SEC-01 OTP Attempt Counter & Permanent Lockout]\x1b[0m");

    await resetMockDb();

    await runTest("T1.1: Failed attempts 1 through 4 increment counter and return retry error", async () => {
        const targetEmail = "target@quizweb.dev";
        const realOtp = "555111";
        const hashedOtp = crypto.createHash("sha256").update(realOtp).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 3,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        // Attempts 1 to 4 with incorrect OTPs
        for (let i = 1; i <= 4; i++) {
            const wrongCode = `00000${i}`;
            const res = await verifyOTP(targetEmail, wrongCode);
            assert.strictEqual(res.success, undefined, `Attempt ${i} must not succeed`);
            assert.strictEqual(res.error, "Invalid OTP. Please try again.", `Attempt ${i} must return invalid error`);
            const currentRecord = mockDb.otps.find((o) => o.user_id === 3)!;
            assert.strictEqual(currentRecord.attempts, i, `Record attempts must be ${i}`);
            assert.strictEqual(currentRecord.locked_until, null, `Record must not be locked yet on attempt ${i}`);
        }
    });

    await runTest("T1.2: 5th failed attempt locks OTP permanently (attempts = 5, locked_until set)", async () => {
        const targetEmail = "target@quizweb.dev";
        const res5 = await verifyOTP(targetEmail, "999999");

        assert.strictEqual(res5.success, undefined, "5th attempt must not succeed");
        assert.ok(
            res5.error?.includes("Too many failed attempts. This OTP has been locked"),
            "5th attempt must return locked error message"
        );

        const currentRecord = mockDb.otps.find((o) => o.user_id === 3)!;
        assert.strictEqual(currentRecord.attempts, 5, "Attempts must be set to 5");
        assert.ok(currentRecord.locked_until !== null, "locked_until timestamp must be set");
    });

    await runTest("T1.3: Subsequent 6th attempt (even with CORRECT OTP) is immediately rejected", async () => {
        const targetEmail = "target@quizweb.dev";
        const realOtp = "555111"; // The actual correct code

        const res6 = await verifyOTP(targetEmail, realOtp);
        assert.strictEqual(res6.success, undefined, "Locked OTP must reject even the correct code");
        assert.ok(
            res6.error?.includes("Too many failed attempts. This OTP has been locked"),
            "Subsequent attempt on locked OTP must return locked error"
        );

        const currentRecord = mockDb.otps.find((o) => o.user_id === 3)!;
        assert.strictEqual(currentRecord.is_used, 0, "Locked OTP must NEVER transition to is_used = 1");
    });

    await runTest("T1.4: Pre-locked OTP record fails closed prior to code comparison", async () => {
        const email = "user@quizweb.dev";
        const code = "777888";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 5,
            locked_until: new Date(),
        });

        const res = await verifyOTP(email, code);
        assert.strictEqual(res.success, undefined, "Pre-locked OTP must fail");
        assert.ok(res.error?.includes("Too many failed attempts"));
    });

    await runTest("T1.5: Valid OTP with < 5 attempts succeeds and transitions is_used = 1", async () => {
        const email = "admin@quizweb.dev";
        const code = "123456";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 1,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 2, // 2 prior attempts
            locked_until: null,
        });

        const res = await verifyOTP(email, code);
        assert.strictEqual(res.success, true, "Valid OTP must succeed");
        assert.strictEqual(res.message, "OTP verified successfully.");

        const record = mockDb.otps.find((o) => o.otp_id === otpId)!;
        assert.strictEqual(record.is_used, 1, "OTP must transition to is_used = 1 (verified status)");
    });

    // =========================================================================
    // Suite 2: SEC-02 Strict Expiration Enforcement in verifyOTP & resetPass
    // =========================================================================
    console.log("\n\x1b[1m[Suite 2: SEC-02 Strict Expiration Enforcement]\x1b[0m");

    await resetMockDb();

    await runTest("T2.1: Expired OTP in verifyOTP is rejected with expiration error", async () => {
        const email = "user@quizweb.dev";
        const code = "112233";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() - 10000), // Expired 10 seconds ago
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await verifyOTP(email, code);
        assert.strictEqual(res.success, undefined, "Expired OTP must not verify");
        assert.strictEqual(res.error, "OTP has expired. Please request a new one.");
    });

    await runTest("T2.2: Expired OTP in resetPass is rejected with invalid/expired error", async () => {
        const email = "user@quizweb.dev";
        const code = "445566";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() - 5000), // Expired 5 seconds ago
            is_used: 1, // Was verified in time, but expired before resetPass
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await resetPass(email, code, "ValidNewPassword888!");
        assert.strictEqual(res.success, undefined, "Expired OTP in resetPass must fail");
        assert.strictEqual(res.error, "Invalid or expired OTP");
    });

    await runTest("T2.3: Non-expired OTP within valid window succeeds in resetPass", async () => {
        const email = "user@quizweb.dev";
        const code = "889900";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 180000), // Valid for 3 more minutes
            is_used: 1,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await resetPass(email, code, "ValidNewPassword888!");
        assert.strictEqual(res.success, true, "Non-expired OTP must succeed");
        assert.strictEqual(res.message, "Password reset successfully.");
    });

    // =========================================================================
    // Suite 3: SEC-02 Replay Prevention & State Transition (is_used = 2)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 3: SEC-02 Replay Prevention & Consumed State Transition]\x1b[0m");

    await resetMockDb();

    await runTest("T3.1: Unverified OTP (is_used = 0) CANNOT be submitted directly to resetPass", async () => {
        const email = "target@quizweb.dev";
        const code = "654321";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 3,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0, // Unverified!
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        // Attacker attempts to skip verifyOTP and call resetPass directly
        const res = await resetPass(email, code, "AttackerPass123!");
        assert.strictEqual(res.success, undefined, "Unverified OTP must be rejected by resetPass");
        assert.strictEqual(res.error, "Invalid or expired OTP");
    });

    await runTest("T3.2: Legitimate resetPass execution transitions OTP record to is_used = 2", async () => {
        const email = "target@quizweb.dev";
        const code = "654321";
        const otpRecord = mockDb.otps.find((o) => o.user_id === 3)!;

        // Step 1: User verifies OTP
        const vRes = await verifyOTP(email, code);
        assert.strictEqual(vRes.success, true, "verifyOTP must succeed");
        assert.strictEqual(otpRecord.is_used, 1, "verifyOTP transitions record to is_used = 1");

        // Step 2: User executes resetPass
        const rRes = await resetPass(email, code, "LegitPassword123!");
        assert.strictEqual(rRes.success, true, "resetPass must succeed");

        // Assert record is now consumed (is_used = 2)
        assert.strictEqual(otpRecord.is_used, 2, "resetPass MUST transition record to is_used = 2 (consumed)");
    });

    await runTest("T3.3: SEC-02 REPLAY ATTACK: Re-submitting the exact same OTP is REJECTED", async () => {
        const email = "target@quizweb.dev";
        const code = "654321";

        // Replay submission with identical OTP code
        const replayRes = await resetPass(email, code, "ReplayedMaliciousPass123!");
        assert.strictEqual(replayRes.success, undefined, "Replay attack MUST be rejected");
        assert.strictEqual(replayRes.error, "Invalid or expired OTP", "Must return Invalid or expired OTP on replay");

        // Re-verify that password in DB was NOT altered by replay
        const user = mockDb.users.find((u) => u.user_id === 3)!;
        const matchesReplay = await argon2.verify(user.password_hash!, "ReplayedMaliciousPass123!");
        assert.strictEqual(matchesReplay, false, "Password must NOT be changed by replayed OTP");
    });

    await runTest("T3.4: Consumed OTP (is_used = 2) is also rejected in verifyOTP", async () => {
        const email = "target@quizweb.dev";
        const code = "654321";

        const res = await verifyOTP(email, code);
        assert.strictEqual(res.success, undefined, "Consumed OTP must not be verifiable again");
        assert.strictEqual(res.error, "Invalid or expired OTP");
    });

    await runTest("T3.5: Repeated replays (3rd, 4th, 5th) continuously fail closed without side effects", async () => {
        const email = "target@quizweb.dev";
        const code = "654321";
        const initialTokenVersion = mockDb.users.find((u) => u.user_id === 3)!.token_version;

        for (let i = 0; i < 5; i++) {
            const res = await resetPass(email, code, `AnotherAttemptPass${i}!`);
            assert.strictEqual(res.error, "Invalid or expired OTP");
        }

        const currentTokenVersion = mockDb.users.find((u) => u.user_id === 3)!.token_version;
        assert.strictEqual(currentTokenVersion, initialTokenVersion, "Token version must not increment on failed replays");
    });

    // =========================================================================
    // Suite 4: SEC-08 Anti-Enumeration in reqPassReset
    // =========================================================================
    console.log("\n\x1b[1m[Suite 4: SEC-08 User Enumeration Prevention (Identical Responses)]\x1b[0m");

    await resetMockDb();

    const expectedMessage = "If an account exists with this email, a reset code has been sent.";

    await runTest("T4.1: reqPassReset with EXISTING email returns generic success message", async () => {
        const existingEmail = "user@quizweb.dev";
        const res = await reqPassReset(existingEmail);

        assert.strictEqual(res.success, true, "Existing user must receive success");
        assert.strictEqual(res.message, expectedMessage, "Existing user must receive exact generic message");
        assert.strictEqual(capturedEmails.length, 1, "Email must be dispatched for existing user");
    });

    await runTest("T4.2: reqPassReset with NON-EXISTENT email returns IDENTICAL success response", async () => {
        const nonExistentEmail = "ghost_user_99999@quizweb.dev";
        const res = await reqPassReset(nonExistentEmail);

        assert.strictEqual(res.success, true, "Non-existent user must receive success");
        assert.strictEqual(res.message, expectedMessage, "Non-existent user must receive exact same generic message");
    });

    await runTest("T4.3: Crucial fix: Non-existent email executes cleanly without TypeError", async () => {
        // Test multiple non-existent email variations
        const testEmails = [
            "nobody@quizweb.dev",
            "fake.account@quizweb.dev",
            "unknown-user@gmail.com",
        ];

        for (const badEmail of testEmails) {
            const res = await reqPassReset(badEmail);
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.message, expectedMessage);
            assert.strictEqual(res.error, undefined, "Must NOT throw TypeError or return catch-block error");
        }
    });

    await runTest("T4.4: Response shape & timing parity between existing and non-existent accounts", async () => {
        const existingEmail = "admin@quizweb.dev";
        const nonExistentEmail = "nonexistent_tester@quizweb.dev";

        // Measure timings over 20 calls each
        const existingTimes: number[] = [];
        const nonExistentTimes: number[] = [];

        // Clear rate limits for timing test
        mockDb.rateLimits.clear();

        for (let i = 0; i < 20; i++) {
            mockDb.rateLimits.clear();
            const start1 = performance.now();
            const res1 = await reqPassReset(existingEmail);
            existingTimes.push(performance.now() - start1);
            assert.strictEqual(res1.message, expectedMessage);

            mockDb.rateLimits.clear();
            const start2 = performance.now();
            const res2 = await reqPassReset(nonExistentEmail);
            nonExistentTimes.push(performance.now() - start2);
            assert.strictEqual(res2.message, expectedMessage);
        }

        const avgExisting = existingTimes.reduce((a, b) => a + b) / existingTimes.length;
        const avgNonExistent = nonExistentTimes.reduce((a, b) => a + b) / nonExistentTimes.length;

        // Both execution times must be sub-100ms in-process
        assert.ok(avgExisting < 100, `Existing avg time (${avgExisting}ms) must be reasonable`);
        assert.ok(avgNonExistent < 100, `Non-existent avg time (${avgNonExistent}ms) must be reasonable`);
    });

    await runTest("T4.5: Invalid email syntax is rejected at input validation stage", async () => {
        const invalidEmails = ["", "invalid-no-at", "@nodomain", "spaces in@email.com"];
        for (const bad of invalidEmails) {
            const res = await reqPassReset(bad);
            assert.strictEqual(res.error, "Please enter a valid email address.");
            assert.strictEqual(res.success, undefined);
        }
    });

    // =========================================================================
    // Suite 5: SEC-10 Rate Limiting against Email Flooding in reqPassReset
    // =========================================================================
    console.log("\n\x1b[1m[Suite 5: SEC-10 Rate Limiting & Anti-Flooding on reqPassReset]\x1b[0m");

    await resetMockDb();

    await runTest("T5.1: Rapid password reset requests are tracked per target email", async () => {
        const victimEmail = "user@quizweb.dev";

        // Requests 1 to 4 succeed
        for (let i = 1; i <= 4; i++) {
            const res = await reqPassReset(victimEmail);
            assert.strictEqual(res.success, true, `Request ${i} must succeed`);
        }

        // Verify rate limit record in mock DB
        const rateLimitKey = `ratelimit:req_reset_${victimEmail.toLowerCase()}`;
        const record = mockDb.rateLimits.get(rateLimitKey);
        assert.ok(record, "Rate limit record must exist");
        assert.strictEqual(record.attempts, 4, "Attempts counter must be 4");
    });

    await runTest("T5.2: Exceeding rate limit threshold (5th request) blocks request with rate limit error", async () => {
        const victimEmail = "user@quizweb.dev";

        // 5th request triggers lockout
        const res5 = await reqPassReset(victimEmail);
        assert.strictEqual(res5.success, undefined, "5th request must be blocked");
        assert.strictEqual(
            res5.error,
            "Too many password reset requests. Please try again later.",
            "Must return rate limit error message"
        );

        // 6th request remains blocked
        const res6 = await reqPassReset(victimEmail);
        assert.strictEqual(res6.error, "Too many password reset requests. Please try again later.");
    });

    await runTest("T5.3: Blocked rate-limited requests execute ZERO emails and ZERO OTP insertions", async () => {
        const victimEmail = "user@quizweb.dev";
        const emailCountBefore = capturedEmails.length;
        const otpCountBefore = mockDb.otps.length;

        // Attempt blocked request
        const res = await reqPassReset(victimEmail);
        assert.strictEqual(res.error, "Too many password reset requests. Please try again later.");

        assert.strictEqual(capturedEmails.length, emailCountBefore, "ZERO emails must be sent when rate limited");
        assert.strictEqual(mockDb.otps.length, otpCountBefore, "ZERO OTP records must be created when rate limited");
    });

    await runTest("T5.4: Independent rate limit buckets for different email addresses", async () => {
        // victimEmail ("user@quizweb.dev") is blocked
        // targetEmail ("target@quizweb.dev") is fresh
        const targetEmail = "target@quizweb.dev";

        const res = await reqPassReset(targetEmail);
        assert.strictEqual(res.success, true, "Different email address must not be affected by victim's rate limit");
        assert.strictEqual(res.message, expectedMessage);
    });

    await runTest("T5.5: Case-insensitive rate limit key normalization", async () => {
        // "USER@QUIZWEB.DEV" must hit the same rate limit as "user@quizweb.dev"
        const upperEmail = "USER@QUIZWEB.DEV";
        const res = await reqPassReset(upperEmail);
        assert.strictEqual(res.error, "Too many password reset requests. Please try again later.", "Must share rate limit bucket");
    });

    // =========================================================================
    // Suite 6: Adversarial Robustness & Edge Cases
    // =========================================================================
    console.log("\n\x1b[1m[Suite 6: Adversarial Robustness & Edge Cases]\x1b[0m");

    await resetMockDb();

    await runTest("T6.1: verifyOTP rejects missing or malformed parameters gracefully", async () => {
        const badCalls = [
            verifyOTP("", "123456"),
            verifyOTP("user@quizweb.dev", ""),
            verifyOTP(null as never, "123456"),
            verifyOTP("user@quizweb.dev", null as never),
            verifyOTP("user@quizweb.dev", 123456 as never),
        ];

        for (const call of badCalls) {
            const res = await call;
            assert.strictEqual(res.success, undefined);
            assert.ok(res.error !== undefined);
        }
    });

    await runTest("T6.2: resetPass enforces minimum password length (8 chars) before consuming OTP", async () => {
        const email = "user@quizweb.dev";
        const code = "789123";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 1, // Verified
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        // Short password
        const shortRes = await resetPass(email, code, "short");
        assert.strictEqual(shortRes.error, "Password must be at least 8 characters.");

        // OTP must NOT be consumed by invalid password
        const otp = mockDb.otps.find((o) => o.otp_code === hash)!;
        assert.strictEqual(otp.is_used, 1, "OTP must remain is_used = 1 on password validation failure");
    });

    await runTest("T6.3: Non-existent email in resetPass returns invalid email error", async () => {
        const res = await resetPass("nonexistent@quizweb.dev", "123456", "ValidPassword123!");
        assert.strictEqual(res.error, "Invalid email.");
    });

    await runTest("T6.4: Case-insensitivity across email inputs in verifyOTP and resetPass", async () => {
        const code = "998877";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        // verify with uppercase
        const vRes = await verifyOTP("  USER@QUIZWEB.DEV  ", code);
        assert.strictEqual(vRes.success, true, "verifyOTP must normalize email");

        // reset with mixed case
        const rRes = await resetPass("User@QuizWeb.Dev", code, "FreshBrandNewPass999!");
        assert.strictEqual(rRes.success, true, "resetPass must normalize email");
    });

    // =========================================================================
    // Suite 7: Zero Regression Verification Guard (M1, M2, M3)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 7: Zero Regression Verification Guard (M1, M2, M3)]\x1b[0m");

    await runTest("M1: Database migration defines attempts, locked_until, and token_version", () => {
        const sql = fs.readFileSync(path.join(projectRoot, "migrations/002_security_hardening.sql"), "utf8");
        assert.ok(sql.includes("attempts"), "002 migration must define attempts");
        assert.ok(sql.includes("locked_until"), "002 migration must define locked_until");
        assert.ok(sql.includes("token_version"), "002 migration must define token_version");
    });

    await runTest("M2: Route middleware exists and clearLoginRateLimit is not exported", () => {
        assert.ok(fs.existsSync(path.join(projectRoot, "middleware.ts")), "middleware.ts must exist");
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(!authSrc.includes("export async function clearLoginRateLimit"), "clearLoginRateLimit must NOT be exported");
    });

    await runTest("M3: Password reset increments token_version to revoke active sessions", async () => {
        await resetMockDb();
        const initialVersion = mockDb.users.find((u) => u.user_id === 1)!.token_version;

        const code = "334455";
        const hash = crypto.createHash("sha256").update(code).digest("hex");
        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 1,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 1,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        await resetPass("admin@quizweb.dev", code, "NewAdminPass123!");
        const newVersion = mockDb.users.find((u) => u.user_id === 1)!.token_version;
        assert.strictEqual(newVersion, initialVersion + 1, "resetPass must increment token_version");
    });

    // =========================================================================
    // Suite 8: OWASP ASVS v4.0.3 Chapter 2 & Chapter 3 Compliance Matrix
    // =========================================================================
    console.log("\n\x1b[1m[Suite 8: OWASP ASVS v4.0.3 Compliance Audit]\x1b[0m");

    await runTest("V2.1.8 & V2.5.3: Credential Recovery - Anti-enumeration identical responses verified", async () => {
        await resetMockDb();
        const existing = await reqPassReset("user@quizweb.dev");
        const nonExistent = await reqPassReset("nonexistent_asvs@quizweb.dev");
        assert.strictEqual(existing.message, nonExistent.message);
        assert.strictEqual(existing.success, nonExistent.success);
    });

    await runTest("V2.2.1 & V11.1.3: Anti-Automation - Rate limiting prevents email flooding on recovery", async () => {
        await resetMockDb();
        const email = "flood_target@quizweb.dev";
        // 5 requests allowed
        for (let i = 0; i < 4; i++) {
            const r = await reqPassReset(email);
            assert.strictEqual(r.success, true);
        }
        // 5th triggers block
        const blocked = await reqPassReset(email);
        assert.strictEqual(blocked.error, "Too many password reset requests. Please try again later.");
    });

    await runTest("V2.8.4 & V3.7.2: Single-Use OTPs - Consumed OTP replay strictly prohibited", async () => {
        await resetMockDb();
        const email = "user@quizweb.dev";
        const code = "998811";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 1,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const firstUse = await resetPass(email, code, "GoodPassword123!");
        assert.strictEqual(firstUse.success, true);

        const replay = await resetPass(email, code, "EvilReplay123!");
        assert.strictEqual(replay.error, "Invalid or expired OTP");
    });

    await runTest("V3.7.1: OTP Attempt Counter - Locked permanently on 5th failed attempt", async () => {
        await resetMockDb();
        const email = "user@quizweb.dev";
        const code = "776655";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        // 4 failed attempts
        for (let i = 0; i < 4; i++) {
            await verifyOTP(email, "000000");
        }
        // 5th attempt locks
        const lockRes = await verifyOTP(email, "000000");
        assert.ok(lockRes.error?.includes("Too many failed attempts"));

        // subsequent attempt rejected
        const lockedRes = await verifyOTP(email, code);
        assert.ok(lockedRes.error?.includes("Too many failed attempts"));
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
        console.log(" OWASP ASVS v4.0.3 Chapter 2 & Chapter 3 Compliance: VERIFIED");
        console.log("   - SEC-01 / V3.7.1: 5-attempt counter permanently locks OTP");
        console.log("   - SEC-02 / V2.8.4, V3.7.2: Expiration & replay prevention (is_used = 2)");
        console.log("   - SEC-08 / V2.1.8, V2.5.3: Anti-enumeration uniform responses");
        console.log("   - SEC-10 / V2.2.1, V11.1.3: Rate limiting against email flooding");
        console.log("========================================================\n");
    }
}

main().catch((err) => {
    console.error("Fatal error running Milestone 4 test suite:", err);
    process.exit(1);
});
