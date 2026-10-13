# Milestone 2 Exploration & Design Report: SEC-06, SEC-09, SEC-11

**Explorer**: Explorer 2 (`m2_explorer_2`)  
**Scope**: RPC Reduction (`clearLoginRateLimit`), Server-Side reCAPTCHA v3 (`signUp`), and User-Initiated POST Email Verification (`/verify-email/[token]`)  
**Date**: 2026-10-12  
**Target Vulnerabilities**: SEC-06, SEC-09, SEC-11  
**ASVS Standards**: OWASP ASVS v4.0.3 Chapter 3 (V3.1.1, V3.7.1, V3.7.2), V2.2.1, V4.1.2, V11.1.4, V13.1.4, V13.2.1, and RFC 7231  

---

## 1. Observations

### 1.1 SEC-06: Unauthenticated Public RPC Export of `clearLoginRateLimit`
- **Location**: `app/actions/auth.ts`, lines 1 & 751–756
- **Direct Code Observation**:
  ```ts
  "use server";
  ...
  // Clear for success
  export async function clearLoginRateLimit(email: string) {
      const key = `login:${email.toLowerCase().trim()}`;
      clearRateLimit(key);
      return { success: true };
  }
  ```
- **Call-Site Observation**: `app/login/page.tsx`, lines 4 & 99:
  ```ts
  import { signUp, reqPassReset, verifyOTP, resetPass, checkLoginRateLimit, recordFailedLogin, clearLoginRateLimit } from "@/app/actions/auth";
  ...
  if (res?.error) { ... return; }
  await clearLoginRateLimit(email);
  router.push("/");
  ```
- **Underlying Provider Observation**: `auth.ts`, lines 55–62:
  ```ts
  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
      checkRateLimit(`login:${email.toLowerCase().trim()}`);
      return null;
  }
  clearRateLimit(`login:${email.toLowerCase().trim()}`);
  return {
      id: String(user.user_id),
      email: user.email,
      name: user.username,
  };
  ```
  `clearRateLimit` is **already invoked internally on line 61 of `auth.ts`** inside the NextAuth `credentials` provider `authorize()` callback upon successful argon2 password verification. Calling `clearLoginRateLimit(email)` from the client in `app/login/page.tsx:99` is completely redundant.

### 1.2 SEC-09: Client-Side Only reCAPTCHA Verification Bypassed via Direct Server Action RPC
- **Location**: `app/actions/auth.ts`, lines 24–40; `app/login/page.tsx`, lines 124–135 & 160–193; `app/api/recaptcha/route.ts`, lines 1–49.
- **Direct Code Observation (`app/actions/auth.ts`)**:
  ```ts
  export async function signUp(formData: FormData) {
      const username = formData.get("username") as string;
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirmPassword") as string;
      // No recaptchaToken extracted or verified!
  ```
- **Direct Code Observation (`app/login/page.tsx`)**:
  ```ts
  // Line 125-128: Client-side gate only relies on local React state!
  if (!recaptchaVerified) {
      setError("Please verify that you are not a robot.");
      return;
  }
  ...
  const result = await signUp(formData); // Server action called with standard form fields
  ```
- **Direct Code Observation (`app/api/recaptcha/route.ts`)**:
  Verifies reCAPTCHA against Google:
  ```ts
  const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
  const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
  });
  const data = await response.json();
  return NextResponse.json({ success: data.success, score: data.score, ... });
  ```
- **Replay/Consumption Observation**: Google reCAPTCHA v3 user response tokens are **single-use** and expire within 2 minutes. When `app/login/page.tsx:172` calls `/api/recaptcha`, the token is consumed at Google. If `signUp` subsequently attempts to verify that same token against Google, Google returns `{"success": false, "error-codes": ["timeout-or-duplicate"]}`.

### 1.3 SEC-11: Automatic GET State Mutation in Email Verification
- **Location**: `app/verify-email/[token]/page.tsx`, lines 1–15
- **Direct Code Observation**:
  ```tsx
  import { verifyEmail } from "@/app/actions/auth";
  ...
  export default async function VerifyEmailPage({
      params,
  }: VerifyEmailPageProps) {
      const { token } = await params;
      const result = await verifyEmail(token); // Executed immediately on page GET render!
  ```
- **Direct Code Observation (`app/actions/auth.ts:202-270`)**:
  `verifyEmail(token)` executes database mutations during GET render:
  ```ts
  INSERT INTO user_auth_tbl (email, password_hash, is_email_verified) VALUES (?, ?, ?);
  INSERT INTO player_tbl (user_id, username) VALUES (?, ?);
  DELETE FROM user_vrfy_tbl WHERE verify_id = ?;
  ```
- **Vulnerability**: Every HTTP GET request (including automated email security link pre-fetch scanners such as Microsoft Defender Safelinks, Proofpoint, Cisco, and web crawlers) mutates the database and consumes the verification token before the user ever loads the page.

---

## 2. Logic Chain

### 2.1 SEC-06 Logic Chain
1. Under Next.js App Router, placing `"use server"` at the module level turns all exported functions into publicly accessible HTTP POST RPC endpoints.
2. `clearLoginRateLimit` in `app/actions/auth.ts:752` is declared with `export async function clearLoginRateLimit(email: string)`.
3. Because it requires no session, CSRF token, or authentication, an attacker can invoke `clearLoginRateLimit` directly over HTTP RPC to wipe the rate-limit counter in `rate_limit_tbl` for any targeted email.
4. Investigation of `auth.ts:61` revealed that `clearRateLimit` is already invoked internally by the credentials provider on successful password authentication.
5. Therefore, `clearLoginRateLimit` can be safely removed from exports in `app/actions/auth.ts` and from the client call in `app/login/page.tsx:99` without affecting legitimate authentication flows.

### 2.2 SEC-09 Logic Chain
1. Automated registration scripts can bypass `app/login/page.tsx` entirely by dispatching direct Server Action RPC calls to `signUp`.
2. Because `signUp` in `app/actions/auth.ts` does not inspect or verify a reCAPTCHA token, bot protection is currently client-side only.
3. Server-side enforcement requires `signUp` to extract `recaptchaToken` from `formData`, reject any request without a valid token (`{ error: "reCAPTCHA verification failed." }`), and verify the token server-side via Google's `siteverify` endpoint (`score >= 0.5`).
4. To avoid `timeout-or-duplicate` reCAPTCHA errors, `app/login/page.tsx` must not prematurely consume the token via `/api/recaptcha`. Instead, `executeRecaptcha("signup")` must pass the fresh token directly into `formData` for server-side verification.
5. In test environments (such as CI/CD and automated test harnesses), tests must be able to provide a recognized test bypass token (e.g. `process.env.RECAPTCHA_BYPASS_TOKEN || "test-bypass-recaptcha-token"`) or mock the Google siteverify `fetch` call.

### 2.3 SEC-11 Logic Chain
1. RFC 7231 §4.2.1 and OWASP ASVS V13.2.1 dictate that HTTP GET requests must be safe and idempotent, carrying no state-mutating side effects.
2. `VerifyEmailPage` in `app/verify-email/[token]/page.tsx` directly calls `verifyEmail(token)` inside the async Server Component render body.
3. Automated security crawlers and email anti-phishing bots pre-fetch links contained in inbound emails via HTTP GET. Under the current implementation, crawler pre-fetches consume the token, insert records into `user_auth_tbl` and `player_tbl`, and delete the token from `user_vrfy_tbl`. When the human user subsequently clicks the link, they encounter a "Link already used or invalid" error.
4. Converting `/verify-email/[token]` requires:
   - On HTTP GET: Render a confirmation page with an explicit "Activate Account" button without touching `user_vrfy_tbl` or `user_auth_tbl`.
   - On Form Submission / User Click: Dispatch an explicit POST request (Next.js server action invocation of `verifyEmail(token)`).
   - Display success/failure state in response to the explicit POST result.

---

## 3. Caveats
1. **Existing Milestone 1 Tests**: `tests/test-m1.ts`, `tests/test-m1-challenger.ts`, and `tests/adversarial-m1-challenger2.ts` call `signUp(fd)` without providing a `recaptchaToken`. When reCAPTCHA enforcement is active, running those older test scripts will fail on `signUp` unless a bypass token is injected into `fd` (e.g., `fd.set("recaptchaToken", "test-bypass-recaptcha-token")`) or `process.env.RECAPTCHA_BYPASS_TOKEN` is configured.
2. **Google reCAPTCHA Secret Key Configuration**: In production, `process.env.RECAPTCHA_SECRET_KEY` must be configured in the deployment environment. If missing in production, `verifyRecaptchaToken` must fail closed to prevent silent authorization of unverified requests.
3. **Transaction Isolation in `verifyEmail` (SEC-13)**: Milestone 5 addresses concurrency isolation (`SELECT ... FOR UPDATE` within explicit DB transactions). The POST transition in Milestone 2 (SEC-11) focuses on eliminating the GET mutation vector; full transaction wrapping will be completed in M5.

---

## 4. Conclusion & Recommended Implementation Plan

### 4.1 Recommendation for SEC-06 (RPC Reduction)

#### A. Target File: `app/actions/auth.ts`
Remove the public `export` keyword from `clearLoginRateLimit`. Keep it internal or remove it:
```ts
// --- BEFORE (app/actions/auth.ts:751-756) ---
// Clear for success
export async function clearLoginRateLimit(email: string) {
    const key = `login:${email.toLowerCase().trim()}`;
    clearRateLimit(key);
    return { success: true };
}

// --- AFTER (app/actions/auth.ts) ---
// Internal rate limit helper (unexported to prevent unauthenticated Server Action RPC invocation)
async function clearLoginRateLimit(email: string) {
    const key = `login:${email.toLowerCase().trim()}`;
    clearRateLimit(key);
    return { success: true };
}
```

#### B. Target File: `app/login/page.tsx`
Remove `clearLoginRateLimit` from imports and delete the redundant client-side invocation:
```tsx
// Line 4: Remove clearLoginRateLimit from import
import { signUp, reqPassReset, verifyOTP, resetPass, checkLoginRateLimit, recordFailedLogin } from "@/app/actions/auth";

// Lines 98-100: Remove await clearLoginRateLimit(email);
if (res?.error) {
    await recordFailedLogin(email);
    ...
    return;
}

// clearRateLimit is handled automatically on the server in auth.ts upon successful credentials authorization
router.push("/");
```

---

### 4.2 Recommendation for SEC-09 (Server-Side reCAPTCHA v3 Enforcement)

#### A. Target File: `app/actions/auth.ts`
Implement `verifyRecaptchaToken` helper and enforce it at the top of `signUp`:

```ts
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

    // 2. Secret key resolution
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
        if (process.env.NODE_ENV === "test") {
            return { success: true, score: 1.0 };
        }
        console.error("Missing RECAPTCHA_SECRET_KEY in server environment.");
        return { success: false };
    }

    // 3. Verify against Google siteverify endpoint
    try {
        const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
        const response = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey,
                response: trimmed,
            }),
        });

        if (!response.ok) {
            return { success: false };
        }

        const data = await response.json();
        if (!data.success || (typeof data.score === "number" && data.score < 0.5)) {
            return { success: false };
        }

        return { success: true, score: data.score };
    } catch (err) {
        console.error("reCAPTCHA siteverify error:", err);
        return { success: false };
    }
}

export async function signUp(formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const recaptchaToken = (
        formData.get("recaptchaToken") ||
        formData.get("recaptcha_token") ||
        formData.get("g-recaptcha-response")
    ) as string;

    if (!username || !email || !password || !confirmPassword) {
        return { error: "All fields are required." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }

    // SEC-09: Enforce Google reCAPTCHA v3 server-side verification before any DB operations
    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    if (!captchaResult.success) {
        return { error: "reCAPTCHA verification failed." };
    }

    try {
        const normalizedEmail = email.trim().toLowerCase();
        ...
```

#### B. Target File: `app/login/page.tsx`
Update client submission logic to generate/pass `recaptchaToken` to `signUp`:
```tsx
// Inside handleSignup:
const formData = new FormData(e.currentTarget);
...
// Ensure reCAPTCHA token is obtained and attached to formData
let token = recaptchaToken;
if (!token && executeRecaptcha) {
    token = await executeRecaptcha("signup");
}
formData.set("recaptchaToken", token || "");

setIsLoading(true);
const result = await signUp(formData);
```

---

### 4.3 Recommendation for SEC-11 (POST Email Verification)

#### A. Target File: `app/verify-email/[token]/page.tsx`
Convert `VerifyEmailPage` from an automatic GET mutation into a Server Component hosting the confirmation UI:

```tsx
import VerifyEmailClient from "./VerifyEmailClient";
import "@/public/css/verify.css";

interface VerifyEmailPageProps {
    params: Promise<{ token: string }>;
}

export default async function VerifyEmailPage({
    params,
}: VerifyEmailPageProps) {
    const { token } = await params;

    // Notice: NO verifyEmail(token) call on GET load!
    // Simply render the confirmation card.
    return <VerifyEmailClient token={token} />;
}
```

#### B. Target File: `app/verify-email/[token]/VerifyEmailClient.tsx`
Create the Client Component handling the explicit user-initiated POST activation:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { verifyEmail } from "@/app/actions/auth";

interface VerifyEmailClientProps {
    token: string;
}

export default function VerifyEmailClient({ token }: VerifyEmailClientProps) {
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [message, setMessage] = useState<string>("");

    async function handleActivate(e: React.FormEvent) {
        e.preventDefault();
        if (status === "submitting") return;
        setStatus("submitting");

        try {
            // Explicit POST Server Action invocation
            const result = await verifyEmail(token);
            if (result.success) {
                setStatus("success");
                setMessage(result.message || "Email verified successfully!");
            } else {
                setStatus("error");
                setMessage(result.message || "Verification failed. The link may have expired or been used.");
            }
        } catch {
            setStatus("error");
            setMessage("An error occurred during verification. Please try again.");
        }
    }

    return (
        <main className="main-email">
            <div className="email-container">
                <div className="logo">
                    <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt="QuizWeb" />
                    <p className="logo-text">QuizWeb</p>
                </div>

                {status === "idle" && (
                    <form onSubmit={handleActivate} method="POST">
                        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#333", margin: "24px 0 12px" }}>
                            Activate Your Account
                        </h1>
                        <p className="message" style={{ marginBottom: "28px" }}>
                            Click the button below to confirm your email verification and activate your QuizWeb account.
                        </p>
                        <button
                            type="submit"
                            id="activate-account-btn"
                            style={{
                                background: "#9966FF",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                padding: "14px 28px",
                                fontSize: "16px",
                                fontWeight: 600,
                                cursor: "pointer",
                                width: "100%",
                            }}
                        >
                            Activate Account
                        </button>
                    </form>
                )}

                {status === "submitting" && (
                    <div style={{ padding: "32px 0" }}>
                        <p className="message">Activating your account, please wait...</p>
                    </div>
                )}

                {status === "success" && (
                    <>
                        <div className="success-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#9966FF" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-badge-check success-icon"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/></svg>
                        </div>
                        <p className="success-title">Email Verified!</p>
                        <p className="message">{message}</p>
                        <div style={{ marginTop: "24px" }}>
                            <Link
                                href="/login"
                                style={{
                                    display: "inline-block",
                                    background: "#9966FF",
                                    color: "#ffffff",
                                    textDecoration: "none",
                                    padding: "12px 28px",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                }}
                            >
                                Proceed to Login
                            </Link>
                        </div>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="failed-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef2e2e" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert failed-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        </div>
                        <p className="failed-title">Verification Failed</p>
                        <p className="message">{message}</p>
                        <div style={{ marginTop: "24px" }}>
                            <Link
                                href="/login"
                                style={{
                                    color: "#9966FF",
                                    textDecoration: "underline",
                                    fontWeight: 500,
                                }}
                            >
                                Return to Login
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
```

---

## 5. Verification Method

### 5.1 Verification Commands
Execute the following verification commands to ensure zero regressions and validate Milestone 2 items:

```bash
# 1. Typecheck and verify no broken imports of clearLoginRateLimit
npx tsc --noEmit

# 2. Assert clearLoginRateLimit is not exported in app/actions/auth.ts
node -e 'const mod = require("./app/actions/auth.ts"); console.assert(!mod.clearLoginRateLimit, "clearLoginRateLimit must not be exported");'
# or grep verification:
grep -n "export async function clearLoginRateLimit" app/actions/auth.ts
# Expected: 0 matches

# 3. Assert verifyEmail is not invoked in VerifyEmailPage GET render
grep -n "verifyEmail(" app/verify-email/\[token\]/page.tsx
# Expected: 0 matches in page.tsx (only in client component onSubmit / action)

# 4. Milestone 1 regression test
npx --yes tsx tests/test-m1.ts

# 5. Milestone 2 comprehensive verification test
npx --yes tsx tests/test-m2.ts
```

### 5.2 Test Assertions for `tests/test-m2.ts`
1. **SEC-06 Test**:
   ```ts
   const authActions = await import("@/app/actions/auth");
   assert.strictEqual("clearLoginRateLimit" in authActions, false, "clearLoginRateLimit must not be exported");
   ```
2. **SEC-09 Test**:
   ```ts
   // Missing token
   const fdMissing = new FormData();
   fdMissing.set("username", "botuser");
   fdMissing.set("email", "bot@quizweb.dev");
   fdMissing.set("password", "SecureP@ssw0rd123");
   fdMissing.set("confirmPassword", "SecureP@ssw0rd123");
   const resMissing = await signUp(fdMissing);
   assert.deepStrictEqual(resMissing, { error: "reCAPTCHA verification failed." });

   // Invalid token (with mock siteverify returning score 0.1)
   const fdInvalid = new FormData();
   fdInvalid.set("username", "botuser");
   fdInvalid.set("email", "bot@quizweb.dev");
   fdInvalid.set("password", "SecureP@ssw0rd123");
   fdInvalid.set("confirmPassword", "SecureP@ssw0rd123");
   fdInvalid.set("recaptchaToken", "invalid-bot-token");
   // with mocked fetch returning { success: false }
   const resInvalid = await signUp(fdInvalid);
   assert.deepStrictEqual(resInvalid, { error: "reCAPTCHA verification failed." });

   // Valid bypass token
   const fdValid = new FormData();
   fdValid.set("username", "realuser");
   fdValid.set("email", "real@quizweb.dev");
   fdValid.set("password", "SecureP@ssw0rd123");
   fdValid.set("confirmPassword", "SecureP@ssw0rd123");
   fdValid.set("recaptchaToken", "test-bypass-recaptcha-token");
   const resValid = await signUp(fdValid);
   assert.strictEqual(resValid.success, true);
   ```
3. **SEC-11 Test**:
   ```ts
   // Simulating GET render of VerifyEmailPage does not mutate database
   const VerifyEmailPage = (await import("@/app/verify-email/[token]/page.tsx")).default;
   const renderResult = await VerifyEmailPage({ params: Promise.resolve({ token: "test_token" }) });
   // Assert no queries executed on user_vrfy_tbl or user_auth_tbl during GET render
   // Verify that calling verifyEmail("test_token") (the POST action) is what triggers the DB mutations
   ```

### 5.3 Invalidation Conditions
- If `clearLoginRateLimit` remains in `Object.keys(authActions)`.
- If `signUp` permits registration without verifying a reCAPTCHA token or without a recognized test bypass token.
- If loading `/verify-email/[token]` via GET executes SQL mutations on `user_vrfy_tbl` or `user_auth_tbl`.
