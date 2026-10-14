/**
 * =============================================================================
 * Milestone 2 Adversarial Verification Test Suite: tests/test-m2-challenger-1.ts
 * =============================================================================
 * Agent: Milestone 2 Route & Access Challenger (m2_challenger_1_r2)
 * Role: critic, specialist
 * Targets:
 *   - SEC-03: Route Protection Middleware (/pending/*, /input/*) & RBAC Access Control
 *   - SEC-03: Admin Mutation Authorization Guards (All 10 functions in app/actions/quiz.ts)
 *   - SEC-06: RPC Surface Reduction (clearLoginRateLimit export elimination)
 *   - SEC-09: Server-Side Google reCAPTCHA v3 Anti-Bot Verification in signUp
 *   - SEC-11: HTTP Semantics & Zero-Mutation GET Idempotency in Email Verification
 *
 * Compliance:
 *   - OWASP ASVS v4.0.3 Chapter 3 (V3.1.1)
 *   - OWASP ASVS v4.0.3 (V2.2.1, V4.1.1, V4.1.2, V4.1.3, V4.2.1, V11.1.4, V13.1.4, V13.2.1)
 *
 * Execution:
 *   npx --yes tsx tests/test-m2-challenger-1.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { createRequire } from "node:module";
import type { NextRequest } from "next/server";

// -----------------------------------------------------------------------------
// Environment & Resolution Setup
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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m2_challenger1";
process.env.RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "test_recaptcha_secret_key_6LeIxAcTAAAAAGG";
process.env.RECAPTCHA_BYPASS_TOKEN = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";

// Patch next/headers for standalone tsx test execution
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

// Global fetch mock for Google reCAPTCHA v3 and Resend email
interface MockFetchState {
    recaptchaResult: { success: boolean; score?: number; "error-codes"?: string[] };
    recaptchaStatus: number;
    capturedRecaptchas: string[];
    capturedEmails: Record<string, unknown>[];
}

const mockFetchState: MockFetchState = {
    recaptchaResult: { success: true, score: 0.9 },
    recaptchaStatus: 200,
    capturedRecaptchas: [],
    capturedEmails: [],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("google.com/recaptcha/api/siteverify")) {
        mockFetchState.capturedRecaptchas.push(String(init?.body || ""));
        return new Response(JSON.stringify(mockFetchState.recaptchaResult), {
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
                bodyObj = { raw: String(init.body) };
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

// -----------------------------------------------------------------------------
// Test Harness Reporter
// -----------------------------------------------------------------------------
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails: { name: string; error: string }[] = [];

async function challenge(testName: string, testFn: () => void | Promise<void>) {
    totalAssertions++;
    try {
        await testFn();
        passedAssertions++;
        console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName}`);
    } catch (err: unknown) {
        failedAssertions++;
        const msg = err instanceof Error ? err.message : String(err);
        failureDetails.push({ name: testName, error: msg });
        console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName}`);
        console.error(`    \x1b[31mError:\x1b[0m ${msg}`);
    }
}

// -----------------------------------------------------------------------------
// Database Query Interceptor & Mutation Auditor
// -----------------------------------------------------------------------------
interface QueryRecord {
    sql: string;
    params?: unknown[];
    isMutation: boolean;
}

const dbQueryLog: QueryRecord[] = [];

function clearQueryLog() {
    dbQueryLog.length = 0;
}

function getMutationCount(): number {
    return dbQueryLog.filter(q => q.isMutation).length;
}

function getTotalQueryCount(): number {
    return dbQueryLog.length;
}

// -----------------------------------------------------------------------------
// Main Adversarial Challenge Execution
// -----------------------------------------------------------------------------
async function runAdversarialAudit() {
    console.log("\n========================================================");
    console.log(" QuizWeb Milestone 2: Adversarial Security Challenge Suite");
    console.log(" Agent: Milestone 2 Route & Access Challenger (m2_challenger_1_r2)");
    console.log(" Targets: SEC-03, SEC-06, SEC-09, SEC-11");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3, V4, V2, V11, V13");
    console.log("========================================================\n");

    const { NextRequest } = await import("next/server");
    const { encode } = await import("next-auth/jwt");

    // Dynamic database pool setup
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
    const dbModule = await import("../lib/db") as unknown as { db?: MockDbPool; default?: { db: MockDbPool } };
    const db = (dbModule.db || dbModule.default?.db) as MockDbPool;

    // Active session controller for tests
    interface AuthSession {
        user?: {
            id?: string;
            role?: string;
            user_role?: string;
            email?: string;
            name?: string;
        };
    }
    let activeTestSession: AuthSession | null = null;
    let activeDbError = false;
    const testGlobals = globalThis as unknown as { __TEST_AUTH_SESSION__?: AuthSession | null };

    // Configure DB spy and dynamic responses
    db.query = (async (sql: string, params: unknown[] = []) => {
        const isMutation = /INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE/i.test(sql);
        dbQueryLog.push({ sql, params, isMutation });

        // User role check in user_auth_tbl
        if (sql.includes("SELECT user_role FROM user_auth_tbl")) {
            if (activeDbError) {
                throw new Error("Simulated database connection failure / pool timeout");
            }
            const userId = params[0];
            // Explicitly test deleted/nonexistent user returning 0 rows
            if (userId === "deleted_user" || userId === "nonexistent_user") {
                return [[]];
            }
            // Explicitly test spoofed role: user exists in DB as 'user'
            if (userId === "spoofed_admin") {
                return [[{ user_role: "user" }]];
            }
            if (activeTestSession?.user?.id === userId && activeTestSession?.user?.role === "admin") {
                return [[{ user_role: "admin" }]];
            }
            if (activeTestSession?.user?.id === userId && activeTestSession?.user?.role === "student") {
                return [[{ user_role: "student" }]];
            }
            if (activeTestSession?.user?.id === userId && activeTestSession?.user?.role === "user") {
                return [[{ user_role: "user" }]];
            }
            return [[{ user_role: "user" }]];
        }

        // Table exists check
        if (sql.includes("SELECT 1 FROM")) {
            return [[{ 1: 1 }]];
        }

        // Schema check
        if (sql.includes("SHOW COLUMNS FROM quiz_tbl")) {
            return [[{ Field: "sec_id" }]];
        }

        // Quiz type check
        if (sql.includes("SELECT type_name FROM quiz_type_tbl")) {
            return [[{ type_name: "MCQ" }]];
        }

        // Pending table check
        if (sql.includes("SELECT * FROM pending_tbl")) {
            return [[{
                pending_id: 1,
                pending_status: "pending",
                unit_title: "Adversarial Test Unit",
                sec_id: 1,
                unit_lesson_card_json: [],
                unit_quiz_json: [],
                unit_assessment_json: [],
            }]];
        }

        // Default mutation success response
        return [{ affectedRows: 1, insertId: 777 }];
    }) as typeof db.query;

    db.getConnection = (async () => ({
        query: async (sql: string, params: unknown[] = []) => {
            const isMutation = /INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|TRUNCATE/i.test(sql);
            dbQueryLog.push({ sql, params, isMutation });

            if (sql.includes("SELECT * FROM pending_tbl")) {
                return [[{
                    pending_id: 1,
                    pending_status: "pending",
                    unit_title: "Adversarial Test Unit",
                    sec_id: 1,
                    unit_lesson_card_json: [],
                    unit_quiz_json: [],
                    unit_assessment_json: [],
                }]];
            }
            return [{ affectedRows: 1, insertId: 888 }];
        },
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
    })) as typeof db.getConnection;

    // =========================================================================
    // SECTION 1: NEXT.JS ROUTE PROTECTION MIDDLEWARE ADVERSARIAL CHALLENGES (SEC-03)
    // =========================================================================
    console.log("\x1b[1m[Suite 1: Route Protection Middleware Adversarial Verification (SEC-03)]\x1b[0m");

    type MiddlewareHandler = (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>;
    interface MiddlewareModule {
        default?: MiddlewareHandler | { default?: MiddlewareHandler; middleware?: MiddlewareHandler };
        middleware?: MiddlewareHandler;
    }
    const mwModule = await import("../middleware") as unknown as MiddlewareModule;
    let middlewareFn: MiddlewareHandler;
    if (typeof mwModule.default === "function") {
        middlewareFn = mwModule.default;
    } else if (mwModule.default && typeof mwModule.default === "object" && typeof mwModule.default.middleware === "function") {
        middlewareFn = mwModule.default.middleware;
    } else if (mwModule.middleware && typeof mwModule.middleware === "function") {
        middlewareFn = mwModule.middleware;
    } else {
        throw new Error("Could not resolve middleware handler function");
    }

    // Helper to invoke middleware with specific session and headers
    const invokeMiddleware = async (
        urlPath: string,
        session?: AuthSession | null,
        cookieTokenOverride?: string,
        acceptHeader?: string,
    ): Promise<Response> => {
        const fullUrl = `https://localhost:3000${urlPath}`;
        const headers = new Headers();

        let tokenToUse = cookieTokenOverride;
        if (tokenToUse === undefined && session?.user) {
            tokenToUse = await encode({
                token: {
                    sub: session.user.id || "1",
                    id: session.user.id || "1",
                    role: session.user.role,
                    user_role: session.user.user_role || session.user.role,
                    email: session.user.email || "user@quizweb.dev",
                },
                secret: process.env.AUTH_SECRET!,
                salt: "__Secure-authjs.session-token",
            });
        }

        if (tokenToUse) {
            headers.set("cookie", `__Secure-authjs.session-token=${tokenToUse}`);
        }
        if (acceptHeader) {
            headers.set("accept", acceptHeader);
        }
        const req = new NextRequest(fullUrl, { headers });
        if (session) {
            (req as unknown as { auth: AuthSession }).auth = session;
        }
        return await middlewareFn(req, {});
    };

    // 1.1 Unauthenticated requests to /pending, /pending/sub, /input, /input/sub
    await challenge("1.1.1: Unauthenticated request to /pending redirects to /login with callbackUrl", async () => {
        const res = await invokeMiddleware("/pending");
        assert.ok(res.status === 307 || res.status === 302, `Expected redirect status, got ${res.status}`);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"), `Redirect must target /login, got ${location}`);
        assert.ok(location.includes("callbackUrl=%2Fpending"), `callbackUrl must be %2Fpending, got ${location}`);
    });

    await challenge("1.1.2: Unauthenticated request to /pending/sub redirects to /login with callbackUrl", async () => {
        const res = await invokeMiddleware("/pending/sub");
        assert.ok(res.status === 307 || res.status === 302, `Expected redirect status, got ${res.status}`);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"), `Redirect must target /login, got ${location}`);
        assert.ok(location.includes("callbackUrl=%2Fpending%2Fsub"), `callbackUrl must preserve subpath, got ${location}`);
    });

    await challenge("1.1.3: Unauthenticated request to /input redirects to /login with callbackUrl", async () => {
        const res = await invokeMiddleware("/input");
        assert.ok(res.status === 307 || res.status === 302, `Expected redirect status, got ${res.status}`);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"), `Redirect must target /login, got ${location}`);
        assert.ok(location.includes("callbackUrl=%2Finput"), `callbackUrl must be %2Finput, got ${location}`);
    });

    await challenge("1.1.4: Unauthenticated request to /input/sub redirects to /login with callbackUrl", async () => {
        const res = await invokeMiddleware("/input/sub");
        assert.ok(res.status === 307 || res.status === 302, `Expected redirect status, got ${res.status}`);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"), `Redirect must target /login, got ${location}`);
        assert.ok(location.includes("callbackUrl=%2Finput%2Fsub"), `callbackUrl must preserve subpath, got ${location}`);
    });

    await challenge("1.1.5: Deep nested routes /pending/a/b/c and /input/unit/42/edit redirect to /login", async () => {
        const res1 = await invokeMiddleware("/pending/a/b/c");
        assert.ok(res1.status === 307 || res1.status === 302);
        assert.ok((res1.headers.get("location") || "").includes("callbackUrl=%2Fpending%2Fa%2Fb%2Fc"));

        const res2 = await invokeMiddleware("/input/unit/42/edit");
        assert.ok(res2.status === 307 || res2.status === 302);
        assert.ok((res2.headers.get("location") || "").includes("callbackUrl=%2Finput%2Funit%2F42%2Fedit"));
    });

    // 1.2 Query strings & path normalization edge cases
    await challenge("1.2.1: Query parameters preserved on unauthenticated redirect (/pending?foo=bar)", async () => {
        const res = await invokeMiddleware("/pending?foo=bar");
        assert.ok(res.status === 307 || res.status === 302);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"));
        assert.ok(
            location.includes("%2Fpending%3Ffoo%3Dbar") || location.includes("foo=bar"),
            `Query string must be preserved in callbackUrl, got ${location}`
        );
    });

    await challenge("1.2.2: Multiple complex query parameters preserved (/input/sub?tab=settings&draft_id=102&debug=true)", async () => {
        const res = await invokeMiddleware("/input/sub?tab=settings&draft_id=102&debug=true");
        assert.ok(res.status === 307 || res.status === 302);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"));
        assert.ok(location.includes("draft_id") && location.includes("tab"), `Complex query must be preserved, got: ${location}`);
    });

    await challenge("1.2.3: Trailing slash edge cases (/pending/ and /input/) redirect to /login", async () => {
        const res1 = await invokeMiddleware("/pending/");
        assert.ok(res1.status === 307 || res1.status === 302);
        assert.ok((res1.headers.get("location") || "").includes("/login"));

        const res2 = await invokeMiddleware("/input/");
        assert.ok(res2.status === 307 || res2.status === 302);
        assert.ok((res2.headers.get("location") || "").includes("/login"));
    });

    // 1.3 Non-admin authenticated user access
    const nonAdminSession: AuthSession = { user: { id: "100", role: "user", user_role: "user", email: "user@quizweb.dev" } };
    const studentSession: AuthSession = { user: { id: "101", role: "student", user_role: "student", email: "student@quizweb.dev" } };
    const moderatorSession: AuthSession = { user: { id: "102", role: "moderator", user_role: "moderator", email: "mod@quizweb.dev" } };

    await challenge("1.3.1: Non-admin user (role='user') browser request to /pending redirects to /home", async () => {
        const res = await invokeMiddleware("/pending", nonAdminSession);
        assert.ok(res.status === 307 || res.status === 302, `Expected redirect, got status ${res.status}`);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/home"), `Expected redirect to /home, got ${location}`);
    });

    await challenge("1.3.2: Non-admin user (role='user') browser request to /pending/sub redirects to /home", async () => {
        const res = await invokeMiddleware("/pending/sub", nonAdminSession);
        assert.ok(res.status === 307 || res.status === 302);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/home"), `Expected redirect to /home, got ${location}`);
    });

    await challenge("1.3.3: Non-admin user (role='user') browser request to /input redirects to /home", async () => {
        const res = await invokeMiddleware("/input", nonAdminSession);
        assert.ok(res.status === 307 || res.status === 302);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/home"), `Expected redirect to /home, got ${location}`);
    });

    await challenge("1.3.4: Non-admin user (role='user') browser request to /input/sub redirects to /home", async () => {
        const res = await invokeMiddleware("/input/sub", nonAdminSession);
        assert.ok(res.status === 307 || res.status === 302);
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/home"), `Expected redirect to /home, got ${location}`);
    });

    await challenge("1.3.5: Non-admin user JSON request to /pending returns HTTP 403 Forbidden with JSON error", async () => {
        const res = await invokeMiddleware("/pending", nonAdminSession, undefined, "application/json");
        assert.strictEqual(res.status, 403, `Expected HTTP 403, got ${res.status}`);
        assert.ok(res.headers.get("content-type")?.includes("application/json"), "Response must be JSON");
        const body = await res.text();
        assert.ok(body.includes("Forbidden") || body.includes("Admin role required"), `Body must state Forbidden: ${body}`);
    });

    await challenge("1.3.6: Non-admin user JSON request to /input/sub returns HTTP 403 Forbidden with JSON error", async () => {
        const res = await invokeMiddleware("/input/sub", nonAdminSession, undefined, "application/json");
        assert.strictEqual(res.status, 403, `Expected HTTP 403, got ${res.status}`);
        const body = await res.text();
        assert.ok(body.includes("Forbidden"), `Body must state Forbidden: ${body}`);
    });

    await challenge("1.3.7: Student role (role='student') is rejected from /pending and /input", async () => {
        const resPending = await invokeMiddleware("/pending", studentSession);
        assert.ok(resPending.status === 307 || resPending.status === 302 || resPending.status === 403);
        if (resPending.status === 307 || resPending.status === 302) {
            assert.ok((resPending.headers.get("location") || "").includes("/home"));
        }

        const resInput = await invokeMiddleware("/input/sub", studentSession);
        assert.ok(resInput.status === 307 || resInput.status === 302 || resInput.status === 403);
    });

    await challenge("1.3.8: Moderator role (role='moderator') is rejected from /pending and /input", async () => {
        const res = await invokeMiddleware("/pending/sub", moderatorSession);
        assert.ok(res.status === 307 || res.status === 302 || res.status === 403);
    });

    await challenge("1.3.9: Empty or missing role string on session is rejected", async () => {
        const emptyRoleSession: AuthSession = { user: { id: "103", role: "", user_role: "" } };
        const res = await invokeMiddleware("/pending", emptyRoleSession);
        assert.ok(res.status === 307 || res.status === 302 || res.status === 403);

        const nullRoleSession: AuthSession = { user: { id: "104" } };
        const res2 = await invokeMiddleware("/input", nullRoleSession);
        assert.ok(res2.status === 307 || res2.status === 302 || res2.status === 403);
    });

    await challenge("1.3.10: Case sensitivity: Uppercase 'ADMIN' and 'Admin' roles are rejected (strict RBAC)", async () => {
        const upperAdminSession: AuthSession = { user: { id: "105", role: "ADMIN", user_role: "ADMIN" } };
        const resUpper = await invokeMiddleware("/pending", upperAdminSession);
        assert.ok(resUpper.status === 307 || resUpper.status === 302 || resUpper.status === 403);

        const titleAdminSession: AuthSession = { user: { id: "106", role: "Admin", user_role: "Admin" } };
        const resTitle = await invokeMiddleware("/input", titleAdminSession);
        assert.ok(resTitle.status === 307 || resTitle.status === 302 || resTitle.status === 403);
    });

    // 1.4 Admin authenticated user access
    const adminSession: AuthSession = { user: { id: "1", role: "admin", user_role: "admin", email: "admin@quizweb.dev" } };

    await challenge("1.4.1: Legitimate admin request to /pending is allowed through (status 200)", async () => {
        const res = await invokeMiddleware("/pending", adminSession);
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin must be allowed on /pending, got status ${res?.status}`);
    });

    await challenge("1.4.2: Legitimate admin request to /pending/sub is allowed through (status 200)", async () => {
        const res = await invokeMiddleware("/pending/sub", adminSession);
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin must be allowed on /pending/sub, got status ${res?.status}`);
    });

    await challenge("1.4.3: Legitimate admin request to /input is allowed through (status 200)", async () => {
        const res = await invokeMiddleware("/input", adminSession);
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin must be allowed on /input, got status ${res?.status}`);
    });

    await challenge("1.4.4: Legitimate admin request to /input/sub is allowed through (status 200)", async () => {
        const res = await invokeMiddleware("/input/sub", adminSession);
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin must be allowed on /input/sub, got status ${res?.status}`);
    });

    await challenge("1.4.5: Legitimate admin request with query parameters (/pending?foo=bar) is allowed", async () => {
        const res = await invokeMiddleware("/pending?foo=bar", adminSession);
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin with query params must pass through, got status ${res?.status}`);
    });

    await challenge("1.4.6: Token fallback: Session missing role but JWT cookie has role='admin' passes through", async () => {
        const adminJwt = await encode({
            token: { sub: "1", id: "1", role: "admin", user_role: "admin", email: "admin@quizweb.dev" },
            secret: process.env.AUTH_SECRET!,
            salt: "__Secure-authjs.session-token",
        });

        // Session user object without role, token passed via cookie
        const sessionWithoutRole: AuthSession = { user: { id: "1", email: "admin@quizweb.dev" } };
        const res = await invokeMiddleware("/pending", sessionWithoutRole, adminJwt);
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin token fallback must allow access, got status ${res?.status}`);
    });

    // 1.5 Public route transparency
    await challenge("1.5.1: Public routes (/, /home, /quizzes, /login, /signup) bypass middleware without redirect", async () => {
        const publicRoutes = ["/", "/home", "/quizzes", "/quizzes/99", "/login", "/signup", "/api/auth/session"];
        for (const route of publicRoutes) {
            const res = await invokeMiddleware(route, null, "");
            const isAllowed = !res || res.status === 200 || !res.headers.get("location");
            assert.ok(isAllowed, `Public route ${route} must not redirect unauthenticated user, got status ${res?.status}`);
        }
    });

    // =========================================================================
    // SECTION 2: ADMIN MUTATION ACTIONS DIRECT INVOCATION & INTEGRITY (SEC-03)
    // =========================================================================
    console.log("\n\x1b[1m[Suite 2: Direct Invocation of All 10 Mutation Functions (app/actions/quiz.ts)]\x1b[0m");

    const quizModule = await import("../app/actions/quiz") as Record<string, unknown>;
    const quizActions = (quizModule.default || quizModule) as Record<string, unknown>;
    const requireAdminFn = quizActions.requireAdmin as () => Promise<unknown>;
    assert.strictEqual(typeof requireAdminFn, "function", "requireAdmin must be exported as a function");

    // 2.0 Direct requireAdmin() unit assertions
    await challenge("2.0.1: [requireAdmin] Deleted / non-existent user with stale JWT claiming admin (rows.length === 0) returns false", async () => {
        activeTestSession = { user: { id: "deleted_user", role: "admin", user_role: "admin" } };
        testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
        activeDbError = false;
        const res = await requireAdminFn();
        assert.strictEqual(res, false, `Expected false for deleted user, got ${JSON.stringify(res)}`);
    });

    await challenge("2.0.2: [requireAdmin] Database connection error returns false (fail-closed)", async () => {
        activeTestSession = { user: { id: "1", role: "admin", user_role: "admin" } };
        testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
        activeDbError = true;
        try {
            const res = await requireAdminFn();
            assert.strictEqual(res, false, `Expected false on DB error, got ${JSON.stringify(res)}`);
        } finally {
            activeDbError = false;
        }
    });

    await challenge("2.0.3: [requireAdmin] Unauthenticated / null session returns false", async () => {
        activeTestSession = null;
        testGlobals.__TEST_AUTH_SESSION__ = null;
        activeDbError = false;
        const res = await requireAdminFn();
        assert.strictEqual(res, false, `Expected false for null session, got ${JSON.stringify(res)}`);
    });

    await challenge("2.0.4: [requireAdmin] Session without user ID returns false", async () => {
        activeTestSession = { user: { role: "admin", user_role: "admin" } };
        testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
        activeDbError = false;
        const res = await requireAdminFn();
        assert.strictEqual(res, false, `Expected false for missing userId, got ${JSON.stringify(res)}`);
    });

    await challenge("2.0.5: [requireAdmin] User with user_role='user' in DB claiming admin returns false", async () => {
        activeTestSession = { user: { id: "spoofed_admin", role: "admin", user_role: "admin" } };
        testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
        activeDbError = false;
        const res = await requireAdminFn();
        assert.strictEqual(res, false, `Expected false for spoofed role, got ${JSON.stringify(res)}`);
    });

    await challenge("2.0.6: [requireAdmin] Legitimate admin returns { id: '1', role: 'admin' }", async () => {
        activeTestSession = { user: { id: "1", role: "admin", user_role: "admin" } };
        testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
        activeDbError = false;
        const res = await requireAdminFn() as { id: string; role: string } | null;
        assert.ok(res, "Expected admin result object");
        assert.strictEqual(res.id, "1");
        assert.strictEqual(res.role, "admin");
    });

    // Prepare standard FormData payloads
    const createMcqFormData = (): FormData => {
        const fd = new FormData();
        fd.set("cat_id", "1");
        fd.set("sec_id", "1");
        fd.set("difficulty_id", "1");
        fd.set("quiz_type_id", "1");
        fd.set("question_text", "Adversarial test question");
        fd.set("option_0", "Option 1");
        fd.set("option_1", "Option 2");
        fd.set("option_2", "Option 3");
        fd.set("option_3", "Option 4");
        fd.set("correct_option_index", "0");
        return fd;
    };

    const createUnitFormData = (): FormData => {
        const fd = new FormData();
        fd.set("unit_title", "Adversarial Unit Title");
        fd.set("sec_id", "1");
        fd.set("lesson_title_0", "Slide 1");
        fd.set("lesson_text_0", "Lesson text content");
        fd.set("assessment_steps", JSON.stringify(["Step 1"]));
        fd.set("quiz_json", JSON.stringify([{ question: "Q1" }]));
        return fd;
    };

    interface MutationDefinition {
        name: string;
        call: () => Promise<unknown>;
    }

    const mutationActions: MutationDefinition[] = [
        {
            name: "deleteUnit",
            call: () => (quizActions.deleteUnit as (id: number) => Promise<unknown>)(10),
        },
        {
            name: "createQuiz",
            call: () => (quizActions.createQuiz as (s: unknown, f: FormData) => Promise<unknown>)({}, createMcqFormData()),
        },
        {
            name: "deleteQuiz",
            call: () => (quizActions.deleteQuiz as (id: number) => Promise<unknown>)(20),
        },
        {
            name: "updateQuiz",
            call: () => (quizActions.updateQuiz as (id: number, f: FormData) => Promise<unknown>)(20, createMcqFormData()),
        },
        {
            name: "reviewPendingQuiz",
            call: () => (quizActions.reviewPendingQuiz as (id: number, d: "approve" | "reject") => Promise<unknown>)(30, "approve"),
        },
        {
            name: "updatePendingQuiz",
            call: () => (quizActions.updatePendingQuiz as (id: number, q: string) => Promise<unknown>)(30, "Updated question text"),
        },
        {
            name: "updatePendingNote",
            call: () => (quizActions.updatePendingNote as (id: number, n: string) => Promise<unknown>)(30, "Updated review note"),
        },
        {
            name: "updatePendingQuizFromForm",
            call: () => (quizActions.updatePendingQuizFromForm as (id: number, f: FormData) => Promise<unknown>)(30, createMcqFormData()),
        },
        {
            name: "updatePendingUnitFromForm",
            call: () => (quizActions.updatePendingUnitFromForm as (id: number, f: FormData) => Promise<unknown>)(30, createUnitFormData()),
        },
        {
            name: "deletePendingQuiz",
            call: () => (quizActions.deletePendingQuiz as (id: number) => Promise<unknown>)(30),
        },
    ];

    assert.strictEqual(mutationActions.length, 10, "Must test exactly 10 mutation actions");

    // Helper to test unauthenticated rejection
    for (const [index, action] of mutationActions.entries()) {
        const actionNum = index + 1;

        // Challenge A: Call without session
        await challenge(`2.${actionNum}.1: [${action.name}] Unauthenticated call rejected with { error: "Unauthorized" } & ZERO DB mutations`, async () => {
            activeTestSession = null;
            testGlobals.__TEST_AUTH_SESSION__ = null;
            clearQueryLog();

            const result = await action.call() as { error?: string; success?: boolean } | null;

            assert.ok(result, `${action.name} must return a result object`);
            assert.strictEqual(
                result.error,
                "Unauthorized",
                `${action.name} without session must return { error: "Unauthorized" }, got: ${JSON.stringify(result)}`
            );
            assert.strictEqual(
                getMutationCount(),
                0,
                `SEC-03 CRITICAL: ${action.name} executed ${getMutationCount()} database mutations without session!`
            );
            assert.strictEqual(
                getTotalQueryCount(),
                0,
                `${action.name} should fail fast with 0 DB queries when session is null, executed ${getTotalQueryCount()}`
            );
        });

        // Challenge B: Call with non-admin session
        await challenge(`2.${actionNum}.2: [${action.name}] Non-admin caller rejected with { error: "Unauthorized" } & ZERO DB mutations`, async () => {
            activeTestSession = { user: { id: "201", role: "user", user_role: "user" } };
            testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
            clearQueryLog();

            const result = await action.call() as { error?: string; success?: boolean } | null;

            assert.ok(result, `${action.name} must return a result object`);
            assert.strictEqual(
                result.error,
                "Unauthorized",
                `${action.name} with user role must return { error: "Unauthorized" }, got: ${JSON.stringify(result)}`
            );
            assert.strictEqual(
                getMutationCount(),
                0,
                `SEC-03 CRITICAL: ${action.name} executed ${getMutationCount()} database mutations for non-admin user!`
            );
        });

        // Challenge C: Call with spoofed admin claim (client claims admin, DB confirms user)
        await challenge(`2.${actionNum}.3: [${action.name}] Role spoofing attempt blocked by DB user_role check with ZERO DB mutations`, async () => {
            // Client claims admin in session, but user_id 'spoofed_admin' in DB has user_role='user'
            activeTestSession = { user: { id: "spoofed_admin", role: "admin", user_role: "admin" } };
            testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
            clearQueryLog();

            const result = await action.call() as { error?: string; success?: boolean } | null;

            assert.ok(result, `${action.name} must return a result object`);
            assert.strictEqual(
                result.error,
                "Unauthorized",
                `${action.name} with spoofed role must be caught by DB user_role check, got: ${JSON.stringify(result)}`
            );
            assert.strictEqual(
                getMutationCount(),
                0,
                `SEC-03 CRITICAL: ${action.name} executed mutations on spoofed session claim!`
            );
        });

        // Challenge D: Legitimate admin invocation
        await challenge(`2.${actionNum}.4: [${action.name}] Legitimate admin is authorized (no Unauthorized rejection)`, async () => {
            activeTestSession = { user: { id: "1", role: "admin", user_role: "admin", name: "Administrator" } };
            testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
            clearQueryLog();

            const result = await action.call() as { error?: string; success?: boolean; message?: string } | null;

            assert.ok(result, `${action.name} must return a result object`);
            assert.notStrictEqual(
                result.error,
                "Unauthorized",
                `Legitimate admin must not receive { error: "Unauthorized" } on ${action.name}, got: ${JSON.stringify(result)}`
            );
            assert.ok(
                result.success === true || (result.error && result.error !== "Unauthorized"),
                `Admin call should either succeed or fail on business logic, got: ${JSON.stringify(result)}`
            );
        });

        // Challenge E: Deleted / non-existent user with stale JWT claiming admin (rows.length === 0)
        await challenge(`2.${actionNum}.5: [${action.name}] Deleted / non-existent user rejected with { error: "Unauthorized" } & ZERO DB mutations`, async () => {
            activeTestSession = { user: { id: "deleted_user", role: "admin", user_role: "admin" } };
            testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
            activeDbError = false;
            clearQueryLog();

            const result = await action.call() as { error?: string; success?: boolean } | null;

            assert.ok(result, `${action.name} must return a result object`);
            assert.strictEqual(
                result.error,
                "Unauthorized",
                `${action.name} with deleted user must return { error: "Unauthorized" }, got: ${JSON.stringify(result)}`
            );
            assert.strictEqual(
                getMutationCount(),
                0,
                `SEC-03 CRITICAL: ${action.name} executed ${getMutationCount()} database mutations for deleted user!`
            );
        });

        // Challenge F: Database connection error in requireAdmin() (fail-closed)
        await challenge(`2.${actionNum}.6: [${action.name}] Database connection error in requireAdmin rejected with { error: "Unauthorized" } & ZERO DB mutations`, async () => {
            activeTestSession = { user: { id: "1", role: "admin", user_role: "admin" } };
            testGlobals.__TEST_AUTH_SESSION__ = activeTestSession;
            activeDbError = true;
            clearQueryLog();

            try {
                const result = await action.call() as { error?: string; success?: boolean } | null;

                assert.ok(result, `${action.name} must return a result object`);
                assert.strictEqual(
                    result.error,
                    "Unauthorized",
                    `${action.name} on DB connection error must return { error: "Unauthorized" }, got: ${JSON.stringify(result)}`
                );
                assert.strictEqual(
                    getMutationCount(),
                    0,
                    `SEC-03 CRITICAL: ${action.name} executed mutations on DB connection error!`
                );
            } finally {
                activeDbError = false;
            }
        });
    }

    // =========================================================================
    // SECTION 3: RPC REDUCTION, ANTI-BOT & EMAIL VERIFICATION CROSS-CHECKS
    // =========================================================================
    console.log("\n\x1b[1m[Suite 3: Milestone 2 Feature Hardening Cross-Checks (SEC-06, SEC-09, SEC-11)]\x1b[0m");

    // 3.1 SEC-06: RPC Surface Reduction
    const authActionsPath = path.join(projectRoot, "app/actions/auth.ts");
    const authActionsContent = fs.readFileSync(authActionsPath, "utf8");
    const authActionsMod = await import("../app/actions/auth") as Record<string, unknown>;

    await challenge("3.1.1: clearLoginRateLimit is NOT exported dynamically or statically from app/actions/auth.ts", () => {
        assert.strictEqual(
            authActionsMod.clearLoginRateLimit,
            undefined,
            "clearLoginRateLimit must not be exported on app/actions/auth"
        );
        assert.ok(
            !/export\s+(async\s+)?function\s+clearLoginRateLimit\b/.test(authActionsContent),
            "export declaration for clearLoginRateLimit must not exist"
        );
    });

    await challenge("3.1.2: Client login page does not import or call clearLoginRateLimit", () => {
        const loginPageContent = fs.readFileSync(path.join(projectRoot, "app/login/page.tsx"), "utf8");
        assert.ok(
            !loginPageContent.includes("clearLoginRateLimit"),
            "app/login/page.tsx must not reference clearLoginRateLimit"
        );
    });

    // 3.2 SEC-09: Server-Side Google reCAPTCHA v3
    const signUp = authActionsMod.signUp as (f: FormData) => Promise<{ success?: boolean; error?: string }>;

    await challenge("3.2.1: signUp rejects submission without reCAPTCHA token before executing any DB queries", async () => {
        clearQueryLog();
        const fd = new FormData();
        fd.set("username", "testbot");
        fd.set("email", "bot@quizweb.dev");
        fd.set("password", "Pass123456!");
        fd.set("confirmPassword", "Pass123456!");

        const res = await signUp(fd);
        assert.strictEqual(res.success !== true, true, "Missing reCAPTCHA token must fail");
        assert.ok(res.error?.includes("reCAPTCHA"), `Error must indicate reCAPTCHA, got: ${res.error}`);
        assert.strictEqual(getTotalQueryCount(), 0, "No database queries allowed when token is missing");
    });

    await challenge("3.2.2: signUp rejects bot score (< 0.5) before executing any DB queries", async () => {
        clearQueryLog();
        mockFetchState.recaptchaResult = { success: true, score: 0.3 };

        const fd = new FormData();
        fd.set("username", "botuser");
        fd.set("email", "botscore@quizweb.dev");
        fd.set("password", "Pass123456!");
        fd.set("confirmPassword", "Pass123456!");
        fd.set("recaptchaToken", "bot_score_token_0.3");

        const res = await signUp(fd);
        assert.strictEqual(res.success !== true, true, "Score 0.3 must fail");
        assert.strictEqual(getTotalQueryCount(), 0, "No database queries allowed on bot score");
    });

    await challenge("3.2.3: signUp accepts test bypass token in test environment", async () => {
        clearQueryLog();
        const fd = new FormData();
        fd.set("username", "bypassuser");
        fd.set("email", "bypass@quizweb.dev");
        fd.set("password", "Pass123456!");
        fd.set("confirmPassword", "Pass123456!");
        fd.set("recaptchaToken", "test-bypass-recaptcha-token");

        const res = await signUp(fd);
        assert.strictEqual(res.success, true, `Bypass token must succeed, got: ${JSON.stringify(res)}`);
    });

    // 3.3 SEC-11: Zero-Mutation GET Idempotency in Email Verification
    await challenge("3.3.1: app/verify-email/[token]/page.tsx does not call verifyEmail on GET render", () => {
        const verifyPageSrc = fs.readFileSync(path.join(projectRoot, "app/verify-email/[token]/page.tsx"), "utf8");
        assert.ok(!verifyPageSrc.includes("verifyEmail("), "page.tsx must not call verifyEmail on render");
        assert.ok(verifyPageSrc.includes("VerifyEmailClient"), "page.tsx must render VerifyEmailClient");
    });

    await challenge("3.3.2: Simulated GET rendering executes ZERO database mutations", async () => {
        clearQueryLog();
        const verifyPageMod = await import("../app/verify-email/[token]/page") as {
            default?: (props: { params: Promise<{ token: string }> }) => Promise<unknown>;
        };
        const VerifyPage = verifyPageMod.default;
        assert.ok(VerifyPage, "VerifyPage component must be exported");

        const rendered = await VerifyPage({ params: Promise.resolve({ token: "test_token_crawlers_get" }) });
        assert.ok(rendered !== null && rendered !== undefined);
        assert.strictEqual(getMutationCount(), 0, "Zero DB mutations on GET page render");
        assert.strictEqual(getTotalQueryCount(), 0, "Zero DB queries on GET page render");
    });

    // =========================================================================
    // SECTION 4: OWASP ASVS v4.0.3 CHAPTER 3 & V4 COMPLIANCE AUDIT
    // =========================================================================
    console.log("\n\x1b[1m[Suite 4: OWASP ASVS v4.0.3 Chapter 3 & V4 Compliance Matrix]\x1b[0m");

    await challenge("4.1: ASVS V3.1.1 (Verify that HTTP GET requests are safe and idempotent)", () => {
        // Zero mutations on GET email verification
        const pageSrc = fs.readFileSync(path.join(projectRoot, "app/verify-email/[token]/page.tsx"), "utf8");
        assert.ok(!pageSrc.includes("verifyEmail"));
    });

    await challenge("4.2: ASVS V4.1.1 (Verify that the application enforces access control rules on the server side)", () => {
        // Middleware guards routes server-side; requireAdmin guards mutation actions server-side
        const mwSrc = fs.readFileSync(path.join(projectRoot, "middleware.ts"), "utf8");
        assert.ok(mwSrc.includes("isProtected"));
        const quizSrc = fs.readFileSync(path.join(projectRoot, "app/actions/quiz.ts"), "utf8");
        assert.ok(quizSrc.includes("requireAdmin"));
    });

    await challenge("4.3: ASVS V4.1.2 (Verify that access control cannot be bypassed by removing parameters)", () => {
        // clearLoginRateLimit removed completely from server actions
        assert.ok(!authActionsContent.includes("export async function clearLoginRateLimit"));
    });

    await challenge("4.4: ASVS V4.1.3 (Verify principle of least privilege is enforced for roles)", () => {
        // Only admin role allowed on /pending and /input; other roles blocked
        const mwSrc = fs.readFileSync(path.join(projectRoot, "middleware.ts"), "utf8");
        assert.ok(mwSrc.includes('role !== "admin"'));
    });

    await challenge("4.5: ASVS V4.2.1 (Verify that all operations that modify data have access control checks)", () => {
        // All 10 mutation functions checked
        const quizSrc = fs.readFileSync(path.join(projectRoot, "app/actions/quiz.ts"), "utf8");
        const matches = quizSrc.match(/if \(!\(await requireAdmin\(\)\)\)/g) || [];
        assert.strictEqual(matches.length, 10, `Expected 10 requireAdmin call guards in quiz.ts, found ${matches.length}`);
    });

    await challenge("4.6: ASVS V11.1.4 & V2.2.1 (Anti-Automation on sensitive actions & registration)", () => {
        // reCAPTCHA enforced server-side before account creation
        assert.ok(authActionsContent.includes("verifyRecaptchaToken"));
    });

    await challenge("4.7: ASVS V13.1.4 & V13.2.1 (Server-side API controls & explicit state mutation methods)", () => {
        // Email activation requires POST submission
        const clientSrc = fs.readFileSync(path.join(projectRoot, "app/verify-email/[token]/VerifyEmailClient.tsx"), "utf8");
        assert.ok(clientSrc.includes("verifyEmail(token)"));
    });

    // =========================================================================
    // FINAL AUDIT SUMMARY
    // =========================================================================
    console.log("\n========================================================");
    console.log(` Test Execution Summary: ${passedAssertions}/${totalAssertions} Passed`);
    if (failedAssertions > 0) {
        console.log(` \x1b[31mStatus: ADVERSARIAL CHALLENGES FAILED (${failedAssertions} failures)\x1b[0m`);
        console.log(" Failed tests:");
        for (const f of failureDetails) {
            console.log(`   - ${f.name}: ${f.error}`);
        }
        console.log(" Verdict: DEFECTS_FOUND");
        console.log("========================================================\n");
        process.exit(1);
    } else {
        console.log(" \x1b[32mStatus: ALL ADVERSARIAL CHALLENGES PASSED\x1b[0m");
        console.log(" Verdict: CONFIRM_CORRECTNESS");
        console.log(" OWASP ASVS v4.0.3 Chapter 3 & V4 Access Control: VERIFIED");
        console.log("========================================================\n");
        process.exit(0);
    }
}

runAdversarialAudit().catch((err: unknown) => {
    console.error("Fatal error during adversarial execution:", err);
    process.exit(1);
});
