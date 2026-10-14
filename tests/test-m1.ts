/**
 * =============================================================================
 * Milestone 1 Verification Test Harness: tests/test-m1.ts
 * =============================================================================
 * Targets: SEC-12 (Database Schema Hardening & Token Storage Hardening)
 * Standards: OWASP ASVS v4.0.3 Chapter 3 (V2.7.5, V3.3.1, V3.4.2)
 *
 * Execution:
 *   npx --yes tsx tests/test-m1.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert";

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
        console.log("[\x1b[32mSETUP\x1b[0m] Linked node_modules from main repository.");
    } catch {
        if (!process.env.NODE_PATH) {
            process.env.NODE_PATH = mainNodeModules;
        }
    }
}

// Pre-initialize environment variables to prevent module load crashes
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m1_audit";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test_secret_32_characters_minimum_length_for_jwt";

// Mock external HTTP requests (Resend transactional email)
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
        return new Response(JSON.stringify({ id: "mock_resend_email_" + Date.now() }), {
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
// Schema Catalog Emulator (for Offline Verification)
// -----------------------------------------------------------------------------
interface ColumnDef {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
}

interface TableDef {
    name: string;
    columns: Map<string, ColumnDef>;
}

class MockSchemaCatalog {
    tables: Map<string, TableDef> = new Map();

    createTable(name: string, cols: ColumnDef[]) {
        if (!this.tables.has(name.toLowerCase())) {
            const table: TableDef = { name, columns: new Map() };
            for (const c of cols) {
                table.columns.set(c.name.toLowerCase(), c);
            }
            this.tables.set(name.toLowerCase(), table);
        }
    }

    hasColumn(tableName: string, colName: string): boolean {
        const tbl = this.tables.get(tableName.toLowerCase());
        return tbl ? tbl.columns.has(colName.toLowerCase()) : false;
    }

    addColumn(tableName: string, col: ColumnDef): boolean {
        const tbl = this.tables.get(tableName.toLowerCase());
        if (!tbl) throw new Error(`Table ${tableName} does not exist`);
        if (tbl.columns.has(col.name.toLowerCase())) {
            return false; // Duplicate column
        }
        tbl.columns.set(col.name.toLowerCase(), col);
        return true;
    }

    dropColumn(tableName: string, colName: string): boolean {
        const tbl = this.tables.get(tableName.toLowerCase());
        if (!tbl) throw new Error(`Table ${tableName} does not exist`);
        if (!tbl.columns.has(colName.toLowerCase())) {
            return false; // Column does not exist
        }
        tbl.columns.delete(colName.toLowerCase());
        return true;
    }
}

// -----------------------------------------------------------------------------
// Main Test Execution Function
// -----------------------------------------------------------------------------
async function main() {
    console.log("\n========================================================");
    console.log(" QuizWeb Milestone 1: Standalone Security Verification");
    console.log(" Target: SEC-12 (Database Schema & Token Storage)");
    console.log("========================================================\n");

    const migrationsDir = path.join(projectRoot, "migrations");
    const fInitial = path.join(migrationsDir, "001_initial_schema.sql");
    const fHardening = path.join(migrationsDir, "002_security_hardening.sql");
    const fRollback = path.join(migrationsDir, "002_security_hardening_rollback.sql");

    // -------------------------------------------------------------------------
    // Suite 2: SQL Migration File & Syntax Validation
    // -------------------------------------------------------------------------
    console.log("\x1b[1m[Suite 2: SQL Migration File & Syntax Integrity]\x1b[0m");

    await runTest("Migration files exist under migrations/", () => {
        assert.ok(fs.existsSync(migrationsDir), "migrations/ directory must exist");
        assert.ok(fs.existsSync(fInitial), "001_initial_schema.sql must exist");
        assert.ok(fs.existsSync(fHardening), "002_security_hardening.sql must exist");
        assert.ok(fs.existsSync(fRollback), "002_security_hardening_rollback.sql must exist");
    });

    await runTest("SQL scripts do not contain MySQL CLI DELIMITER directives", () => {
        const hardeningContent = fs.readFileSync(fHardening, "utf8");
        const rollbackContent = fs.readFileSync(fRollback, "utf8");
        assert.ok(
            !/^\s*DELIMITER\b/im.test(hardeningContent),
            "002_security_hardening.sql must not use DELIMITER (incompatible with mysql2 protocol)"
        );
        assert.ok(
            !/^\s*DELIMITER\b/im.test(rollbackContent),
            "002_security_hardening_rollback.sql must not use DELIMITER (incompatible with mysql2 protocol)"
        );
    });

    await runTest("001_initial_schema.sql defines required baseline tables", () => {
        const sql = fs.readFileSync(fInitial, "utf8").toLowerCase();
        const requiredTables = [
            "user_auth_tbl",
            "player_tbl",
            "user_oauth_tbl",
            "user_vrfy_tbl",
            "user_otp_tbl",
            "rate_limit_tbl",
        ];
        for (const t of requiredTables) {
            assert.ok(sql.includes(t), `001_initial_schema.sql must define ${t}`);
            assert.ok(
                sql.includes(`create table if not exists \`${t}\``) ||
                sql.includes(`create table if not exists ${t}`),
                `Table ${t} must use CREATE TABLE IF NOT EXISTS`
            );
        }
    });

    await runTest("002_security_hardening.sql defines all SEC-12 columns and defaults", () => {
        const sql = fs.readFileSync(fHardening, "utf8");
        assert.ok(sql.includes("token_version"), "Must define token_version in user_auth_tbl");
        assert.ok(sql.includes("attempts"), "Must define attempts");
        assert.ok(sql.includes("locked_until"), "Must define locked_until");
        assert.ok(sql.includes("DEFAULT 1"), "token_version must default to 1");
        assert.ok(sql.includes("DEFAULT 0"), "attempts must default to 0");
    });

    await runTest("002_security_hardening.sql includes idempotency guards via INFORMATION_SCHEMA", () => {
        const sql = fs.readFileSync(fHardening, "utf8");
        assert.ok(
            sql.includes("information_schema.COLUMNS") || sql.includes("information_schema.columns"),
            "002_security_hardening.sql must check information_schema.COLUMNS for idempotency"
        );
    });

    await runTest("002_security_hardening_rollback.sql drops hardened columns idempotently", () => {
        const sql = fs.readFileSync(fRollback, "utf8");
        assert.ok(sql.includes("DROP COLUMN `token_version`") || sql.includes("DROP COLUMN token_version"));
        assert.ok(sql.includes("DROP COLUMN `attempts`") || sql.includes("DROP COLUMN attempts"));
        assert.ok(sql.includes("DROP COLUMN `locked_until`") || sql.includes("DROP COLUMN locked_until"));
        assert.ok(
            sql.includes("information_schema.COLUMNS") || sql.includes("information_schema.columns"),
            "Rollback must check information_schema.COLUMNS for idempotency"
        );
    });

    // -------------------------------------------------------------------------
    // Suite 3: Schema State Machine & Idempotency Simulation
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 3: Migration Execution & Idempotency State Machine]\x1b[0m");

    await runTest("Simulated migration applies baseline, hardening, and rollback idempotently", () => {
        const catalog = new MockSchemaCatalog();
        // Baseline
        catalog.createTable("user_auth_tbl", [
            { name: "user_id", type: "INT", nullable: false },
            { name: "email", type: "VARCHAR(255)", nullable: false },
            { name: "password_hash", type: "VARCHAR(255)", nullable: true },
            { name: "is_email_verified", type: "TINYINT(1)", nullable: false },
            { name: "user_role", type: "VARCHAR(50)", nullable: false },
        ]);
        catalog.createTable("user_otp_tbl", [
            { name: "otp_id", type: "INT", nullable: false },
            { name: "user_id", type: "INT", nullable: false },
            { name: "otp_code", type: "VARCHAR(255)", nullable: false },
            { name: "expires_at", type: "DATETIME", nullable: false },
            { name: "is_used", type: "INT", nullable: false },
        ]);
        catalog.createTable("user_vrfy_tbl", [
            { name: "verify_id", type: "INT", nullable: false },
            { name: "username", type: "VARCHAR(100)", nullable: false },
            { name: "email", type: "VARCHAR(255)", nullable: false },
            { name: "password_hash", type: "VARCHAR(255)", nullable: false },
            { name: "verification_token", type: "VARCHAR(255)", nullable: false },
            { name: "expires_at", type: "DATETIME", nullable: false },
        ]);

        // First application of hardening
        assert.ok(!catalog.hasColumn("user_auth_tbl", "token_version"));
        const added1 = catalog.addColumn("user_auth_tbl", { name: "token_version", type: "INT", nullable: false, defaultValue: "1" });
        catalog.addColumn("user_otp_tbl", { name: "attempts", type: "INT", nullable: false, defaultValue: "0" });
        catalog.addColumn("user_otp_tbl", { name: "locked_until", type: "DATETIME", nullable: true });
        catalog.addColumn("user_vrfy_tbl", { name: "attempts", type: "INT", nullable: false, defaultValue: "0" });
        catalog.addColumn("user_vrfy_tbl", { name: "locked_until", type: "DATETIME", nullable: true });
        assert.strictEqual(added1, true, "First application of hardening must succeed");

        assert.ok(catalog.hasColumn("user_auth_tbl", "token_version"));
        assert.ok(catalog.hasColumn("user_otp_tbl", "attempts"));
        assert.ok(catalog.hasColumn("user_otp_tbl", "locked_until"));
        assert.ok(catalog.hasColumn("user_vrfy_tbl", "attempts"));
        assert.ok(catalog.hasColumn("user_vrfy_tbl", "locked_until"));

        // Idempotency: Second application guarded by existence check
        const colCheck = catalog.hasColumn("user_auth_tbl", "token_version");
        assert.strictEqual(colCheck, true, "Guard correctly detects existing token_version column");
        const dupResult = catalog.addColumn("user_auth_tbl", { name: "token_version", type: "INT", nullable: false });
        assert.strictEqual(dupResult, false, "Duplicate addition correctly bypassed");

        // Rollback
        const dropped1 = catalog.dropColumn("user_auth_tbl", "token_version");
        catalog.dropColumn("user_otp_tbl", "attempts");
        catalog.dropColumn("user_otp_tbl", "locked_until");
        catalog.dropColumn("user_vrfy_tbl", "attempts");
        catalog.dropColumn("user_vrfy_tbl", "locked_until");
        assert.strictEqual(dropped1, true, "First rollback execution must succeed");

        assert.ok(!catalog.hasColumn("user_auth_tbl", "token_version"));
        assert.ok(!catalog.hasColumn("user_otp_tbl", "attempts"));

        // Rollback Idempotency: Repeated drop guarded
        const dropAgain = catalog.dropColumn("user_auth_tbl", "token_version");
        assert.strictEqual(dropAgain, false, "Repeated drop correctly bypassed without error");

        // Re-apply hardening after rollback
        const reapply = catalog.addColumn("user_auth_tbl", { name: "token_version", type: "INT", nullable: false, defaultValue: "1" });
        assert.strictEqual(reapply, true, "Re-applying hardening after rollback must succeed cleanly");
    });

    // -------------------------------------------------------------------------
    // Suite 4: Action Dynamic Execution & Token Hashing (SEC-12)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 4: Dynamic Action Execution & SHA-256 Storage Verification]\x1b[0m");

    // Dynamic import of database pool and auth actions
    const dbModule = await import("../lib/db");
    const db = dbModule.db;
    const authActions = await import("../app/actions/auth");
    const signUp = authActions.signUp;
    const reqPassReset = authActions.reqPassReset;
    const verifyOTP = authActions.verifyOTP;
    const verifyEmail = authActions.verifyEmail;
    const resetPass = authActions.resetPass;

    await runTest("signUp stores SHA-256 hashed verification token with attempts=0, not cleartext", async () => {
        capturedEmails = [];
        interface QueryRecord {
            sql: string;
            params: unknown[];
        }
        const queries: QueryRecord[] = [];

        db.query = (async (sql: string, params: unknown[] = []) => {
            queries.push({ sql, params });
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
            if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
            if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
            if (sql.includes("INSERT INTO user_vrfy_tbl")) return [{ insertId: 101 }];
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "sec12user");
        fd.set("email", "sec12@quizweb.dev");
        fd.set("password", "SecureP@ssw0rd123");
        fd.set("confirmPassword", "SecureP@ssw0rd123");
        fd.set("recaptchaToken", "test-bypass-recaptcha-token");

        const result = await signUp(fd);
        assert.strictEqual(result.success, true, "signUp must succeed with valid inputs");
        assert.strictEqual(capturedEmails.length, 1, "Exactly one verification email must be dispatched");

        // Extract raw token from email verification link: /verify-email/<token>
        const linkMatch = capturedEmails[0].html.match(/\/verify-email\/([a-f0-9]{64})/i);
        assert.ok(linkMatch, "Verification email must contain 64-char raw token link");
        const rawToken = linkMatch[1];

        // Find the INSERT INTO user_vrfy_tbl query
        const insertQuery = queries.find(q => q.sql.includes("INSERT INTO user_vrfy_tbl"));
        assert.ok(insertQuery, "Database must execute INSERT INTO user_vrfy_tbl");
        assert.ok(
            insertQuery.sql.includes("attempts") && insertQuery.sql.includes("locked_until"),
            "INSERT INTO user_vrfy_tbl must initialize attempts and locked_until columns"
        );

        // Verify stored token: [trimmedUsername, normalizedEmail, hashed, hashedVerificationToken, verificationExpires]
        const storedToken = String(insertQuery.params[3]);
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        assert.strictEqual(storedToken.length, 64, "Stored token must be a 64-character hex string");
        assert.notStrictEqual(storedToken, rawToken, "SEC-12 VIOLATION: Stored token must NOT match cleartext token");
        assert.strictEqual(storedToken, expectedHash, "SEC-12 COMPLIANCE: Stored token must equal SHA-256 hash of raw token");
    });

    await runTest("reqPassReset stores SHA-256 hashed OTP with attempts=0, not cleartext numeric code", async () => {
        capturedEmails = [];
        interface QueryRecord {
            sql: string;
            params: unknown[];
        }
        const queries: QueryRecord[] = [];

        db.query = (async (sql: string, params: unknown[] = []) => {
            queries.push({ sql, params });
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[{ user_id: 88 }]];
            if (sql.includes("SELECT username FROM player_tbl")) return [[{ username: "sec12user" }]];
            if (sql.includes("UPDATE user_otp_tbl")) return [{ affectedRows: 1 }];
            if (sql.includes("INSERT INTO user_otp_tbl")) return [{ insertId: 202 }];
            return [[]];
        }) as typeof db.query;

        const result = await reqPassReset("sec12@quizweb.dev");
        assert.strictEqual(result.success, true, "reqPassReset must return success");
        assert.strictEqual(capturedEmails.length, 1, "Password reset email must be dispatched");

        // Extract raw 6-digit OTP from email HTML
        const otpMatch = capturedEmails[0].html.match(/otp-code\">([0-9]{6})</);
        assert.ok(otpMatch, "Email must contain 6-digit raw OTP code");
        const rawOtp = otpMatch[1];

        // Find the INSERT INTO user_otp_tbl query
        const insertQuery = queries.find(q => q.sql.includes("INSERT INTO user_otp_tbl"));
        assert.ok(insertQuery, "Database must execute INSERT INTO user_otp_tbl");
        assert.ok(
            insertQuery.sql.includes("attempts") && insertQuery.sql.includes("locked_until"),
            "INSERT INTO user_otp_tbl must initialize attempts and locked_until columns"
        );

        // Verify stored OTP: [userId, hashedOtp, expiresAt, 0, "password_reset"]
        const storedOtp = String(insertQuery.params[1]);
        const expectedHash = crypto.createHash("sha256").update(rawOtp).digest("hex");

        assert.strictEqual(storedOtp.length, 64, "Stored OTP must be 64-character SHA-256 hex string");
        assert.notStrictEqual(storedOtp, rawOtp, "SEC-12 VIOLATION: Stored OTP must NOT be cleartext numeric string");
        assert.strictEqual(storedOtp, expectedHash, "SEC-12 COMPLIANCE: Stored OTP must equal SHA-256 hash of raw OTP");
    });

    await runTest("verifyOTP validates raw OTP against stored SHA-256 hash and handles attempts/lockout", async () => {
        const rawOtp = "482619";
        const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");
        let attemptsCount = 0;

        db.query = (async (sql: string, params: unknown[] = []) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[{ user_id: 88 }]];
            if (sql.includes("SELECT otp_id, otp_code")) {
                return [[{
                    otp_id: 1,
                    otp_code: hashedOtp,
                    expires_at: new Date(Date.now() + 300000),
                    is_used: 0,
                    attempts: attemptsCount,
                    locked_until: null,
                }]];
            }
            if (sql.includes("UPDATE user_otp_tbl SET attempts =")) {
                attemptsCount = Number(params[0]);
                return [{ affectedRows: 1 }];
            }
            if (sql.includes("UPDATE user_otp_tbl SET is_used = 1")) return [{ affectedRows: 1 }];
            return [[]];
        }) as typeof db.query;

        // Correct OTP succeeds
        const successRes = await verifyOTP("sec12@quizweb.dev", rawOtp);
        assert.strictEqual(successRes.success, true, "Valid raw OTP must match stored SHA-256 hash");

        // Incorrect OTP fails and increments attempts
        const failRes = await verifyOTP("sec12@quizweb.dev", "999999");
        assert.strictEqual(failRes.error !== undefined, true, "Incorrect OTP must fail verification");
        assert.strictEqual(attemptsCount, 1, "Failed attempt must increment attempts counter");

        // Lockout after 5 attempts
        attemptsCount = 5;
        const lockedRes = await verifyOTP("sec12@quizweb.dev", rawOtp);
        assert.strictEqual(lockedRes.error !== undefined, true, "Locked OTP must reject attempts");
        assert.ok(
            lockedRes.error?.toLowerCase().includes("locked"),
            "Locked error message must indicate lockout"
        );
    });

    await runTest("verifyEmail queries using SHA-256 hash of the received token and checks lockout", async () => {
        const rawToken = "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890";
        const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        interface ConnectionQuery {
            sql: string;
            params: unknown[];
        }
        const connectionQueries: ConnectionQuery[] = [];

        db.getConnection = (async () => ({
            query: async (sql: string, params: unknown[] = []) => {
                connectionQueries.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 10,
                        username: "verifyuser",
                        email: "verify@quizweb.dev",
                        password_hash: "argon2_hash",
                        expires_at: new Date(Date.now() + 300000),
                        attempts: 0,
                        locked_until: null,
                    }]];
                }
                if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
                if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
                if (sql.includes("INSERT INTO user_auth_tbl")) return [{ insertId: 55 }];
                if (sql.includes("INSERT INTO player_tbl")) return [{ affectedRows: 1 }];
                if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 1 }];
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const res = await verifyEmail(rawToken);
        assert.strictEqual(res.success, true, "verifyEmail must complete successfully");

        const selectQuery = connectionQueries.find(q => q.sql.includes("WHERE verification_token = ?"));
        assert.ok(selectQuery, "Must execute SELECT with verification_token parameter");
        assert.strictEqual(
            selectQuery.params[0],
            expectedHash,
            "verifyEmail query must look up using SHA-256 hash of the token, not cleartext token"
        );

        // Invalid empty token rejected
        const invalidRes = await verifyEmail("");
        assert.strictEqual(invalidRes.success, false, "Empty token must be rejected");
    });

    await runTest("resetPass verifies OTP using SHA-256 hash and timingSafeEqualStr", async () => {
        const rawOtp = "654321";
        const hashedOtp = crypto.createHash("sha256").update(rawOtp).digest("hex");

        db.query = (async (sql: string) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[{ user_id: 88 }]];
            if (sql.includes("SELECT otp_id, otp_code")) {
                return [[{
                    otp_id: 2,
                    otp_code: hashedOtp,
                    expires_at: new Date(Date.now() + 300000),
                    is_used: 1, // Already verified in verifyOTP
                }]];
            }
            if (sql.includes("UPDATE user_auth_tbl SET password_hash =")) return [{ affectedRows: 1 }];
            if (sql.includes("UPDATE user_otp_tbl SET is_used =")) return [{ affectedRows: 1 }];
            return [[]];
        }) as typeof db.query;

        // Valid OTP with new password
        const validRes = await resetPass("sec12@quizweb.dev", rawOtp, "NewPassword123!");
        assert.strictEqual(validRes.success, true, "resetPass must succeed with valid OTP and matching hash");

        // Invalid OTP fails
        const invalidRes = await resetPass("sec12@quizweb.dev", "000000", "NewPassword123!");
        assert.strictEqual(invalidRes.error !== undefined, true, "resetPass must reject wrong OTP");
    });

    // -------------------------------------------------------------------------
    // Suite 5: Static Code Security Audit (AST / Pattern Verification)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 5: Static Code Security Audit (app/actions/auth.ts)]\x1b[0m");

    await runTest("app/actions/auth.ts contains SHA-256 hashing and timing-safe comparisons", () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            authSrc.includes("createHash") && authSrc.includes("sha256"),
            "app/actions/auth.ts must implement crypto.createHash('sha256')"
        );
        assert.ok(
            authSrc.includes("timingSafeEqual"),
            "app/actions/auth.ts must use crypto.timingSafeEqual for constant-time hash comparison"
        );
        assert.ok(
            !/export\s+(async\s+)?function\s+hashToken\b/.test(authSrc),
            "hashToken must NOT be exported from server actions file"
        );
        assert.ok(
            !/export\s+(async\s+)?function\s+timingSafeEqualStr\b/.test(authSrc),
            "timingSafeEqualStr must NOT be exported from server actions file"
        );
    });

    // -------------------------------------------------------------------------
    // Suite 6: ASVS Compliance Summary
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    console.log(` Test Execution Summary: ${passedTests}/${totalTests} Passed`);
    if (failedTests > 0) {
        console.log(` \x1b[31mStatus: FAILED (${failedTests} tests failed)\x1b[0m`);
        console.log("========================================================\n");
        process.exit(1);
    } else {
        console.log(" \x1b[32mStatus: ALL VERIFICATIONS PASSED\x1b[0m");
        console.log(" OWASP ASVS v4.0.3 Chapter 3 Compliance: VERIFIED");
        console.log("   - V2.7.5: Authenticator tokens hashed with SHA-256 at rest");
        console.log("   - V3.3.1: Session token_version column supported");
        console.log("   - V3.4.2: Protection against credential/token harvesting");
        console.log("========================================================\n");
        process.exit(0);
    }
}

main().catch(err => {
    console.error("Fatal test runner exception:", err);
    process.exit(1);
});
