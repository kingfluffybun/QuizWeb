# Security Survey & Vulnerability Mapping Report (SEC-01 through SEC-13)

**Author:** Explorer 2 (Survey Phase)  
**Date:** 2026-10-12  
**Target Codebase:** QuizWeb (Next.js 16.3.4, Next-Auth 5.0.0-beta.32, MySQL, TypeScript)  
**Project Root:** `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management`  

---

## Executive Summary & Mapping Matrix

| Vuln ID | Milestone | Target File(s) | Functions / Routes | Current Lines | Vulnerability Classification | ASVS Clause |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-12** | M1: Schema | `app/actions/auth.ts`, DB Schema | `signUp`, `reqPassReset`, `verifyEmail`, `verifyOTP` | `auth.ts:58-65, 332-347` | Cleartext token storage in DB; missing attempt/lockout and token version columns | ASVS 3.4.1, 3.4.2 |
| **SEC-03** | M2: Routes | `app/pending/page.tsx`, `app/input/page.tsx`, `app/actions/quiz.ts`, `middleware.ts` | `/pending/*`, `/input/*`, all 10 mutation actions | `pending:10-44`, `input:12-48`, `quiz.ts:109, 328-1788` | Missing route middleware and missing `requireAdmin()` enforcement in mutation actions | ASVS 3.1.1, 4.1.1 |
| **SEC-06** | M2: Routes | `app/actions/auth.ts`, `app/login/page.tsx` | `clearLoginRateLimit` | `auth.ts:695-699`, `login:99` | Public Server Action RPC export allowing unauthenticated rate limit wipe | ASVS 3.7.1 |
| **SEC-09** | M2: Routes | `app/actions/auth.ts`, `app/login/page.tsx`, `app/api/recaptcha/route.ts` | `signUp`, `handleSignup` | `auth.ts:12-27`, `login:124-128, 160-193` | Client-only reCAPTCHA v3 verification bypassed via direct Server Action RPC | ASVS 3.7.1, 2.2.1 |
| **SEC-11** | M2: Routes | `app/verify-email/[token]/page.tsx`, `app/actions/auth.ts` | `/verify-email/[token]`, `verifyEmail` | `verify-email:10-58`, `auth.ts:189-301` | Insecure GET state mutation / email token consumption upon page load | ASVS 3.7.2, RFC 7231 |
| **SEC-04** | M3: Auth | `auth.ts` | `callbacks.signIn` | `auth.ts:72-126` | Insecure automatic OAuth account linking on email collision without active session | ASVS 3.2.1, 3.2.3 |
| **SEC-05** | M3: Auth | `auth.ts`, `app/actions/auth.ts`, `app/home/page.tsx` | `callbacks.jwt`, `callbacks.session`, `resetPass`, `handleSignOut` | `auth.ts:127-136`, `actions/auth.ts:566-570`, `home:31-34` | Stateless 30-day JWT sessions without revocation check; password reset & logout fail to invalidate sessions | ASVS 3.1.1, 3.3.1, 3.3.2 |
| **SEC-01** | M4: OTP | `app/actions/auth.ts` | `verifyOTP` | `auth.ts:478-529` | Missing OTP attempt tracking, brute-force lockout, and rate limiting | ASVS 3.7.1, 2.3.1 |
| **SEC-02** | M4: OTP | `app/actions/auth.ts` | `resetPass` | `auth.ts:532-580` | OTP replay attack (OTP remains in reusable `is_used = 1` state) and missing `expires_at` check | ASVS 3.7.2, 3.4.3 |
| **SEC-08** | M4: OTP | `app/actions/auth.ts` | `reqPassReset` | `auth.ts:310-327, 471-474` | User account enumeration via unhandled `TypeError` on non-existent users and asymmetric responses | ASVS 3.7.1, 2.5.1 |
| **SEC-10** | M4: OTP | `app/actions/auth.ts` | `reqPassReset` | `auth.ts:304-350` | Missing rate limiting on password reset requests allowing email flooding and DoS | ASVS 3.7.1, 2.5.4 |
| **SEC-07** | M5: Concurrency | `lib/rate-limit.ts` | `checkRateLimit` | `rate-limit.ts:14-102` | Time-of-Check to Time-of-Use (TOCTOU) multi-query race condition in rate limiting | ASVS 3.7.1, 14.2.1 |
| **SEC-13** | M5: Concurrency | `app/actions/auth.ts` | `verifyEmail` | `auth.ts:189-301` | Non-isolated concurrent transactions and missing pessimistic lock (`SELECT ... FOR UPDATE`) | ASVS 3.7.2, 14.2.1 |

---

## 1. Observation

### Milestone 1: Database Schema & Token Storage Hardening

#### SEC-12: Cleartext Token Storage & Schema Attempt Tracking Deficits
- **Locations:**
  - `app/actions/auth.ts:58-65` (`signUp` token creation)
  - `app/actions/auth.ts:201-204` (`verifyEmail` token query)
  - `app/actions/auth.ts:332-347` (`reqPassReset` OTP creation)
  - `app/actions/auth.ts:496-500` (`verifyOTP` OTP query)
  - `app/actions/auth.ts:552-556` (`resetPass` OTP query)
  - Tables: `user_otp_tbl`, `user_vrfy_tbl`, `user_auth_tbl`

- **Verbatim Observed Code (`app/actions/auth.ts` lines 58-65):**
```ts
const verificationToken = crypto.randomBytes(32).toString("hex");
const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);

// Store temporarily
await db.query<ResultSetHeader>(
    `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [trimmedUsername, normalizedEmail, hashed, verificationToken, verificationExpires]
)
```
- **Verbatim Observed Code (`app/actions/auth.ts` lines 332-347):**
```ts
const otpCode = String(randomInt(100000, 999999));
const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

await db.query(
    "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
    [userId, "password_reset"]
);

await db.query(
    "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, ?, ?)",
    [userId, otpCode, expiresAt, 0, "password_reset"]
);
```
- **Observations:**
  1. `verification_token` stores the 64-character raw hex string directly in cleartext in `user_vrfy_tbl`.
  2. `otp_code` stores the 6-digit numeric string directly in cleartext in `user_otp_tbl`.
  3. `user_otp_tbl` and `user_vrfy_tbl` lack attempt-tracking columns (`attempts INT DEFAULT 0`, `locked_until DATETIME NULL`).
  4. `user_auth_tbl` lacks a `token_version INT DEFAULT 1` column.
  5. There are no existing schema migration scripts or DDL files under a `migrations/` directory.

---

### Milestone 2: Route Protection & Access Control

#### SEC-03: Route Protection & Missing Mutation Authorization
- **Locations:**
  - `middleware.ts` (File missing entirely)
  - `app/pending/page.tsx:10-44`
  - `app/input/page.tsx:12-48`
  - `app/actions/quiz.ts:109-119` (`requireAdmin` definition)
  - `app/actions/quiz.ts:328-1788` (All 10 mutation actions)

- **Verbatim Observed Code (`app/pending/page.tsx` lines 10-16):**
```ts
export default async function PendingPage() {
  const [pendingQuizzes, recentQuizPage, metadata] = await Promise.all([
    getPendingQuizzes("pending"),
    getPaginatedRecentQuizzes(),
    getQuizMetadata(),
  ]);
```
- **Verbatim Observed Code (`app/actions/quiz.ts` lines 109-119):**
```ts
export async function requireAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
    [userId],
  );
  return rows[0]?.user_role === "admin";
}
```
- **Mutation Server Actions in `app/actions/quiz.ts`:**
  1. `saveUnit` (`quiz.ts:328-440`): Inserts/updates units. No `requireAdmin()` check.
  2. `deleteUnit` (`quiz.ts:619-648`): Deletes units. No `requireAdmin()` check.
  3. `createQuiz` (`quiz.ts:1127-1214`): Inserts questions/quizzes. No `requireAdmin()` check.
  4. `deleteQuiz` (`quiz.ts:1216-1240`): Deletes quizzes. No `requireAdmin()` check.
  5. `updateQuiz` (`quiz.ts:1242-1318`): Updates quizzes. No `requireAdmin()` check.
  6. `reviewPendingQuiz` (`quiz.ts:1500-1585`): Approves/rejects pending items. No `requireAdmin()` check.
  7. `updatePendingQuiz` (`quiz.ts:1587-1607`): Updates pending questions. No `requireAdmin()` check.
  8. `updatePendingNote` (`quiz.ts:1609-1629`): Modifies rejection notes. No `requireAdmin()` check.
  9. `updatePendingQuizFromForm` (`quiz.ts:1631-1679`): Modifies pending quizzes. No `requireAdmin()` check.
  10. `updatePendingUnitFromForm` (`quiz.ts:1681-1771`): Modifies pending units. No `requireAdmin()` check.
  11. `deletePendingQuiz` (`quiz.ts:1773-1788`): Deletes pending records. No `requireAdmin()` check.
- **Observations:**
  - `requireAdmin` is declared at line 109 but is called 0 times in `quiz.ts`.
  - Any unauthenticated user can directly view `/pending` and `/input`, and can invoke any of the administrative mutation Server Actions via HTTP POST RPC.

#### SEC-06: Unauthenticated Rate Limit Reset RPC Export
- **Locations:**
  - `app/actions/auth.ts:695-699`
  - `app/login/page.tsx:4, 99`

- **Verbatim Observed Code (`app/actions/auth.ts` lines 695-699):**
```ts
// Clear for success
export async function clearLoginRateLimit(email: string) {
    const key = `login:${email.toLowerCase().trim()}`;
    clearRateLimit(key);
    return { success: true };
}
```
- **Observations:**
  - `app/actions/auth.ts` has `"use server";` at line 1.
  - Exporting `clearLoginRateLimit` exposes it as an unauthenticated public RPC endpoint.
  - Furthermore, `auth.ts:61` already calls `clearRateLimit` inside `authorize` upon valid credentials verification, rendering the client-triggered call in `app/login/page.tsx:99` redundant and dangerous.

#### SEC-09: Client-Side reCAPTCHA v3 Verification in `signUp`
- **Locations:**
  - `app/actions/auth.ts:12-27`
  - `app/login/page.tsx:124-128, 160-193`
  - `app/api/recaptcha/route.ts:1-49`

- **Verbatim Observed Code (`app/actions/auth.ts` lines 12-20):**
```ts
export async function signUp(formData: FormData) {
    const username = formData.get("username") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!username || !email || !password || !confirmPassword) {
        return { error: "All fields are required." };
    }
```
- **Observations:**
  - In `app/login/page.tsx:125-128`, the client checks a React state variable `recaptchaVerified`.
  - In `app/actions/auth.ts:signUp`, no reCAPTCHA token is received or verified server-side.
  - An automated script can invoke `signUp` directly without sending a reCAPTCHA token or talking to `/api/recaptcha`.

#### SEC-11: Automatic GET State Mutation in Email Verification
- **Locations:**
  - `app/verify-email/[token]/page.tsx:10-15`
  - `app/actions/auth.ts:189-301`

- **Verbatim Observed Code (`app/verify-email/[token]/page.tsx` lines 10-15):**
```ts
export default async function VerifyEmailPage({
    params,
}: VerifyEmailPageProps) {
    const { token } = await params;
    const result  = await verifyEmail(token);
```
- **Observations:**
  - When a user, email crawler, antivirus previewer, or web crawler performs an HTTP GET request to `/verify-email/[token]`, `verifyEmail(token)` executes automatically.
  - This mutates database state (inserts user into `user_auth_tbl`, inserts player into `player_tbl`, deletes verification token from `user_vrfy_tbl`) on a safe/idempotent GET request.

---

### Milestone 3: Authentication & Session Revocation

#### SEC-04: Insecure Automatic OAuth Account Linking on Email Collision
- **Locations:**
  - `auth.ts:72-126` (`callbacks.signIn`)

- **Verbatim Observed Code (`auth.ts` lines 78-118):**
```ts
// 1. Check if user already exists in user_auth_tbl and is verified
const [existingUser] = await db.query<RowDataPacket[]>(
    "SELECT user_id FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1 LIMIT 1",
    [user.email]
);

let userId: number;

if (existingUser.length === 0) {
    // Insert new user
    ...
} else {
    userId = existingUser[0].user_id;
}

// 2. Link OAuth connection in user_oauth_tbl
const [existingOAuth] = await db.query<RowDataPacket[]>(
    "SELECT oauth_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
    [account.provider, account.providerAccountId]
);

if (existingOAuth.length === 0) {
    await db.query(
        "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
        [userId, account.provider, account.providerAccountId]
    );
}

// Attach the true DB user_id to the user object for the JWT callback
user.id = String(userId);
return true;
```
- **Observations:**
  - If a local account exists with `user.email`, and a user logs in via Google/GitHub OAuth with the same email, the system automatically links the OAuth provider ID to the existing `user_id` without checking if the current request has an authenticated session.
  - This allows pre-account takeover: an attacker with a controlled OAuth account sharing the email address gains access to the victim's existing account.

#### SEC-05: Missing Session Revocation and JWT Invalidation
- **Locations:**
  - `auth.ts:127-136` (`jwt` and `session` callbacks)
  - `app/actions/auth.ts:566-570` (`resetPass`)
  - `app/home/page.tsx:31-34` (`handleSignOut`)

- **Verbatim Observed Code (`auth.ts` lines 127-136):**
```ts
callbacks: {
    ...
    async jwt({ token, user }) {
        if (user) token.id = user.id;
        return token;
    },
    async session({ session, token }) {
        if (token && session.user) {
            session.user.id = token.id as string;
        }
        return session;
    },
}
```
- **Verbatim Observed Code (`app/actions/auth.ts` lines 566-570):**
```ts
// Update
await db.query(
    "UPDATE user_auth_tbl SET password_hash = ? WHERE user_id = ?",
    [hashed, userId]
);
```
- **Observations:**
  - The JWT strategy is stateless. Tokens are minted with a default 30-day lifetime.
  - `jwt` callback does not store `tokenVersion`.
  - `session` callback does not query `user_auth_tbl` to validate `tokenVersion`.
  - `resetPass` updates `password_hash` but does not increment `token_version`.
  - `signOut` in Next-Auth only clears client cookies; active JWTs remain completely valid if presented again.

---

### Milestone 4: OTP Lifecycle, Anti-Abuse & Rate Limiting

#### SEC-01: Missing OTP Verification Attempt Counter & Lockout
- **Locations:**
  - `app/actions/auth.ts:478-529` (`verifyOTP`)

- **Verbatim Observed Code (`app/actions/auth.ts` lines 513-524):**
```ts
// Check if matches
if (otp.otp_code !== otpCode) {
    return { error: "Invalid OTP. Please try again." };
}

// Mark OTP as used
await db.query(
    "UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?",
    [otp.otp_id]
);
```
- **Observations:**
  - When `otp.otp_code !== otpCode`, the function returns an error without updating `attempts` or checking lockout.
  - An attacker can submit unlimited guesses against a 6-digit OTP (1,000,000 keyspace) within its 5-minute validity window.

#### SEC-02: OTP Token Replay Attack & Missing Expiration in `resetPass`
- **Locations:**
  - `app/actions/auth.ts:551-576` (`resetPass`)

- **Verbatim Observed Code (`app/actions/auth.ts` lines 552-575):**
```ts
const [otps] = await db.query<RowDataPacket[]>(
    `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
    WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
    [userId, "password_reset"]
);

if (otps.length === 0 || otps[0].otp_code !== otpCode || otps[0].is_used === 0) {
    return { error: "Invalid or expired OTP" };
}

...

// Invalidate all OTPs for this user
await db.query(
    "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ?",
    [userId, "password_reset"]
);
```
- **Observations:**
  1. `resetPass` requires `is_used !== 0` (meaning it requires `is_used = 1` set by `verifyOTP`).
  2. At line 573, it sets `is_used = 1` again! Because `is_used` remains `1`, an attacker can repeatedly re-submit the same OTP to change the password again (replay). It never transitions to a consumed status (`is_used = 2`).
  3. `expires_at` is selected in line 553 but never compared against `new Date()`. An expired OTP that was previously verified can still be used to reset passwords.

#### SEC-08 & SEC-10: User Enumeration & Missing Rate Limiting in `reqPassReset`
- **Locations:**
  - `app/actions/auth.ts:304-330, 471-475` (`reqPassReset`)

- **Verbatim Observed Code (`app/actions/auth.ts` lines 310-327, 471-475):**
```ts
// Check if user exists in user_auth_tbl
const [users] = await db.query<RowDataPacket[]>(
    "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
    [email]
);

// Get username from player_tbl
const [player] = await db.query<RowDataPacket[]>(
    "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
    [users[0].user_id]
);

const genericMessage = "If the email is valid, you will receive an email.";

if (users.length === 0) {
    return { success: true, message: genericMessage };
}
...
} catch (error) {
    console.error("Password reset database error:", error);
    return { error: "Failed to send OTP. Please try again." };
}
```
- **Observations:**
  1. Line 319 attempts to access `users[0].user_id` before checking `if (users.length === 0)` (which is placed after at line 324).
  2. If the email does not exist, `users[0]` is `undefined`, causing a runtime `TypeError: Cannot read properties of undefined (reading 'user_id')`.
  3. The error jumps to `catch`, returning `{ error: "Failed to send OTP. Please try again." }`.
  4. If the email exists, it returns `{ success: true, message: ... }`.
  5. This creates a user enumeration vulnerability (SEC-08).
  6. There is zero rate limiting in `reqPassReset` (SEC-10), allowing infinite password reset email requests (email bombing / DoS).

---

### Milestone 5: Concurrency & Transaction Isolation

#### SEC-07: Time-of-Check to Time-of-Use (TOCTOU) Race Condition in Rate Limiting
- **Locations:**
  - `lib/rate-limit.ts:14-102` (`checkRateLimit`)

- **Verbatim Observed Code (`lib/rate-limit.ts` lines 19-22, 56-59, 78-95):**
```ts
// Get existing
const [rows] = await db.query<RateLimitRow[]>(
    "SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?",
    [dbkey]
);
...
// Get fresh
const [freshRows] = await db.query<RateLimitRow[]>(
    "SELECT attempts, reset_at, blocked FROM rate_limit_tbl WHERE limit_key = ?",
    [dbkey]
);
...
if (fresh.attempts + 1 >= MAX_ATTEMPTS) {
    await db.query(
        "UPDATE rate_limit_tbl SET attempts = attempts + 1, blocked = TRUE, reset_at = ? WHERE limit_key = ?",
        [now, dbkey]
    );
    ...
}
await db.query(
    "UPDATE rate_limit_tbl SET attempts = attempts + 1 WHERE limit_key = ?",
    [dbkey]
);
```
- **Observations:**
  - The function performs non-atomic queries: `SELECT` -> in-memory JS condition -> `UPDATE`.
  - Multiple concurrent requests read the same initial `attempts` counter before any request increments it, allowing rate limit bypass via concurrent bursts.

#### SEC-13: Race Conditions & Missing Row Locking in `verifyEmail`
- **Locations:**
  - `app/actions/auth.ts:189-301` (`verifyEmail`)

- **Verbatim Observed Code (`app/actions/auth.ts` lines 201-236):**
```ts
// Find pending verification
const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT verify_id, username, email, password_hash, expires_at FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1`,
    [token]
);

if (rows.length === 0) { ... }
...
await connection.beginTransaction();

// Check if email already exists
const [existingEmail] = await connection.query<RowDataPacket[]>(
    `SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1`,
    [pendingUser.email]
);
```
- **Observations:**
  - Line 201 queries `user_vrfy_tbl` outside of any database transaction and without row locks (`FOR UPDATE` is missing).
  - `connection.beginTransaction()` is only invoked at line 230.
  - Concurrent requests with the same token both read the unconsumed token, leading to race conditions, duplicate account creation attempts, or unexpected transaction rollbacks.

---

## 2. Logic Chain

### Milestone 1: Database Schema Hardening (SEC-12)
1. **Fact:** `app/actions/auth.ts` lines 63 and 345 write raw token strings into `user_vrfy_tbl.verification_token` and `user_otp_tbl.otp_code`.
2. **Inference:** A database read compromise (SQL injection, database dump, backup leak) immediately exposes all valid verification tokens and password reset OTPs.
3. **Requirement:** Tokens must be stored as one-way cryptographic hashes (`SHA-256`) at rest (ASVS 3.4.1). Tables must also track `attempts` and `locked_until` for lockout enforcement, and `user_auth_tbl` must store `token_version` for session revocation.
4. **Remediation:** Provide idempotent migration scripts adding columns:
   - `user_auth_tbl`: `token_version INT DEFAULT 1 NOT NULL`
   - `user_otp_tbl`: `attempts INT DEFAULT 0 NOT NULL`, `locked_until DATETIME NULL`, `otp_code VARCHAR(64)`
   - `user_vrfy_tbl`: `attempts INT DEFAULT 0 NOT NULL`, `locked_until DATETIME NULL`, `verification_token VARCHAR(64)`
   Update `signUp` and `reqPassReset` to hash tokens with SHA-256 before inserting.

### Milestone 2: Access Control & Route Hardening (SEC-03, SEC-06, SEC-09, SEC-11)
1. **Fact:** There is no `middleware.ts`. Pages `/pending` and `/input` do not verify sessions or roles. All 10 mutation actions in `app/actions/quiz.ts` do not invoke `requireAdmin()`.
2. **Inference:** Any anonymous attacker can access admin dashboards and manipulate quizzes, units, and pending reviews.
3. **Remediation (SEC-03):** 
   - Author `middleware.ts` intercepting `/pending/:path*` and `/input/:path*`, checking authentication and `user_role === 'admin'`. Unauthenticated requests redirect to `/login`.
   - Wrap each mutation action in `quiz.ts` with `if (!(await requireAdmin())) return { error: "Unauthorized" };`.
4. **Fact:** `clearLoginRateLimit` is an exported server action in `app/actions/auth.ts:695`.
5. **Inference:** Anyone can make a POST request to the server action to reset login rate limits, bypassing brute force defenses.
6. **Remediation (SEC-06):** Remove the public `export` from `clearLoginRateLimit`. Remove its call from `app/login/page.tsx:99`.
7. **Fact:** `signUp` in `app/actions/auth.ts` does not check reCAPTCHA.
8. **Inference:** Automated account creation bots can bypass the client-side reCAPTCHA check in `app/login/page.tsx`.
9. **Remediation (SEC-09):** Pass `recaptchaToken` into `signUp` and verify it server-side using Google's `siteverify` API before proceeding with registration.
10. **Fact:** `app/verify-email/[token]/page.tsx` executes `verifyEmail(token)` on HTTP GET.
11. **Inference:** Email clients and web crawlers trigger account activation and token deletion on prefetch.
12. **Remediation (SEC-11):** Convert the verification page to display a confirmation button; require a user-initiated POST submission or action to execute `verifyEmail`.

### Milestone 3: Session Revocation & Binding (SEC-04, SEC-05)
1. **Fact:** `auth.ts` lines 103-114 link OAuth accounts to existing local users based on email match without requiring an active session.
2. **Inference:** An attacker who creates a social account with a victim's email gains unauthorized access to the victim's QuizWeb account.
3. **Remediation (SEC-04):** Block automatic OAuth linking for existing emails unless `await auth()` confirms an existing, active session.
4. **Fact:** Next-Auth JWTs have a 30-day lifespan and are never validated against `user_auth_tbl.token_version`.
5. **Inference:** Password resets and logouts do not revoke active JWT sessions.
6. **Remediation (SEC-05):**
   - In `jwt` callback, populate `token.tokenVersion = user.token_version`.
   - In `session` callback, query `user_auth_tbl.token_version`; if `token.tokenVersion !== dbUser.token_version`, invalidate the session (return empty/null).
   - In `resetPass` and `signOut`, execute `UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?`.

### Milestone 4: OTP Lifecycle & Anti-Abuse (SEC-01, SEC-02, SEC-08, SEC-10)
1. **Fact:** `verifyOTP` does not increment an attempt count or lock on incorrect OTPs.
2. **Inference:** A 6-digit OTP can be brute-forced within 5 minutes.
3. **Remediation (SEC-01):** Increment `attempts` on invalid guesses. Lock or invalidate the OTP record when `attempts >= 5`.
4. **Fact:** `resetPass` does not check `expires_at` and sets `is_used = 1`, leaving it in the exact state required for `resetPass`.
5. **Inference:** An attacker can reuse the same OTP to reset the password repeatedly, and expired OTPs can be used.
6. **Remediation (SEC-02):** Enforce `new Date() <= expiresAt`. On password reset completion, transition OTP to `is_used = 2`. Reject OTPs where `is_used !== 1`.
7. **Fact:** `reqPassReset` accesses `users[0].user_id` when `users.length === 0`, throwing a `TypeError` and returning `{ error: ... }`, but returns `{ success: true }` if the user exists.
8. **Inference:** User accounts can be enumerated.
9. **Remediation (SEC-08):** Guard against undefined user. Always return identical generic success responses `{ success: true, message: genericMessage }` regardless of whether the user exists.
10. **Fact:** `reqPassReset` has no rate limiting.
11. **Inference:** Email flooding / DoS attacks are possible.
12. **Remediation (SEC-10):** Enforce rate limiting via `checkRateLimit(`reset:${normalizedEmail}`)`.

### Milestone 5: Concurrency & Transaction Isolation (SEC-07, SEC-13)
1. **Fact:** `checkRateLimit` executes multiple independent SQL statements with JavaScript conditionals in between.
2. **Inference:** Concurrent requests read stale attempt counts, bypassing rate limits.
3. **Remediation (SEC-07):** Refactor `checkRateLimit` to use atomic MySQL statements (`INSERT ... ON DUPLICATE KEY UPDATE`) without multi-query TOCTOU windows.
4. **Fact:** `verifyEmail` queries `user_vrfy_tbl` prior to `beginTransaction` and without `FOR UPDATE`.
5. **Inference:** Concurrent submissions of the same verification link trigger duplicate account creations and unhandled race conditions.
6. **Remediation (SEC-13):** Open an explicit transaction first (`beginTransaction`), then acquire a pessimistic lock (`SELECT ... FROM user_vrfy_tbl WHERE verification_token = ? FOR UPDATE`).

---

## 3. Caveats

1. **MySQL Database Availability:**
   - The local MySQL service (`systemctl is-active mysql`) is currently inactive in the environment.
   - For standalone verification tests (`tests/test-m1.ts` through `tests/test-m5.ts`), either a local MySQL instance or an integration test database with valid credentials in `.env` will be required, or a mock adapter conforming to `mysql2/promise`.
2. **Resend Email Service:**
   - `lib/email.ts` relies on `process.env.RESEND_API_KEY`. In test and development environments without a valid API key, `sendEmail` throws an error. Test harnesses must stub `sendEmail` or provide a valid dummy transport to avoid false negative test failures in `signUp` and `reqPassReset`.
3. **reCAPTCHA Secret Key:**
   - `app/api/recaptcha/route.ts` and the upcoming server-side verification in `signUp` rely on `RECAPTCHA_SECRET_KEY`. Test harnesses must account for dummy secret keys (or test keys `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`) or environment mock flags.
4. **Dead Code vs Active Actions:**
   - `updatePendingQuiz` (`quiz.ts:1587`) is exported but appears to be superseded by `updatePendingQuizFromForm` (`quiz.ts:1631`). However, because it is exported from a `"use server"` file, it must also be protected with `requireAdmin()`.

---

## 4. Conclusion

All 13 security vulnerabilities (SEC-01 through SEC-13) have been pinpointed to exact files, lines of code, and architectural design flaws across the Next.js, Next-Auth, and MySQL stack.
The roadmap cleanly aligns with the 5-milestone plan:
- **Milestone 1 (SEC-12):** Schema migrations for `token_version`, `attempts`, `locked_until`, and SHA-256 token hashing at rest.
- **Milestone 2 (SEC-03, SEC-06, SEC-09, SEC-11):** Route middleware for `/pending/*` and `/input/*`, `requireAdmin()` on all mutation actions in `quiz.ts`, removing `clearLoginRateLimit` export, server-side reCAPTCHA in `signUp`, and POST-based email verification.
- **Milestone 3 (SEC-04, SEC-05):** Invalidation of JWT sessions via `token_version` on password resets and logouts; blocking automatic OAuth account linking for existing emails.
- **Milestone 4 (SEC-01, SEC-02, SEC-08, SEC-10):** 5-attempt lockout on OTP verification, replay protection (`is_used = 2`) and expiration check on `resetPass`, enumeration prevention and rate limiting on `reqPassReset`.
- **Milestone 5 (SEC-07, SEC-13):** Atomic `INSERT ... ON DUPLICATE KEY UPDATE` rate limiting without TOCTOU windows, and pessimistic row locking (`SELECT ... FOR UPDATE`) in `verifyEmail`.

---

## 5. Verification Method

Each milestone must be independently verified using standalone test scripts in `tests/` executed via `npx tsx`:

1. **Milestone 1 Verification (`tests/test-m1.ts`):**
   - Inspect migration SQL files under `migrations/`.
   - Run migration script idempotently (first run succeeds, second run does not error).
   - Verify `user_auth_tbl` has column `token_version`.
   - Verify `user_otp_tbl` and `user_vrfy_tbl` have columns `attempts`, `locked_until`.
   - Insert OTP / verification tokens via `signUp` and `reqPassReset` and assert stored values are 64-char SHA-256 hashes, not cleartext strings.
   - Command: `npx tsx tests/test-m1.ts`

2. **Milestone 2 Verification (`tests/test-m2.ts`):**
   - Send simulated unauthenticated HTTP GET requests to `/pending` and `/input`; verify redirect response to `/login`.
   - Invoke all 10 mutation actions in `app/actions/quiz.ts` without an active admin session; assert each returns an unauthorized error.
   - Assert `clearLoginRateLimit` is not exported from `app/actions/auth.ts`.
   - Send GET request to `/verify-email/[token]`; assert database records remain unchanged.
   - Send `signUp` request with invalid/missing reCAPTCHA token; assert request is rejected.
   - Command: `npx tsx tests/test-m2.ts`

3. **Milestone 3 Verification (`tests/test-m3.ts`):**
   - Mint a valid JWT session for a user.
   - Increment `token_version` in `user_auth_tbl`.
   - Call session callback / verify session; assert session is terminated/invalidated.
   - Call `resetPass` and `signOut`; assert `token_version` increments.
   - Simulate OAuth sign-in matching an existing email without an active session; assert OAuth linking is blocked.
   - Command: `npx tsx tests/test-m3.ts`

4. **Milestone 4 Verification (`tests/test-m4.ts`):**
   - Enter 5 consecutive incorrect OTPs via `verifyOTP`; assert 5th failure locks the OTP record and 6th attempt is rejected.
   - Execute `resetPass` with a valid OTP; re-submit the same OTP immediately; assert second attempt fails with invalid/used token error (`is_used = 2`).
   - Submit `reqPassReset` for an existing email and a non-existent email; assert returned messages and shapes are identical.
   - Submit multiple rapid requests to `reqPassReset`; assert rate limiting kicks in after threshold.
   - Command: `npx tsx tests/test-m4.ts`

5. **Milestone 5 Verification (`tests/test-m5.ts`):**
   - Launch 20 concurrent requests to `checkRateLimit`; assert exact attempt count increments atomically without race condition bypasses.
   - Launch 10 concurrent requests to `verifyEmail` with the same token; assert exactly 1 succeeds and remaining 9 fail cleanly without duplicate records or database deadlocks.
   - Command: `npx tsx tests/test-m5.ts`
