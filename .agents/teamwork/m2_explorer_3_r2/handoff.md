# Milestone 2 Remediation Analysis & Fix Strategy Report

**Role:** Milestone 2 Remediation Explorer 3 (`m2_explorer_3_r2`)  
**Working Directory:** `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_3_r2`  
**Date:** 2026-10-12T22:05:00Z  
**Status:** Investigation Complete & Fix Specification Formulated  

---

## 1. Observation

### 1.1 Direct Observation: Unscoped reCAPTCHA Test Bypass in Production (`app/actions/auth.ts`)
In `app/actions/auth.ts`, lines 26–38:
```typescript
/**
 * Helper: Server-side Google reCAPTCHA v3 verification (SEC-09)
 */
async function verifyRecaptchaToken(token: string | null | undefined): Promise<{ success: boolean; score?: number }> {
    if (!token || typeof token !== "string" || !token.trim()) {
        return { success: false };
    }

    const trimmed = token.trim();

    // 1. Support test environments: bypass tokens
    const testBypass = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
    if (trimmed === testBypass || trimmed === "test-bypass-token") {
        return { success: true, score: 1.0 };
    }
```
**Direct Observations:**
1. Lines 34–37 are executed unconditionally before inspecting `process.env.NODE_ENV` or checking whether the application is running in an automated test environment.
2. In production deployments where `process.env.RECAPTCHA_BYPASS_TOKEN` is unset, the fallback default `"test-bypass-recaptcha-token"` is active.
3. The secondary literal string `"test-bypass-token"` is accepted unconditionally under all deployment configurations.
4. Line 42 checks `if (process.env.NODE_ENV === "test")` for secret key fallback, demonstrating that environment-based scoping was already understood in the codebase, but was omitted from the bypass evaluation on lines 34–37.

#### Empirical Verification of Production Bypass
Executed standalone reproduction script with `NODE_ENV = "production"`, `RECAPTCHA_SECRET_KEY = "prod_secret_key_google"`, and `RECAPTCHA_BYPASS_TOKEN` unset:
```bash
npx --yes tsx -e '
process.env.RESEND_API_KEY = "dummy";
process.env.NODE_ENV = "production";
process.env.RECAPTCHA_SECRET_KEY = "prod_secret_key_google";
delete process.env.RECAPTCHA_BYPASS_TOKEN;

(async () => {
  const dbMod = await import("./lib/db");
  const db = dbMod.db || dbMod.default?.db;
  let dbReached = false;
  db.query = async () => { dbReached = true; return [[]]; };

  const mod = await import("./app/actions/auth");
  const authActions = mod.default || mod;
  const signUp = authActions.signUp;
  
  const fd = new FormData();
  fd.set("username", "testbot");
  fd.set("email", "testbot@example.com");
  fd.set("password", "Password123!");
  fd.set("confirmPassword", "Password123!");
  fd.set("recaptchaToken", "test-bypass-recaptcha-token");

  await signUp(fd);
  if (dbReached) {
    console.error("CONFIRMED: reCAPTCHA bypassed in production with static test token!");
    process.exit(1);
  } else {
    console.log("CLEAN: reCAPTCHA bypass blocked in production.");
  }
})();
'
```
**Observed Result:**
The command exited with code 1:
`CONFIRMED: reCAPTCHA bypassed in production with static test token!`
When supplied with `"test-bypass-recaptcha-token"`, `signUp` bypassed reCAPTCHA v3 verification in production mode and proceeded to database mutations (`dbReached === true`).

---

### 1.2 Direct Observation: Fail-Open Session Claim Fallback in `requireAdmin()` (`app/actions/quiz.ts`)
In `app/actions/quiz.ts`, lines 129–156:
```typescript
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId],
    );
    if (rows && rows.length > 0) {
      if (rows[0]?.user_role === "admin") {
        return { id: String(userId), role: "admin" };
      }
      return false;
    }
  } catch {
    // If DB error, check session claims
    const sessionRole = session?.user?.role || session?.user?.user_role;
    if (sessionRole === "admin") {
      return { id: String(userId), role: "admin" };
    }
    return false;
  }

  // Fallback to session claims if no DB rows returned
  const sessionRole = session?.user?.role || session?.user?.user_role;
  if (sessionRole === "admin") {
    return { id: String(userId), role: "admin" };
  }

  return false;
```
**Direct Observations:**
1. If `rows.length === 0` (e.g. the user account was deleted or revoked from `user_auth_tbl`, or an invalid `userId` exists in a forged/stale JWT), lines 134–139 evaluate to false. Execution exits the `try` block and reaches lines 149–154.
2. Lines 150–153 inspect `sessionRole = session?.user?.role || session?.user?.user_role`. If the stale JWT contains `role: "admin"`, access is granted: `{ id: String(userId), role: "admin" }`.
3. In lines 140–147 (`catch` block), if a database exception occurs, the function similarly falls back to trusting `sessionRole === "admin"`.

#### Empirical Verification of Fail-Open Fallback on Missing Database Record
Executed probe simulating a deleted/non-existent user with a stale admin session:
```bash
npx --yes tsx -e '
(async () => {
  const dbMod = await import("./lib/db");
  const db = dbMod.db || dbMod.default?.db;
  db.query = async (sql) => {
    if (sql.includes("SELECT user_role FROM user_auth_tbl")) {
      return [[]]; // User not found in database! (deleted/revoked)
    }
    return [[{ affectedRows: 1 }]];
  };

  (globalThis).__TEST_AUTH_SESSION__ = {
    user: { id: "deleted_user_999", role: "admin" }
  };

  const quizMod = await import("./app/actions/quiz");
  const requireAdmin = quizMod.requireAdmin || quizMod.default?.requireAdmin;
  const isAuthorized = await requireAdmin();
  console.log("requireAdmin result for deleted/nonexistent user with stale JWT:", isAuthorized);
  if (isAuthorized) {
    console.error("CONFIRMED VULNERABILITY: Fail-open fallback granted admin access to deleted/nonexistent user!");
  }
})();
'
```
**Observed Result:**
Output:
```
requireAdmin result for deleted/nonexistent user with stale JWT: { id: 'deleted_user_999', role: 'admin' }
CONFIRMED VULNERABILITY: Fail-open fallback granted admin access to deleted/nonexistent user!
```

---

### 1.3 Direct Observation: Existing Test Suite Compatibility
Executed all 4 test suites against current repository state:
```bash
npx --yes tsx tests/test-m1.ts && npx --yes tsx tests/test-m2.ts && npx --yes tsx tests/test-m2-challenger-1.ts && npx --yes tsx tests/test-m2-challenger-2.ts
```
**Observed Result:**
1. `tests/test-m1.ts`: 13/13 passed.
2. `tests/test-m2.ts`: 31/31 passed.
3. `tests/test-m2-challenger-1.ts`: 79/79 passed.
4. `tests/test-m2-challenger-2.ts`: 32/32 passed.
All 155 test assertions passed cleanly.

---

## 2. Logic Chain

1. **Forensic Integrity Mandate & OWASP Standards:**
   - Under OWASP ASVS v4.0.3 V2.2.1 and V11.1.4, applications must implement server-side anti-automation controls on sensitive operations (including account registration) to mitigate automated bots, spamming, and enumeration.
   - Under OWASP ASVS v4.0.3 V4.1.1, access control rules must be enforced on a trusted service layer on the server side and must fail closed (fail secure). Unverified client-side session claims must never override authoritative database records.
   - The Forensic Auditor holds a binary veto: any backdoor bypass active in production constitutes an `INTEGRITY VIOLATION`.

2. **Deduction for Defect 1 (Unscoped reCAPTCHA Test Bypass):**
   - From Observation 1.1, `verifyRecaptchaToken` unconditionally checks `trimmed === testBypass || trimmed === "test-bypass-token"`.
   - In production deployments where `process.env.RECAPTCHA_BYPASS_TOKEN` is unset, `testBypass` defaults to `"test-bypass-recaptcha-token"`.
   - Any external client or automated script can bypass Google reCAPTCHA v3 verification by passing `recaptchaToken: "test-bypass-recaptcha-token"` in their `FormData`.
   - Observation 1.1 proved empirically that registration database queries execute when this token is passed under `NODE_ENV = "production"`.
   - **Remediation Logic:** The bypass check MUST be encapsulated within `if (process.env.NODE_ENV !== "production")`. In production, the token must be submitted to the Google siteverify endpoint (or fail closed if `RECAPTCHA_SECRET_KEY` is missing). In non-production/test environments (`process.env.NODE_ENV !== "production"`), test runners can still use `RECAPTCHA_BYPASS_TOKEN` or `"test-bypass-recaptcha-token"`.

3. **Deduction for Defect 2 (Fail-Open Fallback in `requireAdmin`):**
   - From Observation 1.2, when `db.query` for `SELECT user_role FROM user_auth_tbl` returns `[]` (0 rows), execution skips the role check and falls through to lines 150–153.
   - If the user's session object contains `role: "admin"`, access is granted even though the user does not exist in `user_auth_tbl`.
   - Similarly, if `db.query` throws an unhandled database error, the `catch` block grants access if `sessionRole === "admin"`.
   - Stale JWTs (e.g. valid for 30 days) from deleted admins, or tampered tokens where `id` does not exist, can execute administrative mutations.
   - **Remediation Logic:** Both conditions (0 rows returned or DB exception caught) must fail closed (`return false`). Lines 149–155 must be removed entirely. Access must only be granted when `rows && rows.length > 0 && rows[0]?.user_role === "admin"`.

4. **Test Suite Compatibility Analysis:**
   - In `tests/test-m1.ts`, `tests/test-m2.ts`, `tests/test-m2-challenger-1.ts`, and `tests/test-m2-challenger-2.ts`, tests are executed in Node.js where `process.env.NODE_ENV` is unset (`undefined`) or `"test"`.
   - Under `if (process.env.NODE_ENV !== "production")`, `NODE_ENV !== "production"` evaluates to `true`, preserving test bypass functionality for test harnesses.
   - For `requireAdmin()`, all test suites mock `user_auth_tbl` queries returning `[[{ user_role: "admin" }]]` for authorized admins and `[[{ user_role: "user" }]]` for unauthorized callers. None of the test suites rely on missing DB rows returning admin access.
   - Therefore, the remediation will not break any existing test assertions.

---

## 3. Caveats

1. **Environment Variable Configuration in Production:**
   - In production environments, `RECAPTCHA_SECRET_KEY` must be configured in `.env`. If it is absent, `verifyRecaptchaToken` correctly logs an error and returns `{ success: false }` (failing closed).
2. **Read-Only Explorer Scope:**
   - As an Explorer agent, no source code modifications have been directly committed to `app/actions/auth.ts` or `app/actions/quiz.ts`. The implementation must be executed by the designated Worker agent using the precise specifications provided below.
3. **No Unintended Side Effects on Milestone 1 & 2 Requirements:**
   - The changes are strictly localized to `verifyRecaptchaToken` in `app/actions/auth.ts` and `requireAdmin` in `app/actions/quiz.ts`. No route middlewares, client components, or database migrations are altered.

---

## 4. Conclusion & Recommended Fix Specifications

### Recommended Fix Specifications

#### Fix 1: Scope reCAPTCHA Test Bypass to Non-Production (`app/actions/auth.ts`)
**Target File:** `app/actions/auth.ts`  
**Target Lines:** 33–38  

**Before:**
```typescript
    // 1. Support test environments: bypass tokens
    const testBypass = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
    if (trimmed === testBypass || trimmed === "test-bypass-token") {
        return { success: true, score: 1.0 };
    }
```

**After:**
```typescript
    // 1. Support test environments: bypass tokens strictly scoped to non-production
    if (process.env.NODE_ENV !== "production") {
        const testBypass = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
        if (trimmed === testBypass || trimmed === "test-bypass-token") {
            return { success: true, score: 1.0 };
        }
    }
```

---

#### Fix 2: Enforce Fail-Closed Access Control in `requireAdmin()` (`app/actions/quiz.ts`)
**Target File:** `app/actions/quiz.ts`  
**Target Lines:** 129–156  

**Before:**
```typescript
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId],
    );
    if (rows && rows.length > 0) {
      if (rows[0]?.user_role === "admin") {
        return { id: String(userId), role: "admin" };
      }
      return false;
    }
  } catch {
    // If DB error, check session claims
    const sessionRole = session?.user?.role || session?.user?.user_role;
    if (sessionRole === "admin") {
      return { id: String(userId), role: "admin" };
    }
    return false;
  }

  // Fallback to session claims if no DB rows returned
  const sessionRole = session?.user?.role || session?.user?.user_role;
  if (sessionRole === "admin") {
    return { id: String(userId), role: "admin" };
  }

  return false;
```

**After:**
```typescript
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
      [userId],
    );
    if (rows && rows.length > 0) {
      if (rows[0]?.user_role === "admin") {
        return { id: String(userId), role: "admin" };
      }
      return false;
    }
    // Fail closed: User does not exist in user_auth_tbl
    return false;
  } catch {
    // Fail closed: On database failure, do not trust client session claims
    return false;
  }
```

---

## 5. Verification Method

### 5.1 Verifying Production reCAPTCHA Bypass Remediation
Run the following standalone command:
```bash
npx --yes tsx -e '
process.env.RESEND_API_KEY = "dummy";
process.env.NODE_ENV = "production";
process.env.RECAPTCHA_SECRET_KEY = "prod_secret_key_google";
delete process.env.RECAPTCHA_BYPASS_TOKEN;

(async () => {
  const dbMod = await import("./lib/db");
  const db = dbMod.db || dbMod.default?.db;
  let dbReached = false;
  db.query = async () => { dbReached = true; return [[]]; };

  const mod = await import("./app/actions/auth");
  const authActions = mod.default || mod;
  const signUp = authActions.signUp;
  
  const fd = new FormData();
  fd.set("username", "testbot");
  fd.set("email", "testbot@example.com");
  fd.set("password", "Password123!");
  fd.set("confirmPassword", "Password123!");
  fd.set("recaptchaToken", "test-bypass-recaptcha-token");

  const res = await signUp(fd);
  if (dbReached) {
    console.error("FAIL: reCAPTCHA bypassed in production with static test token!");
    process.exit(1);
  }
  if (res?.error !== "reCAPTCHA verification failed.") {
    console.error("FAIL: Expected reCAPTCHA verification failed error, got:", res);
    process.exit(1);
  }
  console.log("PASS: reCAPTCHA bypass successfully blocked in production.");
})();
'
```
**Expected Post-Remediation Output:**
- Prints `"PASS: reCAPTCHA bypass successfully blocked in production."`
- Exits with code 0.

### 5.2 Verifying `requireAdmin()` Fail-Closed Remediation
Run the following standalone probe:
```bash
npx --yes tsx -e '
(async () => {
  const dbMod = await import("./lib/db");
  const db = dbMod.db || dbMod.default?.db;
  
  // Test Case A: User not found in user_auth_tbl (0 rows)
  db.query = async (sql) => {
    if (sql.includes("SELECT user_role FROM user_auth_tbl")) return [[]];
    return [[{ affectedRows: 1 }]];
  };
  (globalThis).__TEST_AUTH_SESSION__ = { user: { id: "deleted_999", role: "admin" } };

  const quizMod = await import("./app/actions/quiz");
  const requireAdmin = quizMod.requireAdmin || quizMod.default?.requireAdmin;
  
  const resA = await requireAdmin();
  if (resA !== false) {
    console.error("FAIL: requireAdmin did not fail closed on missing DB row! Got:", resA);
    process.exit(1);
  }

  // Test Case B: Database error thrown
  db.query = async () => { throw new Error("DB Connection Error"); };
  const resB = await requireAdmin();
  if (resB !== false) {
    console.error("FAIL: requireAdmin did not fail closed on DB error! Got:", resB);
    process.exit(1);
  }

  console.log("PASS: requireAdmin properly fails closed on 0 DB rows and DB errors.");
})();
'
```
**Expected Post-Remediation Output:**
- Prints `"PASS: requireAdmin properly fails closed on 0 DB rows and DB errors."`
- Exits with code 0.

### 5.3 Regression Test Verification Commands
Run all test suites to confirm zero regressions:
```bash
npx --yes tsx tests/test-m1.ts
npx --yes tsx tests/test-m2.ts
npx --yes tsx tests/test-m2-challenger-1.ts
npx --yes tsx tests/test-m2-challenger-2.ts
```
**Expected Output:** All test suites pass with 100% assertions satisfied.

### Invalidation Conditions for Rejection
The remediation strategy is invalidated if:
1. `npx --yes tsx tests/test-m2.ts` or any challenger test suite fails.
2. The empirical command in Section 5.1 allows `dbReached === true` in production.
3. The empirical probe in Section 5.2 returns an authorized object `{ role: "admin" }` when 0 rows are returned from the database.
