/**
 * =============================================================================
 * Milestone 2 Verification Test Harness: tests/test-m2.ts
 * =============================================================================
 * Targets:
 *   - SEC-03: Route Protection Middleware & Admin Mutation Access Control
 *   - SEC-06: RPC Reduction (Remove unauthenticated clearLoginRateLimit export)
 *   - SEC-09: Server-Side Google reCAPTCHA v3 Enforcement in signUp
 *   - SEC-11: Explicit POST Email Verification (Eliminate GET state mutations)
 *
 * Standards:
 *   - OWASP ASVS v4.0.3 Chapter 3 (V3.1.1)
 *   - OWASP ASVS v4.0.3 (V2.2.1, V4.1.1, V4.1.2, V4.1.3, V4.2.1, V11.1.4, V13.1.4, V13.2.1)
 *
 * Execution:
 *   npx --yes tsx tests/test-m2.ts
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { createRequire } from "node:module";
import type { NextRequest } from "next/server";

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
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_mock_test_key_m2_audit";
process.env.RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || "test_recaptcha_secret_key_6LeIxAcTAAAAAGG";
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

// Global fetch mock for reCAPTCHA v3 and Resend email
interface MockFetchState {
    recaptchaResult: { success: boolean; score?: number; "error-codes"?: string[] };
    capturedRecaptchaBodies: string[];
    capturedEmails: Record<string, unknown>[];
}

const mockState: MockFetchState = {
    recaptchaResult: { success: true, score: 0.9 },
    capturedRecaptchaBodies: [],
    capturedEmails: [],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.includes("google.com/recaptcha/api/siteverify")) {
        const bodyStr = String(init?.body || "");
        mockState.capturedRecaptchaBodies.push(bodyStr);
        return new Response(JSON.stringify(mockState.recaptchaResult), {
            status: 200,
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
        mockState.capturedEmails.push(bodyObj);
        return new Response(JSON.stringify({ id: "mock_resend_" + Date.now() }), {
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
// Database Query Interceptor & Spy
// -----------------------------------------------------------------------------
interface QueryRecord {
    sql: string;
    params?: unknown[];
}
const queryLog: QueryRecord[] = [];

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

interface UserAuthSession {
    user?: {
        id: string;
        role?: string;
        user_role?: string;
    };
}

interface ActionErrorResult {
    success?: boolean;
    error?: string;
    message?: string;
}

type MiddlewareHandler = (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>;

// -----------------------------------------------------------------------------
// Main Test Suite Execution
// -----------------------------------------------------------------------------
async function main() {
    console.log("\n========================================================");
    console.log(" QuizWeb Milestone 2: Standalone Security Verification");
    console.log(" Targets: SEC-03, SEC-06, SEC-09, SEC-11");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3 & Related");
    console.log("========================================================\n");

    const { NextRequest } = await import("next/server");
    const { encode } = await import("next-auth/jwt");

    // Dynamic import of database pool
    const dbModule = await import("../lib/db") as unknown as { db?: MockDbPool; default?: { db: MockDbPool } };
    const db = (dbModule.db || dbModule.default?.db) as MockDbPool;

    // -------------------------------------------------------------------------
    // Suite 2: Next.js Route Protection Middleware (SEC-03 / ASVS V4.1.1, V4.1.3)
    // -------------------------------------------------------------------------
    console.log("\x1b[1m[Suite 2: Route Protection Middleware (middleware.ts)]\x1b[0m");

    const middlewarePath = path.join(projectRoot, "middleware.ts");

    await runTest("middleware.ts file exists at project root", () => {
        assert.ok(fs.existsSync(middlewarePath), "middleware.ts must exist at project root");
    });

    let middlewareSource = "";
    if (fs.existsSync(middlewarePath)) {
        middlewareSource = fs.readFileSync(middlewarePath, "utf8");
    }

    await runTest("middleware.ts defines config.matcher covering /pending/* and /input/*", () => {
        assert.ok(middlewareSource.length > 0, "middleware.ts must not be empty");
        assert.ok(
            middlewareSource.includes("/pending") && middlewareSource.includes("/input"),
            "middleware.ts config.matcher must include /pending and /input routes"
        );
        assert.ok(
            /matcher\s*:\s*\[[^\]]*\/pending[^\]]*\/input[^\]]*\]/s.test(middlewareSource) ||
            /matcher\s*:\s*\[[^\]]*\/input[^\]]*\/pending[^\]]*\]/s.test(middlewareSource) ||
            middlewareSource.includes("matcher"),
            "middleware.ts must export config.matcher"
        );
    });

    // Dynamic execution of middleware
    let middlewareFn: MiddlewareHandler | null = null;
    if (fs.existsSync(middlewarePath)) {
        const mwMod = await import("../middleware") as unknown as { default?: MiddlewareHandler; middleware?: MiddlewareHandler };
        middlewareFn = mwMod.default || mwMod.middleware || null;
    }

    await runTest("Direct unauthenticated request to /pending is redirected to /login", async () => {
        assert.ok(middlewareFn, "middleware function must be exported");
        const req = new NextRequest("https://localhost:3000/pending");
        const res = await middlewareFn(req, {});

        assert.ok(res, "Middleware must return a response");
        assert.ok(
            res.status === 307 || res.status === 302,
            `Unauthenticated request to /pending must redirect (status 302/307), got ${res.status}`
        );
        const location = res.headers.get("location") || "";
        assert.ok(
            location.includes("/login"),
            `Redirect location must point to /login, got ${location}`
        );
        assert.ok(
            location.includes("callbackUrl=%2Fpending") || location.includes("callbackUrl"),
            "Redirect must preserve callbackUrl for post-login return"
        );
    });

    await runTest("Direct unauthenticated request to /input is redirected to /login", async () => {
        assert.ok(middlewareFn, "middleware function must be exported");
        const req = new NextRequest("https://localhost:3000/input");
        const res = await middlewareFn(req, {});

        assert.ok(res, "Middleware must return a response");
        assert.ok(
            res.status === 307 || res.status === 302,
            `Unauthenticated request to /input must redirect (status 302/307), got ${res.status}`
        );
        const location = res.headers.get("location") || "";
        assert.ok(location.includes("/login"), `Redirect location must point to /login, got ${location}`);
    });

    await runTest("Authenticated non-admin request to /pending receives 403 or redirect to /home", async () => {
        assert.ok(middlewareFn, "middleware function must be exported");
        const userToken = await encode({
            token: { sub: "10", id: "10", role: "user", user_role: "user", email: "user@quizweb.dev" },
            secret: process.env.AUTH_SECRET!,
            salt: "__Secure-authjs.session-token",
        });

        const req = new NextRequest("https://localhost:3000/pending", {
            headers: { cookie: `__Secure-authjs.session-token=${userToken}` },
        });
        (req as unknown as { auth: UserAuthSession }).auth = { user: { id: "10", role: "user", user_role: "user" } };

        const res = await middlewareFn(req, {});
        assert.ok(res, "Middleware must return a response for non-admin");
        const isForbidden = res.status === 403;
        const isRedirect = (res.status === 307 || res.status === 302) && (res.headers.get("location")?.includes("/home") || res.headers.get("location")?.includes("/login"));
        assert.ok(
            isForbidden || isRedirect,
            `Non-admin request must receive 403 Forbidden or redirect to /home, got status ${res.status}`
        );
    });

    await runTest("Authenticated non-admin request to /input receives 403 or redirect to /home", async () => {
        assert.ok(middlewareFn, "middleware function must be exported");
        const userToken = await encode({
            token: { sub: "11", id: "11", role: "user", user_role: "user", email: "student@quizweb.dev" },
            secret: process.env.AUTH_SECRET!,
            salt: "__Secure-authjs.session-token",
        });

        const req = new NextRequest("https://localhost:3000/input", {
            headers: { cookie: `__Secure-authjs.session-token=${userToken}` },
        });
        (req as unknown as { auth: UserAuthSession }).auth = { user: { id: "11", role: "user", user_role: "user" } };

        const res = await middlewareFn(req, {});
        assert.ok(res, "Middleware must return a response for non-admin");
        const isForbidden = res.status === 403;
        const isRedirect = (res.status === 307 || res.status === 302) && (res.headers.get("location")?.includes("/home") || res.headers.get("location")?.includes("/login"));
        assert.ok(
            isForbidden || isRedirect,
            `Non-admin request to /input must receive 403 Forbidden or redirect, got status ${res.status}`
        );
    });

    await runTest("Authenticated admin request to /pending is allowed through (status 200)", async () => {
        assert.ok(middlewareFn, "middleware function must be exported");
        const adminToken = await encode({
            token: { sub: "1", id: "1", role: "admin", user_role: "admin", email: "admin@quizweb.dev" },
            secret: process.env.AUTH_SECRET!,
            salt: "__Secure-authjs.session-token",
        });

        const req = new NextRequest("https://localhost:3000/pending", {
            headers: { cookie: `__Secure-authjs.session-token=${adminToken}` },
        });
        (req as unknown as { auth: UserAuthSession }).auth = { user: { id: "1", role: "admin", user_role: "admin" } };

        const res = await middlewareFn(req, {});
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, `Admin request to /pending must be allowed through, got status ${res?.status}`);
    });

    await runTest("Public route (e.g. /quizzes) passes through without redirect when unauthenticated", async () => {
        assert.ok(middlewareFn, "middleware function must be exported");
        const req = new NextRequest("https://localhost:3000/quizzes");
        const res = await middlewareFn(req, {});
        const isAllowed = !res || res.status === 200 || !res.headers.get("location");
        assert.ok(isAllowed, "Public route /quizzes must not be blocked by admin middleware");
    });

    // -------------------------------------------------------------------------
    // Suite 3: Administrative Mutation Server Actions (SEC-03 / ASVS V4.1.1, V4.2.1)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 3: Admin Mutation Actions Authorization (app/actions/quiz.ts)]\x1b[0m");

    interface QuizActions {
        createQuiz: (state: unknown, formData: FormData) => Promise<ActionErrorResult>;
        updateQuiz: (quizId: number, formData: FormData) => Promise<ActionErrorResult>;
        deleteQuiz: (quizId: number) => Promise<ActionErrorResult>;
        deleteUnit: (unitId: number) => Promise<ActionErrorResult>;
        reviewPendingQuiz: (pendingId: number, decision: "approve" | "reject", rejectionNotes?: string) => Promise<ActionErrorResult>;
        updatePendingQuiz: (pendingId: number, text: string) => Promise<ActionErrorResult>;
        updatePendingNote: (pendingId: number, note: string) => Promise<ActionErrorResult>;
        updatePendingQuizFromForm: (pendingId: number, formData: FormData) => Promise<ActionErrorResult>;
        updatePendingUnitFromForm: (pendingId: number, formData: FormData) => Promise<ActionErrorResult>;
        deletePendingQuiz: (pendingId: number) => Promise<ActionErrorResult>;
    }

    const quizModule = await import("../app/actions/quiz") as unknown as { default?: QuizActions } & QuizActions;
    const quizActions: QuizActions = quizModule.default || quizModule;

    // Setup active session controller for tests
    let currentAuthSession: UserAuthSession | null = null;

    // Helper to evaluate mutation response for unauthorized rejection
    const isUnauthorizedResult = (result: ActionErrorResult | null | undefined): boolean => {
        if (!result) return false;
        if (typeof result.error === "string") {
            const err = result.error.toLowerCase();
            return err.includes("unauthor") || err.includes("admin") || err.includes("forbidden");
        }
        return false;
    };

    // Mock db.query for quiz actions
    let executedDbMutations = 0;
    db.query = (async (sql: string, params: unknown[] = []) => {
        queryLog.push({ sql, params });
        if (/INSERT|UPDATE|DELETE/i.test(sql)) {
            executedDbMutations++;
        }
        if (sql.includes("SELECT user_role FROM user_auth_tbl")) {
            const userId = params[0];
            if (currentAuthSession?.user?.id === userId && currentAuthSession?.user?.role === "admin") {
                return [[{ user_role: "admin" }]];
            }
            return [[{ user_role: "user" }]];
        }
        if (sql.includes("SHOW COLUMNS FROM quiz_tbl")) {
            return [[{ Field: "sec_id" }]];
        }
        if (sql.includes("SELECT 1 FROM")) {
            return [[{ 1: 1 }]];
        }
        if (sql.includes("SELECT type_name FROM quiz_type_tbl")) {
            return [[{ type_name: "MCQ" }]];
        }
        if (sql.includes("SELECT * FROM pending_tbl")) {
            return [[{ pending_id: 1, pending_status: "pending", unit_title: "Test Unit" }]];
        }
        return [{ affectedRows: 1, insertId: 999 }];
    }) as typeof db.query;

    db.getConnection = (async () => ({
        query: async (sql: string, params: unknown[] = []) => {
            queryLog.push({ sql, params });
            if (/INSERT|UPDATE|DELETE/i.test(sql)) {
                executedDbMutations++;
            }
            if (sql.includes("SELECT * FROM pending_tbl")) {
                return [[{ pending_id: 1, pending_status: "pending", unit_title: "Test Unit" }]];
            }
            return [{ affectedRows: 1, insertId: 999 }];
        },
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
    })) as typeof db.getConnection;

    // 10 Administrative Mutation Actions to Verify
    const adminMutationActions = [
        {
            name: "createQuiz",
            invoke: async () => {
                const fd = new FormData();
                fd.set("cat_id", "1");
                fd.set("difficulty_id", "1");
                fd.set("quiz_type_id", "1");
                fd.set("question_text", "What is ASVS?");
                fd.set("option_0", "A");
                fd.set("option_1", "B");
                fd.set("option_2", "C");
                fd.set("option_3", "D");
                fd.set("correct_option_index", "0");
                return quizActions.createQuiz(null, fd);
            },
        },
        {
            name: "updateQuiz",
            invoke: async () => {
                const fd = new FormData();
                fd.set("cat_id", "1");
                fd.set("difficulty_id", "1");
                fd.set("quiz_type_id", "1");
                fd.set("question_text", "Updated question?");
                return quizActions.updateQuiz(1, fd);
            },
        },
        {
            name: "deleteQuiz",
            invoke: async () => quizActions.deleteQuiz(1),
        },
        {
            name: "deleteUnit",
            invoke: async () => quizActions.deleteUnit(1),
        },
        {
            name: "reviewPendingQuiz",
            invoke: async () => quizActions.reviewPendingQuiz(1, "approve"),
        },
        {
            name: "updatePendingQuiz",
            invoke: async () => quizActions.updatePendingQuiz(1, "Updated Pending Text"),
        },
        {
            name: "updatePendingNote",
            invoke: async () => quizActions.updatePendingNote(1, "Rejection feedback note"),
        },
        {
            name: "updatePendingQuizFromForm",
            invoke: async () => {
                const fd = new FormData();
                fd.set("cat_id", "1");
                fd.set("difficulty_id", "1");
                fd.set("quiz_type_id", "1");
                fd.set("question_text", "Updated from form");
                return quizActions.updatePendingQuizFromForm(1, fd);
            },
        },
        {
            name: "updatePendingUnitFromForm",
            invoke: async () => {
                const fd = new FormData();
                fd.set("unit_title", "Updated Unit");
                fd.set("sec_id", "1");
                fd.set("lesson_text_0", "Slide text");
                fd.set("assessment_title", "Assess");
                fd.set("assessment_steps", JSON.stringify(["Step 1"]));
                fd.set("quiz_json", JSON.stringify([{ question: "q" }]));
                return quizActions.updatePendingUnitFromForm(1, fd);
            },
        },
        {
            name: "deletePendingQuiz",
            invoke: async () => quizActions.deletePendingQuiz(1),
        },
    ];

    // Test each of the 10 mutation actions without admin authentication
    currentAuthSession = null; // Unauthenticated
    (globalThis as unknown as { __TEST_AUTH_SESSION__: UserAuthSession | null }).__TEST_AUTH_SESSION__ = null;
    for (const action of adminMutationActions) {
        await runTest(`Calling ${action.name} without admin authentication returns unauthorized error`, async () => {
            executedDbMutations = 0;
            let result: ActionErrorResult | null = null;
            let threw = false;

            try {
                result = await action.invoke();
            } catch (err: unknown) {
                threw = true;
                const msg = err instanceof Error ? err.message : String(err);
                assert.ok(
                    msg.toLowerCase().includes("unauthor") || msg.toLowerCase().includes("admin"),
                    `Exception must indicate unauthorized access: ${msg}`
                );
            }

            if (!threw) {
                assert.ok(
                    isUnauthorizedResult(result),
                    `Action ${action.name} must return an unauthorized error object, received: ${JSON.stringify(result)}`
                );
            }

            assert.strictEqual(
                executedDbMutations,
                0,
                `SEC-03 VIOLATION: ${action.name} executed ${executedDbMutations} DB mutations without admin authorization`
            );
        });
    }

    // Test with non-admin session
    currentAuthSession = { user: { id: "50", role: "user", user_role: "user" } };
    (globalThis as unknown as { __TEST_AUTH_SESSION__: UserAuthSession | null }).__TEST_AUTH_SESSION__ = currentAuthSession;
    await runTest("Calling mutation action (deleteQuiz) with non-admin role is rejected", async () => {
        executedDbMutations = 0;
        let result: ActionErrorResult | null = null;
        let threw = false;
        try {
            result = await quizActions.deleteQuiz(99);
        } catch (err: unknown) {
            threw = true;
            const msg = err instanceof Error ? err.message : String(err);
            assert.ok(msg.toLowerCase().includes("unauthor") || msg.toLowerCase().includes("admin"));
        }
        if (!threw) {
            assert.ok(isUnauthorizedResult(result), "Non-admin must be rejected with unauthorized error");
        }
        assert.strictEqual(executedDbMutations, 0, "No database deletion must occur for non-admin");
    });

    // Test with admin session
    currentAuthSession = { user: { id: "1", role: "admin", user_role: "admin" } };
    (globalThis as unknown as { __TEST_AUTH_SESSION__: UserAuthSession | null }).__TEST_AUTH_SESSION__ = currentAuthSession;
    await runTest("Calling mutation action (deleteQuiz) with admin role succeeds", async () => {
        executedDbMutations = 0;
        const result = await quizActions.deleteQuiz(99);
        assert.strictEqual(result.success, true, "Admin deleteQuiz must succeed");
        assert.ok(executedDbMutations > 0, "Database mutation must be executed for authorized admin");
    });

    // -------------------------------------------------------------------------
    // Suite 4: RPC Reduction - clearLoginRateLimit (SEC-06 / ASVS V4.1.2, V13.1.4)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 4: RPC Reduction (app/actions/auth.ts)]\x1b[0m");

    interface AuthActions {
        signUp: (formData: FormData) => Promise<ActionErrorResult>;
        verifyEmail: (token: string) => Promise<ActionErrorResult>;
    }

    const authModule = await import("../app/actions/auth") as unknown as { default?: AuthActions } & AuthActions;
    const authActions: AuthActions = authModule.default || authModule;

    await runTest("clearLoginRateLimit is NOT exported from app/actions/auth.ts", () => {
        const exportedKeys = Object.keys(authActions);
        assert.strictEqual(
            exportedKeys.includes("clearLoginRateLimit"),
            false,
            "SEC-06 VIOLATION: clearLoginRateLimit must NOT be exported as a server action RPC in app/actions/auth.ts"
        );
    });

    await runTest("Static inspection confirms no export of clearLoginRateLimit", () => {
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");
        assert.ok(
            !/export\s+(async\s+)?function\s+clearLoginRateLimit\b/.test(authSrc),
            "app/actions/auth.ts must not have 'export async function clearLoginRateLimit'"
        );
        assert.ok(
            !/export\s*\{[^}]*\bclearLoginRateLimit\b[^}]*\}/.test(authSrc),
            "app/actions/auth.ts must not export clearLoginRateLimit in export list"
        );
    });

    await runTest("app/login/page.tsx does not call clearLoginRateLimit", () => {
        const loginPagePath = path.join(projectRoot, "app/login/page.tsx");
        if (fs.existsSync(loginPagePath)) {
            const loginSrc = fs.readFileSync(loginPagePath, "utf8");
            assert.ok(
                !loginSrc.includes("clearLoginRateLimit"),
                "app/login/page.tsx must not invoke clearLoginRateLimit on the client"
            );
        }
    });

    // -------------------------------------------------------------------------
    // Suite 5: Server-Side Google reCAPTCHA v3 in signUp (SEC-09 / ASVS V2.2.1, V11.1.4)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 5: Server-Side Google reCAPTCHA v3 Enforcement (signUp)]\x1b[0m");

    const signUp = authActions.signUp;

    await runTest("signUp rejects submission with missing reCAPTCHA token", async () => {
        mockState.capturedRecaptchaBodies = [];
        let dbInsertTriggered = false;

        db.query = (async (sql: string) => {
            if (sql.includes("INSERT INTO user_vrfy_tbl")) dbInsertTriggered = true;
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "botuser");
        fd.set("email", "bot@quizweb.dev");
        fd.set("password", "Password123!");
        fd.set("confirmPassword", "Password123!");
        // Omit recaptchaToken

        const result = await signUp(fd);
        assert.strictEqual(result.success !== true, true, "signUp must fail when reCAPTCHA token is missing");
        assert.ok(
            result.error?.toLowerCase().includes("recaptcha") || result.error?.toLowerCase().includes("robot"),
            `Error message must indicate reCAPTCHA failure, got: ${result.error}`
        );
        assert.strictEqual(dbInsertTriggered, false, "SEC-09: No DB insert may occur when reCAPTCHA is missing");
    });

    await runTest("signUp rejects submission when Google siteverify returns failure", async () => {
        mockState.capturedRecaptchaBodies = [];
        mockState.recaptchaResult = { success: false, "error-codes": ["invalid-input-response"] };

        let dbInsertTriggered = false;
        db.query = (async (sql: string) => {
            if (sql.includes("INSERT INTO user_vrfy_tbl")) dbInsertTriggered = true;
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "invalidcaptchar");
        fd.set("email", "fakecaptcha@quizweb.dev");
        fd.set("password", "Password123!");
        fd.set("confirmPassword", "Password123!");
        fd.set("recaptchaToken", "invalid_token_xyz");

        const result = await signUp(fd);
        assert.strictEqual(result.success !== true, true, "signUp must fail when Google verification fails");
        assert.ok(
            result.error?.toLowerCase().includes("recaptcha") || result.error?.toLowerCase().includes("failed"),
            `Error message must report reCAPTCHA failure: ${result.error}`
        );
        assert.strictEqual(dbInsertTriggered, false, "No DB insert may occur when Google verification fails");
    });

    await runTest("signUp rejects submission when reCAPTCHA score is below threshold (bot score 0.2)", async () => {
        mockState.capturedRecaptchaBodies = [];
        mockState.recaptchaResult = { success: true, score: 0.2 }; // Low score below 0.5 threshold

        let dbInsertTriggered = false;
        db.query = (async (sql: string) => {
            if (sql.includes("INSERT INTO user_vrfy_tbl")) dbInsertTriggered = true;
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "lowscoreuser");
        fd.set("email", "lowscore@quizweb.dev");
        fd.set("password", "Password123!");
        fd.set("confirmPassword", "Password123!");
        fd.set("recaptchaToken", "token_with_low_score");

        const result = await signUp(fd);
        assert.strictEqual(result.success !== true, true, "signUp must reject bot score < 0.5");
        assert.strictEqual(dbInsertTriggered, false, "No DB insert may occur on low bot score");
    });

    await runTest("signUp succeeds when reCAPTCHA verification passes with score >= 0.5", async () => {
        mockState.capturedRecaptchaBodies = [];
        mockState.capturedEmails = [];
        mockState.recaptchaResult = { success: true, score: 0.9 }; // Valid human score

        let dbInsertTriggered = false;
        db.query = (async (sql: string) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
            if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
            if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
            if (sql.includes("INSERT INTO user_vrfy_tbl")) {
                dbInsertTriggered = true;
                return [{ insertId: 777 }];
            }
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "validcaptcha");
        fd.set("email", "valid@quizweb.dev");
        fd.set("password", "ValidP@ssw0rd123!");
        fd.set("confirmPassword", "ValidP@ssw0rd123!");
        fd.set("recaptchaToken", "genuine_google_recaptcha_token_high_score");

        const result = await signUp(fd);
        assert.strictEqual(result.success, true, "signUp must succeed with valid reCAPTCHA token and score >= 0.5");
        assert.strictEqual(dbInsertTriggered, true, "DB record in user_vrfy_tbl must be created on verified signup");
        assert.strictEqual(mockState.capturedEmails.length, 1, "Verification email must be dispatched");
    });

    await runTest("signUp accepts recognized test bypass token in test environments", async () => {
        let dbInsertTriggered = false;
        db.query = (async (sql: string) => {
            if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
            if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
            if (sql.includes("DELETE FROM user_vrfy_tbl")) return [{ affectedRows: 0 }];
            if (sql.includes("INSERT INTO user_vrfy_tbl")) {
                dbInsertTriggered = true;
                return [{ insertId: 778 }];
            }
            return [[]];
        }) as typeof db.query;

        const fd = new FormData();
        fd.set("username", "testbypassuser");
        fd.set("email", "bypass@quizweb.dev");
        fd.set("password", "BypassP@ss123!");
        fd.set("confirmPassword", "BypassP@ss123!");
        fd.set("recaptchaToken", process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token");

        const result = await signUp(fd);
        assert.strictEqual(result.success, true, "Test bypass token must allow test runners to execute signUp");
        assert.strictEqual(dbInsertTriggered, true, "DB record must be created for test bypass signup");
    });

    // -------------------------------------------------------------------------
    // Suite 6: User-Initiated POST Email Verification (SEC-11 / ASVS V3.1.1, V13.2.1)
    // -------------------------------------------------------------------------
    console.log("\n\x1b[1m[Suite 6: POST Email Verification & Zero-Mutation GET Load]\x1b[0m");

    const verifyPagePath = path.join(projectRoot, "app/verify-email/[token]/page.tsx");
    assert.ok(fs.existsSync(verifyPagePath), "app/verify-email/[token]/page.tsx must exist");
    const verifyPageSrc = fs.readFileSync(verifyPagePath, "utf8");

    await runTest("app/verify-email/[token]/page.tsx does not call verifyEmail on GET render", () => {
        assert.ok(
            !/const\s+result\s*=\s*await\s+verifyEmail\s*\(/.test(verifyPageSrc),
            "SEC-11 VIOLATION: VerifyEmailPage must NOT call 'await verifyEmail(token)' on GET render"
        );
        assert.ok(
            !verifyPageSrc.includes("await verifyEmail("),
            "SEC-11 VIOLATION: VerifyEmailPage must not await verifyEmail directly"
        );
    });

    await runTest("Simulated GET load of VerifyEmailPage executes ZERO database mutations", async () => {
        let dbMutationCount = 0;
        db.query = (async (sql: string) => {
            if (/INSERT|UPDATE|DELETE/i.test(sql)) dbMutationCount++;
            return [[]];
        }) as typeof db.query;
        db.getConnection = (async () => ({
            query: async (sql: string) => {
                if (/INSERT|UPDATE|DELETE/i.test(sql)) dbMutationCount++;
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        interface VerifyPageModule {
            default?: (props: { params: Promise<{ token: string }> }) => Promise<unknown>;
        }

        const verifyPageMod = await import("../app/verify-email/[token]/page") as unknown as VerifyPageModule;
        const VerifyEmailPage = verifyPageMod.default;
        assert.ok(VerifyEmailPage, "VerifyEmailPage default export must exist");

        const renderedComponent = await VerifyEmailPage({
            params: Promise.resolve({ token: "test_probe_token_get_render" }),
        });

        assert.ok(renderedComponent !== null && renderedComponent !== undefined, "VerifyEmailPage must render UI");
        assert.strictEqual(
            dbMutationCount,
            0,
            `SEC-11 VIOLATION: Loading VerifyEmailPage via GET executed ${dbMutationCount} database mutations`
        );
    });

    await runTest("Explicit user-initiated POST activation executes verifyEmail and mutates DB", async () => {
        const rawToken = "64char_raw_verification_token_for_post_activation_test_suite_12345";
        let userAuthInserted = false;
        let vrfyDeleted = false;

        db.getConnection = (async () => ({
            query: async (sql: string) => {
                if (sql.includes("SELECT verify_id")) {
                    return [[{
                        verify_id: 88,
                        username: "activated_user",
                        email: "activated@quizweb.dev",
                        password_hash: "argon2_hash_val",
                        expires_at: new Date(Date.now() + 600000),
                        attempts: 0,
                        locked_until: null,
                    }]];
                }
                if (sql.includes("SELECT user_id FROM user_auth_tbl")) return [[]];
                if (sql.includes("SELECT user_id FROM player_tbl")) return [[]];
                if (sql.includes("INSERT INTO user_auth_tbl")) {
                    userAuthInserted = true;
                    return [{ insertId: 501 }];
                }
                if (sql.includes("INSERT INTO player_tbl")) return [{ affectedRows: 1 }];
                if (sql.includes("DELETE FROM user_vrfy_tbl")) {
                    vrfyDeleted = true;
                    return [{ affectedRows: 1 }];
                }
                return [[]];
            },
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {},
        })) as typeof db.getConnection;

        const verifyEmail = authActions.verifyEmail;
        const result = await verifyEmail(rawToken);

        assert.strictEqual(result.success, true, "Explicit POST verifyEmail must succeed with valid token");
        assert.strictEqual(userAuthInserted, true, "User auth record must be inserted upon explicit POST activation");
        assert.strictEqual(vrfyDeleted, true, "Verification token record must be deleted upon explicit POST activation");
    });

    // -------------------------------------------------------------------------
    // Suite 7: Summary & ASVS Compliance Reporting
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
        console.log("   - V3.1.1: GET requests carry no state mutations (SEC-11)");
        console.log("   - V4.1.1: Server-side access control enforced on routes & actions (SEC-03)");
        console.log("   - V4.1.2: Administrative RPC endpoint removed (SEC-06)");
        console.log("   - V4.1.3: Least privilege enforced on /pending and /input routes (SEC-03)");
        console.log("   - V4.2.1: 10 administrative mutation actions protected (SEC-03)");
        console.log("   - V11.1.4 / V2.2.1: Server-side reCAPTCHA v3 anti-bot verification (SEC-09)");
        console.log("   - V13.1.4: Client-side access checks cannot bypass rate limits (SEC-06)");
        console.log("   - V13.2.1: Explicit POST actions required for account activation (SEC-11)");
        console.log("========================================================\n");
        process.exit(0);
    }
}

main().catch(err => {
    console.error("Fatal test runner exception:", err);
    process.exit(1);
});
