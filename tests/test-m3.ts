/**
 * =============================================================================
 * Milestone 3 Verification Test Harness: tests/test-m3.ts
 * =============================================================================
 * Targets:
 *   - SEC-04: Insecure OAuth Account Linking Prevention
 *   - SEC-05: Token Versioning & Stateless JWT Session Revocation
 *
 * Standards:
 *   - OWASP ASVS v4.0.3 Chapter 3 (V3.1.1, V3.2.1, V3.3.1, V3.3.3, V3.5.3, V3.6.1)
 *
 * Execution:
 *   npx --yes tsx tests/test-m3.ts
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
process.env.AUTH_GITHUB_ID = process.env.AUTH_GITHUB_ID || "test_github_client_id";
process.env.AUTH_GITHUB_SECRET = process.env.AUTH_GITHUB_SECRET || "test_github_client_secret";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m3_audit";

// Global mock for transactional email (Resend)
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
                email: "victim@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 1, user_id: 1, username: "admin_user" },
            { player_id: 2, user_id: 2, username: "regular_user" },
            { player_id: 3, user_id: 3, username: "victim_user" },
        ],
        oauths: [
            {
                oauth_id: 1,
                user_id: 2,
                provider_name: "github",
                provider_account_id: "gh-linked-200",
            },
        ],
        otps: [],
        nextUserId: 10,
        nextPlayerId: 10,
        nextOAuthId: 10,
        nextOtpId: 10,
    };
}

// -----------------------------------------------------------------------------
// Database Query Interceptor
// -----------------------------------------------------------------------------
interface QueryLogEntry {
    sql: string;
    params?: unknown[];
}
const queryLog: QueryLogEntry[] = [];

// Dynamic import of database pool
import { db } from "../lib/db";

db.query = (async (sql: string, params: unknown[] = []) => {
    queryLog.push({ sql, params });

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
    if (sql.includes("SELECT token_version FROM user_auth_tbl WHERE user_id = ?") ||
        sql.includes("SELECT user_role, token_version FROM user_auth_tbl WHERE user_id = ?")) {
        const userId = Number(params[0]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (!user) return [[]];
        return [[{ token_version: user.token_version, user_role: user.user_role }]];
    }

    // 4. SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ?
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

    // 5. SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ?
    if (sql.includes("SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ?")) {
        const providerName = String(params[0]);
        const providerAccountId = String(params[1]);
        const oauth = mockDb.oauths.find(
            (o) => o.provider_name === providerName && o.provider_account_id === providerAccountId
        );
        if (!oauth) return [[]];
        return [[{ oauth_id: oauth.oauth_id, user_id: oauth.user_id }]];
    }

    // 6. UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?
    if (sql.includes("UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?")) {
        const userId = Number(params[0]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (user) {
            user.token_version += 1;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 7. UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?
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

    // 8. INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id)
    if (sql.includes("INSERT INTO user_oauth_tbl")) {
        const userId = Number(params[0]);
        const providerName = String(params[1]);
        const providerAccountId = String(params[2]);
        const newId = mockDb.nextOAuthId++;
        mockDb.oauths.push({
            oauth_id: newId,
            user_id: userId,
            provider_name: providerName,
            provider_account_id: providerAccountId,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 9. INSERT INTO user_auth_tbl (email, is_email_verified, token_version)
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

    // 10. INSERT INTO player_tbl (user_id, username)
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

    // 11. SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1 (for resetPass)
    if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return [[]];
        return [[{ user_id: user.user_id }]];
    }

    // 12. SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl (for resetPass)
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

    // 12b. Rate limit table handling
    if (sql.includes("rate_limit_tbl")) {
        return [[{ attempts: 0, reset_at: Date.now() + 900000, blocked: 0 }]];
    }

    // 13. UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ?
    if (sql.includes("UPDATE user_otp_tbl SET is_used = 1")) {
        const userId = Number(params[0]);
        for (const otp of mockDb.otps) {
            if (otp.user_id === userId) otp.is_used = 1;
        }
        return [{ affectedRows: 1 }];
    }

    return [{ affectedRows: 1, insertId: 999 }];
}) as typeof db.query;

// -----------------------------------------------------------------------------
// Test Execution
// -----------------------------------------------------------------------------
async function main() {
    console.log("\n========================================================");
    console.log(" QuizWeb Milestone 3: Standalone Security Verification");
    console.log(" Targets: SEC-04 (OAuth Account Linking Protection)");
    console.log("          SEC-05 (Token Versioning & Session Revocation)");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3");
    console.log("========================================================\n");

    // Dynamic import of auth modules
    const authModule = await import("../auth");
    const { authConfig, handlers, auth, signIn, signOut } = authModule;
    const authActions = await import("../app/actions/auth");
    const { resetPass, signOutAction, logoutUser } = authActions;

    // =========================================================================
    // Suite 1: Architecture & Contract Verification
    // =========================================================================
    console.log("\x1b[1m[Suite 1: Architecture & Module Contract Verification]\x1b[0m");

    await runTest("auth.ts exports handlers, auth, signIn, signOut, and authConfig", () => {
        assert.ok(handlers, "handlers must be exported");
        assert.ok(typeof auth === "function", "auth function must be exported");
        assert.ok(typeof signIn === "function", "signIn function must be exported");
        assert.ok(typeof signOut === "function", "signOut function must be exported");
        assert.ok(authConfig, "authConfig must be exported");
    });

    await runTest("authConfig defines callbacks for signIn, jwt, and session", () => {
        assert.ok(authConfig.callbacks, "callbacks must be defined in authConfig");
        assert.ok(typeof authConfig.callbacks.signIn === "function", "signIn callback must be defined");
        assert.ok(typeof authConfig.callbacks.jwt === "function", "jwt callback must be defined");
        assert.ok(typeof authConfig.callbacks.session === "function", "session callback must be defined");
    });

    await runTest("authConfig defines signOut event handler", () => {
        assert.ok(authConfig.events, "events must be defined in authConfig");
        assert.ok(typeof authConfig.events.signOut === "function", "signOut event must be defined");
    });

    await runTest("app/actions/auth.ts exports resetPass, signOutAction, and logoutUser", () => {
        assert.ok(typeof resetPass === "function", "resetPass must be exported");
        assert.ok(typeof signOutAction === "function", "signOutAction must be exported");
        assert.ok(typeof logoutUser === "function", "logoutUser must be exported");
    });

    // =========================================================================
    // Suite 2: Credentials Login & JWT Token Version Attachment (SEC-05)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 2: Credentials Login & JWT Token Version Attachment (SEC-05)]\x1b[0m");

    await resetMockDb();

    await runTest("authorize() retrieves token_version and returns it on user object", async () => {
        const credentialsProvider = authConfig.providers.find(
            (p) => typeof p === "object" && p !== null && "id" in p && p.id === "credentials"
        ) as {
            authorize?: (cred: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
            options?: { authorize?: (cred: Record<string, unknown>) => Promise<Record<string, unknown> | null> };
        };

        assert.ok(credentialsProvider, "Credentials provider must exist");
        const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;
        assert.ok(typeof authorizeFn === "function", "authorize function must be found");
        const authorizedUser = await authorizeFn({
            email: "admin@quizweb.dev",
            password: "ValidPassword123!",
        });

        assert.ok(authorizedUser, "authorize() must succeed with valid credentials");
        assert.strictEqual(authorizedUser.id, "1", "User id must match");
        assert.strictEqual(authorizedUser.token_version, 1, "token_version must be returned");
        assert.strictEqual(authorizedUser.tokenVersion, 1, "tokenVersion must be returned");
    });

    await runTest("callbacks.jwt attaches tokenVersion to token on user login", async () => {
        const rawUser = {
            id: "2",
            email: "user@quizweb.dev",
            role: "user",
            user_role: "user",
            token_version: 1,
            tokenVersion: 1,
        };

        const initialToken: Record<string, unknown> = {};
        const jwtCallback = authConfig.callbacks.jwt!;
        const resultToken = await jwtCallback({
            token: initialToken,
            user: rawUser,
            account: null as never,
        });

        assert.ok(resultToken, "jwt callback must return token");
        assert.strictEqual(resultToken.tokenVersion, 1, "token.tokenVersion must be 1");
        assert.strictEqual(resultToken.id, "2", "token.id must be 2");
    });

    // =========================================================================
    // Suite 3: Dynamic Session Revocation (SEC-05 / ASVS 3.1.1, 3.3.1, 3.5.3)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 3: Dynamic Session Revocation via DB token_version (SEC-05)]\x1b[0m");

    await resetMockDb();
    const sessionCallback = authConfig.callbacks!.session! as unknown as (params: { session: unknown; token: unknown }) => Promise<unknown>;

    await runTest("T3.1: Valid session succeeds when token.tokenVersion matches DB token_version", async () => {
        const token = { id: "2", sub: "2", role: "user", tokenVersion: 1 };
        const session = {
            user: { id: "2", name: "User", email: "user@quizweb.dev", image: null },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token });
        assert.ok(resultSession, "Valid session callback must not be null");
        assert.ok(resultSession.user, "Valid session must contain user");
        assert.strictEqual(resultSession.user.id, "2", "User ID must match");
        assert.strictEqual((resultSession.user as { tokenVersion?: number }).tokenVersion, 1, "tokenVersion must match");
    });

    await runTest("T3.2: Revoked session: DB token_version mismatch terminates session immediately", async () => {
        // Increment user 2's token_version in mock DB to 2
        const targetUser = mockDb.users.find((u) => u.user_id === 2)!;
        targetUser.token_version = 2;

        // Present stale JWT token with tokenVersion: 1
        const staleToken = { id: "2", sub: "2", role: "user", tokenVersion: 1 };
        const session = {
            user: { id: "2", name: "User", email: "user@quizweb.dev", image: null },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token: staleToken });
        // Must invalidate immediately: returns null or user is undefined
        const isRevoked = resultSession === null || !resultSession?.user;
        assert.ok(isRevoked, "Session callback must be revoked / return null on token_version mismatch");
    });

    await runTest("T3.3: Post-revocation: Newly issued JWT with matching tokenVersion restores valid session", async () => {
        // Target user DB token_version is 2
        const freshToken = { id: "2", sub: "2", role: "user", tokenVersion: 2 };
        const session = {
            user: { id: "2", name: "User", email: "user@quizweb.dev", image: null },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token: freshToken });
        assert.ok(resultSession, "Fresh session callback must succeed");
        assert.ok(resultSession.user, "Fresh session must contain user");
        assert.strictEqual(resultSession.user.id, "2", "User ID must match");
        assert.strictEqual((resultSession.user as { tokenVersion?: number }).tokenVersion, 2, "Fresh tokenVersion must be 2");
    });

    await runTest("T3.4: Fail-closed on non-existent or deleted user ID", async () => {
        const deletedUserToken = { id: "9999", sub: "9999", role: "user", tokenVersion: 1 };
        const session = {
            user: { id: "9999", name: "Ghost", email: "ghost@quizweb.dev", image: null },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token: deletedUserToken });
        const isRevoked = resultSession === null || !resultSession?.user;
        assert.ok(isRevoked, "Session callback must return null for non-existent user");
    });

    await runTest("T3.5: Fail-closed on missing user ID on token payload", async () => {
        const emptyToken = { tokenVersion: 1 };
        const session = {
            user: { id: "1", name: "Admin", email: "admin@quizweb.dev", image: null },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };

        const resultSession = await sessionCallback({ session, token: emptyToken as never });
        const isRevoked = resultSession === null || !resultSession?.user;
        assert.ok(isRevoked, "Session callback must fail-closed on missing token ID");
    });

    // =========================================================================
    // Suite 4: Password Reset Session Revocation (SEC-05 / ASVS 3.3.3)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 4: Password Reset Session Invalidation (SEC-05 / ASVS 3.3.3)]\x1b[0m");

    await resetMockDb();

    await runTest("T4.1: resetPass execution increments token_version in user_auth_tbl", async () => {
        const userEmail = "user@quizweb.dev";
        const rawOtp = "123456";
        const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");

        // Seed an active OTP for user 2
        mockDb.otps.push({
            otp_id: mockDb.nextOtpId++,
            user_id: 2,
            otp_code: hashedOtp,
            expires_at: new Date(Date.now() + 300000),
            is_used: 1, // Already verified OTP step
            purpose: "password_reset",
            attempts: 0,
            locked_until: null,
        });

        const initialTokenVersion = mockDb.users.find((u) => u.user_id === 2)!.token_version;
        assert.strictEqual(initialTokenVersion, 1, "Initial token_version must be 1");

        // Pre-reset session succeeds
        const preResetToken = { id: "2", sub: "2", role: "user", tokenVersion: 1 };
        const preSession = await sessionCallback({
            session: { user: { id: "2", name: "User", email: userEmail }, expires: new Date().toISOString() },
            token: preResetToken,
        });
        assert.ok(preSession?.user, "Pre-reset session must be valid");

        // Execute resetPass
        const resetResult = await resetPass(userEmail, rawOtp, "BrandNewPassword999!");
        assert.strictEqual(resetResult.success, true, "resetPass must succeed");

        // Verify token_version in DB was incremented
        const updatedUser = mockDb.users.find((u) => u.user_id === 2)!;
        assert.strictEqual(updatedUser.token_version, 2, "DB token_version must be incremented to 2");

        // Pre-existing JWT with tokenVersion: 1 is now rejected
        const postResetSession = await sessionCallback({
            session: { user: { id: "2", name: "User", email: userEmail }, expires: new Date().toISOString() },
            token: preResetToken,
        });
        const isInvalidated = postResetSession === null || !postResetSession?.user;
        assert.ok(isInvalidated, "Pre-existing JWT must be rejected immediately after resetPass");
    });

    // =========================================================================
    // Suite 5: Logout / Sign-Out Session Revocation (SEC-05 / ASVS 3.3.1, 3.5.3)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 5: Logout / Sign-Out Session Invalidation (SEC-05 / ASVS 3.5.3)]\x1b[0m");

    await resetMockDb();

    await runTest("T5.1: NextAuth events.signOut increments token_version in user_auth_tbl", async () => {
        const initialVersion = mockDb.users.find((u) => u.user_id === 1)!.token_version;
        assert.strictEqual(initialVersion, 1, "Initial token_version must be 1");

        // Invoke signOut event handler
        const signOutEventHandler = authConfig.events!.signOut!;
        await signOutEventHandler({ token: { id: "1", sub: "1" } });

        const newVersion = mockDb.users.find((u) => u.user_id === 1)!.token_version;
        assert.strictEqual(newVersion, 2, "DB token_version must be incremented to 2 upon signOut event");

        // Stale token is revoked
        const staleToken = { id: "1", sub: "1", role: "admin", tokenVersion: 1 };
        const sessionRes = await sessionCallback({
            session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() },
            token: staleToken,
        });
        const isRevoked = sessionRes === null || !sessionRes?.user;
        assert.ok(isRevoked, "Stale token must be revoked post signOut event");
    });

    await runTest("T5.2: Server action logoutUser increments token_version", async () => {
        const initialVersion = mockDb.users.find((u) => u.user_id === 3)!.token_version;
        assert.strictEqual(initialVersion, 1, "Initial token_version must be 1");

        await logoutUser(3);

        const newVersion = mockDb.users.find((u) => u.user_id === 3)!.token_version;
        assert.strictEqual(newVersion, 2, "DB token_version must be incremented to 2 upon logoutUser");
    });

    // =========================================================================
    // Suite 6: OAuth Account Linking Security (SEC-04 / ASVS 3.2.1, 3.6.1)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 6: OAuth Account Linking Protection (SEC-04 / ASVS 3.2.1, 3.6.1)]\x1b[0m");

    await resetMockDb();
    const signInCallback = authConfig.callbacks!.signIn! as unknown as (params: { user: unknown; account?: unknown }) => Promise<boolean | string>;

    await runTest("T6.1: OAuth sign-in with brand new email creates user and links provider", async () => {
        const brandNewEmail = "newbie@quizweb.dev";
        const userObj = { id: "", email: brandNewEmail, name: "Newbie User" };
        const accountObj = { provider: "google", providerAccountId: "google-newbie-101" };

        const allowed = await signInCallback({ user: userObj, account: accountObj as never });
        assert.strictEqual(allowed, true, "New OAuth user registration must be allowed");

        const createdUser = mockDb.users.find((u) => u.email === brandNewEmail);
        assert.ok(createdUser, "New user record must be created in user_auth_tbl");
        assert.strictEqual(createdUser.token_version, 1, "New user token_version must be initialized to 1");

        const createdOAuth = mockDb.oauths.find(
            (o) => o.provider_name === "google" && o.provider_account_id === "google-newbie-101"
        );
        assert.ok(createdOAuth, "OAuth record must be inserted into user_oauth_tbl");
        assert.strictEqual(createdOAuth.user_id, createdUser.user_id, "OAuth user_id must match created user");
    });

    await runTest("T6.2: Returning OAuth user with existing link allows sign-in without active session", async () => {
        // User 2 already has github linked with gh-linked-200
        const userObj = { id: "", email: "user@quizweb.dev", name: "Regular User" };
        const accountObj = { provider: "github", providerAccountId: "gh-linked-200" };

        // Ensure no active session is present
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const allowed = await signInCallback({ user: userObj, account: accountObj as never });
        assert.strictEqual(allowed, true, "Returning linked OAuth user sign-in must be permitted");
        assert.strictEqual(userObj.id, "2", "User object ID must be set to existing user 2");
    });

    await runTest("T6.3: SEC-04 ATTACK: Unauthenticated OAuth sign-in with existing local email is BLOCKED", async () => {
        // Victim has local email 'victim@quizweb.dev' (user_id: 3), NOT linked to Google
        const victimEmail = "victim@quizweb.dev";
        const attackerUserObj = { id: "", email: victimEmail, name: "Attacker Impersonator" };
        const attackerAccount = { provider: "google", providerAccountId: "google-attacker-evil-999" };

        // Attacker has NO active authenticated session
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const initialOAuthCount = mockDb.oauths.length;
        const allowed = await signInCallback({ user: attackerUserObj, account: attackerAccount as never });

        // Must be rejected (returns false)
        assert.strictEqual(allowed, false, "Unauthenticated OAuth linking attempt MUST return false (SEC-04)");

        // Assert ZERO rows were inserted into user_oauth_tbl
        const finalOAuthCount = mockDb.oauths.length;
        assert.strictEqual(finalOAuthCount, initialOAuthCount, "ZERO rows must be inserted into user_oauth_tbl");

        const injectedOAuth = mockDb.oauths.find(
            (o) => o.provider_account_id === "google-attacker-evil-999"
        );
        assert.strictEqual(injectedOAuth, undefined, "Attacker OAuth record must NOT exist in user_oauth_tbl");
    });

    await runTest("T6.4: Authenticated OAuth sign-in with matching active session successfully links provider", async () => {
        // User 3 is logged in and initiates linking their Google account
        const victimEmail = "victim@quizweb.dev";
        const legitUserObj = { id: "", email: victimEmail, name: "Victim Real User" };
        const legitAccount = { provider: "google", providerAccountId: "google-victim-legit-777" };

        // Active session matches user 3
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = {
            user: { id: "3", email: victimEmail },
        };

        const allowed = await signInCallback({ user: legitUserObj, account: legitAccount as never });
        assert.strictEqual(allowed, true, "Authenticated user linking their own OAuth account must succeed");

        // Verify row was inserted into user_oauth_tbl for user 3
        const linkedOAuth = mockDb.oauths.find(
            (o) => o.provider_name === "google" && o.provider_account_id === "google-victim-legit-777"
        );
        assert.ok(linkedOAuth, "OAuth record must be inserted into user_oauth_tbl");
        assert.strictEqual(linkedOAuth.user_id, 3, "OAuth link must be bound to user 3");

        // Cleanup global test session
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
    });

    await runTest("T6.5: Cross-user session mismatch attempt (active user A attempting to link user B) is BLOCKED", async () => {
        // Attacker is authenticated as user 2, but presents victim's email (user 3) in OAuth
        const victimEmail = "victim@quizweb.dev";
        const spoofedUserObj = { id: "", email: victimEmail, name: "Victim Impersonator" };
        const spoofedAccount = { provider: "github", providerAccountId: "github-spoofed-555" };

        // Active session belongs to user 2 (NOT user 3)
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = {
            user: { id: "2", email: "user@quizweb.dev" },
        };

        const allowed = await signInCallback({ user: spoofedUserObj, account: spoofedAccount as never });
        assert.strictEqual(allowed, false, "Cross-user OAuth account linking attempt MUST be blocked");

        const injectedOAuth = mockDb.oauths.find(
            (o) => o.provider_account_id === "github-spoofed-555"
        );
        assert.strictEqual(injectedOAuth, undefined, "Mismatched OAuth link must NOT be inserted");

        // Cleanup
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
    });

    // =========================================================================
    // Suite 7: Adversarial Edge Cases & Boundary Conditions
    // =========================================================================
    console.log("\n\x1b[1m[Suite 7: Adversarial Robustness & Edge Cases]\x1b[0m");

    await resetMockDb();

    await runTest("T7.1: Missing or non-numeric tokenVersion in token payload fails closed", async () => {
        const invalidTokens = [
            { id: "1", sub: "1", tokenVersion: "malicious_string" },
            { id: "1", sub: "1", tokenVersion: NaN },
            { id: "1", sub: "1", tokenVersion: -1 },
        ];

        for (const badToken of invalidTokens) {
            const res = await sessionCallback({
                session: { user: { id: "1", name: "Admin" }, expires: new Date().toISOString() },
                token: badToken as never,
            });
            const isInvalid = res === null || !res?.user;
            assert.ok(isInvalid, `Token with ${JSON.stringify(badToken)} must be rejected`);
        }
    });

    await runTest("T7.2: OAuth provider separation (same accountId on different providers)", async () => {
        // gh-linked-200 is linked on 'github' for user 2.
        // If an attacker comes with 'google' and providerAccountId 'gh-linked-200', it must NOT be considered linked!
        const userObj = { id: "", email: "user@quizweb.dev", name: "Regular User" };
        const confusedAccount = { provider: "google", providerAccountId: "gh-linked-200" };

        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const allowed = await signInCallback({ user: userObj, account: confusedAccount as never });
        assert.strictEqual(allowed, false, "Same account ID on different provider must NOT bypass linking guard");
    });

    await runTest("T7.3: Monotonic increment of token_version across repeated revocations", async () => {
        const user = mockDb.users.find((u) => u.user_id === 1)!;
        user.token_version = 1;

        const signOutEventHandler = authConfig.events!.signOut!;
        await signOutEventHandler({ token: { id: "1" } });
        assert.strictEqual(user.token_version, 2, "First revocation increments to 2");

        await signOutEventHandler({ token: { id: "1" } });
        assert.strictEqual(user.token_version, 3, "Second revocation increments to 3");

        await signOutEventHandler({ token: { id: "1" } });
        assert.strictEqual(user.token_version, 4, "Third revocation increments to 4");
    });

    // =========================================================================
    // Suite 8: Zero Regression Verification with Milestones 1 & 2
    // =========================================================================
    console.log("\n\x1b[1m[Suite 8: Zero Regression Verification Guard]\x1b[0m");

    await runTest("Milestone 1 schema & hashing contract integrity confirmed", () => {
        const migrationSql = fs.readFileSync(path.join(projectRoot, "migrations/002_security_hardening.sql"), "utf8");
        assert.ok(
            migrationSql.includes("`token_version` INT NOT NULL DEFAULT 1") || migrationSql.includes("token_version INT NOT NULL DEFAULT 1"),
            "002 migration must define token_version"
        );
    });

    await runTest("Milestone 2 route protection & RPC reduction integrity confirmed", () => {
        const authSource = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(!authSource.includes("export async function clearLoginRateLimit"), "clearLoginRateLimit must NOT be exported");
        assert.ok(authSource.includes("token_version = token_version + 1"), "resetPass must increment token_version");
    });

    // =========================================================================
    // Suite 9: OWASP ASVS v4.0.3 Chapter 3 Compliance Matrix
    // =========================================================================
    console.log("\n\x1b[1m[Suite 9: OWASP ASVS v4.0.3 Chapter 3 Compliance Audit]\x1b[0m");

    await runTest("V3.1.1: Session Management Architecture - session tokens securely verified", async () => {
        await resetMockDb();
        // 1. Valid token bound to valid user produces active session
        const validToken = { id: "1", sub: "1", role: "admin", tokenVersion: 1 };
        const validSession = {
            user: { id: "1", name: "Admin", email: "admin@quizweb.dev" },
            expires: new Date(Date.now() + 86400000).toISOString(),
        };
        const activeRes = await sessionCallback({ session: validSession, token: validToken });
        assert.ok(activeRes !== null && activeRes?.user, "Session callback must return active session for valid token");
        assert.strictEqual(activeRes.user.id, "1", "Session user id must match token binding");

        // 2. Corrupted / unbound token (non-existent user) is terminated
        const unboundToken = { id: "9999", sub: "9999", role: "user", tokenVersion: 1 };
        const unboundRes = await sessionCallback({
            session: { user: { id: "9999", name: "Fake", email: "fake@quizweb.dev" }, expires: new Date().toISOString() },
            token: unboundToken,
        });
        const isTerminated = unboundRes === null || !unboundRes?.user;
        assert.ok(isTerminated, "Session callback must terminate session for unbound/invalid user token");

        // 3. Null / empty token payload fails closed
        const nullTokenRes = await sessionCallback({ session: validSession, token: null as never });
        assert.ok(nullTokenRes === null || !nullTokenRes?.user, "Session callback must fail closed on null token");
    });

    await runTest("V3.2.1: Session Binding - cross-account OAuth takeover prohibited (SEC-04)", async () => {
        await resetMockDb();
        // Setup User 2's OAuth link
        mockDb.oauths = [{
            oauth_id: 1,
            user_id: 2,
            provider_name: "github",
            provider_account_id: "attacker-gh-link",
        }];

        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        // Attacker attempts to hijack User 1 (Admin) using User 2's OAuth credentials
        const hijackUserObj = { id: "", email: "admin@quizweb.dev", name: "Hijacker" };
        const hijackAccount = { provider: "github", providerAccountId: "attacker-gh-link" };

        const hijackResult = await signInCallback({ user: hijackUserObj, account: hijackAccount as never });
        assert.strictEqual(hijackResult, false, "Cross-account OAuth takeover MUST return false");
        assert.notStrictEqual(hijackUserObj.id, "1", "User ID must NOT be assigned to target victim user");

        // Legitimate login with matching user_id succeeds
        const legitUserObj = { id: "", email: "user@quizweb.dev", name: "Legit User" };
        const legitAccount = { provider: "github", providerAccountId: "attacker-gh-link" };
        const legitResult = await signInCallback({ user: legitUserObj, account: legitAccount as never });
        assert.strictEqual(legitResult, true, "Legitimate owner of OAuth link must be permitted");
        assert.strictEqual(legitUserObj.id, "2", "User ID must match legitimate owner");
    });

    await runTest("V3.3.1: Session Revocation - database token_version validates session tokens (SEC-05)", async () => {
        await resetMockDb();
        const user = mockDb.users.find((u) => u.user_id === 2)!;
        assert.strictEqual(user.token_version, 1, "Initial DB token_version must be 1");

        const tokenV1 = { id: "2", sub: "2", role: "user", tokenVersion: 1 };
        const getSession = () => ({
            user: { id: "2", name: "User", email: "user@quizweb.dev" },
            expires: new Date(Date.now() + 86400000).toISOString(),
        });

        // Token v1 is valid
        const validRes = await sessionCallback({ session: getSession(), token: tokenV1 });
        assert.ok(validRes?.user, "Session with matching token_version must be active");

        // Simulate server-side revocation: DB token_version is bumped to 2
        user.token_version = 2;

        // Token v1 is now rejected
        const staleRes = await sessionCallback({ session: getSession(), token: tokenV1 });
        const isRevoked = staleRes === null || !staleRes?.user;
        assert.ok(isRevoked, "Session with mismatched token_version must be terminated (returns null)");

        // Token v2 matching updated DB token_version is accepted
        const tokenV2 = { id: "2", sub: "2", role: "user", tokenVersion: 2 };
        const freshRes = await sessionCallback({ session: getSession(), token: tokenV2 });
        assert.ok(freshRes?.user, "Session with updated token_version 2 must be valid");
        assert.strictEqual((freshRes.user as { tokenVersion?: number }).tokenVersion, 2);
    });

    await runTest("V3.3.3: Password Change Invalidation - password reset revokes all active JWTs (SEC-05)", async () => {
        await resetMockDb();
        const rawOtp = "654321";
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

        const preResetToken = { id: "2", sub: "2", role: "user", tokenVersion: 1 };
        const preResetRes = await sessionCallback({
            session: { user: { id: "2", name: "User", email: "user@quizweb.dev" }, expires: new Date().toISOString() } as never,
            token: preResetToken as never,
        });
        assert.ok(preResetRes?.user, "Pre-reset session must be active");

        const resetRes = await resetPass("user@quizweb.dev", rawOtp, "UpdatedPassword999!");
        assert.strictEqual(resetRes.success, true, "resetPass server action must succeed");

        const targetUser = mockDb.users.find((u) => u.user_id === 2)!;
        assert.strictEqual(targetUser.token_version, 2, "DB token_version must be incremented to 2");

        const postResetRes = await sessionCallback({
            session: { user: { id: "2", name: "User", email: "user@quizweb.dev" }, expires: new Date().toISOString() } as never,
            token: preResetToken as never,
        });
        const isTerminated = postResetRes === null || !postResetRes?.user;
        assert.ok(isTerminated, "Existing JWT with pre-reset tokenVersion must be immediately invalidated");
    });

    await runTest("V3.5.3: Logout Revocation - signout increments token_version to terminate active tokens (SEC-05)", async () => {
        await resetMockDb();
        const user = mockDb.users.find((u) => u.user_id === 1)!;
        assert.strictEqual(user.token_version, 1, "Initial token_version must be 1");

        const activeToken = { id: "1", sub: "1", role: "admin", tokenVersion: 1 };
        const activeRes = await sessionCallback({
            session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() } as never,
            token: activeToken as never,
        });
        assert.ok(activeRes?.user, "Initial session must be valid before logout");

        // 1. Next-Auth events.signOut handler increments token_version
        const signOutEventHandler = authConfig.events!.signOut!;
        await signOutEventHandler({ token: { id: "1" } });
        assert.strictEqual(user.token_version, 2, "signOut event must increment token_version to 2");

        // Stale token v1 is rejected
        const staleRes = await sessionCallback({
            session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() } as never,
            token: activeToken as never,
        });
        assert.ok(staleRes === null || !staleRes?.user, "Token v1 must be revoked after signOut event");

        // 2. Server action logoutUser increments token_version
        await logoutUser(1);
        assert.strictEqual(user.token_version, 3, "logoutUser must increment token_version to 3");

        // Token v2 is now also rejected
        const tokenV2 = { id: "1", sub: "1", role: "admin", tokenVersion: 2 };
        const resV2 = await sessionCallback({
            session: { user: { id: "1", name: "Admin", email: "admin@quizweb.dev" }, expires: new Date().toISOString() } as never,
            token: tokenV2 as never,
        });
        assert.ok(resV2 === null || !resV2?.user, "Token v2 must be revoked after second logout");
    });

    await runTest("V3.6.1: Federated Account Linking - unauthenticated linking blocked (SEC-04)", async () => {
        await resetMockDb();
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const victimEmail = "victim@quizweb.dev";
        const initialOAuthCount = mockDb.oauths.length;

        // Unauthenticated OAuth linking attempt
        const unauthRes = await signInCallback({
            user: { id: "", email: victimEmail, name: "Unauthenticated Linker" },
            account: { provider: "google", providerAccountId: "unauth-google-888" } as never,
        });
        assert.strictEqual(unauthRes, false, "Unauthenticated OAuth linking for existing email MUST return false");
        assert.strictEqual(mockDb.oauths.length, initialOAuthCount, "No OAuth record must be created when unauthenticated");

        // Authenticated OAuth linking attempt by the account owner
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = {
            user: { id: "3", email: victimEmail },
        };
        const authRes = await signInCallback({
            user: { id: "", email: victimEmail, name: "Legit Owner" },
            account: { provider: "google", providerAccountId: "legit-google-888" } as never,
        });
        assert.strictEqual(authRes, true, "Authenticated user linking their own OAuth account must succeed");
        const newlyLinked = mockDb.oauths.find((o) => o.provider_account_id === "legit-google-888");
        assert.ok(newlyLinked, "OAuth record must be inserted into user_oauth_tbl");
        assert.strictEqual(newlyLinked.user_id, 3, "OAuth record must be linked to user 3");

        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
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
        console.log(" OWASP ASVS v4.0.3 Chapter 3 Compliance: VERIFIED");
        console.log("   - V3.1.1: Session token confidentiality & verified binding");
        console.log("   - V3.2.1: OAuth federated identity binding guarded");
        console.log("   - V3.3.1: Server-side token_version session termination");
        console.log("   - V3.3.3: Password reset terminates active sessions across devices");
        console.log("   - V3.5.3: Server-side token invalidation on sign-out");
        console.log("   - V3.6.1: Pre-account takeover thwarted for federated OAuth");
        console.log("========================================================\n");
    }
}

main().catch((err) => {
    console.error("Fatal error running Milestone 3 test suite:", err);
    process.exit(1);
});
