/**
 * =============================================================================
 * Milestone 2 Challenger 2 Test Harness: tests/test-m2-challenger-2.ts
 * =============================================================================
 * Roles: critic, specialist
 * Targets:
 *   - SEC-06: RPC Surface Reduction (clearLoginRateLimit export elimination)
 *   - SEC-09: Server-Side Google reCAPTCHA v3 Enforcement in signUp
 *             (missing/invalid tokens rejected, zero DB query prior to validation)
 *   - SEC-11: Safe Email Verification (GET zero DB mutations, POST activation)
 *
 * Security Standards:
 *   - OWASP ASVS v4.0.3 Chapter 3 (V3.1.1)
 *   - OWASP ASVS v4.0.3 (V2.2.1, V11.1.4, V13.1.4, V13.2.1)
 *   - RFC 7231 §4.2.1 (Safe HTTP Methods)
 *
 * Execution:
 *   npx --yes tsx tests/test-m2-challenger-2.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import crypto from "node:crypto";
import { createRequire } from "node:module";

// -----------------------------------------------------------------------------
// Suite 1: Environment & Mock Infrastructure
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

// Pre-initialize environment variables for standalone test execution
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "adversarial_audit_secret_key_32_chars_min";
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_adversarial_test_resend_key";
process.env.RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "recaptcha_secret_adversarial_test_key";
process.env.RECAPTCHA_BYPASS_TOKEN = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";

// Patch next/headers to prevent "headers was called outside request scope" in standalone tsx
const requireHelper = createRequire(path.join(projectRoot, "package.json"));
try {
    const nextHeadersPath = requireHelper.resolve("next/headers");
    requireHelper.cache[nextHeadersPath] = {
        id: nextHeadersPath,
        filename: nextHeadersPath,
        loaded: true,
        exports: {
            headers: async () => new Headers(),
            cookies: async () => ({
                get: () => undefined,
                getAll: () => [],
                has: () => false,
            }),
            draftMode: async () => ({ isEnabled: false }),
        },
    } as unknown as NodeModule;
} catch {
    // Fallback if resolve fails
}

// Global fetch mock state for reCAPTCHA v3 and Resend email
interface MockFetchState {
    recaptchaStatus: number;
    recaptchaResult: { success: boolean; score?: number; "error-codes"?: string[] } | string;
    throwNetworkError: boolean;
    capturedRecaptchaBodies: string[];
    capturedEmails: Record<string, unknown>[];
}

const mockFetchState: MockFetchState = {
    recaptchaStatus: 200,
    recaptchaResult: { success: true, score: 0.9 },
    throwNetworkError: false,
    capturedRecaptchaBodies: [],
    capturedEmails: [],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("google.com/recaptcha/api/siteverify")) {
        if (mockFetchState.throwNetworkError) {
            throw new Error("Simulated network timeout/failure reaching google siteverify");
        }
        const bodyStr = String(init?.body || "");
        mockFetchState.capturedRecaptchaBodies.push(bodyStr);

        const responseContent = typeof mockFetchState.recaptchaResult === "string"
            ? mockFetchState.recaptchaResult
            : JSON.stringify(mockFetchState.recaptchaResult);

        return new Response(responseContent, {
            status: mockFetchState.recaptchaStatus,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (url.includes("api.resend.com")) {
        let bodyObj: Record<string, unknown> = {};
        if (init?.body) {
            try {
                bodyObj = JSON.parse(String(init.body)) as Record<string, unknown>;
            } catch {
                bodyObj = { html: String(init.body) };
            }
        }
        mockFetchState.capturedEmails.push(bodyObj);
        return new Response(JSON.stringify({ id: "mock_resend_" + Date.now() }), {
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
const failureDetails: string[] = [];

async function runAdversarialTest(testName: string, testFn: () => void | Promise<void>) {
    totalTests++;
    try {
        await testFn();
        passedTests++;
        console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName}`);
    } catch (err: unknown) {
        failedTests++;
        const msg = err instanceof Error ? err.message : String(err);
        failureDetails.push(`${testName}: ${msg}`);
        console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName}`);
        console.error(`    \x1b[31mDetails:\x1b[0m ${msg}`);
    }
}

// Database query interceptor
interface QueryLogEntry {
    sql: string;
    params?: unknown[];
}
const globalQueryLog: QueryLogEntry[] = [];

interface MockDbConnection {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    beginTransaction: () => Promise<void>;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
    release: () => void;
}

interface MockDbPool {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    getConnection: () => Promise<MockDbConnection>;
}

// -----------------------------------------------------------------------------
// Main Adversarial Test Execution
// -----------------------------------------------------------------------------
async function runAllChallengerTests() {
    console.log("\n================================================================================");
    console.log(" QuizWeb Milestone 2: Adversarial Security Challenge Suite 2");
    console.log(" Agent: m2_challenger_2_r2 (critic, specialist)");
    console.log(" Targets: SEC-06 (RPC Reduction), SEC-09 (reCAPTCHA v3), SEC-11 (Email Activation)");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3 (V3.1.1), V2.2.1, V11.1.4, V13.1.4, V13.2.1");
    console.log("================================================================================\n");

    // Dynamic import of modules under test
    const dbModule = await import("../lib/db") as unknown as { db?: MockDbPool; default?: { db: MockDbPool } };
    const db = (dbModule.db || dbModule.default?.db) as MockDbPool;

    const authActions = await import("../app/actions/auth") as Record<string, unknown>;
    const authPath = path.join(projectRoot, "app/actions/auth.ts");
    const loginPagePath = path.join(projectRoot, "app/login/page.tsx");
    const verifyPagePath = path.join(projectRoot, "app/verify-email/[token]/page.tsx");
    const verifyClientPath = path.join(projectRoot, "app/verify-email/[token]/VerifyEmailClient.tsx");
    const verifyLayoutPath = path.join(projectRoot, "app/verify-email/[token]/layout.tsx");

    const authSrc = fs.readFileSync(authPath, "utf8");
    const loginSrc = fs.readFileSync(loginPagePath, "utf8");
    const verifyPageSrc = fs.readFileSync(verifyPagePath, "utf8");
    const verifyClientSrc = fs.readFileSync(verifyClientPath, "utf8");
    const verifyLayoutSrc = fs.readFileSync(verifyLayoutPath, "utf8");

    // =========================================================================
    // SECTION 1: SEC-06 RPC Surface Reduction (clearLoginRateLimit)
    // =========================================================================
    console.log("\x1b[1m[SECTION 1: SEC-06 RPC Surface Reduction - clearLoginRateLimit]\x1b[0m");

    await runAdversarialTest("SEC-06.1: Module exports inspection - clearLoginRateLimit must NOT exist in Object.keys()", () => {
        const exportedKeys = Object.keys(authActions);
        assert.strictEqual(
            exportedKeys.includes("clearLoginRateLimit"),
            false,
            `SEC-06 VIOLATION: clearLoginRateLimit is exported in Object.keys(): [${exportedKeys.join(", ")}]`
        );
    });

    await runAdversarialTest("SEC-06.2: Module property inspection - clearLoginRateLimit must be undefined", () => {
        assert.strictEqual(
            authActions["clearLoginRateLimit"],
            undefined,
            "SEC-06 VIOLATION: clearLoginRateLimit is accessible as a property on app/actions/auth"
        );
    });

    await runAdversarialTest("SEC-06.3: Simulated unauthenticated RPC invocation attempt must fail", () => {
        const candidateFn = authActions["clearLoginRateLimit"];
        assert.throws(
            () => {
                if (typeof candidateFn === "function") {
                    candidateFn("victim@quizweb.dev");
                } else {
                    throw new TypeError("clearLoginRateLimit is not a function");
                }
            },
            {
                name: "TypeError",
                message: /not a function/,
            },
            "Adversarial caller must not be able to execute clearLoginRateLimit as an RPC endpoint"
        );
    });

    await runAdversarialTest("SEC-06.4: Static AST/Regex audit - app/actions/auth.ts contains NO export of clearLoginRateLimit", () => {
        const hasExportFunc = /export\s+(async\s+)?function\s+clearLoginRateLimit\b/.test(authSrc);
        const hasExportConst = /export\s+(const|let|var)\s+clearLoginRateLimit\b/.test(authSrc);
        const hasExportClause = /export\s*\{[^}]*\bclearLoginRateLimit\b[^}]*\}/.test(authSrc);

        assert.strictEqual(hasExportFunc, false, "SEC-06 VIOLATION: Found 'export function clearLoginRateLimit'");
        assert.strictEqual(hasExportConst, false, "SEC-06 VIOLATION: Found 'export const clearLoginRateLimit'");
        assert.strictEqual(hasExportClause, false, "SEC-06 VIOLATION: Found export clause containing clearLoginRateLimit");
    });

    await runAdversarialTest("SEC-06.5: Static AST/Regex audit - app/actions/auth.ts does not declare clearLoginRateLimit at all", () => {
        assert.strictEqual(
            authSrc.includes("clearLoginRateLimit"),
            false,
            "SEC-06 VIOLATION: app/actions/auth.ts still contains reference to clearLoginRateLimit"
        );
    });

    await runAdversarialTest("SEC-06.6: Client audit - app/login/page.tsx must NOT import or call clearLoginRateLimit", () => {
        assert.strictEqual(
            loginSrc.includes("clearLoginRateLimit"),
            false,
            "SEC-06 VIOLATION: app/login/page.tsx imports or calls clearLoginRateLimit"
        );
    });

    // =========================================================================
    // SECTION 2: SEC-09 Server-Side reCAPTCHA v3 Enforcement in signUp
    // =========================================================================
    console.log("\n\x1b[1m[SECTION 2: SEC-09 Server-Side Google reCAPTCHA v3 Enforcement in signUp]\x1b[0m");

    const signUp = authActions.signUp as (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
    assert.strictEqual(typeof signUp, "function", "signUp must be exported from app/actions/auth");

    // Helper to spy on DB queries
    function attachDbSpy() {
        globalQueryLog.length = 0;
        db.query = (async (sql: string, params?: unknown[]) => {
            globalQueryLog.push({ sql, params });
            return [[]];
        }) as typeof db.query;

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;
    }

    await runAdversarialTest("SEC-09.1: signUp rejects request when recaptchaToken is completely omitted", async () => {
        attachDbSpy();
        mockFetchState.capturedRecaptchaBodies = [];

        const fd = new FormData();
        fd.set("username", "adversarial_bot1");
        fd.set("email", "adv_bot1@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        // recaptchaToken omitted

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail when reCAPTCHA token is missing");
        assert.ok(
            result.error?.toLowerCase().includes("recaptcha") || result.error?.toLowerCase().includes("failed"),
            `Expected reCAPTCHA failure message, received: ${result.error}`
        );
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} times) before reCAPTCHA token validation!`
        );
        assert.strictEqual(
            mockFetchState.capturedRecaptchaBodies.length,
            0,
            "Fetch to Google siteverify should not be dispatched for empty token"
        );
    });

    await runAdversarialTest("SEC-09.2: signUp rejects request when recaptchaToken is empty string", async () => {
        attachDbSpy();

        const fd = new FormData();
        fd.set("username", "adversarial_bot2");
        fd.set("email", "adv_bot2@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail on empty reCAPTCHA token");
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} times) with empty reCAPTCHA token!`
        );
    });

    await runAdversarialTest("SEC-09.3: signUp rejects request when recaptchaToken is whitespace only", async () => {
        attachDbSpy();

        const fd = new FormData();
        fd.set("username", "adversarial_bot3");
        fd.set("email", "adv_bot3@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "    \t\n  ");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail on whitespace reCAPTCHA token");
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} times) with whitespace reCAPTCHA token!`
        );
    });

    await runAdversarialTest("SEC-09.4: signUp rejects request when Google siteverify returns success: false", async () => {
        attachDbSpy();
        mockFetchState.capturedRecaptchaBodies = [];
        mockFetchState.recaptchaStatus = 200;
        mockFetchState.recaptchaResult = { success: false, "error-codes": ["invalid-input-response"] };
        mockFetchState.throwNetworkError = false;

        const fd = new FormData();
        fd.set("username", "adversarial_bot4");
        fd.set("email", "adv_bot4@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "forged_invalid_recaptcha_token_string");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail when Google verification returns false");
        assert.ok(
            result.error?.toLowerCase().includes("recaptcha") || result.error?.toLowerCase().includes("failed"),
            `Expected reCAPTCHA failure message, received: ${result.error}`
        );
        assert.strictEqual(
            mockFetchState.capturedRecaptchaBodies.length,
            1,
            "Fetch to Google siteverify must have been called exactly once"
        );
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} queries) after Google rejected token!`
        );
    });

    await runAdversarialTest("SEC-09.5: signUp rejects request when Google siteverify returns HTTP 500 error", async () => {
        attachDbSpy();
        mockFetchState.recaptchaStatus = 500;
        mockFetchState.recaptchaResult = "Internal Server Error";
        mockFetchState.throwNetworkError = false;

        const fd = new FormData();
        fd.set("username", "adversarial_bot5");
        fd.set("email", "adv_bot5@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "token_triggering_http_500");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail if Google siteverify returns HTTP 500");
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} queries) when Google returned HTTP 500!`
        );
    });

    await runAdversarialTest("SEC-09.6: signUp rejects request when network timeout / exception occurs contacting Google", async () => {
        attachDbSpy();
        mockFetchState.throwNetworkError = true;

        const fd = new FormData();
        fd.set("username", "adversarial_bot6");
        fd.set("email", "adv_bot6@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "token_with_network_failure");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail if siteverify network connection throws");
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} queries) on network failure!`
        );
    });

    await runAdversarialTest("SEC-09.7: Bot score stress test - low score (0.1) rejected with ZERO DB queries", async () => {
        attachDbSpy();
        mockFetchState.recaptchaStatus = 200;
        mockFetchState.throwNetworkError = false;
        mockFetchState.recaptchaResult = { success: true, score: 0.1 };

        const fd = new FormData();
        fd.set("username", "adversarial_bot_01");
        fd.set("email", "bot01@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "token_score_0.1");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail when score is 0.1 (bot)");
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} queries) for score 0.1!`
        );
    });

    await runAdversarialTest("SEC-09.8: Boundary test - sub-threshold score (0.49) rejected with ZERO DB queries", async () => {
        attachDbSpy();
        mockFetchState.recaptchaStatus = 200;
        mockFetchState.throwNetworkError = false;
        mockFetchState.recaptchaResult = { success: true, score: 0.49 };

        const fd = new FormData();
        fd.set("username", "adversarial_bot_049");
        fd.set("email", "bot049@quizweb.dev");
        fd.set("password", "P@ssword123!");
        fd.set("confirmPassword", "P@ssword123!");
        fd.set("recaptchaToken", "token_score_0.49");

        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "signUp must fail when score is 0.49 (< 0.50)");
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-09 CRITICAL: Database was queried (${globalQueryLog.length} queries) for score 0.49!`
        );
    });

    await runAdversarialTest("SEC-09.9: Boundary test - exact threshold score (0.50) passes reCAPTCHA and queries DB", async () => {
        attachDbSpy();
        mockFetchState.recaptchaStatus = 200;
        mockFetchState.throwNetworkError = false;
        mockFetchState.recaptchaResult = { success: true, score: 0.50 };

        let insertedIntoVrfy = false;
        db.query = (async (sql: string, params?: unknown[]) => {
            globalQueryLog.push({ sql, params });
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
            if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
            if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
            if (sql.includes("INSERT INTO user_vrfy_tbl")) {
                insertedIntoVrfy = true;
                return [{ insertId: 801 }];
            }
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "human_boundary_50");
        fd.set("email", "human50@quizweb.dev");
        fd.set("password", "StrongP@ss123!");
        fd.set("confirmPassword", "StrongP@ss123!");
        fd.set("recaptchaToken", "token_score_0.50");

        const result = await signUp(fd);

        assert.strictEqual(result.success, true, `signUp should succeed at boundary score 0.50, got error: ${result.error}`);
        assert.strictEqual(insertedIntoVrfy, true, "Registration verification record must be inserted into user_vrfy_tbl");
        assert.ok(globalQueryLog.length > 0, "Database must be queried upon passing reCAPTCHA check");
    });

    await runAdversarialTest("SEC-09.10: Alternate token field names (g-recaptcha-response, recaptcha_token) support", async () => {
        attachDbSpy();
        mockFetchState.recaptchaStatus = 200;
        mockFetchState.throwNetworkError = false;
        mockFetchState.recaptchaResult = { success: true, score: 0.85 };

        let insertedIntoVrfy = false;
        db.query = (async (sql: string, params?: unknown[]) => {
            globalQueryLog.push({ sql, params });
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
            if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
            if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
            if (sql.includes("INSERT INTO user_vrfy_tbl")) {
                insertedIntoVrfy = true;
                return [{ insertId: 802 }];
            }
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "alternate_field_user");
        fd.set("email", "altfield@quizweb.dev");
        fd.set("password", "StrongP@ss123!");
        fd.set("confirmPassword", "StrongP@ss123!");
        fd.set("g-recaptcha-response", "genuine_token_in_g_recaptcha_response_field");

        const result = await signUp(fd);

        assert.strictEqual(result.success, true, "signUp must recognize token in 'g-recaptcha-response'");
        assert.strictEqual(insertedIntoVrfy, true, "Verification record must be created");
    });

    // =========================================================================
    // SECTION 3: SEC-11 Safe Email Verification (/verify-email/[token])
    // =========================================================================
    console.log("\n\x1b[1m[SECTION 3: SEC-11 Safe Email Verification - Zero-Mutation GET & Explicit POST]\x1b[0m");

    await runAdversarialTest("SEC-11.1: Static audit - app/verify-email/[token]/page.tsx does NOT import verifyEmail", () => {
        const importsVerifyEmail = /import\s+.*verifyEmail.*from/.test(verifyPageSrc);
        assert.strictEqual(
            importsVerifyEmail,
            false,
            "SEC-11 VIOLATION: app/verify-email/[token]/page.tsx imports verifyEmail directly"
        );
    });

    await runAdversarialTest("SEC-11.2: Static audit - app/verify-email/[token]/page.tsx does NOT invoke verifyEmail", () => {
        assert.strictEqual(
            verifyPageSrc.includes("verifyEmail("),
            false,
            "SEC-11 VIOLATION: app/verify-email/[token]/page.tsx executes verifyEmail()"
        );
    });

    await runAdversarialTest("SEC-11.3: Static audit - app/verify-email/[token]/page.tsx contains NO db import or SQL queries", () => {
        assert.strictEqual(
            verifyPageSrc.includes("@/lib/db") || verifyPageSrc.includes("lib/db"),
            false,
            "SEC-11 VIOLATION: page.tsx imports db module"
        );
        const hasSqlKeywords = /SELECT|INSERT|UPDATE|DELETE/i.test(verifyPageSrc);
        assert.strictEqual(hasSqlKeywords, false, "SEC-11 VIOLATION: page.tsx contains SQL query strings");
    });

    await runAdversarialTest("SEC-11.4: Static audit - VerifyEmailClient has NO automated useEffect hook calling verifyEmail", () => {
        const hasUseEffect = verifyClientSrc.includes("useEffect");
        assert.strictEqual(
            hasUseEffect,
            false,
            "SEC-11 VIOLATION: VerifyEmailClient must not use useEffect to auto-trigger verification"
        );
    });

    await runAdversarialTest("SEC-11.5: Static audit - VerifyEmailClient requires user form submission with POST method", () => {
        assert.ok(
            verifyClientSrc.includes('method="POST"'),
            "SEC-11 REQUIREMENT: VerifyEmailClient confirmation form must specify method='POST'"
        );
        assert.ok(
            verifyClientSrc.includes('onSubmit={handleActivate}'),
            "SEC-11 REQUIREMENT: VerifyEmailClient form must bind submit handler"
        );
        assert.ok(
            verifyClientSrc.includes("Activate Account"),
            "SEC-11 REQUIREMENT: VerifyEmailClient must render an explicit 'Activate Account' button"
        );
    });

    await runAdversarialTest("SEC-11.6: Static audit - app/verify-email/[token]/layout.tsx imports verify.css properly", () => {
        assert.ok(
            verifyLayoutSrc.includes("verify.css"),
            "app/verify-email/[token]/layout.tsx must import verify.css"
        );
    });

    await runAdversarialTest("SEC-11.7: Simulated GET render of VerifyEmailPage executes ZERO database queries or mutations", async () => {
        attachDbSpy();

        interface VerifyPageModule {
            default?: (props: { params: Promise<{ token: string }> }) => Promise<unknown>;
        }

        const verifyPageMod = await import("../app/verify-email/[token]/page") as unknown as VerifyPageModule;
        const VerifyEmailPage = verifyPageMod.default;
        assert.ok(VerifyEmailPage, "VerifyEmailPage default export must exist");

        // Test with regular token
        const renderedNormal = await VerifyEmailPage({
            params: Promise.resolve({ token: "standard_probe_token_12345" }),
        });
        assert.ok(renderedNormal !== null && renderedNormal !== undefined, "VerifyEmailPage must render UI");

        // Test with SQL injection probe in token
        const renderedSqli = await VerifyEmailPage({
            params: Promise.resolve({ token: "' OR '1'='1' --" }),
        });
        assert.ok(renderedSqli !== null && renderedSqli !== undefined, "VerifyEmailPage must render UI with probe token");

        // Assert ZERO database queries of ANY kind (not even SELECT)
        assert.strictEqual(
            globalQueryLog.length,
            0,
            `SEC-11 VIOLATION: Rendering VerifyEmailPage on GET dispatched ${globalQueryLog.length} database queries! Queries: ${JSON.stringify(globalQueryLog)}`
        );
    });

    // =========================================================================
    // SECTION 4: Explicit POST Activation Logic in verifyEmail
    // =========================================================================
    console.log("\n\x1b[1m[SECTION 4: Explicit POST verifyEmail Server Action Verification]\x1b[0m");

    const verifyEmail = authActions.verifyEmail as (token: string) => Promise<{ success: boolean; message: string }>;
    assert.strictEqual(typeof verifyEmail, "function", "verifyEmail must be exported from app/actions/auth");

    await runAdversarialTest("SEC-11.8: Calling verifyEmail with empty/whitespace token returns invalid without DB access", async () => {
        attachDbSpy();

        const res1 = await verifyEmail("");
        assert.strictEqual(res1.success, false);

        const res2 = await verifyEmail("    ");
        assert.strictEqual(res2.success, false);

        const res3 = await verifyEmail(null as unknown as string);
        assert.strictEqual(res3.success, false);

        assert.strictEqual(
            globalQueryLog.length,
            0,
            "Calling verifyEmail with invalid token input must not touch database"
        );
    });

    await runAdversarialTest("SEC-11.9: Calling verifyEmail with non-existent token fails gracefully", async () => {
        globalQueryLog.length = 0;
        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[]]; // Token not found
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail("non_existent_token_hex_probe");
        assert.strictEqual(result.success, false);
        assert.ok(
            result.message.toLowerCase().includes("invalid") || result.message.toLowerCase().includes("already been used"),
            `Expected message regarding invalid/used token, got: ${result.message}`
        );
    });

    await runAdversarialTest("SEC-11.10: Calling verifyEmail with expired token cleans up record and fails", async () => {
        globalQueryLog.length = 0;
        let deleteTriggered = false;

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 99,
                        username: "expired_user",
                        email: "expired@quizweb.dev",
                        password_hash: "argon2_test_hash",
                        expires_at: new Date(Date.now() - 60000), // Expired 1 minute ago
                        attempts: 0,
                        locked_until: null,
                    }]];
                }
                if (sql.includes("DELETE FROM user_vrfy_tbl WHERE verify_id = ?")) {
                    deleteTriggered = true;
                    return [{ affectedRows: 1 }];
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail("expired_token_hex_probe");
        assert.strictEqual(result.success, false);
        assert.ok(result.message.toLowerCase().includes("expired"), `Expected expired message, got: ${result.message}`);
        assert.strictEqual(deleteTriggered, true, "Expired token record must be deleted from user_vrfy_tbl");
    });

    await runAdversarialTest("SEC-11.11: Calling verifyEmail with locked token (attempts >= 5) fails with lockout error", async () => {
        globalQueryLog.length = 0;

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 100,
                        username: "locked_user",
                        email: "locked@quizweb.dev",
                        password_hash: "argon2_test_hash",
                        expires_at: new Date(Date.now() + 600000),
                        attempts: 5, // Locked!
                        locked_until: null,
                    }]];
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail("locked_token_hex_probe");
        assert.strictEqual(result.success, false);
        assert.ok(result.message.toLowerCase().includes("locked"), `Expected locked message, got: ${result.message}`);
    });

    await runAdversarialTest("SEC-11.12: Calling verifyEmail with locked token (locked_until in future) fails with lockout error", async () => {
        globalQueryLog.length = 0;

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 101,
                        username: "locked_future_user",
                        email: "locked_future@quizweb.dev",
                        password_hash: "argon2_test_hash",
                        expires_at: new Date(Date.now() + 600000),
                        attempts: 2,
                        locked_until: new Date(Date.now() + 180000), // Locked until 3 minutes in future
                    }]];
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail("locked_until_future_token_probe");
        assert.strictEqual(result.success, false);
        assert.ok(result.message.toLowerCase().includes("locked"), `Expected locked message, got: ${result.message}`);
    });

    await runAdversarialTest("SEC-11.13: Calling verifyEmail when email already registered rolls back and fails", async () => {
        globalQueryLog.length = 0;
        let rollbackOccurred = false;

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 102,
                        username: "conflict_user",
                        email: "conflict@quizweb.dev",
                        password_hash: "argon2_test_hash",
                        expires_at: new Date(Date.now() + 600000),
                        attempts: 0,
                        locked_until: null,
                    }]];
                }
                if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ?")) {
                    return [[{ user_id: 42 }]]; // Email already exists!
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {
                rollbackOccurred = true;
            },
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail("conflict_email_token_probe");
        assert.strictEqual(result.success, false);
        assert.ok(result.message.toLowerCase().includes("already exists"), `Expected conflict message, got: ${result.message}`);
        assert.strictEqual(rollbackOccurred, true, "Transaction must rollback on existing email conflict");
    });

    await runAdversarialTest("SEC-11.14: Calling verifyEmail when username already taken rolls back and fails", async () => {
        globalQueryLog.length = 0;
        let rollbackOccurred = false;

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 103,
                        username: "existing_player",
                        email: "newemail@quizweb.dev",
                        password_hash: "argon2_test_hash",
                        expires_at: new Date(Date.now() + 600000),
                        attempts: 0,
                        locked_until: null,
                    }]];
                }
                if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ?")) {
                    return [[]]; // Email does not exist
                }
                if (sql.includes("SELECT user_id FROM player_tbl WHERE username = ?")) {
                    return [[{ user_id: 43 }]]; // Username already exists!
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {
                rollbackOccurred = true;
            },
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail("conflict_username_token_probe");
        assert.strictEqual(result.success, false);
        assert.ok(result.message.toLowerCase().includes("already taken"), `Expected username taken message, got: ${result.message}`);
        assert.strictEqual(rollbackOccurred, true, "Transaction must rollback on existing username conflict");
    });

    await runAdversarialTest("SEC-11.15: Valid explicit POST verifyEmail activates account, creates player, deletes token, commits", async () => {
        globalQueryLog.length = 0;
        let txBegun = false;
        let txCommitted = false;
        let authInserted = false;
        let playerInserted = false;
        let vrfyDeleted = false;

        const rawProbeToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const expectedHashedToken = crypto.createHash("sha256").update(rawProbeToken).digest("hex");

        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    assert.strictEqual(
                        (params as unknown[])?.[0],
                        expectedHashedToken,
                        "Token looked up in user_vrfy_tbl must be the SHA-256 hash of the raw token"
                    );
                    return [[{
                        verify_id: 555,
                        username: "legitimate_new_user",
                        email: "legit@quizweb.dev",
                        password_hash: "argon2_valid_hash_string",
                        expires_at: new Date(Date.now() + 600000),
                        attempts: 0,
                        locked_until: null,
                    }]];
                }
                if (sql.includes("SELECT user_id FROM user_auth_tbl WHERE email = ?")) return [[]];
                if (sql.includes("SELECT user_id FROM player_tbl WHERE username = ?")) return [[]];
                if (sql.includes("INSERT INTO user_auth_tbl")) {
                    authInserted = true;
                    return [{ insertId: 999 }];
                }
                if (sql.includes("INSERT INTO player_tbl")) {
                    playerInserted = true;
                    return [{ affectedRows: 1 }];
                }
                if (sql.includes("DELETE FROM user_vrfy_tbl WHERE verify_id = ?")) {
                    vrfyDeleted = true;
                    return [{ affectedRows: 1 }];
                }
                return [[]];
            },
            beginTransaction: async () => {
                txBegun = true;
            },
            commit: async () => {
                txCommitted = true;
            },
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const result = await verifyEmail(rawProbeToken);

        assert.strictEqual(result.success, true, "Valid explicit POST verifyEmail must succeed");
        assert.strictEqual(txBegun, true, "Transaction must begin");
        assert.strictEqual(authInserted, true, "User must be inserted into user_auth_tbl");
        assert.strictEqual(playerInserted, true, "Player profile must be inserted into player_tbl");
        assert.strictEqual(vrfyDeleted, true, "Verification token record must be deleted from user_vrfy_tbl");
        assert.strictEqual(txCommitted, true, "Transaction must be committed");
    });

    await runAdversarialTest("SEC-11.16: Token replay attack - second invocation fails because token is consumed", async () => {
        // After first verification deletes the token, a second call with identical token returns empty rows
        globalQueryLog.length = 0;
        db.getConnection = (async () => ({
            query: async (sql: string, params?: unknown[]) => {
                globalQueryLog.push({ sql, params });
                if (sql.includes("SELECT verify_id")) {
                    return [[]]; // Token was already deleted
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const rawProbeToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const replayResult = await verifyEmail(rawProbeToken);

        assert.strictEqual(replayResult.success, false, "Replay attack must fail");
        assert.ok(
            replayResult.message.toLowerCase().includes("invalid") || replayResult.message.toLowerCase().includes("already been used"),
            `Replay must be rejected: ${replayResult.message}`
        );
    });

    // =========================================================================
    // SECTION 5: Summary & ASVS Compliance Assessment
    // =========================================================================
    console.log("\n================================================================================");
    console.log(` Adversarial Test Execution Summary: ${passedTests}/${totalTests} Passed`);

    if (failedTests > 0) {
        console.error(` \x1b[31mStatus: ADVERSARIAL CHALLENGES FAILED (${failedTests} failures)\x1b[0m`);
        for (const failure of failureDetails) {
            console.error(`   - ${failure}`);
        }
        console.log("================================================================================\n");
        process.exit(1);
    } else {
        console.log(" \x1b[32mStatus: ALL ADVERSARIAL CHALLENGES PASSED (0 defects found)\x1b[0m");
        console.log(" OWASP ASVS v4.0.3 Chapter 3 & Cross-Chapter Verification:");
        console.log("   - V3.1.1 (GET State Mutation Elimination): VERIFIED (0 DB queries on GET render)");
        console.log("   - V2.2.1 / V11.1.4 (reCAPTCHA Anti-Bot Enforcement): VERIFIED (server-side, 0 DB queries on missing/invalid/bot)");
        console.log("   - V13.1.4 (RPC Attack Surface Reduction): VERIFIED (clearLoginRateLimit export eliminated)");
        console.log("   - V13.2.1 (Explicit POST Account Activation): VERIFIED (user form submit, token consumed)");
        console.log("================================================================================\n");
        process.exit(0);
    }
}

runAllChallengerTests().catch((err) => {
    console.error("Fatal exception in challenger test harness:", err);
    process.exit(1);
});
