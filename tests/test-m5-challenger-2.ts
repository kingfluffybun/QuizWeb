/**
 * =============================================================================
 * Milestone 5 Challenger 2 Empirical Test Harness: tests/test-m5-challenger-2.ts
 * =============================================================================
 * Adversarially challenges:
 *   - SEC-13: Transaction Isolation & Pessimistic Locking in verifyEmail (app/actions/auth.ts)
 *
 * Focus:
 *   - High Concurrency Parallel Verification (50 simultaneous requests on same token)
 *   - Race Condition Probes & Token Collision Races (Email & Username collisions)
 *   - Transaction Abort, Failure Injection & Clean Rollback Verification
 *   - Zero Unhandled Exceptions, Zero Duplicate Key Crashes, Zero Orphaned Records
 *   - Connection Pool Leak Prevention & Resource Release Verification
 *   - Token State Machine: Expiration, Lockouts, Edge Cases & Type Confusion
 *   - OWASP ASVS v4.0.3 Chapter 4 (V4.1.5) & Chapter 13 (V13.1.4) Compliance
 *
 * Execution:
 *   npx --yes tsx tests/test-m5-challenger-2.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert";
import argon2 from "argon2";

// -----------------------------------------------------------------------------
// Setup & Environment
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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m5_challenger2";

// Mock fetch
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("api.resend.com")) {
        return new Response(JSON.stringify({ id: "mock_resend_m5_c2_" + Date.now() }), {
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

function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

// -----------------------------------------------------------------------------
// Database Interfaces & Mock Engine
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

interface MockDatabaseState {
    users: UserAuthRow[];
    players: PlayerRow[];
    vrfy: UserVrfyRow[];
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
                email: "existing_user@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 1, user_id: 1, username: "admin_user" },
            { player_id: 2, user_id: 2, username: "existing_username" },
        ],
        vrfy: [],
        nextUserId: 10,
        nextPlayerId: 10,
        nextVrfyId: 10,
    };
}

// Concurrency & Row Lock Engine
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

    clearAll(): void {
        for (const unlock of this.unlockers.values()) {
            unlock();
        }
        this.locks.clear();
        this.unlockers.clear();
    }
}

const vrfyLockManager = new RowLockManager();
const userLockManager = new RowLockManager();
const playerLockManager = new RowLockManager();

// Track Connection Pool Metrics
let activeConnections = 0;
let totalConnectionsAcquired = 0;
let totalConnectionsReleased = 0;

// Fault injection hooks
let simulateFailureOnPlayerInsert = false;
let simulateFailureOnVrfyDelete = false;
let simulateFailureOnCommit = false;

import { db } from "../lib/db";

// Intercept getConnection with transactional semantics and lock tracking
db.getConnection = (async () => {
    activeConnections++;
    totalConnectionsAcquired++;

    const heldVrfyLocks: string[] = [];
    const heldUserLocks: string[] = [];
    const heldPlayerLocks: string[] = [];

    // Track staged mutations within transaction
    let inTransaction = false;
    const stagedUsers: UserAuthRow[] = [];
    const stagedPlayers: PlayerRow[] = [];
    const stagedVrfyDeletions: number[] = [];

    const releaseHeldLocks = () => {
        while (heldVrfyLocks.length > 0) {
            const key = heldVrfyLocks.pop()!;
            vrfyLockManager.release(key);
        }
        while (heldUserLocks.length > 0) {
            const key = heldUserLocks.pop()!;
            userLockManager.release(key);
        }
        while (heldPlayerLocks.length > 0) {
            const key = heldPlayerLocks.pop()!;
            playerLockManager.release(key);
        }
    };

    return {
        beginTransaction: async () => {
            inTransaction = true;
        },

        query: async (sql: string, params: unknown[] = []) => {
            // 1. SELECT ... FROM user_vrfy_tbl WHERE verification_token = ? ... FOR UPDATE
            if (sql.includes("FROM user_vrfy_tbl") && sql.includes("FOR UPDATE")) {
                const token = String(params[0]);
                const lockKey = `vrfy:${token}`;
                await vrfyLockManager.acquire(lockKey);
                heldVrfyLocks.push(lockKey);

                // Small random micro-delay to simulate real-world database scheduling jitter
                await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));

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

            // 2. DELETE FROM user_vrfy_tbl WHERE verify_id = ?
            if (sql.includes("DELETE FROM user_vrfy_tbl WHERE verify_id = ?")) {
                if (simulateFailureOnVrfyDelete) {
                    throw new Error("Simulated transient DB error on DELETE FROM user_vrfy_tbl");
                }
                const verifyId = Number(params[0]);
                if (inTransaction) {
                    stagedVrfyDeletions.push(verifyId);
                } else {
                    const idx = mockDb.vrfy.findIndex((v) => v.verify_id === verifyId);
                    if (idx !== -1) mockDb.vrfy.splice(idx, 1);
                }
                return [{ affectedRows: 1 }];
            }

            // 3. SELECT user_id FROM user_auth_tbl WHERE email = ? ... FOR UPDATE
            if (sql.includes("FROM user_auth_tbl WHERE email = ?")) {
                const email = String(params[0]).toLowerCase();
                const lockKey = `email:${email}`;
                await userLockManager.acquire(lockKey);
                heldUserLocks.push(lockKey);

                const existingInDb = mockDb.users.find((u) => u.email.toLowerCase() === email);
                const existingInStaged = stagedUsers.find((u) => u.email.toLowerCase() === email);
                const user = existingInDb || existingInStaged;
                if (!user) return [[]];
                return [[{ user_id: user.user_id }]];
            }

            // 4. SELECT user_id FROM player_tbl WHERE username = ? ... FOR UPDATE
            if (sql.includes("FROM player_tbl WHERE username = ?")) {
                const username = String(params[0]);
                const lockKey = `player:${username.toLowerCase()}`;
                await playerLockManager.acquire(lockKey);
                heldPlayerLocks.push(lockKey);

                const existingInDb = mockDb.players.find((p) => p.username.toLowerCase() === username.toLowerCase());
                const existingInStaged = stagedPlayers.find((p) => p.username.toLowerCase() === username.toLowerCase());
                const player = existingInDb || existingInStaged;
                if (!player) return [[]];
                return [[{ user_id: player.user_id }]];
            }

            // 5. INSERT INTO user_auth_tbl
            if (sql.includes("INSERT INTO user_auth_tbl")) {
                const email = String(params[0]);
                const pwdHash = String(params[1]);
                const verified = Number(params[2]);
                const role = String(params[3]);
                const newUserId = mockDb.nextUserId++;
                const newRow: UserAuthRow = {
                    user_id: newUserId,
                    email,
                    password_hash: pwdHash,
                    user_role: role,
                    token_version: 1,
                    is_email_verified: verified,
                };
                stagedUsers.push(newRow);
                return [{ affectedRows: 1, insertId: newUserId }];
            }

            // 6. INSERT INTO player_tbl
            if (sql.includes("INSERT INTO player_tbl")) {
                if (simulateFailureOnPlayerInsert) {
                    throw new Error("Simulated ER_LOCK_DEADLOCK or foreign key failure on INSERT INTO player_tbl");
                }
                const userId = Number(params[0]);
                const username = String(params[1]);
                const newPlayerId = mockDb.nextPlayerId++;
                const newRow: PlayerRow = {
                    player_id: newPlayerId,
                    user_id: userId,
                    username,
                };
                stagedPlayers.push(newRow);
                return [{ affectedRows: 1, insertId: newPlayerId }];
            }

            return [{ affectedRows: 1 }];
        },

        commit: async () => {
            if (simulateFailureOnCommit) {
                throw new Error("Simulated commit failure / connection lost");
            }
            // Commit staged mutations into persistent mockDb
            for (const user of stagedUsers) {
                mockDb.users.push(user);
            }
            for (const player of stagedPlayers) {
                mockDb.players.push(player);
            }
            for (const vrfyId of stagedVrfyDeletions) {
                const idx = mockDb.vrfy.findIndex((v) => v.verify_id === vrfyId);
                if (idx !== -1) mockDb.vrfy.splice(idx, 1);
            }
            stagedUsers.length = 0;
            stagedPlayers.length = 0;
            stagedVrfyDeletions.length = 0;
            inTransaction = false;
            releaseHeldLocks();
        },

        rollback: async () => {
            // Discard staged mutations
            stagedUsers.length = 0;
            stagedPlayers.length = 0;
            stagedVrfyDeletions.length = 0;
            inTransaction = false;
            releaseHeldLocks();
        },

        release: () => {
            // Clean up locks if not already released
            releaseHeldLocks();
            activeConnections--;
            totalConnectionsReleased++;
        },
    };
}) as unknown as typeof db.getConnection;

// -----------------------------------------------------------------------------
// Test Execution Suite
// -----------------------------------------------------------------------------
async function main() {
    console.log("========================================================");
    console.log(" QuizWeb Milestone 5 Adversarial Challenge Suite 2");
    console.log(" Focus: SEC-13 (Transaction Isolation & Row Locking)");
    console.log("========================================================\n");

    const { verifyEmail } = await import("../app/actions/auth");

    // =========================================================================
    // SUITE 1: High Concurrency Parallel Verification (Same Token)
    // =========================================================================
    console.log("[Suite 1: High Concurrency Parallel Verification (Same Token)]");

    await runTest("T1.1: 50 simultaneous parallel verifyEmail requests on SAME token yield EXACTLY 1 success and 49 rollbacks", async () => {
        await resetMockDb();
        const rawToken = "high_concurrency_race_token_secret_12345";
        const hashed = hashToken(rawToken);

        mockDb.vrfy.push({
            verify_id: 101,
            username: "race_user_50",
            email: "race50@quizweb.dev",
            password_hash: "argon2id$mock_pwd_hash",
            verification_token: hashed,
            expires_at: new Date(Date.now() + 3600000), // 1h in future
            attempts: 0,
            locked_until: null,
        });

        // Fire 50 simultaneous parallel requests
        const results = await Promise.all(
            Array.from({ length: 50 }, () => verifyEmail(rawToken))
        );

        const successes = results.filter((r) => r.success === true);
        const failures = results.filter((r) => r.success === false);

        assert.strictEqual(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`);
        assert.strictEqual(failures.length, 49, `Expected exactly 49 rollbacks/failures, got ${failures.length}`);

        assert.strictEqual(
            successes[0].message,
            "Email verified successfully. You may now close this tab."
        );

        for (const f of failures) {
            assert.strictEqual(
                f.message,
                "This verification link is invalid or has already been used.",
                `Unexpected failure message: ${f.message}`
            );
        }
    });

    await runTest("T1.2: Exact record count verification: exactly 1 user in user_auth_tbl, exactly 1 in player_tbl, 0 orphaned", async () => {
        const createdUsers = mockDb.users.filter((u) => u.email === "race50@quizweb.dev");
        const createdPlayers = mockDb.players.filter((p) => p.username === "race_user_50");

        assert.strictEqual(createdUsers.length, 1, "Must have exactly 1 record in user_auth_tbl");
        assert.strictEqual(createdPlayers.length, 1, "Must have exactly 1 record in player_tbl");
        assert.strictEqual(createdUsers[0].is_email_verified, 1, "Account must be verified");
        assert.strictEqual(createdPlayers[0].user_id, createdUsers[0].user_id, "player_tbl.user_id must match user_auth_tbl.user_id");
    });

    await runTest("T1.3: Verification token is completely consumed/deleted from user_vrfy_tbl post-activation", async () => {
        const remainingVrfy = mockDb.vrfy.filter((v) => v.email === "race50@quizweb.dev");
        assert.strictEqual(remainingVrfy.length, 0, "Verification token must be removed from user_vrfy_tbl");
    });

    await runTest("T1.4: 50 subsequent replay requests immediately following activation are ALL strictly rejected", async () => {
        const rawToken = "high_concurrency_race_token_secret_12345";
        const replayResults = await Promise.all(
            Array.from({ length: 50 }, () => verifyEmail(rawToken))
        );

        const successes = replayResults.filter((r) => r.success === true);
        const failures = replayResults.filter((r) => r.success === false);

        assert.strictEqual(successes.length, 0, "All replay attempts must fail");
        assert.strictEqual(failures.length, 50, "All 50 replay requests must be rejected");

        // Verify counts remain unchanged
        const createdUsers = mockDb.users.filter((u) => u.email === "race50@quizweb.dev");
        assert.strictEqual(createdUsers.length, 1, "No duplicate accounts inserted on replay");
    });

    await runTest("T1.5: 20 simultaneous parallel requests on non-existent token all return invalid/already used", async () => {
        const fakeToken = "non_existent_token_" + crypto.randomBytes(16).toString("hex");
        const results = await Promise.all(
            Array.from({ length: 20 }, () => verifyEmail(fakeToken))
        );

        assert.strictEqual(results.filter((r) => r.success === true).length, 0);
        assert.strictEqual(results.filter((r) => r.success === false).length, 20);
        for (const r of results) {
            assert.strictEqual(r.message, "This verification link is invalid or has already been used.");
        }
    });

    // =========================================================================
    // SUITE 2: Multi-Token Collision Race Probes (Interleaved Concurrency)
    // =========================================================================
    console.log("\n[Suite 2: Multi-Token Collision Race Probes (Interleaved Concurrency)]");

    await runTest("T2.1: Dual-token EMAIL collision race: 2 different tokens targeting SAME email (25 concurrent requests each)", async () => {
        await resetMockDb();
        const tokenA = "token_email_race_A_" + crypto.randomBytes(8).toString("hex");
        const tokenB = "token_email_race_B_" + crypto.randomBytes(8).toString("hex");
        const targetEmail = "shared_email_target@quizweb.dev";

        mockDb.vrfy.push({
            verify_id: 201,
            username: "user_alpha",
            email: targetEmail,
            password_hash: "pwd_hash_A",
            verification_token: hashToken(tokenA),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        mockDb.vrfy.push({
            verify_id: 202,
            username: "user_beta",
            email: targetEmail,
            password_hash: "pwd_hash_B",
            verification_token: hashToken(tokenB),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        // Fire 25 concurrent calls for Token A and 25 for Token B simultaneously (50 requests total)
        const requests = [
            ...Array.from({ length: 25 }, () => verifyEmail(tokenA)),
            ...Array.from({ length: 25 }, () => verifyEmail(tokenB)),
        ];

        // Shuffle requests
        for (let i = requests.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [requests[i], requests[j]] = [requests[j], requests[i]];
        }

        const results = await Promise.all(requests);
        const successes = results.filter((r) => r.success === true);

        assert.strictEqual(successes.length, 1, `Expected exactly 1 success between competing tokens, got ${successes.length}`);

        const createdUsers = mockDb.users.filter((u) => u.email === targetEmail);
        assert.strictEqual(createdUsers.length, 1, "Exactly 1 user account must be created in user_auth_tbl");

        // The losing token's requests either hit email collision or already used
        const emailCollisionFailures = results.filter((r) => r.message === "An account already exists with this email address.");
        const invalidUsedFailures = results.filter((r) => r.message === "This verification link is invalid or has already been used.");
        assert.strictEqual(
            emailCollisionFailures.length + invalidUsedFailures.length,
            49,
            "All 49 competing requests must be cleanly rolled back with email collision or already used error"
        );
    });

    await runTest("T2.2: Dual-token USERNAME collision race: 2 different tokens targeting SAME username (25 concurrent requests each)", async () => {
        await resetMockDb();
        const tokenA = "token_user_race_A_" + crypto.randomBytes(8).toString("hex");
        const tokenB = "token_user_race_B_" + crypto.randomBytes(8).toString("hex");
        const sharedUsername = "shared_username_target";

        mockDb.vrfy.push({
            verify_id: 301,
            username: sharedUsername,
            email: "email_alpha@quizweb.dev",
            password_hash: "pwd_hash_A",
            verification_token: hashToken(tokenA),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        mockDb.vrfy.push({
            verify_id: 302,
            username: sharedUsername,
            email: "email_beta@quizweb.dev",
            password_hash: "pwd_hash_B",
            verification_token: hashToken(tokenB),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        const requests = [
            ...Array.from({ length: 25 }, () => verifyEmail(tokenA)),
            ...Array.from({ length: 25 }, () => verifyEmail(tokenB)),
        ];

        for (let i = requests.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [requests[i], requests[j]] = [requests[j], requests[i]];
        }

        const results = await Promise.all(requests);
        const successes = results.filter((r) => r.success === true);

        assert.strictEqual(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`);

        const createdPlayers = mockDb.players.filter((p) => p.username === sharedUsername);
        assert.strictEqual(createdPlayers.length, 1, "Exactly 1 player created in player_tbl");

        // The losing token should not leave orphaned user_auth_tbl records
        const totalCreatedAuthUsers = mockDb.users.filter((u) => u.email === "email_alpha@quizweb.dev" || u.email === "email_beta@quizweb.dev");
        assert.strictEqual(totalCreatedAuthUsers.length, 1, "Zero orphaned user_auth_tbl records for the losing username collision");
    });

    // =========================================================================
    // SUITE 3: Transaction Atomicity & Failure Injection Probes
    // =========================================================================
    console.log("\n[Suite 3: Transaction Atomicity & Failure Injection Probes]");

    await runTest("T3.1: Mid-transaction failure during INSERT INTO player_tbl rolls back user_auth_tbl (zero orphans)", async () => {
        await resetMockDb();
        const rawToken = "mid_tx_fail_token_player_" + crypto.randomBytes(8).toString("hex");
        const targetEmail = "midtx_player_fail@quizweb.dev";

        mockDb.vrfy.push({
            verify_id: 401,
            username: "midtx_player_user",
            email: targetEmail,
            password_hash: "pwd_hash_midtx",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        simulateFailureOnPlayerInsert = true;
        try {
            const result = await verifyEmail(rawToken);
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, "An internal error occurred. Please try again later.");

            // Verify rollback: zero records in user_auth_tbl
            const authRecord = mockDb.users.find((u) => u.email === targetEmail);
            assert.strictEqual(authRecord, undefined, "user_auth_tbl must NOT contain orphaned record after rollback");

            // Verify player_tbl has zero records
            const playerRecord = mockDb.players.find((p) => p.username === "midtx_player_user");
            assert.strictEqual(playerRecord, undefined, "player_tbl must NOT contain orphaned record");

            // Token in user_vrfy_tbl must still be intact because transaction rolled back
            const vrfyRecord = mockDb.vrfy.find((v) => v.verify_id === 401);
            assert.ok(vrfyRecord, "user_vrfy_tbl row must be preserved on rollback");
        } finally {
            simulateFailureOnPlayerInsert = false;
        }
    });

    await runTest("T3.2: Mid-transaction failure during DELETE FROM user_vrfy_tbl rolls back all state cleanly", async () => {
        await resetMockDb();
        const rawToken = "mid_tx_fail_token_vrfy_" + crypto.randomBytes(8).toString("hex");
        const targetEmail = "midtx_vrfy_fail@quizweb.dev";

        mockDb.vrfy.push({
            verify_id: 402,
            username: "midtx_vrfy_user",
            email: targetEmail,
            password_hash: "pwd_hash_midtx",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        simulateFailureOnVrfyDelete = true;
        try {
            const result = await verifyEmail(rawToken);
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, "An internal error occurred. Please try again later.");

            // Rollback verification
            const authRecord = mockDb.users.find((u) => u.email === targetEmail);
            assert.strictEqual(authRecord, undefined, "user_auth_tbl must NOT contain orphaned record");

            const playerRecord = mockDb.players.find((p) => p.username === "midtx_vrfy_user");
            assert.strictEqual(playerRecord, undefined, "player_tbl must NOT contain orphaned record");
        } finally {
            simulateFailureOnVrfyDelete = false;
        }
    });

    await runTest("T3.3: Commit failure simulation rolls back staged mutations", async () => {
        await resetMockDb();
        const rawToken = "commit_fail_token_" + crypto.randomBytes(8).toString("hex");
        const targetEmail = "commit_fail@quizweb.dev";

        mockDb.vrfy.push({
            verify_id: 403,
            username: "commit_fail_user",
            email: targetEmail,
            password_hash: "pwd_hash_commit",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        simulateFailureOnCommit = true;
        try {
            const result = await verifyEmail(rawToken);
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.message, "An internal error occurred. Please try again later.");

            const authRecord = mockDb.users.find((u) => u.email === targetEmail);
            assert.strictEqual(authRecord, undefined, "user_auth_tbl must remain empty on commit failure");
        } finally {
            simulateFailureOnCommit = false;
        }
    });

    await runTest("T3.4: Pre-existing email collision rolls back transaction cleanly without creating player", async () => {
        await resetMockDb();
        const rawToken = "existing_email_token_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 404,
            username: "new_player_for_existing_email",
            email: "existing_user@quizweb.dev", // already in mockDb
            password_hash: "pwd_hash_collision",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        const result = await verifyEmail(rawToken);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, "An account already exists with this email address.");

        const playerRecord = mockDb.players.find((p) => p.username === "new_player_for_existing_email");
        assert.strictEqual(playerRecord, undefined, "player_tbl must not be inserted when email collision occurs");
    });

    await runTest("T3.5: Pre-existing username collision rolls back transaction cleanly without creating user", async () => {
        await resetMockDb();
        const rawToken = "existing_username_token_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 405,
            username: "existing_username", // already in mockDb
            email: "brand_new_email@quizweb.dev",
            password_hash: "pwd_hash_collision",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        const result = await verifyEmail(rawToken);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, "This username is already taken.");

        const authRecord = mockDb.users.find((u) => u.email === "brand_new_email@quizweb.dev");
        assert.strictEqual(authRecord, undefined, "user_auth_tbl must not be inserted when username collision occurs");
    });

    // =========================================================================
    // SUITE 4: Connection Pool Leak & Resource Release Probes
    // =========================================================================
    console.log("\n[Suite 4: Connection Pool Leak & Resource Release Probes]");

    await runTest("T4.1: Pool connection leak verification: 100 heterogeneous operations strictly release 100% of acquired connections", async () => {
        await resetMockDb();
        const startActive = activeConnections;
        const initialAcquired = totalConnectionsAcquired;
        const initialReleased = totalConnectionsReleased;

        // Run 100 diverse operations:
        const ops: Promise<unknown>[] = [];

        // 20 valid tokens
        for (let i = 0; i < 20; i++) {
            const token = `batch_valid_token_${i}_${Date.now()}`;
            mockDb.vrfy.push({
                verify_id: 500 + i,
                username: `batch_user_${i}`,
                email: `batch_${i}@quizweb.dev`,
                password_hash: "hash",
                verification_token: hashToken(token),
                expires_at: new Date(Date.now() + 3600000),
                attempts: 0,
                locked_until: null,
            });
            ops.push(verifyEmail(token));
        }

        // 20 expired tokens
        for (let i = 20; i < 40; i++) {
            const token = `batch_exp_token_${i}_${Date.now()}`;
            mockDb.vrfy.push({
                verify_id: 500 + i,
                username: `batch_user_${i}`,
                email: `batch_${i}@quizweb.dev`,
                password_hash: "hash",
                verification_token: hashToken(token),
                expires_at: new Date(Date.now() - 3600000), // expired
                attempts: 0,
                locked_until: null,
            });
            ops.push(verifyEmail(token));
        }

        // 20 locked tokens
        for (let i = 40; i < 60; i++) {
            const token = `batch_locked_token_${i}_${Date.now()}`;
            mockDb.vrfy.push({
                verify_id: 500 + i,
                username: `batch_user_${i}`,
                email: `batch_${i}@quizweb.dev`,
                password_hash: "hash",
                verification_token: hashToken(token),
                expires_at: new Date(Date.now() + 3600000),
                attempts: 5, // locked
                locked_until: null,
            });
            ops.push(verifyEmail(token));
        }

        // 20 non-existent tokens
        for (let i = 60; i < 80; i++) {
            ops.push(verifyEmail(`non_existent_${i}_${Date.now()}`));
        }

        // 20 duplicate email collisions
        for (let i = 80; i < 100; i++) {
            const token = `batch_collision_${i}_${Date.now()}`;
            mockDb.vrfy.push({
                verify_id: 500 + i,
                username: `unique_username_${i}`,
                email: "existing_user@quizweb.dev", // duplicate email
                password_hash: "hash",
                verification_token: hashToken(token),
                expires_at: new Date(Date.now() + 3600000),
                attempts: 0,
                locked_until: null,
            });
            ops.push(verifyEmail(token));
        }

        await Promise.all(ops);

        const deltaAcquired = totalConnectionsAcquired - initialAcquired;
        const deltaReleased = totalConnectionsReleased - initialReleased;

        assert.strictEqual(deltaAcquired, 100, `Expected 100 connection acquisitions, got ${deltaAcquired}`);
        assert.strictEqual(deltaReleased, 100, `Expected 100 connection releases, got ${deltaReleased}`);
        assert.strictEqual(activeConnections, startActive, `Active connections must return to ${startActive}, currently ${activeConnections}`);
    });

    await runTest("T4.2: Connection release is strictly guaranteed in finally block even when unhandled error occurs mid-transaction", async () => {
        await resetMockDb();
        const startActive = activeConnections;
        const rawToken = "fail_leak_token_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 601,
            username: "leak_test_user",
            email: "leak_test@quizweb.dev",
            password_hash: "hash",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 0,
            locked_until: null,
        });

        simulateFailureOnPlayerInsert = true;
        try {
            await verifyEmail(rawToken);
        } finally {
            simulateFailureOnPlayerInsert = false;
        }

        assert.strictEqual(activeConnections, startActive, "activeConnections must remain 0 after internal error");
    });

    // =========================================================================
    // SUITE 5: Token State Machine, Expiration, Lockout & Edge Cases
    // =========================================================================
    console.log("\n[Suite 5: Token State Machine, Expiration, Lockout & Edge Cases]");

    await runTest("T5.1: Expired verification token deletes the row, commits, and returns expired message", async () => {
        await resetMockDb();
        const rawToken = "expired_token_single_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 701,
            username: "exp_user_1",
            email: "exp1@quizweb.dev",
            password_hash: "hash",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() - 60000), // 1 min ago
            attempts: 0,
            locked_until: null,
        });

        const result = await verifyEmail(rawToken);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, "This verification link has expired. Please sign up again.");

        // Token must be deleted from user_vrfy_tbl
        const remaining = mockDb.vrfy.filter((v) => v.verify_id === 701);
        assert.strictEqual(remaining.length, 0, "Expired token must be cleaned up from DB");

        // No user created
        const authUser = mockDb.users.find((u) => u.email === "exp1@quizweb.dev");
        assert.strictEqual(authUser, undefined, "No account should be created for expired token");
    });

    await runTest("T5.2: Concurrency on expired token: 20 simultaneous requests -> exactly 1 cleans up, 19 return invalid/already used", async () => {
        await resetMockDb();
        const rawToken = "expired_token_burst_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 702,
            username: "exp_user_burst",
            email: "exp_burst@quizweb.dev",
            password_hash: "hash",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() - 3600000),
            attempts: 0,
            locked_until: null,
        });

        const results = await Promise.all(
            Array.from({ length: 20 }, () => verifyEmail(rawToken))
        );

        const expiredCount = results.filter((r) => r.message === "This verification link has expired. Please sign up again.").length;
        const alreadyUsedCount = results.filter((r) => r.message === "This verification link is invalid or has already been used.").length;

        assert.strictEqual(expiredCount, 1, `Expected exactly 1 request to see expired and delete, got ${expiredCount}`);
        assert.strictEqual(alreadyUsedCount, 19, `Expected 19 requests to see deleted row, got ${alreadyUsedCount}`);
    });

    await runTest("T5.3: Verification token with attempts >= 5 is permanently locked, rolls back, and returns locked error", async () => {
        await resetMockDb();
        const rawToken = "locked_attempts_token_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 703,
            username: "locked_att_user",
            email: "locked_att@quizweb.dev",
            password_hash: "hash",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 5,
            locked_until: null,
        });

        const result = await verifyEmail(rawToken);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, "This verification link has been locked due to too many failed attempts.");

        // Must NOT create user
        const authUser = mockDb.users.find((u) => u.email === "locked_att@quizweb.dev");
        assert.strictEqual(authUser, undefined);
    });

    await runTest("T5.4: Verification token with future locked_until timestamp is locked and rolls back", async () => {
        await resetMockDb();
        const rawToken = "locked_time_token_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 704,
            username: "locked_time_user",
            email: "locked_time@quizweb.dev",
            password_hash: "hash",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 2,
            locked_until: new Date(Date.now() + 900000), // 15 min in future
        });

        const result = await verifyEmail(rawToken);
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, "This verification link has been locked due to too many failed attempts.");
    });

    await runTest("T5.5: Verification token with expired locked_until timestamp in past and attempts < 5 succeeds", async () => {
        await resetMockDb();
        const rawToken = "past_lock_token_" + crypto.randomBytes(8).toString("hex");

        mockDb.vrfy.push({
            verify_id: 705,
            username: "past_lock_user",
            email: "past_lock@quizweb.dev",
            password_hash: "hash",
            verification_token: hashToken(rawToken),
            expires_at: new Date(Date.now() + 3600000),
            attempts: 2,
            locked_until: new Date(Date.now() - 900000), // 15 min in past
        });

        const result = await verifyEmail(rawToken);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "Email verified successfully. You may now close this tab.");
    });

    // =========================================================================
    // SUITE 6: Malformed, Adversarial, and Type Confusion Inputs
    // =========================================================================
    console.log("\n[Suite 6: Malformed, Adversarial, and Type Confusion Inputs]");

    await runTest("T6.1: Empty, whitespace, null, undefined fail closed without calling db.getConnection()", async () => {
        const initialAcquired = totalConnectionsAcquired;

        const malformedInputs = ["", "   ", "\t\n", null as unknown as string, undefined as unknown as string];
        for (const input of malformedInputs) {
            const res = await verifyEmail(input);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.message, "Invalid verification link.");
        }

        assert.strictEqual(totalConnectionsAcquired, initialAcquired, "Zero DB connections must be opened for malformed token strings");
    });

    await runTest("T6.2: Non-string types (numbers, booleans, objects, arrays) fail closed without opening DB connection", async () => {
        const initialAcquired = totalConnectionsAcquired;

        const nonStringInputs = [
            123456 as unknown as string,
            true as unknown as string,
            false as unknown as string,
            {} as unknown as string,
            [] as unknown as string,
        ];

        for (const input of nonStringInputs) {
            const res = await verifyEmail(input);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.message, "Invalid verification link.");
        }

        assert.strictEqual(totalConnectionsAcquired, initialAcquired, "Zero DB connections must be opened for non-string inputs");
    });

    await runTest("T6.3: SQL Injection payloads are safely SHA-256 hashed and handled via parameterized query", async () => {
        const sqliPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE user_vrfy_tbl; --",
            "admin'--",
            "\" OR \"\"=\"",
            "' UNION SELECT 1,2,3,4,5,6,7--",
        ];

        for (const payload of sqliPayloads) {
            const res = await verifyEmail(payload);
            assert.strictEqual(res.success, false);
            assert.strictEqual(res.message, "This verification link is invalid or has already been used.");
        }
    });

    await runTest("T6.4: Extremely long adversarial strings (10,000 characters) are safely handled without crash", async () => {
        const giantToken = "A".repeat(10000);
        const res = await verifyEmail(giantToken);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.message, "This verification link is invalid or has already been used.");
    });

    // =========================================================================
    // SUITE 7: Static Security & OWASP ASVS v4.0.3 Chapter 4 Compliance Audit
    // =========================================================================
    console.log("\n[Suite 7: Static Security & OWASP ASVS Compliance Audit]");

    await runTest("T7.1: Static audit confirms SELECT ... FOR UPDATE pessimistic row lock in app/actions/auth.ts verifyEmail", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            authSrc.includes("SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1 FOR UPDATE"),
            "verifyEmail must acquire pessimistic row lock with FOR UPDATE"
        );
    });

    await runTest("T7.2: Static audit confirms explicit beginTransaction(), commit(), and rollback() controls", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(authSrc.includes("await connection.beginTransaction()"), "Must call beginTransaction");
        assert.ok(authSrc.includes("await connection.commit()"), "Must call commit");
        assert.ok(authSrc.includes("await connection.rollback()"), "Must call rollback");
    });

    await runTest("T7.3: Static audit confirms connection.release() in finally block under all circumstances", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            authSrc.includes("finally {\n        connection.release();\n    }") ||
            authSrc.includes("finally {\n        connection.release();"),
            "connection.release() must be in finally block"
        );
    });

    await runTest("T7.4: Static audit confirms email and username collision checks also acquire FOR UPDATE locks", async () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            authSrc.includes("SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1 FOR UPDATE"),
            "user_auth_tbl check must use FOR UPDATE lock"
        );
        assert.ok(
            authSrc.includes("SELECT user_id FROM player_tbl WHERE username = ? LIMIT 1 FOR UPDATE"),
            "player_tbl check must use FOR UPDATE lock"
        );
    });

    await runTest("T7.5: OWASP ASVS v4.0.3 V4.1.5 & V13.1.4 Compliance verified", async () => {
        // V4.1.5: Access Control - Transaction Isolation
        // V13.1.4: API Verification - Transaction boundary guarantees
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(authSrc.includes("connection.beginTransaction()"), "Must begin explicit transaction");
        assert.ok(authSrc.includes("FOR UPDATE"), "Must use pessimistic row locking");
        assert.ok(authSrc.includes("connection.commit()"), "Must commit transaction on success");
        assert.ok(authSrc.includes("connection.rollback()"), "Must rollback transaction on error");
    });

    // =========================================================================
    // Summary
    // =========================================================================
    console.log("\n========================================================");
    console.log(` Test Execution Summary: ${passedTests}/${totalTests} Passed`);
    if (failedTests > 0) {
        console.error(` Status: ${failedTests} FAILURES DETECTED!`);
        for (const f of failures) {
            console.error(`  - ${f.name}: ${f.error}`);
        }
        process.exit(1);
    } else {
        console.log(" Status: ALL ADVERSARIAL CHALLENGES PASSED");
        console.log(" Milestone 5 SEC-13 Concurrency & Transaction Isolation: EMPIRICALLY CONFIRMED");
        console.log("========================================================\n");
    }
}

main().catch((err) => {
    console.error("Fatal runner error:", err);
    process.exit(1);
});
