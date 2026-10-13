/**
 * =============================================================================
 * Milestone 3 Comprehensive Adversarial Stress Harness: tests/test-m3-challenger-stress.ts
 * =============================================================================
 * Agent: m3_challenger_1_r2 (Iteration 2 Empirical Challenger)
 * Role: critic, specialist
 * Targets:
 *   - SEC-04: OAuth Account Linking & Takeover Defense (OWASP ASVS V3.2.1, V3.6.1)
 *   - SEC-05: Token Versioning, Session Revocation, Concurrency, and Fail-Closed
 *             Robustness (OWASP ASVS V3.1.1, V3.3.1, V3.3.3, V3.5.3)
 *
 * Execution:
 *   npx --yes tsx tests/test-m3-challenger-stress.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert";
import argon2 from "argon2";

// -----------------------------------------------------------------------------
// Environment & Mock Setup
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
process.env.AUTH_GITHUB_ID = process.env.AUTH_GITHUB_ID || "test_github_client_id";
process.env.AUTH_GITHUB_SECRET = process.env.AUTH_GITHUB_SECRET || "test_github_client_secret";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m3_stress";

// Global mock for email sending
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("api.resend.com")) {
        return new Response(JSON.stringify({ id: "mock_resend_stress_" + Date.now() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    return originalFetch(input, init);
};

// Test Runner Tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

interface TestFinding {
    name: string;
    target: "SEC-04" | "SEC-05";
    asvsRequirement: string;
    status: "PASS" | "FAIL";
    detail: string;
}
const findings: TestFinding[] = [];

async function runStressTest(
    name: string,
    target: "SEC-04" | "SEC-05",
    asvsRequirement: string,
    testFn: () => void | Promise<void>
) {
    totalTests++;
    try {
        await testFn();
        passedTests++;
        findings.push({ name, target, asvsRequirement, status: "PASS", detail: "Behavior verified as expected" });
        console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    } catch (err: unknown) {
        failedTests++;
        const message = err instanceof Error ? err.message : String(err);
        findings.push({ name, target, asvsRequirement, status: "FAIL", detail: message });
        console.error(`  \x1b[31m✖\x1b[0m ${name}`);
        console.error(`    \x1b[31mDefect Detail:\x1b[0m ${message}`);
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

interface UserOAuthRow {
    oauth_id: number;
    user_id: number;
    provider_name: string;
    provider_account_id: string;
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

interface MockDatabaseState {
    users: UserAuthRow[];
    players: PlayerRow[];
    oauths: UserOAuthRow[];
    otps: UserOtpRow[];
    nextUserId: number;
    nextPlayerId: number;
    nextOAuthId: number;
    nextOtpId: number;
    forcedError: Error | null;
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
                email: "attacker@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
            {
                user_id: 3,
                email: "victim@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 1, user_id: 1, username: "admin_user" },
            { player_id: 2, user_id: 2, username: "attacker_user" },
            { player_id: 3, user_id: 3, username: "victim_user" },
        ],
        oauths: [
            {
                oauth_id: 1,
                user_id: 2,
                provider_name: "github",
                provider_account_id: "attacker-gh-200",
            },
            {
                oauth_id: 2,
                user_id: 3,
                provider_name: "google",
                provider_account_id: "victim-google-300",
            },
        ],
        otps: [],
        nextUserId: 10,
        nextPlayerId: 10,
        nextOAuthId: 10,
        nextOtpId: 10,
        forcedError: null,
    };
}

// -----------------------------------------------------------------------------
// Database Interceptor
// -----------------------------------------------------------------------------
import { db } from "../lib/db";

db.query = (async (sql: string, params: unknown[] = []) => {
    if (mockDb.forcedError) {
        throw mockDb.forcedError;
    }

    // 1. SELECT user_auth_tbl for password login authorize()
    if (sql.includes("FROM user_auth_tbl a") && sql.includes("LEFT JOIN player_tbl p")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return [[]];
        const player = mockDb.players.find((p) => p.user_id === user.user_id);
        return [[{
            user_id: user.user_id,
            email: user.email,
            password_hash: user.password_hash,
            user_role: user.user_role,
            token_version: user.token_version,
            username: player?.username || `player_${user.user_id}`,
        }]];
    }

    // 2. SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ?
    if (sql.includes("SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ?")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return [[]];
        return [[{
            user_id: user.user_id,
            user_role: user.user_role,
            token_version: user.token_version,
        }]];
    }

    // 3. SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ?
    if (sql.includes("SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ?")) {
        const providerName = String(params[0]);
        const providerAccountId = String(params[1]);
        const oauth = mockDb.oauths.find(
            (o) => o.provider_name === providerName && o.provider_account_id === providerAccountId
        );
        if (!oauth) return [[]];
        return [[{ oauth_id: oauth.oauth_id, user_id: oauth.user_id }]];
    }

    // 4. SELECT token_version FROM user_auth_tbl WHERE user_id = ?
    if (sql.includes("SELECT token_version FROM user_auth_tbl WHERE user_id = ?")) {
        const userId = Number(params[0]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (!user) return [[]];
        return [[{ token_version: user.token_version }]];
    }

    // 5. UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?
    if (sql.includes("UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?")) {
        const userId = Number(params[0]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (user) {
            user.token_version += 1;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 6. UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?
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

    // 7. INSERT INTO user_oauth_tbl
    if (sql.includes("INSERT INTO user_oauth_tbl")) {
        const userId = Number(params[0]);
        const providerName = String(params[1]);
        const providerAccountId = String(params[2]);
        const existing = mockDb.oauths.find(
            (o) => o.provider_name === providerName && o.provider_account_id === providerAccountId
        );
        if (existing) {
            const err = new Error(`ER_DUP_ENTRY: Duplicate entry '${providerName}-${providerAccountId}' for key 'idx_provider_account'`);
            (err as { code?: string }).code = "ER_DUP_ENTRY";
            throw err;
        }
        const newId = mockDb.nextOAuthId++;
        mockDb.oauths.push({
            oauth_id: newId,
            user_id: userId,
            provider_name: providerName,
            provider_account_id: providerAccountId,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 8. INSERT INTO user_auth_tbl
    if (sql.includes("INSERT INTO user_auth_tbl")) {
        const email = String(params[0]);
        const newId = mockDb.nextUserId++;
        mockDb.users.push({
            user_id: newId,
            email,
            password_hash: null,
            user_role: "user",
            token_version: 1,
            is_email_verified: 1,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 9. INSERT INTO player_tbl
    if (sql.includes("INSERT INTO player_tbl")) {
        const userId = Number(params[0]);
        const username = String(params[1]);
        const newId = mockDb.nextPlayerId++;
        mockDb.players.push({
            player_id: newId,
            user_id: userId,
            username,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 10. SELECT user_id FROM user_auth_tbl WHERE email = ?
    if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ?")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return [[]];
        return [[{ user_id: user.user_id }]];
    }

    // 11. OTP queries
    if (sql.includes("SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl")) {
        const userId = Number(params[0]);
        const purpose = String(params[1]);
        const matching = mockDb.otps
            .filter((o) => o.user_id === userId && o.purpose === purpose)
            .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime());
        if (matching.length === 0) return [[]];
        return [[{
            otp_id: matching[0].otp_id,
            otp_code: matching[0].otp_code,
            expires_at: matching[0].expires_at,
            is_used: matching[0].is_used,
        }]];
    }

    if (sql.includes("UPDATE user_otp_tbl SET is_used = 1")) {
        const userId = Number(params[0]);
        const purpose = String(params[1]);
        for (const o of mockDb.otps) {
            if (o.user_id === userId && o.purpose === purpose) {
                o.is_used = 1;
            }
        }
        return [{ affectedRows: 1 }];
    }

    return [{ affectedRows: 1, insertId: 999 }];
}) as typeof db.query;

// -----------------------------------------------------------------------------
// Test Execution Suite
// -----------------------------------------------------------------------------
async function runAllStressTests() {
    console.log("\n========================================================");
    console.log(" Milestone 3: Adversarial Challenge & Stress Harness (Iteration 2)");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3");
    console.log(" Targets: SEC-04 (OAuth Takeover) & SEC-05 (Session Revocation)");
    console.log("========================================================\n");

    const authModule = await import("../auth");
    const { authConfig } = authModule;
    const sessionCallback = authConfig.callbacks!.session!;
    const signInCallback = authConfig.callbacks!.signIn!;
    const signOutEventHandler = authConfig.events!.signOut!;
    const { resetPass, logoutUser } = await import("../app/actions/auth");

    // =========================================================================
    // Part 1: SEC-05 Session Revocation Stress Tests
    // =========================================================================
    console.log("\x1b[1m[Section 1: SEC-05 Session Revocation & Edge-Case Stress]\x1b[0m");

    // Stress 1.1: Rapid Repeated Revocations across 50 Cycles
    await runStressTest(
        "Stress 1.1: Rapid repeated revocations (50 cycles) monotonically increment DB token_version and revoke all stale tokens",
        "SEC-05",
        "ASVS V3.3.1 / V3.5.3",
        async () => {
            await resetMockDb();
            const user = mockDb.users.find((u) => u.user_id === 1)!;
            assert.strictEqual(user.token_version, 1);

            // Execute 50 sequential sign-out events
            for (let i = 1; i <= 50; i++) {
                await signOutEventHandler({ token: { id: "1" } });
                assert.strictEqual(user.token_version, i + 1, `Version must increment to ${i + 1}`);
            }
            assert.strictEqual(user.token_version, 51);

            // Verify tokens from version 1 to 50 are all strictly rejected
            for (let v = 1; v <= 50; v++) {
                const staleSession = await sessionCallback({
                    session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
                    token: { id: "1", sub: "1", role: "admin", tokenVersion: v },
                });
                const isRejected = staleSession === null || !staleSession?.user;
                assert.ok(isRejected, `Token with stale version ${v} MUST be revoked`);
            }

            // Verify token with matching version 51 succeeds
            const freshSession = await sessionCallback({
                session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
                token: { id: "1", sub: "1", role: "admin", tokenVersion: 51 },
            });
            assert.ok(freshSession !== null && freshSession?.user, "Token with matching version 51 must be accepted");
            assert.strictEqual((freshSession.user as { tokenVersion?: number }).tokenVersion, 51);
        }
    );

    // Stress 1.2: High Concurrency Session Validation (Stale vs Fresh Tokens)
    await runStressTest(
        "Stress 1.2: Concurrent session requests (100 simultaneous calls) with mixed stale and fresh tokens maintain strict isolation",
        "SEC-05",
        "ASVS V3.1.1 / V3.3.1",
        async () => {
            await resetMockDb();
            // User 1 has token_version = 10
            const user1 = mockDb.users.find((u) => u.user_id === 1)!;
            user1.token_version = 10;

            const requests: Promise<{ index: number; expected: boolean; actual: boolean }>[] = [];

            // Spawn 100 concurrent requests: even indices hold stale token (v9), odd indices hold fresh token (v10)
            for (let i = 0; i < 100; i++) {
                const isFresh = i % 2 === 1;
                const tokenVer = isFresh ? 10 : 9;
                const p = (async (idx: number, fresh: boolean, ver: number) => {
                    const res = await sessionCallback({
                        session: { user: { id: "1", name: `Admin_${idx}`, email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
                        token: { id: "1", sub: "1", role: "admin", tokenVersion: ver },
                    });
                    const hasUser = res !== null && Boolean(res?.user);
                    return { index: idx, expected: fresh, actual: hasUser };
                })(i, isFresh, tokenVer);
                requests.push(p);
            }

            const results = await Promise.all(requests);
            for (const r of results) {
                assert.strictEqual(
                    r.actual,
                    r.expected,
                    `Request #${r.index} isolation violated: expected valid=${r.expected}, got valid=${r.actual}`
                );
            }
        }
    );

    // Stress 1.3: Corrupt, Non-Numeric, and Type-Coercion Token Versions
    await runStressTest(
        "Stress 1.3: Corrupt token versions (strings, NaN, Infinity, negative, objects) fail closed",
        "SEC-05",
        "ASVS V3.1.1 / V3.3.1",
        async () => {
            await resetMockDb();
            const user = mockDb.users.find((u) => u.user_id === 1)!;
            user.token_version = 5;

            const maliciousPayloads = [
                "NaN",
                "corrupt_string",
                "5; DROP TABLE user_auth_tbl;",
                NaN,
                Infinity,
                -Infinity,
                -1,
                0,
                4.999,
                5.001,
                null,
                undefined,
                true,
                false,
                {},
                ["corrupt"],
                [1],
                { tokenVersion: 5 },
            ];

            for (const badVal of maliciousPayloads) {
                const res = await sessionCallback({
                    session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
                    token: { id: "1", sub: "1", role: "admin", tokenVersion: badVal as never },
                });
                const isRevoked = res === null || !res?.user;
                assert.ok(isRevoked, `Payload ${JSON.stringify(badVal)} must fail closed and be rejected`);
            }

            // Valid numeric 5 succeeds
            const validRes = await sessionCallback({
                session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
                token: { id: "1", sub: "1", role: "admin", tokenVersion: 5 },
            });
            assert.ok(validRes?.user, "Valid integer version 5 must succeed");
        }
    );

    // Stress 1.4: Missing or Corrupt User Fields in Session Token
    await runStressTest(
        "Stress 1.4: Missing or malformed user identifiers (null token, missing id/sub, empty strings) fail closed",
        "SEC-05",
        "ASVS V3.1.1",
        async () => {
            await resetMockDb();

            // 1. null token
            const res1 = await sessionCallback({
                session: { user: { id: "1" }, expires: new Date().toISOString() },
                token: null as never,
            });
            assert.ok(res1 === null || !res1?.user, "Null token must fail closed");

            // 2. empty token {}
            const res2 = await sessionCallback({
                session: { user: { id: "1" }, expires: new Date().toISOString() },
                token: {} as never,
            });
            assert.ok(res2 === null || !res2?.user, "Empty token without id/sub must fail closed");

            // 3. empty string id
            const res3 = await sessionCallback({
                session: { user: { id: "1" }, expires: new Date().toISOString() },
                token: { id: "", sub: "", tokenVersion: 1 } as never,
            });
            assert.ok(res3 === null || !res3?.user, "Empty string id must fail closed");

            // 4. non-existent user id in DB
            const res4 = await sessionCallback({
                session: { user: { id: "88888" }, expires: new Date().toISOString() },
                token: { id: "88888", sub: "88888", tokenVersion: 1 } as never,
            });
            assert.ok(res4 === null || !res4?.user, "Non-existent user in DB must fail closed");
        }
    );

    // Stress 1.5: Database Query Failures (Deadlocks, Errors) Fail Closed
    await runStressTest(
        "Stress 1.5: Database error during token validation (deadlock, disconnection) strictly fails closed",
        "SEC-05",
        "ASVS V3.1.1",
        async () => {
            await resetMockDb();
            const deadlockErr = new Error("ER_LOCK_DEADLOCK: Deadlock found when trying to get lock");
            (deadlockErr as { code?: string }).code = "ER_LOCK_DEADLOCK";
            mockDb.forcedError = deadlockErr;

            const res = await sessionCallback({
                session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
                token: { id: "1", sub: "1", role: "admin", tokenVersion: 1 },
            });
            mockDb.forcedError = null;

            assert.ok(res === null || !res?.user, "Database query error MUST cause session callback to fail closed");
        }
    );

    // Stress 1.6: Password Reset Session Revocation Multi-Device Test
    await runStressTest(
        "Stress 1.6: Password reset revokes active sessions across multiple devices simultaneously",
        "SEC-05",
        "ASVS V3.3.3",
        async () => {
            await resetMockDb();
            const rawOtp = "123987";
            const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");

            mockDb.otps.push({
                otp_id: mockDb.nextOtpId++,
                user_id: 2,
                otp_code: hashedOtp,
                expires_at: new Date(Date.now() + 600000),
                is_used: 1,
                purpose: "password_reset",
                attempts: 0,
                locked_until: null,
            });

            // Device A (Desktop) and Device B (Mobile) both hold tokenVersion = 1
            const deviceA_Token = { id: "2", sub: "2", role: "user", tokenVersion: 1 };
            const deviceB_Token = { id: "2", sub: "2", role: "user", tokenVersion: 1 };

            // Verify both active initially
            const sessionA_before = await sessionCallback({
                session: { user: { id: "2" }, expires: new Date().toISOString() },
                token: deviceA_Token,
            });
            const sessionB_before = await sessionCallback({
                session: { user: { id: "2" }, expires: new Date().toISOString() },
                token: deviceB_Token,
            });
            assert.ok(sessionA_before?.user, "Device A active before reset");
            assert.ok(sessionB_before?.user, "Device B active before reset");

            // Password reset occurs
            const resetRes = await resetPass("attacker@quizweb.dev", rawOtp, "BrandNewPassword123!");
            assert.strictEqual(resetRes.success, true);

            // Both devices must be rejected immediately
            const sessionA_after = await sessionCallback({
                session: { user: { id: "2" }, expires: new Date().toISOString() },
                token: deviceA_Token,
            });
            const sessionB_after = await sessionCallback({
                session: { user: { id: "2" }, expires: new Date().toISOString() },
                token: deviceB_Token,
            });
            assert.ok(sessionA_after === null || !sessionA_after?.user, "Device A must be terminated post-reset");
            assert.ok(sessionB_after === null || !sessionB_after?.user, "Device B must be terminated post-reset");
        }
    );

    // =========================================================================
    // Part 2: SEC-04 OAuth Account Linking Stress Tests
    // =========================================================================
    console.log("\n\x1b[1m[Section 2: SEC-04 OAuth Linking & Account Takeover Defense]\x1b[0m");

    // Stress 2.1: Cross-Account Takeover Defense Matrix
    await runStressTest(
        "Stress 2.1: Cross-Account OAuth Takeover Matrix: unauthenticated login claiming victim email with attacker OAuth link is blocked",
        "SEC-04",
        "ASVS V3.2.1 / V3.6.1",
        async () => {
            await resetMockDb();
            (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

            // Attacker owns 'attacker-gh-200' (bound to User 2)
            // Attacker attempts to sign in as User 1 (Admin)
            const userObj = { id: "", email: "admin@quizweb.dev", name: "Attacker Impersonating Admin" };
            const accountObj = { provider: "github", providerAccountId: "attacker-gh-200" };

            const signInRes = await signInCallback({ user: userObj, account: accountObj as never });
            assert.strictEqual(signInRes, false, "Cross-account OAuth takeover MUST be rejected (returns false)");
            assert.notStrictEqual(userObj.id, "1", "User ID must NOT be assigned to Admin user 1");

            // Legitimate owner (User 2) signs in with 'attacker-gh-200' -> succeeds
            const legitObj = { id: "", email: "attacker@quizweb.dev", name: "Legitimate Owner" };
            const legitRes = await signInCallback({ user: legitObj, account: accountObj as never });
            assert.strictEqual(legitRes, true, "Legitimate owner sign-in must succeed");
            assert.strictEqual(legitObj.id, "2", "User ID must be assigned to User 2");
        }
    );

    // Stress 2.2: Cross-User Linking Attempt with Active Session Mismatch
    await runStressTest(
        "Stress 2.2: Active session mismatch: User 2 authenticated cannot link OAuth account to User 3's email",
        "SEC-04",
        "ASVS V3.2.1 / V3.6.1",
        async () => {
            await resetMockDb();
            // Active session belongs to User 2
            (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = {
                user: { id: "2", email: "attacker@quizweb.dev" },
            };

            // Attempt to link a new Google account to User 3 (victim@quizweb.dev)
            const userObj = { id: "", email: "victim@quizweb.dev", name: "Hijacker" };
            const accountObj = { provider: "google", providerAccountId: "new-google-777" };

            const res = await signInCallback({ user: userObj, account: accountObj as never });
            assert.strictEqual(res, false, "Cross-user linking attempt MUST return false");

            const createdOAuth = mockDb.oauths.find((o) => o.provider_account_id === "new-google-777");
            assert.strictEqual(createdOAuth, undefined, "No OAuth record must be created");

            (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
        }
    );

    // Stress 2.3: Provider Boundary Separation (Same ProviderAccountId on Different Providers)
    await runStressTest(
        "Stress 2.3: Provider boundary separation: identical providerAccountId across Google vs GitHub are isolated",
        "SEC-04",
        "ASVS V3.2.1",
        async () => {
            await resetMockDb();
            (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

            // 'attacker-gh-200' is linked to User 2 under provider 'github'
            // Request comes in under provider 'google' with same providerAccountId 'attacker-gh-200'
            const userObj = { id: "", email: "attacker@quizweb.dev", name: "Attacker User" };
            const accountObj = { provider: "google", providerAccountId: "attacker-gh-200" };

            const res = await signInCallback({ user: userObj, account: accountObj as never });
            // Must be blocked because Google provider is NOT linked for this user and there is no active session
            assert.strictEqual(res, false, "Cross-provider sign-in with same accountId must be blocked");
        }
    );

    // Stress 2.4: Email Case-Insensitivity Defense in OAuth Sign-In
    await runStressTest(
        "Stress 2.4: Email case-insensitivity: uppercase/mixed-case victim email triggers unauthenticated linking guard",
        "SEC-04",
        "ASVS V3.6.1",
        async () => {
            await resetMockDb();
            (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

            const initialOAuthCount = mockDb.oauths.length;

            // Attacker presents uppercase email "ADMIN@QUIZWEB.DEV"
            const userObj = { id: "", email: "ADMIN@QUIZWEB.DEV", name: "Attacker" };
            const accountObj = { provider: "google", providerAccountId: "attacker-google-upper" };

            const res = await signInCallback({ user: userObj, account: accountObj as never });
            assert.strictEqual(res, false, "Uppercase existing email sign-in must be blocked without active session");
            assert.strictEqual(mockDb.oauths.length, initialOAuthCount, "No OAuth record must be created");
        }
    );

    // Stress 2.5: Missing / Malformed Email in OAuth Sign-In
    await runStressTest(
        "Stress 2.5: OAuth sign-in with missing/empty email fails closed or prevents unauthorized linking",
        "SEC-04",
        "ASVS V3.1.1 / V3.2.1",
        async () => {
            await resetMockDb();
            const initialUsers = mockDb.users.length;
            const initialOAuths = mockDb.oauths.length;

            // 1. empty string email
            const userEmpty = { id: "", email: "", name: "No Email User" };
            const acc1 = { provider: "google", providerAccountId: "no-email-1" };
            const res1 = await signInCallback({ user: userEmpty, account: acc1 as never });
            // Should pass through to default credentials/NextAuth flow without creating an unverified DB user
            assert.strictEqual(mockDb.users.length, initialUsers, "No user created for empty email");
            assert.strictEqual(mockDb.oauths.length, initialOAuths, "No OAuth record created for empty email");

            // 2. undefined email
            const userUndef = { id: "", email: undefined, name: "Undefined Email User" };
            const acc2 = { provider: "github", providerAccountId: "no-email-2" };
            const res2 = await signInCallback({ user: userUndef as never, account: acc2 as never });
            assert.strictEqual(mockDb.users.length, initialUsers, "No user created for undefined email");
            assert.strictEqual(mockDb.oauths.length, initialOAuths, "No OAuth record created for undefined email");
        }
    );

    // Stress 2.6: Database Error during OAuth Sign-In Fails Closed
    await runStressTest(
        "Stress 2.6: Database exception during OAuth sign-in fails closed (returns false)",
        "SEC-04",
        "ASVS V3.1.1",
        async () => {
            await resetMockDb();
            (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

            mockDb.forcedError = new Error("PROTOCOL_CONNECTION_LOST: Database connection severed");

            const userObj = { id: "", email: "brandnew@quizweb.dev", name: "New User" };
            const accountObj = { provider: "google", providerAccountId: "new-google-999" };

            const res = await signInCallback({ user: userObj, account: accountObj as never });
            mockDb.forcedError = null;

            assert.strictEqual(res, false, "Database failure in signInCallback must return false (fail-closed)");
        }
    );

    // -------------------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    console.log(` Adversarial Stress Harness Summary: ${passedTests}/${totalTests} Passed`);
    const defects = findings.filter((f) => f.status === "FAIL");

    if (defects.length > 0) {
        console.log(` \x1b[31mVERDICT: DEFECTS_FOUND\x1b[0m (${defects.length} Defect(s) Found)`);
        for (const d of defects) {
            console.log(`   - [${d.target}] ${d.name}: ${d.detail}`);
        }
        process.exit(1);
    } else {
        console.log(` \x1b[32mVERDICT: CONFIRM_CORRECTNESS\x1b[0m (All 12 Stress Probes Passed)`);
        console.log("========================================================\n");
    }
}

runAllStressTests().catch((err) => {
    console.error("Fatal error in adversarial stress suite:", err);
    process.exit(1);
});
