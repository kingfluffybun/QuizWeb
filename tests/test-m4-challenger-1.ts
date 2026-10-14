/**
 * =============================================================================
 * Milestone 4 Adversarial Challenge Harness: tests/test-m4-challenger-1.ts
 * =============================================================================
 * Agent: m4_challenger_1 (EMPIRICAL CHALLENGER)
 * Role: critic, specialist
 * Targets:
 *   - SEC-01: OTP Attempt Counter & Lockout in verifyOTP (OWASP ASVS V3.7.1, V2.2.1)
 *   - SEC-02: OTP Expiration & Replay Prevention in resetPass (OWASP ASVS V2.8.4, V3.7.2)
 *
 * Scope:
 *   1. 4 failed attempts followed by 1 valid attempt (must succeed).
 *   2. 5 failed attempts (must lock).
 *   3. Attempting correct OTP after lockout (must be blocked).
 *   4. Rapid concurrent verification requests with wrong OTPs.
 *   5. Successful reset followed by second reset with the same OTP (must fail).
 *   6. Attempting reset with OTP in is_used = 0 (unverified) state (must fail).
 *   7. Attempting reset with expired OTP (must fail).
 *   8. Boundary conditions, tampering, and state transition invariants.
 *
 * Execution:
 *   npx --yes tsx tests/test-m4-challenger-1.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import argon2 from "argon2";

// -----------------------------------------------------------------------------
// 1. Environment & Module Resolution
// -----------------------------------------------------------------------------
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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m4_adversarial";

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
        return new Response(JSON.stringify({ id: "mock_resend_m4_adv_" + Date.now() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    return originalFetch(input, init);
};

// -----------------------------------------------------------------------------
// 2. Mock Database State & Query Interception
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

    // 12. Rate limiting
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
// 3. Finding Tracking Structure
// -----------------------------------------------------------------------------
interface Finding {
    id: string;
    title: string;
    target: "SEC-01" | "SEC-02" | "CODE_QUALITY";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASSED";
    reproduced: boolean;
    evidence: string;
}

const findings: Finding[] = [];

// -----------------------------------------------------------------------------
// 4. Adversarial Execution
// -----------------------------------------------------------------------------
async function runAdversarialAudit() {
    console.log("\n========================================================");
    console.log(" Milestone 4 Adversarial Challenge: SEC-01 & SEC-02");
    console.log(" Agent: m4_challenger_1 (EMPIRICAL CHALLENGER)");
    console.log("========================================================\n");

    const authActions = await import("../app/actions/auth");
    const { verifyOTP, resetPass } = authActions;

    // =========================================================================
    // Probe 1: 4 failed attempts followed by 1 valid attempt (Must Succeed)
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const realOtp = "444222";
        const hashedOtp = crypto.createHash("sha256").update(realOtp).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 2,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        let successOnValid = false;
        let attemptsTracked = true;

        for (let i = 1; i <= 4; i++) {
            const badCode = `99900${i}`;
            const res = await verifyOTP(email, badCode);
            if (res.error !== "Invalid OTP. Please try again.") attemptsTracked = false;
            const rec = mockDb.otps.find((o) => o.otp_id === otpId)!;
            if (rec.attempts !== i || rec.locked_until !== null) attemptsTracked = false;
        }

        const validRes = await verifyOTP(email, realOtp);
        const verifiedRec = mockDb.otps.find((o) => o.otp_id === otpId)!;
        if (validRes.success === true && verifiedRec.is_used === 1) {
            successOnValid = true;
        }

        const passed = attemptsTracked && successOnValid;
        findings.push({
            id: "PROBE-01",
            title: "4 failed attempts followed by 1 valid attempt (Must Succeed)",
            target: "SEC-01",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `Attempts tracked: ${attemptsTracked}, 5th valid attempt success: ${validRes.success}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 01: 4 failed attempts + 1 valid attempt -> ${passed ? "SUCCEEDED" : "FAILED"}`);
    }

    // =========================================================================
    // Probe 2: 5 sequential failed attempts permanently locks OTP record
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const realOtp = "777333";
        const hashedOtp = crypto.createHash("sha256").update(realOtp).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 2,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        for (let i = 1; i <= 4; i++) {
            await verifyOTP(email, `00000${i}`);
        }

        const res5 = await verifyOTP(email, "000005");
        const rec = mockDb.otps.find((o) => o.otp_id === otpId)!;
        const lockedMessage = res5.error?.includes("Too many failed attempts. This OTP has been locked") || false;
        const lockedInDb = rec.attempts === 5 && rec.locked_until !== null && rec.is_used === 0;

        const passed = lockedMessage && lockedInDb;
        findings.push({
            id: "PROBE-02",
            title: "5 sequential failed attempts permanently locks OTP record",
            target: "SEC-01",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `Locked message: ${lockedMessage}, DB attempts: ${rec.attempts}, locked_until: ${rec.locked_until !== null}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 02: 5 failed attempts lockout -> ${passed ? "LOCKED" : "FAILED"}`);
    }

    // =========================================================================
    // Probe 3: Attempting correct OTP after lockout (6th attempt) is blocked
    // =========================================================================
    {
        const email = "user@quizweb.dev";
        const realOtp = "777333";

        const res6 = await verifyOTP(email, realOtp);
        const rec = mockDb.otps.find((o) => o.user_id === 2 && o.is_used === 0)!;
        const blocked = res6.success === undefined && (res6.error?.includes("Too many failed attempts") || false);
        const remainedUnused = rec.is_used === 0;

        const passed = blocked && remainedUnused;
        findings.push({
            id: "PROBE-03",
            title: "Attempting correct OTP after lockout (6th attempt) is blocked",
            target: "SEC-01",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `Blocked: ${blocked}, is_used: ${rec.is_used}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 03: Correct OTP after lockout -> ${passed ? "BLOCKED" : "ALLOWED"}`);
    }

    // =========================================================================
    // Probe 4: Direct call to resetPass after lockout fails closed
    // =========================================================================
    {
        const email = "user@quizweb.dev";
        const realOtp = "777333";

        const resetRes = await resetPass(email, realOtp, "MaliciousPassword123!");
        const user = mockDb.users.find((u) => u.user_id === 2)!;
        const passwordModified = await argon2.verify(user.password_hash!, "MaliciousPassword123!");

        const passed = resetRes.error === "Invalid or expired OTP" && !passwordModified;
        findings.push({
            id: "PROBE-04",
            title: "Direct call to resetPass after lockout fails closed",
            target: "SEC-01",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `resetPass returned: ${JSON.stringify(resetRes)}, password changed: ${passwordModified}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 04: resetPass with locked OTP -> ${passed ? "FAILED-CLOSED" : "BYPASSED"}`);
    }

    // =========================================================================
    // Probe 5: Counter stays capped at 5 and does not overflow or reset
    // =========================================================================
    {
        const email = "user@quizweb.dev";
        await verifyOTP(email, "999991");
        await verifyOTP(email, "999992");
        const rec = mockDb.otps.find((o) => o.user_id === 2 && o.is_used === 0)!;

        const passed = rec.attempts === 5;
        findings.push({
            id: "PROBE-05",
            title: "Counter remains capped at 5 on continued failed attempts",
            target: "SEC-01",
            severity: passed ? "PASSED" : "MEDIUM",
            reproduced: !passed,
            evidence: `attempts: ${rec.attempts}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 05: Counter cap at 5 -> ${passed ? "CAPPED" : "OVERFLOWED"}`);
    }

    // =========================================================================
    // Probe 6: EMPIRICAL DEFECT PROBE — Rapid concurrent verification requests
    // =========================================================================
    await resetMockDb();
    {
        const email = "target@quizweb.dev";
        const realOtp = "654987";
        const hashedOtp = crypto.createHash("sha256").update(realOtp).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 3,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        // Launch 20 concurrent requests with wrong OTPs
        const wrongPromises = Array.from({ length: 20 }, (_, i) =>
            verifyOTP(email, `9000${String(i).padStart(2, "0")}`)
        );

        await Promise.all(wrongPromises);

        const rec = mockDb.otps.find((o) => o.otp_id === otpId)!;
        const postConcurrentValidRes = await verifyOTP(email, realOtp);

        // Security invariant: 20 failed attempts MUST lock the OTP (attempts >= 5, locked_until != null, post-lock valid blocked)
        const lockedProperly = rec.attempts >= 5 && rec.locked_until !== null && postConcurrentValidRes.success !== true;

        findings.push({
            id: "PROBE-06",
            title: "Lost update race condition: 20 rapid concurrent wrong OTPs fail to lock record",
            target: "SEC-01",
            severity: lockedProperly ? "PASSED" : "HIGH",
            reproduced: !lockedProperly,
            evidence: `After 20 concurrent wrong attempts, DB recorded attempts = ${rec.attempts} (expected >= 5), locked_until = ${rec.locked_until}, subsequent correct OTP success = ${postConcurrentValidRes.success}`,
        });
        console.log(`  ${lockedProperly ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 06: Rapid concurrent verification requests -> ${lockedProperly ? "LOCKED (PASSED)" : "LOST UPDATE RACE / UNLOCKED (DEFECT)"}`);
    }

    // =========================================================================
    // Probe 7: EMPIRICAL DEFECT PROBE — Missing server-side rate limiting on verifyOTP
    // =========================================================================
    {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        const verifyOtpFunctionBody = authSrc.substring(authSrc.indexOf("export async function verifyOTP"), authSrc.indexOf("export async function resetPass"));
        const hasRateLimitInVerifyOTP = verifyOtpFunctionBody.includes("checkRateLimit");

        findings.push({
            id: "PROBE-07",
            title: "Missing server-side rate limiting in verifyOTP (ORIGINAL_REQUEST R4 / F-14 requirement)",
            target: "SEC-01",
            severity: hasRateLimitInVerifyOTP ? "PASSED" : "MEDIUM",
            reproduced: !hasRateLimitInVerifyOTP,
            evidence: `verifyOTP function body contains checkRateLimit: ${hasRateLimitInVerifyOTP}`,
        });
        console.log(`  ${hasRateLimitInVerifyOTP ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 07: Server-side rate limiting in verifyOTP -> ${hasRateLimitInVerifyOTP ? "PRESENT (PASSED)" : "MISSING (DEFECT)"}`);
    }

    // =========================================================================
    // Probe 8: Successful reset followed by second reset with same OTP (MUST FAIL)
    // =========================================================================
    await resetMockDb();
    {
        const email = "admin@quizweb.dev";
        const realOtp = "888999";
        const hashedOtp = crypto.createHash("sha256").update(realOtp).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 1,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const vRes = await verifyOTP(email, realOtp);
        const r1 = await resetPass(email, realOtp, "ValidFirstResetPassword123!");
        const rec = mockDb.otps.find((o) => o.otp_id === otpId)!;
        const user = mockDb.users.find((u) => u.user_id === 1)!;
        const initialVersion = user.token_version;

        // Replay attempt
        const r2 = await resetPass(email, realOtp, "AttackerReplayedPassword999!");
        const replayRejected = r2.success === undefined && r2.error === "Invalid or expired OTP";
        const passwordSafe = !(await argon2.verify(user.password_hash!, "AttackerReplayedPassword999!"));
        const versionUnchanged = user.token_version === initialVersion;

        const passed = vRes.success === true && r1.success === true && rec.is_used === 2 && replayRejected && passwordSafe && versionUnchanged;
        findings.push({
            id: "PROBE-08",
            title: "Replay attack defense: Re-submitting consumed OTP (is_used = 2) is blocked",
            target: "SEC-02",
            severity: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `1st reset: ${r1.success}, OTP is_used: ${rec.is_used}, replay reset error: ${r2.error}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 08: OTP Replay prevention (is_used = 2) -> ${passed ? "BLOCKED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 9: Attempting reset with OTP in is_used = 0 (unverified) state (MUST FAIL)
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const unverifiedOtp = "123123";
        const hashedOtp = crypto.createHash("sha256").update(unverifiedOtp).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await resetPass(email, unverifiedOtp, "TryBypassVerifyPass123!");
        const passed = res.success === undefined && res.error === "Invalid or expired OTP";
        findings.push({
            id: "PROBE-09",
            title: "Unverified OTP defense: Calling resetPass with is_used = 0 OTP is rejected",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `resetPass returned: ${JSON.stringify(res)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 09: Unverified OTP (is_used = 0) bypass -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 10: Attempting reset with OTP in is_used = 2 (consumed) state (MUST FAIL)
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const consumedOtp = "321321";
        const hashedOtp = crypto.createHash("sha256").update(consumedOtp).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 2,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await resetPass(email, consumedOtp, "TryConsumedPass123!");
        const passed = res.success === undefined && res.error === "Invalid or expired OTP";
        findings.push({
            id: "PROBE-10",
            title: "Consumed OTP defense: Calling resetPass with is_used = 2 OTP is rejected",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `resetPass returned: ${JSON.stringify(res)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 10: Consumed OTP (is_used = 2) submission -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 11: Re-verification of consumed OTP (is_used = 2) in verifyOTP is rejected
    // =========================================================================
    {
        const email = "user@quizweb.dev";
        const consumedOtp = "321321";

        const res = await verifyOTP(email, consumedOtp);
        const passed = res.success === undefined && res.error !== undefined;
        findings.push({
            id: "PROBE-11",
            title: "Consumed OTP re-verification rejection in verifyOTP",
            target: "SEC-02",
            severity: passed ? "PASSED" : "MEDIUM",
            reproduced: !passed,
            evidence: `verifyOTP returned: ${JSON.stringify(res)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 11: Re-verification of consumed OTP -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 12: Repeated replays (10x) continuously fail closed without side effects
    // =========================================================================
    {
        const email = "admin@quizweb.dev";
        const realOtp = "888999";
        const user = mockDb.users.find((u) => u.user_id === 1)!;
        const initialVersion = user.token_version;

        let allFailed = true;
        for (let i = 0; i < 10; i++) {
            const res = await resetPass(email, realOtp, `ConsecutiveReplayPass${i}!`);
            if (res.error !== "Invalid or expired OTP") allFailed = false;
        }

        const versionSafe = user.token_version === initialVersion;
        const passed = allFailed && versionSafe;
        findings.push({
            id: "PROBE-12",
            title: "Consecutive replay spam fails closed with zero side effects",
            target: "SEC-02",
            severity: passed ? "PASSED" : "MEDIUM",
            reproduced: !passed,
            evidence: `All 10 replays failed: ${allFailed}, token_version drift: ${user.token_version - initialVersion}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 12: 10 consecutive replays -> ${passed ? "FAILED-CLOSED (PASSED)" : "DRIFT DETECTED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 13: Attempting verifyOTP with expired OTP (1 ms past expiry)
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const code = "111000";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() - 1),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await verifyOTP(email, code);
        const passed = res.success === undefined && res.error === "OTP has expired. Please request a new one.";
        findings.push({
            id: "PROBE-13",
            title: "Strict expiration in verifyOTP (1ms boundary)",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `verifyOTP returned: ${JSON.stringify(res)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 13: 1ms expired OTP in verifyOTP -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 14: Attempting resetPass with expired OTP (1 ms past expiry)
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const code = "222000";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() - 1),
            is_used: 1,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await resetPass(email, code, "ValidPasswordLength123!");
        const passed = res.success === undefined && res.error === "Invalid or expired OTP";
        findings.push({
            id: "PROBE-14",
            title: "Strict expiration in resetPass (1ms boundary)",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `resetPass returned: ${JSON.stringify(res)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 14: 1ms expired OTP in resetPass -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 15: OTP verified before expiry but expired before resetPass execution
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const code = "333000";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 50),
            is_used: 0,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const vRes = await verifyOTP(email, code);
        await new Promise((resolve) => setTimeout(resolve, 70));
        const rRes = await resetPass(email, code, "ValidPasswordLength123!");

        const passed = vRes.success === true && rRes.success === undefined && rRes.error === "Invalid or expired OTP";
        findings.push({
            id: "PROBE-15",
            title: "Time-window expiration between verifyOTP and resetPass",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `verifyOTP: ${vRes.success}, delayed resetPass: ${rRes.error}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 15: Post-verification expiration window -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 16: Cross-user OTP injection attempt is rejected
    // =========================================================================
    await resetMockDb();
    {
        const victimEmail = "target@quizweb.dev";
        const attackerEmail = "user@quizweb.dev";
        const code = "999888";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 3, // Target
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 1,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const res = await resetPass(attackerEmail, code, "AttackerHijackPass123!");
        const passed = res.success === undefined && res.error === "Invalid or expired OTP";
        findings.push({
            id: "PROBE-16",
            title: "Cross-user OTP injection prevention",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `Target ${victimEmail} OTP attempted with attacker ${attackerEmail}: resetPass returned ${JSON.stringify(res)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 16: Cross-user OTP injection -> ${passed ? "REJECTED (PASSED)" : "HIJACKED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 17: Cross-purpose OTP contamination is rejected
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const code = "777111";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 0,
            purpose: "email_verification", // Mismatched purpose
            attempts: 0,
            locked_until: null,
        });

        const vRes = await verifyOTP(email, code);
        const rRes = await resetPass(email, code, "ValidPassword123!");
        const passed = vRes.error === "Invalid or expired OTP" && rRes.error === "Invalid or expired OTP";
        findings.push({
            id: "PROBE-17",
            title: "Cross-purpose OTP isolation",
            target: "SEC-02",
            severity: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `verifyOTP: ${vRes.error}, resetPass: ${rRes.error}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 17: Cross-purpose OTP contamination -> ${passed ? "ISOLATED (PASSED)" : "CROSS-USED (FAILED)"}`);
    }

    // =========================================================================
    // Probe 18: Password length check protects against OTP consumption on bad input
    // =========================================================================
    await resetMockDb();
    {
        const email = "user@quizweb.dev";
        const code = "555444";
        const hash = crypto.createHash("sha256").update(code).digest("hex");

        const otpId = mockDb.nextOtpId++;
        mockDb.otps.push({
            otp_id: otpId,
            user_id: 2,
            otp_code: hash,
            expires_at: new Date(Date.now() + 300000),
            is_used: 1,
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const resShort = await resetPass(email, code, "Short1!");
        const rec = mockDb.otps.find((o) => o.otp_id === otpId)!;
        const unconsumed = rec.is_used === 1;

        const resValid = await resetPass(email, code, "ValidLengthPassword123!");
        const consumed = rec.is_used === 2;

        const passed = resShort.error === "Password must be at least 8 characters." && unconsumed && resValid.success === true && consumed;
        findings.push({
            id: "PROBE-18",
            title: "Password validation precedes OTP consumption",
            target: "SEC-02",
            severity: passed ? "PASSED" : "MEDIUM",
            reproduced: !passed,
            evidence: `Short error: ${resShort.error}, is_used after short: ${rec.is_used}, valid reset: ${resValid.success}, is_used after valid: ${rec.is_used}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 18: Password validation precedence -> ${passed ? "ORDERED (PASSED)" : "CONSUMED PREMATURELY (FAILED)"}`);
    }

    // =========================================================================
    // Probe 19: State machine consistency in reqPassReset
    // =========================================================================
    {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        // Look for: UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0
        const hasUnusedToVerified = authSrc.includes("UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0");

        findings.push({
            id: "PROBE-19",
            title: "reqPassReset marks invalidated unused OTP as is_used = 1 (verified) instead of 2 (consumed)",
            target: "CODE_QUALITY",
            severity: hasUnusedToVerified ? "LOW" : "PASSED",
            reproduced: hasUnusedToVerified,
            evidence: `Line 443 updates unused OTP to is_used = 1 instead of is_used = 2`,
        });
        console.log(`  ${!hasUnusedToVerified ? "\x1b[32m✔\x1b[0m" : "\x1b[33m▲\x1b[0m"} Probe 19: State machine consistency in reqPassReset -> ${!hasUnusedToVerified ? "CONSISTENT (PASSED)" : "INCONSISTENT is_used=1 TRANSITION (LOW DEFECT)"}`);
    }

    // =========================================================================
    // FINAL AUDIT SUMMARY & VERDICT
    // =========================================================================
    console.log("\n========================================================");
    const defectFindings = findings.filter((f) => f.severity !== "PASSED");
    const passedCount = findings.filter((f) => f.severity === "PASSED").length;

    console.log(` Adversarial Audit Summary: ${passedCount}/${findings.length} Probes Passed`);
    console.log(` Defect(s) Identified: ${defectFindings.length}`);

    for (const d of defectFindings) {
        console.log(`\n [${d.severity} DEFECT] ${d.id}: ${d.title}`);
        console.log(`   Target: ${d.target}`);
        console.log(`   Empirical Evidence: ${d.evidence}`);
    }

    if (defectFindings.length > 0) {
        console.log("\n \x1b[31mVERDICT: DEFECTS_FOUND\x1b[0m");
    } else {
        console.log("\n \x1b[32mVERDICT: CONFIRM_CORRECTNESS\x1b[0m");
    }
    console.log("========================================================\n");

    return defectFindings.length === 0 ? 0 : 1;
}

runAdversarialAudit().catch((err: unknown) => {
    console.error("Fatal error during adversarial execution:", err);
    process.exit(1);
});
