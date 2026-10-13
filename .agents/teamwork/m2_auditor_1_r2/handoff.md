# Milestone 2 Forensic Integrity Audit Report

**Work Product Audited:** Milestone 2 Implementation (Route Protection & Access Control: SEC-03, SEC-06, SEC-09, SEC-11)  
**Auditor:** Forensic Auditor (`m2_auditor_1_r2`)  
**Working Directory:** `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_auditor_1_r2`  
**Profile:** General Project (Integrity Forensics & Adversarial Review)  
**Date:** 2026-10-12T21:59:00Z  
**Verdict:** 🔴 **INTEGRITY VIOLATION**

---

## 1. Observation

### 1.1 Direct Observations of Touched Files

#### Observation 1.1.1: Unscoped Backdoor Test Bypass in Production (`app/actions/auth.ts`)
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
Direct observation:
1. Lines 34–37 are executed unconditionally before checking `process.env.NODE_ENV` or verifying whether the application is running in a test environment.
2. The default value `"test-bypass-recaptcha-token"` is applied whenever `process.env.RECAPTCHA_BYPASS_TOKEN` is unset (the default in production deployments).
3. The hardcoded token string `"test-bypass-token"` is accepted unconditionally under all configurations.
4. Line 42 checks `if (process.env.NODE_ENV === "test")` when secret keys are absent, demonstrating that environment-based gating was known and applied elsewhere in the same function, but omitted from lines 34–37.

#### Observation 1.1.2: Empirical Proof of Production reCAPTCHA Bypass
An empirical test was executed with `NODE_ENV = "production"` and `RECAPTCHA_SECRET_KEY = "prod_secret_key_google"` (with `RECAPTCHA_BYPASS_TOKEN` unset).

Command executed:
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
  db.query = async (sql) => {
    dbReached = true;
    return [[]];
  };

  const mod = await import("./app/actions/auth");
  const authActions = mod.default || mod;
  const signUp = authActions.signUp;
  
  // Test 1: Calling with test-bypass-recaptcha-token
  const fd1 = new FormData();
  fd1.set("username", "testbot1");
  fd1.set("email", "testbot1@example.com");
  fd1.set("password", "Password123!");
  fd1.set("confirmPassword", "Password123!");
  fd1.set("recaptchaToken", "test-bypass-recaptcha-token");

  await signUp(fd1);
  console.log("Test 1 (test-bypass-recaptcha-token in production) dbReached:", dbReached);

  // Test 2: Calling with test-bypass-token
  dbReached = false;
  const fd2 = new FormData();
  fd2.set("username", "testbot2");
  fd2.set("email", "testbot2@example.com");
  fd2.set("password", "Password123!");
  fd2.set("confirmPassword", "Password123!");
  fd2.set("recaptchaToken", "test-bypass-token");

  await signUp(fd2);
  console.log("Test 2 (test-bypass-token in production) dbReached:", dbReached);

  // Test 3: Calling with fake/invalid token in production
  dbReached = false;
  const fd3 = new FormData();
  fd3.set("username", "testbot3");
  fd3.set("email", "testbot3@example.com");
  fd3.set("password", "Password123!");
  fd3.set("confirmPassword", "Password123!");
  fd3.set("recaptchaToken", "random_unauthorized_token");

  const res3 = await signUp(fd3);
  console.log("Test 3 (random token in production) dbReached:", dbReached, "error:", res3?.error);
})();
'
```

Output:
```
Test 1 (test-bypass-recaptcha-token in production) dbReached: true
Test 2 (test-bypass-token in production) dbReached: true
Test 3 (random token in production) dbReached: false error: reCAPTCHA verification failed.
```
Result: When supplied with `"test-bypass-recaptcha-token"` or `"test-bypass-token"`, `signUp` proceeds past reCAPTCHA verification to execute database mutations (`dbReached: true`), completely bypassing Google reCAPTCHA v3 in production.

#### Observation 1.1.3: Fail-Open Session Claim Fallback in `requireAdmin()` (`app/actions/quiz.ts`)
In `app/actions/quiz.ts`, lines 130–156:
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
Direct observation: If `rows.length === 0` (e.g. an account was deleted or purged from `user_auth_tbl`), execution reaches lines 149–153. If the stale session JWT still contains `role === "admin"`, access is granted rather than failing closed.

#### Observation 1.1.4: Authentic Route Middleware Implementation (`middleware.ts`)
`middleware.ts` was created at the project root:
- Wrapped with Auth.js `auth()`.
- Explicit route matcher: `["/pending/:path*", "/input/:path*"]` and inline pathname inspection.
- Unauthenticated requests receive HTTP 307 redirect to `/login?callbackUrl=...`.
- Authenticated requests with `role !== "admin"` receive HTTP 403 (for JSON) or redirect to `/home`.
- Authenticated admin requests (`role === "admin"`) proceed with `NextResponse.next()`.
- Public routes bypass route checks.

#### Observation 1.1.5: 10 Admin Mutation Actions Guarded (`app/actions/quiz.ts`)
All 10 administrative mutation functions prepend:
`if (!(await requireAdmin())) return { error: "Unauthorized" };`
Guarded actions:
1. `deleteUnit(unitId: number)` (line 657)
2. `createQuiz(state: unknown, formData: FormData)` (line 1168)
3. `deleteQuiz(quizId: number)` (line 1260)
4. `updateQuiz(quizId: number, formData: FormData)` (line 1289)
5. `reviewPendingQuiz(pendingId: number, decision: "approve" | "reject", rejectionNotes?: string)` (line 1554)
6. `updatePendingQuiz(pendingId: number, questionText: string)` (line 1643)
7. `updatePendingNote(pendingId: number, pendingNote: string)` (line 1668)
8. `updatePendingQuizFromForm(pendingId: number, formData: FormData)` (line 1693)
9. `updatePendingUnitFromForm(pendingId: number, formData: FormData)` (line 1746)
10. `deletePendingQuiz(pendingId: number)` (line 1838)

#### Observation 1.1.6: Public RPC Export Removal (`app/actions/auth.ts`, `app/login/page.tsx`)
- `export async function clearLoginRateLimit` was deleted from `app/actions/auth.ts`.
- `Object.keys(authModule).includes("clearLoginRateLimit")` evaluates to `false`.
- `app/login/page.tsx` import and client invocation of `clearLoginRateLimit` were removed.
- Rate limits are cleared solely inside `auth.ts:63` upon successful password verification.

#### Observation 1.1.7: User-Initiated POST Email Verification (`app/verify-email/[token]/`)
- `app/verify-email/[token]/page.tsx` renders `<VerifyEmailClient token={token} />` as a Server Component without awaiting or invoking `verifyEmail`.
- Simulated GET load confirms 0 database mutations executed.
- `VerifyEmailClient.tsx` renders an explicit `<form onSubmit={handleActivate} method="POST">` with an "Activate Account" button.
- Only form submission executes `await verifyEmail(token)`.

#### Observation 1.1.8: Test Suite Execution Results
All test suites executed with 100% pass rates in the test environment:
- `tests/test-m2.ts`: 31/31 passed.
- `tests/test-m1.ts`: 13/13 passed.
- `tests/test-m1-challenger.ts`: 25/25 passed.
- `tests/adversarial-m1-challenger2.ts`: 16/16 passed.
- `npx eslint`: 0 errors (3 unused variable warnings).
- `find . -name '*.log' -o -name '*result*' -o -name '*output*'`: 0 pre-populated result artifacts.

---

## 2. Logic Chain

1. **Mandate & Authority:**
   - The Forensic Auditor holds a BINARY VETO: if ANY integrity forensic check fails, the verdict MUST be `INTEGRITY VIOLATION`.
   - Dispatch Check 4 explicitly mandates: *"Check for backdoor test bypasses: verify test bypass tokens are scoped and do not weaken production security."*

2. **Analysis of Observation 1.1.1 & Observation 1.1.2:**
   - In `app/actions/auth.ts:34-37`, `verifyRecaptchaToken` implements:
     ```ts
     const testBypass = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
     if (trimmed === testBypass || trimmed === "test-bypass-token") {
         return { success: true, score: 1.0 };
     }
     ```
   - This bypass logic contains ZERO guards verifying `process.env.NODE_ENV === "test"` or `process.env.NODE_ENV !== "production"`.
   - In any production deployment where `RECAPTCHA_BYPASS_TOKEN` is unset in `.env`, the default string `"test-bypass-recaptcha-token"` is active.
   - Furthermore, the secondary token `"test-bypass-token"` is hardcoded and active unconditionally across all environments.
   - Observation 1.1.2 empirically proved that in `NODE_ENV = "production"` with `RECAPTCHA_SECRET_KEY` configured, a client submitting `"test-bypass-recaptcha-token"` or `"test-bypass-token"` bypasses Google reCAPTCHA v3 verification entirely and triggers registration database queries (`dbReached: true`).

3. **Security Impact:**
   - The purpose of SEC-09 and OWASP ASVS V2.2.1 / V11.1.4 is to prevent automated bots and spammers from flooding registration.
   - Exposing a static, publicly documented bypass token in production allows any automated bot to bypass anti-automation defenses simply by supplying `recaptchaToken: "test-bypass-recaptcha-token"`.
   - Therefore, the test bypass token is NOT scoped to test environments and directly weakens production security.

4. **Forensic Verdict Determination:**
   - Under the Forensic Verification Protocol, Check 4.3 ("verify test bypass tokens are scoped and do not weaken production security") has FAILED.
   - Consequently, the milestone work product cannot be certified as CLEAN.

---

## 3. Caveats

1. **Development Mode vs Production Readiness:**
   - In `ORIGINAL_REQUEST.md`, integrity mode is set to `development`. Under development mode, code reuse and testing helpers are permitted.
   - However, the auditor dispatch prompt explicitly and specifically instructed the auditor to evaluate:
     *"Check for backdoor test bypasses: verify test bypass tokens are scoped and do not weaken production security."*
   - Because the bypass token is active in production deployments, it constitutes a production security bypass backdoor.
2. **Implementation Quality on Other Objectives:**
   - SEC-03 (`middleware.ts` and `app/actions/quiz.ts` admin checks), SEC-06 (`clearLoginRateLimit` RPC removal), and SEC-11 (POST-only email verification) are authentically implemented with high engineering rigor.
   - Aside from the unscoped bypass and the fail-open fallback on 0 DB rows, no facade implementations or hardcoded result spoofing were detected.

---

## 4. Conclusion

### Forensic Verdict: 🔴 INTEGRITY VIOLATION

**Defect Summary:**
1. **Unscoped Backdoor Test Bypass Weakening Production Security (CRITICAL):**
   - **File:** `app/actions/auth.ts:34-37`
   - **Failure:** Static test tokens (`"test-bypass-recaptcha-token"` and `"test-bypass-token"`) are accepted unconditionally without checking `process.env.NODE_ENV !== "production"` or `process.env.NODE_ENV === "test"`.
   - **Remediation Required:** Scope test bypass token evaluation strictly to non-production environments:
     ```typescript
     if (process.env.NODE_ENV !== "production") {
         const testBypass = process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token";
         if (trimmed === testBypass || trimmed === "test-bypass-token") {
             return { success: true, score: 1.0 };
         }
     }
     ```
2. **Fail-Open Session Fallback in `requireAdmin()` on Missing DB Record (MEDIUM):**
   - **File:** `app/actions/quiz.ts:149-153`
   - **Failure:** If `rows.length === 0` (user deleted from DB), code falls back to session claims and approves admin requests if `session.user.role === "admin"`.
   - **Remediation Required:** Fail closed (`return false`) when `rows.length === 0`.

---

## 5. Verification Method

### 5.1 Reproducing the Backdoor Bypass in Production
Run the following standalone command from the project root:

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
    console.error("FAIL: reCAPTCHA bypassed in production with static test token!");
    process.exit(1);
  }
})();
'
```

**Expected Result When Defect Exists:**
Exits with code 1: `"FAIL: reCAPTCHA bypassed in production with static test token!"`

**Invalidation Condition for Rejection:**
The rejection is invalidated only when the command above fails to bypass reCAPTCHA and exits code 0 (i.e. `dbReached === false` and `res.error === "reCAPTCHA verification failed."`).
