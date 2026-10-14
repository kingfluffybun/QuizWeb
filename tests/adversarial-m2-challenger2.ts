/**
 * =============================================================================
 * Milestone 2 Adversarial Stress Suite: tests/adversarial-m2-challenger2.ts
 * =============================================================================
 * Agent: Challenger 2 (critic, specialist)
 * Targets:
 *   - SEC-03: Route Protection Middleware & Admin Mutation Access Control
 *   - SEC-06: RPC Surface Reduction (Removal of clearLoginRateLimit)
 *   - SEC-09: Server-Side Google reCAPTCHA v3 Anti-Bot Enforcement in signUp
 *   - SEC-11: HTTP Semantics & Zero-Mutation GET Idempotency in Email Verification
 *
 * Compliance:
 *   - OWASP ASVS v4.0.3: V2.2.1, V3.1.1, V4.1.1, V4.1.2, V4.1.3, V4.2.1, V11.1.4, V13.1.4, V13.2.1
 *
 * Execution:
 *   npx --yes tsx tests/adversarial-m2-challenger2.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { createRequire } from "node:module";
import type { NextRequest } from "next/server";

// -----------------------------------------------------------------------------
// Environment & Module Setup
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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m2_adversarial";
process.env.RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "test_recaptcha_secret_key_6LeIxAcTAAAAAGG";
process.env.RECAPTCHA_BYPASS_TOKEN = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";

// Patch next/headers
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
    // Ignore fallback
}

// -----------------------------------------------------------------------------
// Fetch Mocking Harness
// -----------------------------------------------------------------------------
interface MockFetchConfig {
    recaptchaStatus: number;
    recaptchaBody: Record<string, unknown> | null;
    recaptchaThrowError?: boolean;
    capturedRecaptchaRequests: { url: string; body: string }[];
    capturedEmails: Record<string, unknown>[];
}

const mockFetchConfig: MockFetchConfig = {
    recaptchaStatus: 200,
    recaptchaBody: { success: true, score: 0.9 },
    capturedRecaptchaRequests: [],
    capturedEmails: [],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);

    if (url.includes("google.com/recaptcha/api/siteverify")) {
        mockFetchConfig.capturedRecaptchaRequests.push({
            url,
            body: String(init?.body || ""),
        });

        if (mockFetchConfig.recaptchaThrowError) {
            throw new TypeError("fetch failed: connection reset by peer (mocked Google outage)");
        }

        return new Response(JSON.stringify(mockFetchConfig.recaptchaBody), {
            status: mockFetchConfig.recaptchaStatus,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (url.includes("api.resend.com")) {
        let bodyObj: Record<string, unknown> = {};
        if (init?.body) {
            try {
                bodyObj = JSON.parse(String(init.body)) as Record<string, unknown>;
            } catch {
                bodyObj = { raw: String(init.body) };
            }
        }
        mockFetchConfig.capturedEmails.push(bodyObj);
        return new Response(JSON.stringify({ id: "mock_resend_email_" + Date.now() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    return originalFetch(input, init);
};

// -----------------------------------------------------------------------------
// Test Runner State
// -----------------------------------------------------------------------------
let passedCount = 0;
let failedCount = 0;
const testRecords: { name: string; pass: boolean; error?: string }[] = [];

async function challenge(name: string, fn: () => void | Promise<void>) {
    try {
        await fn();
        passedCount++;
        testRecords.push({ name, pass: true });
        console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name}`);
    } catch (err: unknown) {
        failedCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        testRecords.push({ name, pass: false, error: errMsg });
        console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}`);
        console.error(`    \x1b[31mReason:\x1b[0m ${errMsg}`);
    }
}

// -----------------------------------------------------------------------------
// Database Query Interceptor & Mutation Tracker
// -----------------------------------------------------------------------------
interface DbTraceRecord {
    sql: string;
    params?: unknown[];
    isMutation: boolean;
}

const dbTraceLog: DbTraceRecord[] = [];

function clearDbTrace() {
    dbTraceLog.length = 0;
}

function countDbQueries(typeFilter?: "ALL" | "MUTATION" | "SELECT"): number {
    if (!typeFilter || typeFilter === "ALL") return dbTraceLog.length;
    if (typeFilter === "MUTATION") return dbTraceLog.filter(q => q.isMutation).length;
    if (typeFilter === "SELECT") return dbTraceLog.filter(q => !q.isMutation).length;
    return 0;
}

// -----------------------------------------------------------------------------
// Main Adversarial Test Program
// -----------------------------------------------------------------------------
async function runAdversarialAudit() {
    console.log("\n========================================================");
    console.log(" Milestone 2 Adversarial Challenge & Empirical Verification");
    console.log(" Agent: Challenger 2 (critic, specialist)");
    console.log(" Targets: SEC-03, SEC-06, SEC-09, SEC-11");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3, V2.2.1, V11.1.4, V13.2.1");
    console.log("========================================================\n");

    const { NextRequest } = await import("next/server");
    const { encode } = await import("next-auth/jwt");

    // Dynamic import of database module
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
    const dbMod = await import("../lib/db") as unknown as { db?: MockDbPool; default?: { db: MockDbPool } };
    const db = (dbMod.db || dbMod.default?.db) as MockDbPool;

    // Track all queries executed on db
    const traceQuery = (sql: string, params?: unknown[]) => {
        const isMutation = /INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE/i.test(sql);
        dbTraceLog.push({ sql, params, isMutation });
    };

    // -------------------------------------------------------------------------
    // VECTOR 1: RPC SURFACE REDUCTION & RATE LIMIT TAMPERING (SEC-06)
    // -------------------------------------------------------------------------
    console.log("\x1b[1m[Vector 1: RPC Surface Reduction & Rate Limit Protection (SEC-06)]\x1b[0m");

    const authActionsPath = path.join(projectRoot, "app/actions/auth.ts");
    const authActionsSource = fs.readFileSync(authActionsPath, "utf8");
    const authModule = await import("../app/actions/auth") as Record<string, unknown>;

    await challenge("V1.1: clearLoginRateLimit is completely unexported dynamically", () => {
        const exportedKeys = Object.keys(authModule);
        assert.strictEqual(
            exportedKeys.includes("clearLoginRateLimit"),
            false,
            `SEC-06 CRITICAL: clearLoginRateLimit is exported in app/actions/auth! Keys: [${exportedKeys.join(", ")}]`
        );
        assert.strictEqual(
            (authModule as Record<string, unknown>).clearLoginRateLimit,
            undefined,
            "SEC-06 CRITICAL: clearLoginRateLimit must be undefined on auth module"
        );
    });

    await challenge("V1.2: Static regex confirms absence of export declarations for clearLoginRateLimit", () => {
        assert.ok(
            !/export\s+(async\s+)?function\s+clearLoginRateLimit\b/.test(authActionsSource),
            "Found 'export async function clearLoginRateLimit' in app/actions/auth.ts"
        );
        assert.ok(
            !/export\s*\{[^}]*\bclearLoginRateLimit\b[^}]*\}/.test(authActionsSource),
            "Found clearLoginRateLimit in export {} block in app/actions/auth.ts"
        );
    });

    await challenge("V1.3: Static audit confirms no client files call clearLoginRateLimit", () => {
        const appDir = path.join(projectRoot, "app");
        const scanDir = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile() && /\.(tsx|ts|jsx|js)$/.test(entry.name)) {
                    const content = fs.readFileSync(fullPath, "utf8");
                    assert.ok(
                        !content.includes("clearLoginRateLimit"),
                        `Client or route file ${fullPath} still invokes or references clearLoginRateLimit`
                    );
                }
            }
        };
        scanDir(appDir);
    });

    await challenge("V1.4: Direct unauthenticated RPC invocation attempt is impossible", () => {
        const maybeFn = (authModule as Record<string, unknown>).clearLoginRateLimit;
        assert.throws(
            () => {
                if (typeof maybeFn === "function") {
                    maybeFn("victim@quizweb.dev");
                } else {
                    throw new TypeError("clearLoginRateLimit is not a function");
                }
            },
            /is not a function/,
            "clearLoginRateLimit must not be callable"
        );
    });

    await challenge("V1.5: Internal rate-limiting clearing is exclusively called inside authorized credentials flow", () => {
        const authConfigSrc = fs.readFileSync(path.join(projectRoot, "auth.ts"), "utf8");
        // Verify clearRateLimit is called only after argon2.verify succeeds
        assert.ok(
            authConfigSrc.includes("clearRateLimit"),
            "auth.ts should use internal clearRateLimit upon successful login"
        );
        const argonPos = authConfigSrc.indexOf("argon2.verify");
        const clearPos = authConfigSrc.indexOf("clearRateLimit");
        assert.ok(argonPos !== -1 && clearPos !== -1 && argonPos < clearPos,
            "clearRateLimit must occur strictly AFTER argon2.verify in auth.ts"
        );
    });

    // -------------------------------------------------------------------------
    // VECTOR 2: SERVER-SIDE GOOGLE RECAPTCHA V3 ADVERSARIAL STRESS (SEC-09)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Vector 2: Server-Side Google reCAPTCHA v3 Anti-Bot Stress (SEC-09)]\x1b[0m");

    const signUp = authModule.signUp as (formData: FormData) => Promise<{ success?: boolean; error?: string }>;

    // Setup DB proxy to track all queries
    db.query = (async (sql: string, params?: unknown[]) => {
        traceQuery(sql, params);
        if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
        if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
        if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
        if (sql.includes("INSERT INTO user_vrfy_tbl")) return [{ insertId: 9001 }];
        return [[]];
    }) as typeof db.query;

    const createSignupForm = (token?: string | null, customEmail?: string) => {
        const fd = new FormData();
        fd.set("username", "testbot_" + Math.random().toString(36).substring(7));
        fd.set("email", customEmail || `bot_${Date.now()}@quizweb.dev`);
        fd.set("password", "SecureBotP@ssw0rd123!");
        fd.set("confirmPassword", "SecureBotP@ssw0rd123!");
        if (token !== undefined && token !== null) {
            fd.set("recaptchaToken", token);
        }
        return fd;
    };

    await challenge("V2.1: Completely missing reCAPTCHA token is rejected with ZERO DB queries", async () => {
        clearDbTrace();
        mockFetchConfig.recaptchaStatus = 200;
        mockFetchConfig.recaptchaBody = { success: true, score: 0.9 };

        const fd = createSignupForm(null); // Omit token completely
        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "Missing reCAPTCHA token must fail");
        assert.ok(
            result.error?.toLowerCase().includes("recaptcha"),
            `Error message must indicate reCAPTCHA failure, got: ${result.error}`
        );
        assert.strictEqual(
            countDbQueries("ALL"),
            0,
            `SEC-09 VIOLATION: ${countDbQueries("ALL")} DB queries were executed before reCAPTCHA token check!`
        );
    });

    await challenge("V2.2: Empty and whitespace-only reCAPTCHA tokens are rejected with ZERO DB queries", async () => {
        const blankTokens = ["", "   ", "\t\t", "\n\r  \n"];
        for (const token of blankTokens) {
            clearDbTrace();
            const fd = createSignupForm(token);
            const result = await signUp(fd);

            assert.strictEqual(result.success !== true, true, `Blank token '${token}' must fail`);
            assert.strictEqual(
                countDbQueries("ALL"),
                0,
                `SEC-09 VIOLATION: DB queries executed on blank token '${token}'`
            );
        }
    });

    await challenge("V2.3: Spoofed / untrusted token returning Google failure is rejected with ZERO DB queries", async () => {
        clearDbTrace();
        mockFetchConfig.recaptchaStatus = 200;
        mockFetchConfig.recaptchaBody = {
            success: false,
            "error-codes": ["invalid-input-response", "timeout-or-duplicate"],
        };

        const fd = createSignupForm("attacker_spoofed_jwt_token_payload");
        const result = await signUp(fd);

        assert.strictEqual(result.success !== true, true, "Spoofed token must fail");
        assert.ok(result.error?.toLowerCase().includes("recaptcha"));
        assert.strictEqual(
            countDbQueries("ALL"),
            0,
            `SEC-09 VIOLATION: DB queries executed when Google siteverify returned success=false`
        );
    });

    await challenge("V2.4: Bot low-score tokens (0.0, 0.1, 0.3, 0.49, 0.4999) rejected with ZERO DB queries", async () => {
        const botScores = [0.0, 0.1, 0.25, 0.4, 0.49, 0.4999];

        for (const score of botScores) {
            clearDbTrace();
            mockFetchConfig.recaptchaStatus = 200;
            mockFetchConfig.recaptchaBody = { success: true, score };

            const fd = createSignupForm(`token_score_${score}`);
            const result = await signUp(fd);

            assert.strictEqual(
                result.success !== true,
                true,
                `Bot score ${score} (< 0.5) must be rejected`
            );
            assert.strictEqual(
                countDbQueries("ALL"),
                0,
                `SEC-09 VIOLATION: Database queries dispatched on bot score ${score}`
            );
        }
    });

    await challenge("V2.5: Legitimate human scores (0.5 exact boundary, 0.7, 0.9, 1.0) proceed to database", async () => {
        const humanScores = [0.5, 0.75, 0.9, 1.0];

        for (const score of humanScores) {
            clearDbTrace();
            mockFetchConfig.recaptchaStatus = 200;
            mockFetchConfig.recaptchaBody = { success: true, score };

            const fd = createSignupForm(`token_score_${score}`);
            const result = await signUp(fd);

            assert.strictEqual(
                result.success,
                true,
                `Human score ${score} (>= 0.5) must succeed`
            );
            assert.ok(
                countDbQueries("MUTATION") > 0,
                `Database INSERT into user_vrfy_tbl must occur for verified human score ${score}`
            );
        }
    });

    await challenge("V2.6: Google siteverify network error / outage fails CLOSED with ZERO DB queries", async () => {
        // Test 1: HTTP 500 error from Google
        clearDbTrace();
        mockFetchConfig.recaptchaStatus = 500;
        mockFetchConfig.recaptchaBody = null;
        mockFetchConfig.recaptchaThrowError = false;

        let fd = createSignupForm("token_google_500");
        let result = await signUp(fd);
        assert.strictEqual(result.success !== true, true, "HTTP 500 from Google must fail-closed");
        assert.strictEqual(countDbQueries("ALL"), 0, "No DB operations allowed during Google 500 outage");

        // Test 2: Network fetch exception (DNS failure / timeout)
        clearDbTrace();
        mockFetchConfig.recaptchaThrowError = true;

        fd = createSignupForm("token_google_timeout");
        result = await signUp(fd);
        assert.strictEqual(result.success !== true, true, "Network exception must fail-closed");
        assert.strictEqual(countDbQueries("ALL"), 0, "No DB operations allowed during network exception");

        // Reset fetch state
        mockFetchConfig.recaptchaThrowError = false;
        mockFetchConfig.recaptchaStatus = 200;
        mockFetchConfig.recaptchaBody = { success: true, score: 0.9 };
    });

    await challenge("V2.7: Alternative reCAPTCHA form parameter names (recaptcha_token, g-recaptcha-response)", async () => {
        mockFetchConfig.recaptchaStatus = 200;
        mockFetchConfig.recaptchaBody = { success: true, score: 0.9 };

        // Test with recaptcha_token
        clearDbTrace();
        const fd1 = new FormData();
        fd1.set("username", "alt_user_1");
        fd1.set("email", "alt1@quizweb.dev");
        fd1.set("password", "AltPassword123!");
        fd1.set("confirmPassword", "AltPassword123!");
        fd1.set("recaptcha_token", "token_recaptcha_underscore");
        const res1 = await signUp(fd1);
        assert.strictEqual(res1.success, true, "recaptcha_token form field should be accepted");

        // Test with g-recaptcha-response
        clearDbTrace();
        const fd2 = new FormData();
        fd2.set("username", "alt_user_2");
        fd2.set("email", "alt2@quizweb.dev");
        fd2.set("password", "AltPassword123!");
        fd2.set("confirmPassword", "AltPassword123!");
        fd2.set("g-recaptcha-response", "token_g_recaptcha_response");
        const res2 = await signUp(fd2);
        assert.strictEqual(res2.success, true, "g-recaptcha-response form field should be accepted");
    });

    // -------------------------------------------------------------------------
    // VECTOR 3: EMAIL VERIFICATION HTTP GET IDEMPOTENCY & POST ACTIVATION (SEC-11)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Vector 3: Email Verification HTTP GET Idempotency & POST Activation (SEC-11)]\x1b[0m");

    const verifyPageModule = await import("../app/verify-email/[token]/page") as {
        default?: (props: { params: Promise<{ token: string }> }) => Promise<unknown>;
    };
    const VerifyEmailPage = verifyPageModule.default;
    assert.ok(VerifyEmailPage, "VerifyEmailPage default export must exist");

    const verifyEmail = authModule.verifyEmail as (token: string) => Promise<{ success: boolean; message?: string }>;

    // Simulated verification database
    interface VerificationRecord {
        verify_id: number;
        username: string;
        email: string;
        password_hash: string;
        expires_at: Date;
        attempts: number;
        locked_until: Date | null;
    }

    const testRawToken = "crawlers_cannot_mutate_db_token_hex_9999999999999999";
    const testHashedToken = (await import("crypto")).createHash("sha256").update(testRawToken).digest("hex");

    const mockVrfyTable: Map<string, VerificationRecord> = new Map();
    const mockAuthTable: Map<string, { user_id: number; email: string }> = new Map();
    const mockPlayerTable: Map<number, { user_id: number; username: string }> = new Map();

    const resetMockTables = () => {
        mockVrfyTable.clear();
        mockAuthTable.clear();
        mockPlayerTable.clear();

        mockVrfyTable.set(testHashedToken, {
            verify_id: 101,
            username: "crawler_target_user",
            email: "crawler_target@quizweb.dev",
            password_hash: "argon2id_mock_hash",
            expires_at: new Date(Date.now() + 1000 * 60 * 15),
            attempts: 0,
            locked_until: null,
        });
    };

    resetMockTables();

    // Mock DB Pool & Connection for verifyEmail
    db.getConnection = (async () => {
        return {
            query: async (sql: string, params?: unknown[]) => {
                traceQuery(sql, params);

                if (sql.includes("SELECT verify_id")) {
                    const tokenParam = String(params?.[0] || "");
                    const record = mockVrfyTable.get(tokenParam);
                    return record ? [[record]] : [[]];
                }

                if (sql.includes("SELECT user_id FROM user_auth_tbl")) {
                    const emailParam = String(params?.[0] || "");
                    const record = mockAuthTable.get(emailParam);
                    return record ? [[record]] : [[]];
                }

                if (sql.includes("SELECT user_id FROM player_tbl")) {
                    return [[]];
                }

                if (sql.includes("INSERT INTO user_auth_tbl")) {
                    const email = String(params?.[0] || "");
                    const newId = 2001;
                    mockAuthTable.set(email, { user_id: newId, email });
                    return [{ insertId: newId }];
                }

                if (sql.includes("INSERT INTO player_tbl")) {
                    const uid = Number(params?.[0] || 2001);
                    const uname = String(params?.[1] || "player");
                    mockPlayerTable.set(uid, { user_id: uid, username: uname });
                    return [{ affectedRows: 1 }];
                }

                if (sql.includes("DELETE FROM user_vrfy_tbl")) {
                    const verifyId = Number(params?.[0] || 0);
                    for (const [key, val] of mockVrfyTable.entries()) {
                        if (val.verify_id === verifyId) {
                            mockVrfyTable.delete(key);
                            break;
                        }
                    }
                    return [{ affectedRows: 1 }];
                }

                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        };
    }) as typeof db.getConnection;

    await challenge("V3.1: 10 repeated crawler GET requests execute ZERO database mutations", async () => {
        clearDbTrace();
        const initialVrfyCount = mockVrfyTable.size;
        const initialAuthCount = mockAuthTable.size;

        for (let i = 1; i <= 10; i++) {
            const pageResult = await VerifyEmailPage({
                params: Promise.resolve({ token: testRawToken }),
            });
            assert.ok(pageResult !== null && pageResult !== undefined, `Crawler GET #${i} must render page component`);
        }

        assert.strictEqual(
            countDbQueries("MUTATION"),
            0,
            `SEC-11 VIOLATION: ${countDbQueries("MUTATION")} database mutations occurred during crawler GET requests!`
        );
        assert.strictEqual(
            countDbQueries("ALL"),
            0,
            `SEC-11 VIOLATION: ${countDbQueries("ALL")} database reads/writes occurred during crawler GET requests!`
        );
        assert.strictEqual(mockVrfyTable.size, initialVrfyCount, "user_vrfy_tbl must not be modified by crawler GETs");
        assert.strictEqual(mockAuthTable.size, initialAuthCount, "user_auth_tbl must not be modified by crawler GETs");
    });

    await challenge("V3.2: Explicit user-initiated POST activation completes account registration", async () => {
        clearDbTrace();

        const result = await verifyEmail(testRawToken);
        assert.strictEqual(result.success, true, "Explicit user POST activation must succeed");
        assert.strictEqual(
            countDbQueries("MUTATION") >= 2,
            true,
            "Explicit POST must execute database mutations (INSERT into auth/player, DELETE from vrfy)"
        );
        assert.strictEqual(mockAuthTable.has("crawler_target@quizweb.dev"), true, "User must be created in user_auth_tbl");
        assert.strictEqual(mockVrfyTable.has(testHashedToken), false, "Verification token must be removed from user_vrfy_tbl");
    });

    await challenge("V3.3: Replay attack with consumed verification token is strictly rejected", async () => {
        clearDbTrace();

        // Attempt to replay the exact same token via POST
        const replayResult = await verifyEmail(testRawToken);
        assert.strictEqual(replayResult.success, false, "Consumed token must not activate account again");
        assert.ok(
            replayResult.message?.toLowerCase().includes("invalid") || replayResult.message?.toLowerCase().includes("used"),
            `Message must report token used or invalid: ${replayResult.message}`
        );
        assert.strictEqual(
            countDbQueries("MUTATION"),
            0,
            "No state mutations may occur when replaying a consumed token"
        );
    });

    await challenge("V3.4: Static code audit of app/verify-email/[token]/page.tsx confirms zero DB mutations", () => {
        const pageSrc = fs.readFileSync(path.join(projectRoot, "app/verify-email/[token]/page.tsx"), "utf8");
        assert.ok(
            !pageSrc.includes("verifyEmail("),
            "app/verify-email/[token]/page.tsx must not call verifyEmail"
        );
        assert.ok(
            !pageSrc.includes("db.query"),
            "app/verify-email/[token]/page.tsx must not directly query database"
        );
        assert.ok(
            pageSrc.includes("VerifyEmailClient"),
            "app/verify-email/[token]/page.tsx must delegate to VerifyEmailClient"
        );
    });

    // -------------------------------------------------------------------------
    // VECTOR 4: ROUTE PROTECTION MIDDLEWARE & ADMIN ACTIONS AUTHORIZATION (SEC-03)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Vector 4: Route Protection Middleware & Action Authorization (SEC-03)]\x1b[0m");

    type MiddlewareHandler = (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>;
    const mwModule = await import("../middleware") as unknown as { default?: MiddlewareHandler; middleware?: MiddlewareHandler };
    const middlewareFn = mwModule.default || mwModule.middleware;
    assert.ok(middlewareFn, "middleware function must be exported");

    const testRouteAccess = async (pathname: string, sessionCookie?: string, headersInit?: HeadersInit) => {
        const headers = new Headers(headersInit || {});
        if (sessionCookie) {
            headers.set("cookie", sessionCookie);
        }
        const req = new NextRequest(`https://localhost:3000${pathname}`, { headers });
        return await middlewareFn(req, {});
    };

    const adminJwt = await encode({
        token: { id: "1", role: "admin", user_role: "admin", email: "admin@quizweb.dev" },
        secret: process.env.AUTH_SECRET!,
        salt: "authjs.session-token",
    });
    const userJwt = await encode({
        token: { id: "2", role: "user", user_role: "user", email: "user@quizweb.dev" },
        secret: process.env.AUTH_SECRET!,
        salt: "authjs.session-token",
    });

    const adminCookie = `authjs.session-token=${adminJwt}`;
    const userCookie = `authjs.session-token=${userJwt}`;

    const protectedPaths = [
        "/pending",
        "/pending/",
        "/pending/123",
        "/pending/quiz/approve",
        "/input",
        "/input/",
        "/input/create",
        "/input/unit/456",
    ];

    await challenge("V4.1: Unauthenticated requests to all protected /pending/* and /input/* routes redirect to /login", async () => {
        for (const p of protectedPaths) {
            const res = await testRouteAccess(p);
            assert.ok(
                res.status === 302 || res.status === 307,
                `Expected redirect (302/307) for unauthenticated ${p}, got ${res.status}`
            );
            const loc = res.headers.get("location") || "";
            assert.ok(loc.includes("/login"), `Redirect for ${p} must lead to /login, got ${loc}`);
            assert.ok(loc.includes("callbackUrl"), `Redirect for ${p} must contain callbackUrl`);
        }
    });

    await challenge("V4.2: Non-admin users are strictly blocked from /pending/* and /input/* (403 or redirect /home)", async () => {
        for (const p of protectedPaths) {
            // HTML navigation
            const resHtml = await testRouteAccess(p, userCookie);
            assert.ok(
                resHtml.status === 302 || resHtml.status === 307 || resHtml.status === 403,
                `Expected non-admin blocked for ${p}, got ${resHtml.status}`
            );
            if (resHtml.status === 302 || resHtml.status === 307) {
                const loc = resHtml.headers.get("location") || "";
                assert.ok(loc.includes("/home"), `Non-admin redirect must lead to /home, got ${loc}`);
            }

            // JSON API navigation
            const resJson = await testRouteAccess(p, userCookie, { accept: "application/json" });
            assert.strictEqual(resJson.status, 403, `Non-admin JSON request to ${p} must return HTTP 403`);
        }
    });

    await challenge("V4.3: Admin users pass through successfully to /pending/* and /input/*", async () => {
        for (const p of protectedPaths) {
            const res = await testRouteAccess(p, adminCookie);
            assert.strictEqual(
                res.status,
                200,
                `Admin user should be permitted through on ${p}, got status ${res.status}`
            );
        }
    });

    await challenge("V4.4: Public routes pass through without authentication barrier", async () => {
        const publicPaths = ["/", "/home", "/login", "/quizzes", "/quizzes/77", "/about"];
        for (const p of publicPaths) {
            const res = await testRouteAccess(p);
            assert.strictEqual(
                res.status,
                200,
                `Public route ${p} must pass through with status 200, got ${res.status}`
            );
        }
    });

    // Admin Mutation Actions (app/actions/quiz.ts)
    console.log("\n\x1b[1m[Vector 4.5: Defense-in-Depth Authorization for All 10 Mutation Actions]\x1b[0m");

    interface QuizMutationActionDef {
        name: string;
        invoke: () => Promise<unknown>;
    }

    const quizActionsMod = await import("../app/actions/quiz") as Record<string, unknown>;
    const dummyFormData = new FormData();
    dummyFormData.set("title", "Adversarial Quiz");
    dummyFormData.set("unit_id", "1");
    dummyFormData.set("difficulty", "medium");

    const tenMutationActions: QuizMutationActionDef[] = [
        { name: "deleteUnit", invoke: () => (quizActionsMod.deleteUnit as (id: number) => Promise<unknown>)(99) },
        { name: "createQuiz", invoke: () => (quizActionsMod.createQuiz as (s: unknown, f: FormData) => Promise<unknown>)({}, dummyFormData) },
        { name: "deleteQuiz", invoke: () => (quizActionsMod.deleteQuiz as (id: number) => Promise<unknown>)(99) },
        { name: "updateQuiz", invoke: () => (quizActionsMod.updateQuiz as (id: number, f: FormData) => Promise<unknown>)(99, dummyFormData) },
        { name: "reviewPendingQuiz", invoke: () => (quizActionsMod.reviewPendingQuiz as (id: number, d: "approve" | "reject") => Promise<unknown>)(99, "approve") },
        { name: "updatePendingQuiz", invoke: () => (quizActionsMod.updatePendingQuiz as (id: number, q: string) => Promise<unknown>)(99, "new question") },
        { name: "updatePendingNote", invoke: () => (quizActionsMod.updatePendingNote as (id: number, n: string) => Promise<unknown>)(99, "new note") },
        { name: "updatePendingQuizFromForm", invoke: () => (quizActionsMod.updatePendingQuizFromForm as (id: number, f: FormData) => Promise<unknown>)(99, dummyFormData) },
        { name: "updatePendingUnitFromForm", invoke: () => (quizActionsMod.updatePendingUnitFromForm as (id: number, f: FormData) => Promise<unknown>)(99, dummyFormData) },
        { name: "deletePendingQuiz", invoke: () => (quizActionsMod.deletePendingQuiz as (id: number) => Promise<unknown>)(99) },
    ];

    interface TestGlobalSession {
        __TEST_AUTH_SESSION__?: { user?: { id: string; role: string; user_role: string } } | null;
    }
    const testGlobals = globalThis as unknown as TestGlobalSession;

    for (const action of tenMutationActions) {
        await challenge(`V4.5.${action.name}: Unauthenticated call rejected with ZERO DB mutations`, async () => {
            testGlobals.__TEST_AUTH_SESSION__ = null;
            clearDbTrace();

            let threw = false;
            let result: unknown = null;
            try {
                result = await action.invoke();
            } catch (err: unknown) {
                threw = true;
                const msg = err instanceof Error ? err.message : String(err);
                assert.ok(msg.toLowerCase().includes("unauthor") || msg.toLowerCase().includes("admin"));
            }

            if (!threw) {
                const resObj = result as { error?: string; success?: boolean };
                assert.ok(
                    resObj && (resObj.error?.toLowerCase().includes("unauthor") || resObj.success === false),
                    `Expected unauthorized error object, received: ${JSON.stringify(result)}`
                );
            }

            assert.strictEqual(
                countDbQueries("MUTATION"),
                0,
                `SEC-03 VIOLATION: Mutation query occurred on unauthenticated ${action.name}!`
            );
        });

        await challenge(`V4.5.${action.name}: Non-admin user call rejected with ZERO DB mutations`, async () => {
            testGlobals.__TEST_AUTH_SESSION__ = { user: { id: "55", role: "user", user_role: "user" } };
            clearDbTrace();

            let threw = false;
            let result: unknown = null;
            try {
                result = await action.invoke();
            } catch (err: unknown) {
                threw = true;
                const msg = err instanceof Error ? err.message : String(err);
                assert.ok(msg.toLowerCase().includes("unauthor") || msg.toLowerCase().includes("admin"));
            }

            if (!threw) {
                const resObj = result as { error?: string; success?: boolean };
                assert.ok(
                    resObj && (resObj.error?.toLowerCase().includes("unauthor") || resObj.success === false),
                    `Expected unauthorized error object for non-admin on ${action.name}, received: ${JSON.stringify(result)}`
                );
            }

            assert.strictEqual(
                countDbQueries("MUTATION"),
                0,
                `SEC-03 VIOLATION: Mutation query occurred on non-admin ${action.name}!`
            );
        });
    }

    // -------------------------------------------------------------------------
    // VECTOR 5: OWASP ASVS v4.0.3 CHAPTER 3 & RELATED STANDARDS MATRIX
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Vector 5: OWASP ASVS v4.0.3 Compliance Matrix Audit]\x1b[0m");

    await challenge("V5.1: OWASP ASVS V2.2.1 (Anti-Automation on Registration) Compliance", () => {
        // Enforced strictly server-side in signUp via verifyRecaptchaToken before DB queries
        assert.ok(authActionsSource.includes("verifyRecaptchaToken"), "signUp must enforce server-side bot verification");
        assert.ok(authActionsSource.includes("reCAPTCHA verification failed"), "signUp must reject failed CAPTCHA");
    });

    await challenge("V5.2: OWASP ASVS V3.1.1 & V13.2.1 (Safe GET & Explicit POST Activation) Compliance", () => {
        // GET does not mutate state; POST activates account
        const verifySrc = fs.readFileSync(path.join(projectRoot, "app/verify-email/[token]/page.tsx"), "utf8");
        assert.ok(!verifySrc.includes("verifyEmail("), "Verify page component must not mutate state on GET");
        const clientSrc = fs.readFileSync(path.join(projectRoot, "app/verify-email/[token]/VerifyEmailClient.tsx"), "utf8");
        assert.ok(clientSrc.includes("verifyEmail(token)"), "Verify client must execute verifyEmail on explicit submission");
    });

    await challenge("V5.3: OWASP ASVS V4.1.2 & V13.1.4 (RPC Attack Surface Reduction) Compliance", () => {
        // clearLoginRateLimit removed from public RPC exports
        assert.ok(!authActionsSource.includes("export async function clearLoginRateLimit"), "clearLoginRateLimit must not be exported");
    });

    await challenge("V5.4: OWASP ASVS V4.1.1, V4.1.3 & V4.2.1 (Access Control & Least Privilege) Compliance", () => {
        // middleware protects routes, requireAdmin protects all 10 mutation actions
        const mwSrc = fs.readFileSync(path.join(projectRoot, "middleware.ts"), "utf8");
        assert.ok(mwSrc.includes("/pending") && mwSrc.includes("/input"), "middleware must protect admin routes");
        const quizSrc = fs.readFileSync(path.join(projectRoot, "app/actions/quiz.ts"), "utf8");
        const requireAdminMatches = (quizSrc.match(/requireAdmin\(\)/g) || []).length;
        assert.ok(requireAdminMatches >= 10, `Expected at least 10 requireAdmin checks in quiz.ts, found ${requireAdminMatches}`);
    });

    await challenge("V5.5: OWASP ASVS V11.1.4 (Rate Limiting & Anti-Automation Controls) Compliance", () => {
        // Bot score evaluation and fail-closed architecture
        assert.ok(authActionsSource.includes("score < 0.5"), "recaptcha must enforce score >= 0.5 threshold");
    });

    // -------------------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    console.log(` Adversarial Challenge Summary: ${passedCount}/${passedCount + failedCount} Passed`);
    if (failedCount > 0) {
        console.log(` \x1b[31mAdversarial Verdict: REJECT (${failedCount} failed challenges)\x1b[0m`);
        console.log("========================================================\n");
        process.exit(1);
    } else {
        console.log(" \x1b[32mAdversarial Verdict: CONFIRM_CORRECTNESS\x1b[0m");
        console.log(" All anti-abuse, HTTP idempotency, and access controls verified.");
        console.log("========================================================\n");
        process.exit(0);
    }
}

runAdversarialAudit().catch(err => {
    console.error("Fatal exception in adversarial audit harness:", err);
    process.exit(1);
});
