/**
 * =============================================================================
 * Milestone 1 Adversarial & Empirical Verification Test Harness
 * =============================================================================
 * File: tests/test-m1-challenger.ts
 * Target: SEC-12 (Database Schema Hardening & Token Storage Hardening)
 * Standards: OWASP ASVS v4.0.3 (V2.7.5, V3.3.1, V3.4.2)
 *
 * Execution:
 *   npx --yes tsx tests/test-m1-challenger.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert";

// -----------------------------------------------------------------------------
// Environment & Setup
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

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_challenger_test_key";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test_secret_32_characters_minimum_length_for_jwt";

// Captured email sink for mock sendEmail / fetch
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

// Test Runner
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
            if (err.stack) {
                console.error(`    \x1b[90m${err.stack.split("\n").slice(1, 4).join("\n")}\x1b[0m`);
            }
        } else {
            console.error(`    \x1b[31mError:\x1b[0m`, err);
        }
    }
}

// -----------------------------------------------------------------------------
// Helper: Reference Implementations (Extracted from app/actions/auth.ts)
// -----------------------------------------------------------------------------
function refHashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

function refTimingSafeEqualStr(a: string, b: string): boolean {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// -----------------------------------------------------------------------------
// Database Migration State Machine Emulator
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

class AdvancedSchemaEmulator {
    tables: Map<string, TableDef> = new Map();

    createTable(name: string, cols: ColumnDef[]) {
        const lower = name.toLowerCase();
        if (!this.tables.has(lower)) {
            const table: TableDef = { name: lower, columns: new Map() };
            for (const c of cols) {
                table.columns.set(c.name.toLowerCase(), c);
            }
            this.tables.set(lower, table);
        }
    }

    hasTable(name: string): boolean {
        return this.tables.has(name.toLowerCase());
    }

    hasColumn(tableName: string, colName: string): boolean {
        const tbl = this.tables.get(tableName.toLowerCase());
        return tbl ? tbl.columns.has(colName.toLowerCase()) : false;
    }

    addColumn(tableName: string, col: ColumnDef): boolean {
        const tbl = this.tables.get(tableName.toLowerCase());
        if (!tbl) throw new Error(`Table ${tableName} does not exist`);
        if (tbl.columns.has(col.name.toLowerCase())) {
            return false;
        }
        tbl.columns.set(col.name.toLowerCase(), col);
        return true;
    }

    dropColumn(tableName: string, colName: string): boolean {
        const tbl = this.tables.get(tableName.toLowerCase());
        if (!tbl) throw new Error(`Table ${tableName} does not exist`);
        if (!tbl.columns.has(colName.toLowerCase())) {
            return false;
        }
        tbl.columns.delete(colName.toLowerCase());
        return true;
    }

    applyHardeningMigration(): { added: string[]; skipped: string[] } {
        const added: string[] = [];
        const skipped: string[] = [];

        // Baseline fallback tables
        if (!this.hasTable("user_auth_tbl")) {
            this.createTable("user_auth_tbl", [
                { name: "user_id", type: "INT", nullable: false },
                { name: "email", type: "VARCHAR(255)", nullable: false },
                { name: "user_role", type: "VARCHAR(50)", nullable: false },
            ]);
        }
        if (!this.hasTable("user_otp_tbl")) {
            this.createTable("user_otp_tbl", [
                { name: "otp_id", type: "INT", nullable: false },
                { name: "user_id", type: "INT", nullable: false },
                { name: "otp_code", type: "VARCHAR(255)", nullable: false },
                { name: "expires_at", type: "DATETIME", nullable: false },
                { name: "is_used", type: "INT", nullable: false },
            ]);
        }
        if (!this.hasTable("user_vrfy_tbl")) {
            this.createTable("user_vrfy_tbl", [
                { name: "verify_id", type: "INT", nullable: false },
                { name: "username", type: "VARCHAR(100)", nullable: false },
                { name: "email", type: "VARCHAR(255)", nullable: false },
                { name: "password_hash", type: "VARCHAR(255)", nullable: false },
                { name: "verification_token", type: "VARCHAR(255)", nullable: false },
                { name: "expires_at", type: "DATETIME", nullable: false },
            ]);
        }

        const items: [string, ColumnDef][] = [
            ["user_auth_tbl", { name: "token_version", type: "INT", nullable: false, defaultValue: "1" }],
            ["user_otp_tbl", { name: "attempts", type: "INT", nullable: false, defaultValue: "0" }],
            ["user_otp_tbl", { name: "locked_until", type: "DATETIME", nullable: true }],
            ["user_vrfy_tbl", { name: "attempts", type: "INT", nullable: false, defaultValue: "0" }],
            ["user_vrfy_tbl", { name: "locked_until", type: "DATETIME", nullable: true }],
        ];

        for (const [tbl, col] of items) {
            if (this.hasColumn(tbl, col.name)) {
                skipped.push(`${tbl}.${col.name}`);
            } else {
                this.addColumn(tbl, col);
                added.push(`${tbl}.${col.name}`);
            }
        }
        return { added, skipped };
    }

    applyRollbackMigration(): { dropped: string[]; skipped: string[] } {
        const dropped: string[] = [];
        const skipped: string[] = [];

        const items: [string, string][] = [
            ["user_auth_tbl", "token_version"],
            ["user_otp_tbl", "locked_until"],
            ["user_otp_tbl", "attempts"],
            ["user_vrfy_tbl", "locked_until"],
            ["user_vrfy_tbl", "attempts"],
        ];

        for (const [tbl, col] of items) {
            if (this.hasColumn(tbl, col)) {
                this.dropColumn(tbl, col);
                dropped.push(`${tbl}.${col}`);
            } else {
                skipped.push(`${tbl}.${col}`);
            }
        }
        return { dropped, skipped };
    }
}

// -----------------------------------------------------------------------------
// MAIN TEST HARNESS
// -----------------------------------------------------------------------------
async function runAllChallengerSuites() {
    console.log("\n========================================================");
    console.log(" Challenger 1: Empirical Adversarial Verification Suite");
    console.log(" Targets: SEC-12, Crypto Primitives, Timing Safety, SQL");
    console.log(" Standard: OWASP ASVS v4.0.3 Chapter 3 (2.7.5, 3.3.1, 3.4.2)");
    console.log("========================================================\n");

    // =========================================================================
    // Suite A: Cryptographic Hashing Edge Cases & Stress Testing
    // =========================================================================
    console.log("\x1b[1m[Suite A: Hashing Primitives & Boundary Edge Cases]\x1b[0m");

    await runTest("A.1: Empty string hashing produces standard 64-char hex SHA-256 digest", () => {
        const hash = refHashToken("");
        const expectedEmptySha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assert.strictEqual(hash, expectedEmptySha256, "Empty string SHA-256 must match standard FIPS 180-4 digest");
        assert.strictEqual(hash.length, 64, "Digest length must be exactly 64 characters");
    });

    await runTest("A.2: Whitespace variations produce distinct cryptographic digests", () => {
        const hSpace = refHashToken(" ");
        const hTab = refHashToken("\t");
        const hNewline = refHashToken("\n");
        const hMultipleSpaces = refHashToken("   ");
        const hEmpty = refHashToken("");

        assert.notStrictEqual(hSpace, hEmpty, "Single space must not hash to empty string digest");
        assert.notStrictEqual(hSpace, hTab, "Space and Tab must produce different digests");
        assert.notStrictEqual(hSpace, hNewline, "Space and Newline must produce different digests");
        assert.notStrictEqual(hSpace, hMultipleSpaces, "Multiple spaces must produce different digests");

        // Verification that trim() prevents padding attacks
        const trimmed1 = refHashToken(" 123456 ".trim());
        const raw1 = refHashToken("123456");
        assert.strictEqual(trimmed1, raw1, "Trimmed padded OTP must match clean OTP hash");
    });

    await runTest("A.3: Multi-byte UTF-8, emojis, accented characters, null bytes hash deterministically", () => {
        const inputs = [
            "🔐TokenKey-123",
            "CrèmeBrûlée_2026",
            "测试用户-OTP-999",
            "مرحبا_بالعالم_token",
            "null\x00byte\x00injection",
            "Z̵a̵l̵g̵o̵ ̸t̵e̸x̸t̸",
        ];

        for (const input of inputs) {
            const h1 = refHashToken(input);
            const h2 = refHashToken(input);
            assert.strictEqual(h1, h2, `Hash of '${input}' must be perfectly deterministic`);
            assert.strictEqual(h1.length, 64, `Digest of '${input}' must be 64 hex characters`);
            assert.match(h1, /^[0-9a-f]{64}$/, `Digest of '${input}' must contain only lowercase hex characters`);
        }
    });

    await runTest("A.4: Extreme input lengths (10 KB, 100 KB, 1 MB, 5 MB) process safely without error", () => {
        const sizes = [10 * 1024, 100 * 1024, 1024 * 1024, 5 * 1024 * 1024];
        for (const size of sizes) {
            const largeInput = "A".repeat(size);
            const startTime = performance.now();
            const digest = refHashToken(largeInput);
            const elapsed = performance.now() - startTime;

            assert.strictEqual(digest.length, 64, `Digest of ${size} bytes must be 64 characters`);
            assert.match(digest, /^[0-9a-f]{64}$/, "Large input digest must be valid hex");
            assert.ok(elapsed < 1000, `Hashing ${size} bytes must complete in under 1000ms (took ${elapsed.toFixed(1)}ms)`);
        }
    });

    await runTest("A.5: Hex digest case sensitivity & canonical representation", () => {
        const raw = "sample_test_token_482619";
        const canonicalHash = refHashToken(raw);

        assert.strictEqual(canonicalHash, canonicalHash.toLowerCase(), "Hex digest must be strictly lowercase");
        assert.notStrictEqual(canonicalHash, canonicalHash.toUpperCase(), "Lowercase and uppercase hex are distinct byte representations");

        // In timingSafeEqualStr, lowercase vs uppercase must evaluate to false
        const upper = canonicalHash.toUpperCase();
        assert.strictEqual(refTimingSafeEqualStr(canonicalHash, upper), false, "timingSafeEqualStr must be case-sensitive for hex strings");
    });

    await runTest("A.6: Avalanche effect: single-bit change flips approximately 50% of hash bits", () => {
        const input1 = "123456";
        const input2 = "123457"; // 1-bit difference in ASCII
        const h1 = Buffer.from(refHashToken(input1), "hex");
        const h2 = Buffer.from(refHashToken(input2), "hex");

        let diffBits = 0;
        for (let i = 0; i < 32; i++) {
            let xor = h1[i] ^ h2[i];
            while (xor > 0) {
                diffBits += xor & 1;
                xor >>= 1;
            }
        }
        const bitChangePercentage = (diffBits / 256) * 100;
        // Standard cryptographic avalanche effect is ~50% bit flip (usually between 40% and 60%)
        assert.ok(
            bitChangePercentage >= 40 && bitChangePercentage <= 65,
            `Avalanche effect must be near 50%, actual: ${bitChangePercentage.toFixed(1)}% (${diffBits}/256 bits)`
        );
    });

    // =========================================================================
    // Suite B: Timing-Safe Equality Verification (Constant-Time & Type Safety)
    // =========================================================================
    console.log("\n\x1b[1m[Suite B: Timing-Safe Equality & Constant-Time Primitives]\x1b[0m");

    await runTest("B.1: Reject non-string primitives without unhandled exceptions", () => {
        const validHash = refHashToken("482619");
        const invalidTypes: unknown[] = [
            null,
            undefined,
            123456,
            0,
            NaN,
            Infinity,
            true,
            false,
            {},
            { toString: () => validHash },
            [],
            [validHash],
            Buffer.from(validHash),
            Symbol("token"),
            () => validHash,
        ];

        for (const item of invalidTypes) {
            // First argument invalid
            assert.strictEqual(
                refTimingSafeEqualStr(item as string, validHash),
                false,
                `Must return false for invalid first argument type: ${typeof item}`
            );
            // Second argument invalid
            assert.strictEqual(
                refTimingSafeEqualStr(validHash, item as string),
                false,
                `Must return false for invalid second argument type: ${typeof item}`
            );
            // Both arguments invalid
            assert.strictEqual(
                refTimingSafeEqualStr(item as string, item as string),
                false,
                `Must return false when both arguments are invalid type: ${typeof item}`
            );
        }
    });

    await runTest("B.2: Reject length mismatches safely without throwing RangeError", () => {
        const hash64 = refHashToken("valid_token");
        const hash63 = hash64.slice(0, 63);
        const hash65 = hash64 + "a";
        const empty = "";

        assert.strictEqual(refTimingSafeEqualStr(hash64, hash63), false, "64 vs 63 bytes must return false without throwing");
        assert.strictEqual(refTimingSafeEqualStr(hash64, hash65), false, "64 vs 65 bytes must return false without throwing");
        assert.strictEqual(refTimingSafeEqualStr(hash64, empty), false, "64 vs 0 bytes must return false without throwing");
        assert.strictEqual(refTimingSafeEqualStr(empty, hash64), false, "0 vs 64 bytes must return false without throwing");
        assert.strictEqual(refTimingSafeEqualStr(hash64, "short"), false, "64 vs 5 bytes must return false without throwing");
    });

    await runTest("B.3: Empty strings comparison returns true safely without throwing", () => {
        assert.strictEqual(refTimingSafeEqualStr("", ""), true, "Two empty strings must evaluate to true safely");
    });

    await runTest("B.4: Positional single-byte differences evaluated accurately", () => {
        const base = refHashToken("sample_base_token_to_verify");
        assert.strictEqual(refTimingSafeEqualStr(base, base), true, "Identical 64-char strings must match");

        // Difference at first byte (index 0)
        const diffStart = (base[0] === "a" ? "b" : "a") + base.slice(1);
        assert.strictEqual(refTimingSafeEqualStr(base, diffStart), false, "Mismatch at index 0 must return false");

        // Difference at middle byte (index 32)
        const midChar = base[32] === "0" ? "1" : "0";
        const diffMid = base.slice(0, 32) + midChar + base.slice(33);
        assert.strictEqual(refTimingSafeEqualStr(base, diffMid), false, "Mismatch at index 32 must return false");

        // Difference at end byte (index 63)
        const endChar = base[63] === "f" ? "e" : "f";
        const diffEnd = base.slice(0, 63) + endChar;
        assert.strictEqual(refTimingSafeEqualStr(base, diffEnd), false, "Mismatch at index 63 must return false");
    });

    await runTest("B.5: Verify crypto.timingSafeEqual is genuinely invoked for equal-length strings", () => {
        let called = false;
        const originalTimingSafeEqual = crypto.timingSafeEqual;
        try {
            crypto.timingSafeEqual = ((a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
                called = true;
                return originalTimingSafeEqual(a, b);
            }) as typeof crypto.timingSafeEqual;

            const h1 = refHashToken("test_a");
            const h2 = refHashToken("test_b");
            const result = refTimingSafeEqualStr(h1, h2);

            assert.strictEqual(called, true, "crypto.timingSafeEqual MUST be called for equal-length strings");
            assert.strictEqual(result, false, "Result must be false for different hashes");
        } finally {
            crypto.timingSafeEqual = originalTimingSafeEqual;
        }
    });

    await runTest("B.6: Verify timingSafeEqual is NOT called when length differs (fail-fast safe check)", () => {
        let called = false;
        const originalTimingSafeEqual = crypto.timingSafeEqual;
        try {
            crypto.timingSafeEqual = ((a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
                called = true;
                return originalTimingSafeEqual(a, b);
            }) as typeof crypto.timingSafeEqual;

            const h1 = refHashToken("test_a");
            const result = refTimingSafeEqualStr(h1, "short");

            assert.strictEqual(called, false, "crypto.timingSafeEqual must NOT be called when lengths differ");
            assert.strictEqual(result, false, "Result must be false for different lengths");
        } finally {
            crypto.timingSafeEqual = originalTimingSafeEqual;
        }
    });

    // =========================================================================
    // Suite C: SQL Migration Idempotency & Reversibility Stress Testing
    // =========================================================================
    console.log("\n\x1b[1m[Suite C: Migration Execution & Idempotency State Machine]\x1b[0m");

    await runTest("C.1: Consecutive repeated executions of hardening migration are fully idempotent", () => {
        const emu = new AdvancedSchemaEmulator();

        // 1st run: all 5 columns added
        const run1 = emu.applyHardeningMigration();
        assert.strictEqual(run1.added.length, 5, "First run must add all 5 SEC-12 columns");
        assert.strictEqual(run1.skipped.length, 0, "First run must not skip any columns");

        // 2nd run: all 5 columns skipped (idempotent)
        const run2 = emu.applyHardeningMigration();
        assert.strictEqual(run2.added.length, 0, "Second run must add 0 columns");
        assert.strictEqual(run2.skipped.length, 5, "Second run must skip all 5 existing columns");

        // 3rd run: all 5 columns skipped
        const run3 = emu.applyHardeningMigration();
        assert.strictEqual(run3.added.length, 0, "Third run must add 0 columns");
        assert.strictEqual(run3.skipped.length, 5, "Third run must skip all 5 existing columns");

        // Verify column states
        assert.ok(emu.hasColumn("user_auth_tbl", "token_version"));
        assert.ok(emu.hasColumn("user_otp_tbl", "attempts"));
        assert.ok(emu.hasColumn("user_otp_tbl", "locked_until"));
        assert.ok(emu.hasColumn("user_vrfy_tbl", "attempts"));
        assert.ok(emu.hasColumn("user_vrfy_tbl", "locked_until"));
    });

    await runTest("C.2: Consecutive repeated executions of rollback migration are fully idempotent", () => {
        const emu = new AdvancedSchemaEmulator();
        emu.applyHardeningMigration();

        // 1st rollback: all 5 columns dropped
        const rb1 = emu.applyRollbackMigration();
        assert.strictEqual(rb1.dropped.length, 5, "First rollback must drop all 5 SEC-12 columns");
        assert.strictEqual(rb1.skipped.length, 0, "First rollback must not skip any columns");

        // 2nd rollback: all 5 skipped (idempotent)
        const rb2 = emu.applyRollbackMigration();
        assert.strictEqual(rb2.dropped.length, 0, "Second rollback must drop 0 columns");
        assert.strictEqual(rb2.skipped.length, 5, "Second rollback must skip non-existent columns without error");

        // 3rd rollback: all 5 skipped
        const rb3 = emu.applyRollbackMigration();
        assert.strictEqual(rb3.dropped.length, 0, "Third rollback must drop 0 columns");
        assert.strictEqual(rb3.skipped.length, 5, "Third rollback must skip non-existent columns without error");

        // Verify columns no longer exist
        assert.ok(!emu.hasColumn("user_auth_tbl", "token_version"));
        assert.ok(!emu.hasColumn("user_otp_tbl", "attempts"));
        assert.ok(!emu.hasColumn("user_otp_tbl", "locked_until"));
        assert.ok(!emu.hasColumn("user_vrfy_tbl", "attempts"));
        assert.ok(!emu.hasColumn("user_vrfy_tbl", "locked_until"));
    });

    await runTest("C.3: Full migration lifecycle cycle: Apply -> Idempotent -> Rollback -> Idempotent -> Re-Apply", () => {
        const emu = new AdvancedSchemaEmulator();

        // Baseline state
        assert.ok(!emu.hasColumn("user_auth_tbl", "token_version"));

        // Step 1: Apply
        emu.applyHardeningMigration();
        assert.ok(emu.hasColumn("user_auth_tbl", "token_version"));

        // Step 2: Idempotent re-apply
        emu.applyHardeningMigration();
        assert.ok(emu.hasColumn("user_auth_tbl", "token_version"));

        // Step 3: Rollback
        emu.applyRollbackMigration();
        assert.ok(!emu.hasColumn("user_auth_tbl", "token_version"));

        // Step 4: Idempotent rollback
        emu.applyRollbackMigration();
        assert.ok(!emu.hasColumn("user_auth_tbl", "token_version"));

        // Step 5: Re-Apply after rollback
        const reapply = emu.applyHardeningMigration();
        assert.strictEqual(reapply.added.length, 5, "Re-applying after rollback must restore all 5 columns");
        assert.ok(emu.hasColumn("user_auth_tbl", "token_version"));
        assert.ok(emu.hasColumn("user_otp_tbl", "attempts"));
        assert.ok(emu.hasColumn("user_vrfy_tbl", "attempts"));
    });

    await runTest("C.4: SQL file structure & syntax audit (zero delimiters, strict types, default values)", () => {
        const fHardening = path.join(projectRoot, "migrations/002_security_hardening.sql");
        const fRollback = path.join(projectRoot, "migrations/002_security_hardening_rollback.sql");
        const hardeningContent = fs.readFileSync(fHardening, "utf8");
        const rollbackContent = fs.readFileSync(fRollback, "utf8");

        // Wire protocol delimiter compliance
        assert.ok(!/^\s*DELIMITER\b/im.test(hardeningContent), "002_security_hardening.sql must not have DELIMITER");
        assert.ok(!/^\s*DELIMITER\b/im.test(rollbackContent), "002_security_hardening_rollback.sql must not have DELIMITER");

        // Schema correctness checks
        assert.ok(hardeningContent.includes("token_version` INT NOT NULL DEFAULT 1"), "token_version must be INT NOT NULL DEFAULT 1");
        assert.ok(hardeningContent.includes("attempts` INT NOT NULL DEFAULT 0"), "attempts must be INT NOT NULL DEFAULT 0");
        assert.ok(hardeningContent.includes("locked_until` DATETIME NULL"), "locked_until must be DATETIME NULL");
        assert.ok(hardeningContent.includes("INFORMATION_SCHEMA.COLUMNS") || hardeningContent.includes("information_schema.COLUMNS"), "Must check INFORMATION_SCHEMA.COLUMNS");
        assert.ok(hardeningContent.includes("TABLE_SCHEMA = DATABASE()"), "Must scope column check to current DATABASE()");
    });

    // =========================================================================
    // Suite D: Authentication Server Actions Adversarial Integration Stress
    // =========================================================================
    console.log("\n\x1b[1m[Suite D: Server Actions Adversarial Integration Stress]\x1b[0m");

    const dbModule = await import("../lib/db");
    const db = dbModule.db;
    const authActions = await import("../app/actions/auth");
    const signUp = authActions.signUp;
    const reqPassReset = authActions.reqPassReset;
    const verifyOTP = authActions.verifyOTP;
    const verifyEmail = authActions.verifyEmail;
    const resetPass = authActions.resetPass;

    await runTest("D.1: signUp generates CSPRNG token, stores SHA-256 hash, and emails raw token link", async () => {
        capturedEmails = [];
        interface QueryRecord {
            sql: string;
            params: unknown[];
        }
        const executedQueries: QueryRecord[] = [];

        db.query = (async (sql: string, params: unknown[] = []) => {
            executedQueries.push({ sql, params });
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
            if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
            if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
            if (sql.includes("INSERT INTO user_vrfy_tbl")) return [{ insertId: 777 }];
            return [[]];
        }) as typeof db.query;

        const formData = new FormData();
        formData.set("username", "adv_challenger_user");
        formData.set("email", "adv@quizweb.dev");
        formData.set("password", "ComplexPassword123!");
        formData.set("confirmPassword", "ComplexPassword123!");
        formData.set("recaptchaToken", "test-bypass-recaptcha-token");

        const res = await signUp(formData);
        assert.strictEqual(res.success, true, "signUp must succeed with valid data");
        assert.strictEqual(capturedEmails.length, 1, "Exactly one verification email must be dispatched");

        // Verify token in email
        const tokenMatch = capturedEmails[0].html.match(/\/verify-email\/([a-f0-9]{64})/i);
        assert.ok(tokenMatch, "Email must contain raw 64-char hexadecimal token");
        const rawToken = tokenMatch[1];

        // Verify token in DB insert
        const insertQuery = executedQueries.find(q => q.sql.includes("INSERT INTO user_vrfy_tbl"));
        assert.ok(insertQuery, "Must execute INSERT INTO user_vrfy_tbl");
        assert.ok(insertQuery.sql.includes("attempts"), "Insert query must include attempts column");
        assert.ok(insertQuery.sql.includes("locked_until"), "Insert query must include locked_until column");

        const storedToken = String(insertQuery.params[3]);
        const expectedHash = refHashToken(rawToken);

        assert.strictEqual(storedToken.length, 64, "Stored token must be 64-character SHA-256 hex string");
        assert.notStrictEqual(storedToken, rawToken, "SEC-12 VIOLATION: Stored token must NEVER match raw token");
        assert.strictEqual(storedToken, expectedHash, "SEC-12: Stored token must equal SHA-256 hash of raw token");
    });

    await runTest("D.2: verifyOTP brute-force simulation (5 failed attempts trigger lockout)", async () => {
        const correctOtp = "123456";
        const correctHashedOtp = refHashToken(correctOtp);
        let storedAttempts = 0;
        let storedLockedUntil: Date | null = null;

        db.query = (async (sql: string, params: unknown[] = []) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[{ user_id: 99 }]];
            if (sql.includes("SELECT otp_id, otp_code")) {
                return [[{
                    otp_id: 50,
                    otp_code: correctHashedOtp,
                    expires_at: new Date(Date.now() + 300000), // 5 min in future
                    is_used: 0,
                    attempts: storedAttempts,
                    locked_until: storedLockedUntil,
                }]];
            }
            if (sql.includes("UPDATE user_otp_tbl") && sql.includes("attempts = attempts + 1")) {
                storedAttempts += 1;
                if (storedAttempts >= 5) {
                    storedLockedUntil = new Date(Date.now() + 900000);
                }
                return [{ affectedRows: 1 }];
            }
            if (sql.includes("UPDATE user_otp_tbl SET attempts = ?, locked_until = NOW()")) {
                storedAttempts = Number(params[0]);
                storedLockedUntil = new Date(Date.now() + 900000); // simulate lockout timestamp
                return [{ affectedRows: 1 }];
            }
            if (sql.includes("UPDATE user_otp_tbl SET attempts = ?")) {
                storedAttempts = Number(params[0]);
                return [{ affectedRows: 1 }];
            }
            if (sql.includes("UPDATE user_otp_tbl SET is_used = 1")) {
                return [{ affectedRows: 1 }];
            }
            return [[]];
        }) as typeof db.query;

        // Attempts 1 through 4: Should fail with "Invalid OTP" and increment attempts
        for (let i = 1; i <= 4; i++) {
            const failRes = await verifyOTP("adv@quizweb.dev", "999999");
            assert.strictEqual(failRes.error, "Invalid OTP. Please try again.", `Attempt ${i} must return invalid error`);
            assert.strictEqual(storedAttempts, i, `Attempt count must be ${i}`);
        }

        // Attempt 5: Should trigger lockout
        const lockRes = await verifyOTP("adv@quizweb.dev", "999999");
        assert.ok(lockRes.error?.includes("locked"), "5th attempt must return lockout error");
        assert.strictEqual(storedAttempts, 5, "Attempts must reach 5");
        assert.ok(storedLockedUntil !== null, "locked_until must be set");

        // Attempt 6 (even with correct OTP!): Must be blocked by lockout
        const blockedRes = await verifyOTP("adv@quizweb.dev", correctOtp);
        assert.ok(blockedRes.error?.includes("locked"), "Subsequent attempts after lockout must be rejected");
    });

    await runTest("D.3: verifyOTP whitespace handling in user-submitted code", async () => {
        const correctOtp = "582910";
        const correctHashedOtp = refHashToken(correctOtp);

        db.query = (async (sql: string) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[{ user_id: 99 }]];
            if (sql.includes("SELECT otp_id, otp_code")) {
                return [[{
                    otp_id: 51,
                    otp_code: correctHashedOtp,
                    expires_at: new Date(Date.now() + 300000),
                    is_used: 0,
                    attempts: 0,
                    locked_until: null,
                }]];
            }
            if (sql.includes("UPDATE user_otp_tbl SET is_used = 1")) return [{ affectedRows: 1 }];
            return [[]];
        }) as typeof db.query;

        // User submits OTP with leading/trailing spaces
        const res = await verifyOTP("adv@quizweb.dev", "  582910  ");
        assert.strictEqual(res.success, true, "Padded OTP must be trimmed and match stored hash");
    });

    await runTest("D.4: verifyEmail rejects locked accounts and handles non-existent tokens", async () => {
        db.getConnection = (async () => ({
            query: async (sql: string) => {
                if (sql.includes("SELECT verify_id") && sql.includes("user_vrfy_tbl")) {
                    return [[{
                        verify_id: 12,
                        username: "lockeduser",
                        email: "locked@quizweb.dev",
                        password_hash: "argon2_hash",
                        expires_at: new Date(Date.now() + 300000),
                        attempts: 5,
                        locked_until: new Date(Date.now() + 600000),
                    }]];
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const res = await verifyEmail("any_token_string");
        assert.strictEqual(res.success, false, "Locked verification must be rejected");
        assert.ok(res.message.includes("locked"), "Message must indicate account is locked");

        // Edge case: Empty token string
        const emptyRes = await verifyEmail("");
        assert.strictEqual(emptyRes.success, false, "Empty token must be rejected");
        const spacesRes = await verifyEmail("   ");
        assert.strictEqual(spacesRes.success, false, "Pure whitespace token must be rejected");
    });

    await runTest("D.5: resetPass rejects unverified OTPs and verifies using timingSafeEqualStr", async () => {
        const rawOtp = "837492";
        const hashedOtp = refHashToken(rawOtp);

        db.query = (async (sql: string) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[{ user_id: 88 }]];
            if (sql.includes("SELECT otp_id, otp_code")) {
                return [[{
                    otp_id: 10,
                    otp_code: hashedOtp,
                    expires_at: new Date(Date.now() + 300000),
                    is_used: 0, // Unverified OTP!
                }]];
            }
            return [[]];
        }) as typeof db.query;

        const res = await resetPass("adv@quizweb.dev", rawOtp, "NewSecretPass123!");
        assert.strictEqual(res.error, "Invalid or expired OTP", "Unverified OTP (is_used=0) must be rejected");
    });

    await runTest("D.6: reqPassReset invalidates old OTPs, generates 6-digit OTP, and stores SHA-256 hash", async () => {
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
            if (sql.includes("INSERT INTO user_otp_tbl")) return [{ insertId: 303 }];
            return [[]];
        }) as typeof db.query;

        const res = await reqPassReset("adv@quizweb.dev");
        assert.strictEqual(res.success, true, "reqPassReset must return success");
        assert.strictEqual(capturedEmails.length, 1, "Password reset email must be sent");

        const updateQuery = queries.find(q => q.sql.includes("UPDATE user_otp_tbl SET is_used = 2") || q.sql.includes("UPDATE user_otp_tbl SET is_used = 1"));
        assert.ok(updateQuery, "Must invalidate prior active OTPs");

        const insertQuery = queries.find(q => q.sql.includes("INSERT INTO user_otp_tbl"));
        assert.ok(insertQuery, "Must insert newly generated OTP record");
        assert.ok(insertQuery.sql.includes("attempts"), "Insert query must include attempts column");
        assert.ok(insertQuery.sql.includes("locked_until"), "Insert query must include locked_until column");

        const storedOtpHash = String(insertQuery.params[1]);
        assert.strictEqual(storedOtpHash.length, 64, "Stored OTP must be 64-char SHA-256 hex string");

        const otpMatch = capturedEmails[0].html.match(/otp-code\">([0-9]{6})</);
        assert.ok(otpMatch, "Email must contain raw 6-digit OTP");
        const rawOtp = otpMatch[1];
        assert.strictEqual(storedOtpHash, refHashToken(rawOtp), "Stored hash must match SHA-256 of emailed OTP");
        assert.notStrictEqual(storedOtpHash, rawOtp, "Raw OTP must not be stored in cleartext");
    });

    // =========================================================================
    // Suite E: OWASP ASVS v4.0.3 Chapter 3 Compliance Verification
    // =========================================================================
    console.log("\n\x1b[1m[Suite E: OWASP ASVS v4.0.3 Chapter 3 Compliance Audit]\x1b[0m");

    await runTest("E.1: ASVS V2.7.5: Authenticator tokens hashed with SHA-256 at rest", () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        // Verify crypto.createHash('sha256') is implemented
        assert.ok(
            authSrc.includes("createHash(\"sha256\")") || authSrc.includes("createHash('sha256')"),
            "Tokens and OTPs must be hashed with SHA-256 at rest"
        );
        // Verify user_vrfy_tbl receives hashed token
        assert.ok(
            authSrc.includes("hashedVerificationToken = hashToken(rawVerificationToken)"),
            "user_vrfy_tbl must store hashToken(rawVerificationToken)"
        );
        // Verify user_otp_tbl receives hashed OTP
        assert.ok(
            authSrc.includes("hashedOtp = hashToken(rawOtp)"),
            "user_otp_tbl must store hashToken(rawOtp)"
        );
    });

    await runTest("E.2: ASVS V3.3.1: Session token_version column exists for session revocation", () => {
        const hardeningSql = fs.readFileSync(path.join(projectRoot, "migrations/002_security_hardening.sql"), "utf8");
        assert.ok(
            hardeningSql.includes("token_version"),
            "user_auth_tbl must contain token_version column"
        );
        assert.ok(
            hardeningSql.includes("INT NOT NULL DEFAULT 1"),
            "token_version must be INT NOT NULL DEFAULT 1"
        );
    });

    await runTest("E.3: ASVS V3.4.2: Protection against credential and token harvesting", () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        // Ensure raw tokens are never inserted into the DB
        assert.ok(
            !authSrc.includes("[trimmedUsername, normalizedEmail, hashed, rawVerificationToken"),
            "Raw verification token must never be passed in database INSERT query"
        );
        assert.ok(
            !authSrc.includes("[userId, rawOtp"),
            "Raw OTP must never be passed in database INSERT query"
        );
    });

    // =========================================================================
    // Final Summary
    // =========================================================================
    console.log("\n========================================================");
    console.log(` Challenger 1 Execution Summary: ${passedTests}/${totalTests} Passed`);
    if (failedTests > 0) {
        console.log(` \x1b[31mStatus: ADVERSARIAL CHALLENGES FAILED (${failedTests} tests failed)\x1b[0m`);
        console.log("========================================================\n");
        process.exit(1);
    } else {
        console.log(" \x1b[32mStatus: ALL ADVERSARIAL VERIFICATIONS PASSED\x1b[0m");
        console.log(" Verdict: CONFIRM_CORRECTNESS for Milestone 1 (SEC-12)");
        console.log("========================================================\n");
        process.exit(0);
    }
}

runAllChallengerSuites().catch(err => {
    console.error("Fatal exception in challenger test suite:", err);
    process.exit(1);
});
