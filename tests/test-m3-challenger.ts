/**
 * =============================================================================
 * Milestone 3 Adversarial Verification Test Suite: tests/test-m3-challenger.ts
 * =============================================================================
 * Agent: Milestone 3 Session Revocation Challenger (m3_challenger_1)
 * Role: critic, specialist
 * Targets:
 *   - SEC-05: Stateless JWT Session Revocation via DB token_version
 *   - SEC-05: Automatic token_version increment on resetPass
 *   - SEC-05: Automatic token_version increment on signOut / logoutUser
 *   - SEC-05: Deleted user fail-closed behavior
 *   - SEC-05: Multi-device invalidation and adversarial edge cases
 *
 * Compliance:
 *   - OWASP ASVS v4.0.3 Chapter 3 (V3.1.1, V3.3.1, V3.3.3, V3.5.3)
 *
 * Execution:
 *   npx --yes tsx tests/test-m3-challenger.ts
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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m3_challenger";

// Mock Resend fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("api.resend.com")) {
        return new Response(JSON.stringify({ id: "mock_resend_m3_" + Date.now() }), {
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
    is_used: number;
    purpose: string;
    attempts: number;
    locked_until: Date | null;
}

interface MockDatabaseState {
    users: UserAuthRow[];
    players: PlayerRow[];
    otps: UserOtpRow[];
    simulateDbError: boolean;
    dbErrorCode: string | null;
}

let mockDb: MockDatabaseState;

async function resetMockDb() {
    const defaultHash = await argon2.hash("SecurePassword123!");
    mockDb = {
        users: [
            {
                user_id: 101,
                email: "alice@quizweb.dev",
                password_hash: defaultHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
            {
                user_id: 102,
                email: "bob@quizweb.dev",
                password_hash: defaultHash,
                user_role: "admin",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 201, user_id: 101, username: "alice_player" },
            { player_id: 202, user_id: 102, username: "bob_player" },
        ],
        otps: [],
        simulateDbError: false,
        dbErrorCode: null,
    };
}

// Dynamic import of database pool
import { db } from "../lib/db";

db.query = (async (sql: string, params: unknown[] = []) => {
    if (mockDb.simulateDbError) {
        const error = new Error("Simulated Database Error (e.g. deadlock / syntax)");
        if (mockDb.dbErrorCode) {
            (error as { code?: string }).code = mockDb.dbErrorCode;
        }
        throw error;
    }

    // 1. SELECT user_auth_tbl for password login in authorize()
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

    // 2. SELECT user_id FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1
    if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.is_email_verified === 1);
        if (!user) return [[]];
        return [[{ user_id: user.user_id }]];
    }

    // 3. SELECT token_version FROM user_auth_tbl WHERE user_id = ?
    if (sql.includes("SELECT token_version FROM user_auth_tbl WHERE user_id = ?")) {
        const userId = Number(params[0]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (!user) return [[]];
        return [[{ token_version: user.token_version }]];
    }

    // 4. SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1
    if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return [[]];
        return [[{ user_id: user.user_id }]];
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

    // 7. SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
    if (sql.includes("FROM user_otp_tbl")) {
        const userId = Number(params[0]);
        const otps = mockDb.otps
            .filter((o) => o.user_id === userId)
            .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime());
        if (otps.length === 0) return [[]];
        return [[{
            otp_id: otps[0].otp_id,
            otp_code: otps[0].otp_code,
            expires_at: otps[0].expires_at,
            is_used: otps[0].is_used,
        }]];
    }

    // 8. UPDATE user_otp_tbl SET is_used = 1
    if (sql.includes("UPDATE user_otp_tbl SET is_used = 1")) {
        const userId = Number(params[0]);
        for (const otp of mockDb.otps) {
            if (otp.user_id === userId) otp.is_used = 1;
        }
        return [{ affectedRows: 1 }];
    }

    // 9. rate_limit_tbl
    if (sql.includes("rate_limit_tbl")) {
        return [[{ attempts: 0, reset_at: Date.now() + 900000, blocked: 0 }]];
    }

    return [{ affectedRows: 1 }];
}) as typeof db.query;

// -----------------------------------------------------------------------------
// Adversarial Challenger Test Execution
// -----------------------------------------------------------------------------
async function runChallengerSuite() {
    console.log("\n========================================================");
    console.log(" Milestone 3: EMPIRICAL ADVERSARIAL CHALLENGER HARNESS");
    console.log(" Targets: SEC-05 Session Revocation & Fail-Closed Robustness");
    console.log(" Role: critic, specialist");
    console.log("========================================================\n");

    const authModule = await import("../auth");
    const { authConfig } = authModule;
    const authActions = await import("../app/actions/auth");
    const { resetPass, logoutUser } = authActions;

    const sessionCallback = authConfig.callbacks.session!;
    const jwtCallback = authConfig.callbacks.jwt!;
    const signOutEventHandler = authConfig.events!.signOut!;

    // -------------------------------------------------------------------------
    // CHALLENGE 1: JWT Issuance with tokenVersion = 1 & Session Callback Acceptance
    // -------------------------------------------------------------------------
    console.log("\x1b[1m[Challenge 1: Token Issuance & Active Session Acceptance]\x1b[0m");

    await resetMockDb();

    await runTest("C1.1: Newly issued JWT with tokenVersion = 1 succeeds against DB version = 1", async () => {
        // Mock token issued for Alice (user_id: 101, DB token_version: 1)
        const rawUser = {
            id: "101",
            email: "alice@quizweb.dev",
            role: "user",
            user_role: "user",
            token_version: 1,
            tokenVersion: 1,
        };

        const token = await jwtCallback({ token: {}, user: rawUser, account: null as never });
        assert.strictEqual(token.tokenVersion, 1, "JWT must carry tokenVersion 1");
        assert.strictEqual(token.id, "101", "JWT must carry user id 101");

        const session = {
            user: { id: "101", email: "alice@quizweb.dev", name: "Alice" },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token });
        assert.ok(resultSession, "Session callback must succeed");
        assert.ok(resultSession.user, "Session callback must return user object");
        assert.strictEqual(resultSession.user.id, "101", "Session user id must match");
        assert.strictEqual((resultSession.user as { tokenVersion?: number }).tokenVersion, 1, "tokenVersion must be 1");
    });

    // -------------------------------------------------------------------------
    // CHALLENGE 2: Database token_version Increment Rejection (Multi-Device)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Challenge 2: Database Version Increment -> Immediate Rejection]\x1b[0m");

    await runTest("C2.1: Incrementing DB token_version = 2 immediately revokes token with tokenVersion = 1", async () => {
        const alice = mockDb.users.find((u) => u.user_id === 101)!;
        alice.token_version = 2; // Incremented on server

        const staleToken = { id: "101", sub: "101", role: "user", tokenVersion: 1 };
        const session = {
            user: { id: "101", email: "alice@quizweb.dev", name: "Alice" },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token: staleToken });
        const isRevoked = resultSession === null || !resultSession?.user;
        assert.ok(isRevoked, "Prior JWT with tokenVersion = 1 MUST be rejected immediately when DB version = 2");
    });

    await runTest("C2.2: Multi-device attack scenario: Device A and Device B both holding v1 tokens are both blocked", async () => {
        const deviceAToken = { id: "101", sub: "101", role: "user", tokenVersion: 1 };
        const deviceBToken = { id: "101", sub: "101", role: "user", tokenVersion: 1 };

        const sessionA = { user: { id: "101" }, expires: new Date().toISOString() };
        const sessionB = { user: { id: "101" }, expires: new Date().toISOString() };

        const resA = await sessionCallback({ session: sessionA, token: deviceAToken });
        const resB = await sessionCallback({ session: sessionB, token: deviceBToken });

        assert.ok(resA === null || !resA?.user, "Device A must be rejected");
        assert.ok(resB === null || !resB?.user, "Device B must be rejected");
    });

    await runTest("C2.3: Repeated probe: Replaying revoked token produces deterministic fail-closed result", async () => {
        const staleToken = { id: "101", sub: "101", role: "user", tokenVersion: 1 };
        for (let i = 0; i < 5; i++) {
            const session = { user: { id: "101" }, expires: new Date().toISOString() };
            const res = await sessionCallback({ session, token: staleToken });
            assert.ok(res === null || !res?.user, `Attempt ${i + 1} must be rejected`);
        }
    });

    // -------------------------------------------------------------------------
    // CHALLENGE 3: Calling resetPass Increments DB token_version
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Challenge 3: resetPass DB Token Version Invalidation]\x1b[0m");

    await resetMockDb();

    await runTest("C3.1: Calling resetPass increments DB token_version from 1 to 2", async () => {
        const rawOtp = "654321";
        const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");

        mockDb.otps.push({
            otp_id: 1,
            user_id: 101,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 600000),
            is_used: 1, // Verified OTP
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const userBefore = mockDb.users.find((u) => u.user_id === 101)!;
        assert.strictEqual(userBefore.token_version, 1, "Pre-reset version must be 1");

        const resetRes = await resetPass("alice@quizweb.dev", rawOtp, "BrandNewSecurePassword456!");
        assert.strictEqual(resetRes.success, true, "resetPass must succeed");

        const userAfter = mockDb.users.find((u) => u.user_id === 101)!;
        assert.strictEqual(userAfter.token_version, 2, "DB token_version must be 2 after resetPass");
    });

    await runTest("C3.2: Prior active token is revoked post-resetPass, while fresh token with v2 succeeds", async () => {
        const priorToken = { id: "101", sub: "101", tokenVersion: 1 };
        const session1 = { user: { id: "101" }, expires: new Date().toISOString() };
        const res1 = await sessionCallback({ session: session1, token: priorToken });
        assert.ok(res1 === null || !res1?.user, "Prior token must be rejected post-resetPass");

        const freshToken = { id: "101", sub: "101", tokenVersion: 2 };
        const session2 = { user: { id: "101" }, expires: new Date().toISOString() };
        const res2 = await sessionCallback({ session: session2, token: freshToken });
        assert.ok(res2?.user, "Fresh token with tokenVersion: 2 must succeed");
        assert.strictEqual((res2.user as { tokenVersion?: number }).tokenVersion, 2, "Session tokenVersion must match 2");
    });

    await runTest("C3.3: Failed resetPass (invalid OTP) does NOT increment token_version", async () => {
        const versionBefore = mockDb.users.find((u) => u.user_id === 101)!.token_version;
        const badRes = await resetPass("alice@quizweb.dev", "wrong-otp-999", "NewPassword123!");
        assert.ok(badRes.error, "resetPass with invalid OTP must return error");
        const versionAfter = mockDb.users.find((u) => u.user_id === 101)!.token_version;
        assert.strictEqual(versionAfter, versionBefore, "Failed resetPass must NOT increment token_version");
    });

    // -------------------------------------------------------------------------
    // CHALLENGE 4: Sign Out / Logout Increments DB token_version
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Challenge 4: Sign Out / Logout DB Token Version Invalidation]\x1b[0m");

    await resetMockDb();

    await runTest("C4.1: Calling events.signOut increments DB token_version", async () => {
        const bob = mockDb.users.find((u) => u.user_id === 102)!;
        assert.strictEqual(bob.token_version, 1, "Initial token_version must be 1");

        await signOutEventHandler({ token: { id: "102" } });
        assert.strictEqual(bob.token_version, 2, "DB token_version must be 2 after signOut event");

        const staleToken = { id: "102", sub: "102", tokenVersion: 1 };
        const res = await sessionCallback({ session: { user: { id: "102" } }, token: staleToken });
        assert.ok(res === null || !res?.user, "Stale token must be revoked post signOut");
    });

    await runTest("C4.2: Calling logoutUser(userId) increments DB token_version", async () => {
        const bob = mockDb.users.find((u) => u.user_id === 102)!;
        assert.strictEqual(bob.token_version, 2, "Initial token_version is 2");

        await logoutUser(102);
        assert.strictEqual(bob.token_version, 3, "DB token_version must be 3 after logoutUser(102)");

        const v2Token = { id: "102", sub: "102", tokenVersion: 2 };
        const res = await sessionCallback({ session: { user: { id: "102" } }, token: v2Token });
        assert.ok(res === null || !res?.user, "v2 token must be revoked when DB version is 3");
    });

    // -------------------------------------------------------------------------
    // CHALLENGE 5: Deleted User Record Fail-Closed Behavior
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Challenge 5: Deleted / Non-Existent User Record Fail-Closed]\x1b[0m");

    await resetMockDb();

    await runTest("C5.1: Deleted user record fails closed (returns null / user undefined)", async () => {
        // User 999 does not exist in mockDb
        const ghostToken = { id: "999", sub: "999", role: "user", tokenVersion: 1 };
        const session = {
            user: { id: "999", email: "ghost@quizweb.dev", name: "Ghost" },
            expires: new Date().toISOString(),
        };

        const res = await sessionCallback({ session, token: ghostToken });
        assert.ok(res === null || !res?.user, "Deleted user record must fail closed");
    });

    await runTest("C5.2: Deleting active user mid-session immediately revokes subsequent session callbacks", async () => {
        // Alice starts with active session
        const aliceToken = { id: "101", sub: "101", role: "user", tokenVersion: 1 };
        const session = { user: { id: "101", email: "alice@quizweb.dev" }, expires: new Date().toISOString() };
        const validRes = await sessionCallback({ session, token: aliceToken });
        assert.ok(validRes?.user, "Alice session valid initially");

        // Admin drops Alice from user_auth_tbl
        mockDb.users = mockDb.users.filter((u) => u.user_id !== 101);

        // Subsequent session callback
        const postDeleteRes = await sessionCallback({ session, token: aliceToken });
        assert.ok(postDeleteRes === null || !postDeleteRes?.user, "Alice session must immediately fail closed post deletion");
    });

    // -------------------------------------------------------------------------
    // CHALLENGE 6: Adversarial Boundary Probes & Type Coercion Attacks
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Challenge 6: Adversarial Boundary Probes & Type Coercion Attacks]\x1b[0m");

    await resetMockDb();

    await runTest("C6.1: Numeric string tokenVersion ('1' vs 1) normalizes correctly", async () => {
        const tokenStringVer = { id: "101", sub: "101", tokenVersion: "1" as unknown as number };
        const session = { user: { id: "101" }, expires: new Date().toISOString() };
        const res = await sessionCallback({ session, token: tokenStringVer });
        assert.ok(res?.user, "Numeric string '1' must normalize to number 1 and succeed");
    });

    await runTest("C6.2: Non-numeric / NaN tokenVersion fails closed against DB version 1", async () => {
        const weirdTokens = [
            { id: "101", sub: "101", tokenVersion: NaN },
            { id: "101", sub: "101", tokenVersion: "malicious" as unknown as number },
            { id: "101", sub: "101", tokenVersion: -99 },
            { id: "101", sub: "101", tokenVersion: 1.5 },
        ];

        for (const badToken of weirdTokens) {
            const session = { user: { id: "101" }, expires: new Date().toISOString() };
            const res = await sessionCallback({ session, token: badToken });
            assert.ok(res === null || !res?.user, `Token ${JSON.stringify(badToken)} must fail closed`);
        }
    });

    await runTest("C6.3: Simulated database query error (deadlock/syntax) fails closed", async () => {
        mockDb.simulateDbError = true;
        mockDb.dbErrorCode = "ER_LOCK_DEADLOCK";

        const validToken = { id: "101", sub: "101", tokenVersion: 1 };
        const session = { user: { id: "101" }, expires: new Date().toISOString() };

        const res = await sessionCallback({ session, token: validToken });
        assert.ok(res === null || !res?.user, "Database query error must fail closed");

        mockDb.simulateDbError = false;
        mockDb.dbErrorCode = null;
    });

    await runTest("C6.4: Monotonic increment under high frequency (50 cycles)", async () => {
        const user = mockDb.users.find((u) => u.user_id === 101)!;
        user.token_version = 1;

        for (let i = 1; i <= 50; i++) {
            await logoutUser(101);
            assert.strictEqual(user.token_version, i + 1, `Version must be ${i + 1}`);

            // Any older token must be invalid
            const oldToken = { id: "101", sub: "101", tokenVersion: i };
            const res = await sessionCallback({ session: { user: { id: "101" } }, token: oldToken });
            assert.ok(res === null || !res?.user, `Old token v${i} must be revoked`);
        }

        // Only latest tokenVersion: 51 succeeds
        const latestToken = { id: "101", sub: "101", tokenVersion: 51 };
        const validRes = await sessionCallback({ session: { user: { id: "101" } }, token: latestToken });
        assert.ok(validRes?.user, "Latest token v51 must succeed");
    });

    // -------------------------------------------------------------------------
    // Final Summary Report
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    console.log(` Challenger Test Summary: ${passedTests}/${totalTests} Passed`);
    if (failedTests > 0) {
        console.log(` Status: DEFECTS DETECTED (${failedTests} tests failed)`);
        process.exit(1);
    } else {
        console.log(" Status: ALL ADVERSARIAL CHALLENGES CONFIRMED");
        console.log(" Session Revocation (SEC-05) Robustness: EMPIRICALLY VERIFIED");
        console.log("========================================================\n");
    }
}

runChallengerSuite().catch((err) => {
    console.error("Fatal error running challenger harness:", err);
    process.exit(1);
});
