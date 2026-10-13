# Spec Miner Handoff Report: OWASP ASVS v4.0.3 Chapter 3 & Milestone Verification Specifications

## 1. Observation

### 1.1 Direct Specification Probing (OWASP ASVS v4.0.3)
Authoritative specification probing against OWASP ASVS v4.0.3 (`https://raw.githubusercontent.com/OWASP/ASVS/v4.0.3/4.0/en/`) reveals the following normative requirements governing Session Management (Chapter 3), Authentication (Chapter 2), Access Control (Chapter 4), Cryptography (Chapter 6), Business Logic (Chapter 11), and Web Services (Chapter 13):

1. **ASVS V3.1 Fundamental Session Management Security**:
   - **3.1.1**: "Verify the application never reveals session tokens in URL parameters." (CWE-598).
2. **ASVS V3.2 Session Binding**:
   - **3.2.1**: "Verify the application generates a new session token on user authentication." (CWE-384, NIST § 7.1).
   - **3.2.2**: "Verify that session tokens possess at least 64 bits of entropy." (CWE-331, NIST § 7.1).
   - **3.2.3**: "Verify the application only stores session tokens in the browser using secure methods such as appropriately secured cookies (see section 3.4) or HTML 5 session storage." (CWE-539, NIST § 7.1).
   - **3.2.4**: "Verify that session tokens are generated using approved cryptographic algorithms." (CWE-331, NIST § 7.1).
3. **ASVS V3.3 Session Termination**:
   - **3.3.1**: "Verify that logout and expiration invalidate the session token, such that the back button or a downstream relying party does not resume an authenticated session, including across relying parties." (CWE-613, NIST § 7.1).
   - **3.3.2**: "If authenticators permit users to remain logged in, verify that re-authentication occurs periodically both when actively used or after an idle period." (CWE-613, NIST § 7.2).
   - **3.3.3**: "Verify that the application gives the option to terminate all other active sessions after a successful password change (including change via password reset/recovery), and that this is effective across the application, federated login (if present), and any relying parties." (CWE-613).
   - **3.3.4**: "Verify that users are able to view and (having re-entered login credentials) log out of any or all currently active sessions and devices." (CWE-613, NIST § 7.1).
4. **ASVS V3.4 Cookie-based Session Management**:
   - **3.4.1**: "Verify that cookie-based session tokens have the 'Secure' attribute set." (CWE-614, NIST § 7.1.1).
   - **3.4.2**: "Verify that cookie-based session tokens have the 'HttpOnly' attribute set." (CWE-1004, NIST § 7.1.1).
   - **3.4.3**: "Verify that cookie-based session tokens utilize the 'SameSite' attribute to limit exposure to cross-site request forgery attacks." (CWE-16, NIST § 7.1.1).
   - **3.4.4**: "Verify that cookie-based session tokens use the '__Host-' prefix so cookies are only sent to the host that initially set the cookie." (CWE-16, NIST § 7.1.1).
5. **ASVS V3.5 Token-based Session Management**:
   - **3.5.1**: "Verify the application allows users to revoke OAuth tokens that form trust relationships with linked applications." (CWE-290, NIST § 7.1.2).
   - **3.5.3**: "Verify that stateless session tokens use digital signatures, encryption, and other countermeasures to protect against tampering, enveloping, replay, null cipher, and key substitution attacks." (CWE-345).
6. **ASVS V3.6 Federated Re-authentication & Session Linking**:
   - **3.6.1 / 3.6.2**: Cross-identity provider and relying party session synchronization. Account linking between local accounts and federated OAuth providers must only occur within a verified, active authenticated session context to prevent account pre-hijacking.
7. **ASVS V3.7 Defenses Against Session Management Exploits**:
   - **3.7.1**: "Verify the application ensures a full, valid login session or requires re-authentication or secondary verification before allowing any sensitive transactions or account modifications." (CWE-306). Focuses on eliminating half-open authentication flaws, privilege elevation during credential recovery, and enforcing re-authentication.
8. **Related ASVS Verification Clauses**:
   - **2.2.1**: "Verify that anti-automation controls are effective at mitigating breached credential testing, brute force, and account lockout attacks... Verify that no more than 100 failed attempts per hour is possible on a single account." (CWE-307).
   - **2.7.2 / 2.8.1**: Timeouts for out-of-band authenticators and OTPs (strict expiration validation).
   - **2.7.3 / 2.8.4**: Replay prevention: out-of-band codes and OTPs are usable only once.
   - **2.7.5**: "Verify that the out of band verifier retains only a hashed version of the authentication code." (CWE-256).
   - **4.1.1 / 4.1.3**: Access control enforced on trusted server layer; principle of least privilege (admin route protection).
   - **11.1.6**: "Verify that the application does not suffer from 'Time Of Check to Time Of Use' (TOCTOU) issues or other race conditions for sensitive operations." (CWE-367).
   - **13.1.3 / RFC 7231**: Safe HTTP methods: GET requests must be safe and idempotent; state mutation must require user-initiated POST. Public RPC surface reduction: internal administrative functions must not be exposed.

---

### 1.2 Codebase Survey Observations
Inspection of the QuizWeb codebase reveals the following direct observations:

1. **Cleartext Token Storage (`app/actions/auth.ts:63, 345`)**:
   - `signUp` generates a cleartext token via `crypto.randomBytes(32).toString("hex")` and writes it directly to `user_vrfy_tbl.verification_token`.
   - `reqPassReset` generates a 6-digit numeric OTP via `randomInt(100000, 999999)` and writes it directly to `user_otp_tbl.otp_code`.
   - Neither table stores SHA-256 hashes. Neither table contains `attempts` or `locked_until` columns.
   - `user_auth_tbl` lacks a `token_version` column.

2. **Unprotected Admin Routes and Actions (`app/pending/page.tsx`, `app/input/page.tsx`, `app/actions/quiz.ts`)**:
   - No `middleware.ts` exists in the repository. Both `/pending` and `/input` render freely without session or role checks.
   - In `app/actions/quiz.ts:109-119`, `requireAdmin()` is defined but is NEVER called by any of the 10 mutation functions (`createQuiz`, `updateQuiz`, `deleteQuiz`, `deleteUnit`, `reviewPendingQuiz`, `updatePendingQuiz`, `updatePendingNote`, `updatePendingQuizFromForm`, `updatePendingUnitFromForm`, `deletePendingQuiz`).

3. **Public RPC Exposure & Missing Anti-Automation (`app/actions/auth.ts:695, 12`)**:
   - `clearLoginRateLimit` is declared `export async function` inside a `"use server"` file, creating an unauthenticated Next.js Server Action RPC callable by anyone over HTTP POST to reset rate limits.
   - `signUp` does not verify Google reCAPTCHA v3 tokens on the server.

4. **GET-based State Mutation (`app/verify-email/[token]/page.tsx:14`)**:
   - Loading the email verification page executes `const result = await verifyEmail(token)` inside the Server Component GET render cycle. Any web crawler, email prefetcher, or spam scanner triggers account creation and token destruction.

5. **Lack of Session Revocation & Insecure OAuth Linking (`auth.ts:72-137`)**:
   - `callbacks.jwt` and `callbacks.session` store `user.id` but do not query or check `token_version` in `user_auth_tbl`. Active 30-day JWTs cannot be revoked upon logout or password reset.
   - `callbacks.signIn` links Google and GitHub OAuth logins to existing accounts with matching emails automatically without checking whether the user is already authenticated in an active session.

6. **OTP Brute-Force & Replay Vulnerabilities (`app/actions/auth.ts:478-528, 532-580`)**:
   - `verifyOTP` does not track failed attempts or lock the OTP, allowing unrestricted brute-force of the 6-digit space.
   - `resetPass` does not check `expires_at` and does not transition consumed OTPs to `is_used = 2`.

7. **User Enumeration & Email Flooding (`app/actions/auth.ts:311-325, 304`)**:
   - In `reqPassReset`, lines 317-320 access `users[0].user_id` before line 324 checks `if (users.length === 0)`. Non-existent emails throw an unhandled exception caught at line 473 returning `{ error: "Failed to send OTP. Please try again." }`, while valid emails return `{ success: true, message: "If the email is valid..." }`.
   - `reqPassReset` lacks rate limiting, allowing automated email flooding.

8. **Race Conditions / TOCTOU Vulnerabilities (`lib/rate-limit.ts:14-102`, `app/actions/auth.ts:189-301`)**:
   - `checkRateLimit` executes a `SELECT`, evaluates `fresh.attempts` in Node.js, and subsequently issues an `UPDATE`. Concurrent requests execute the SELECT before the counter increments, bypassing rate limits.
   - `verifyEmail` executes `SELECT ... FROM user_vrfy_tbl` outside its database transaction and lacks `FOR UPDATE` locking, creating a race condition window where concurrent requests create duplicate users.

---

### 1.3 Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | DB / Token Storage | `token_version` tracking in `user_auth_tbl` | Integer column incremented on password reset/logout to immediately revoke existing JWTs | Database migration | Table column `token_version INT DEFAULT 1` | Database migration failure if table missing | ASVS 3.3.1, 3.3.3, 3.5.3, ORIGINAL_REQUEST R1 |
| 2 | DB / Token Storage | OTP attempt tracking & SHA-256 storage | Hashed OTP storage and attempt/lockout tracking in `user_otp_tbl` | 6-digit OTP code | Stored SHA-256 hash (64 hex), `attempts INT`, `locked_until DATETIME` | Rejects plaintext storage; locks after 5 attempts | ASVS 2.7.5, 3.4.2, 3.7.1, ORIGINAL_REQUEST R1 |
| 3 | DB / Token Storage | Verification token SHA-256 storage & tracking | Hashed email verification token storage and attempt/lockout columns in `user_vrfy_tbl` | 32-byte hex token | Stored SHA-256 hash (64 hex), `attempts INT`, `locked_until DATETIME` | Fails on lookup if cleartext queried | ASVS 2.7.5, 3.4.2, 13.1.3, ORIGINAL_REQUEST R1 |
| 4 | Access Control | Route middleware for `/pending/*` and `/input/*` | Enforces authentication and `user_role === 'admin'` before allowing page access | Incoming NextRequest to `/pending/*` or `/input/*` | Next.js response / redirect to `/login` | Redirects unauthenticated / forbidden users to `/login` | ASVS 4.1.1, 4.1.3, ORIGINAL_REQUEST R2 |
| 5 | Access Control | Administrative server action authorization | Guard all 10 mutation actions in `app/actions/quiz.ts` with `requireAdmin()` | FormData / action arguments from client | Action payload or `{ error: "Unauthorized" }` | Rejects non-admin or unauthenticated callers with 401/403 or error object | ASVS 4.1.1, 4.1.3, 4.2.1, ORIGINAL_REQUEST R2 |
| 6 | Access Control / Anti-Abuse | Internalizing `clearLoginRateLimit` | Remove `export` from `clearLoginRateLimit` so it cannot be invoked as public RPC | Internal server function invocation | `{ success: true }` | Unexported; cannot be called over HTTP RPC | ASVS 4.1.2, 13.1.4, ORIGINAL_REQUEST R2 |
| 7 | Anti-Abuse / Registration | Server-side reCAPTCHA v3 verification | Enforces Google reCAPTCHA v3 verification in `signUp` before creating verification record | `recaptchaToken: string`, FormData | `{ success: true }` or `{ error: "reCAPTCHA verification failed." }` | Rejects automated registration attempts | ASVS 2.2.1, 11.1.4, ORIGINAL_REQUEST R2 |
| 8 | Access Control / HTTP Semantics | User-initiated POST email verification | Convert email verification from GET page render to explicit user-initiated POST | POST action with token | Success confirmation / account creation | Fails if token invalid, expired, or attempted via GET | ASVS 3.1.1, 13.2.1, RFC 7231, ORIGINAL_REQUEST R2 |
| 9 | Session Revocation | Active JWT revocation via session callback | Validate `token.tokenVersion === dbUser.token_version` on every Next-Auth session evaluation | JWT session token, DB query | Active session or `null` (terminated) | Immediately revokes session if `token_version` mismatch | ASVS 3.1.1, 3.3.1, 3.3.3, ORIGINAL_REQUEST R3 |
| 10 | Session Binding | Safe OAuth account linking prevention | Blocks automatic linking of OAuth identities to existing email unless active session is present | OAuth `signIn` callback (`user`, `account`) | `true` (linked) or `false` / redirect error | Prevents account hijacking of unlinked local users | ASVS 3.2.1, 3.6.1, 3.7.1, ORIGINAL_REQUEST R3 |
| 11 | Anti-Abuse / OTP | OTP failure limit & lockout enforcement | Enforce maximum 5 failed attempts in `verifyOTP`, locking record | Email, OTP string | `{ success: true }` or `{ error: "..." }` | Locks OTP after 5 failed attempts (`locked_until` set, further attempts blocked) | ASVS 2.2.1, 3.7.1, ORIGINAL_REQUEST R4 |
| 12 | Anti-Abuse / OTP | OTP replay prevention & state transition | Enforce strict expiration and transition consumed OTP to `is_used = 2` | Email, OTP string, new password | `{ success: true }` | Rejects reused OTPs with invalid/expired error | ASVS 2.8.4, 3.7.2, ORIGINAL_REQUEST R4 |
| 13 | Anti-Enumeration | Uniform response & timing in `reqPassReset` | Return identical message and timing whether email exists or not | Email string | Generic message: `"If an account exists with this email, a reset code has been sent."` | Constant timing; no unhandled null pointer exception | ASVS 2.1.8, 2.5.3, CWE-204, CWE-208, ORIGINAL_REQUEST R4 |
| 14 | Anti-Abuse | Request rate limiting in `reqPassReset` | Limit reset requests per IP/email to prevent email flooding | Email string, client IP | `{ allowed: true }` or `{ error: "Too many reset requests..." }` | Blocks request if rate limit exceeded | ASVS 2.2.1, 11.1.3, ORIGINAL_REQUEST R4 |
| 15 | Concurrency | Atomic rate limiting via MySQL `ON DUPLICATE KEY UPDATE` | Replace SELECT-then-UPDATE in `lib/rate-limit.ts` with atomic upsert | Rate limit key, window duration | `{ allowed: boolean, remaining: number }` | Accurately blocks concurrent requests exceeding threshold | ASVS 11.1.6, CWE-367, ORIGINAL_REQUEST R5 |
| 16 | Concurrency | Pessimistic transaction locking in `verifyEmail` | Enforce explicit transaction with `SELECT ... FOR UPDATE` on `user_vrfy_tbl` | Verification token | `{ success: true }` | Serializes concurrent calls; exactly one succeeds, others fail cleanly | ASVS 11.1.6, 4.1.5, CWE-362, ORIGINAL_REQUEST R5 |

---

### 1.4 Edge Cases Table

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | DB Schema Migration | Executing migration script when columns already exist | Migration script executes idempotently without duplicate column or syntax errors. |
| 2 | Token Storage Hashing | Cleartext token submitted in query against SHA-256 hashed column | Verification routine hashes input with SHA-256 first; exact match found; cleartext never matched directly. |
| 3 | Route Middleware | Unauthenticated user accessing `/pending/nested-route` | Middleware intercepts request and returns HTTP 307 redirect to `/login?callbackUrl=%2Fpending%2Fnested-route`. |
| 4 | Route Middleware | Authenticated user with `user_role = 'user'` accessing `/input` | Middleware rejects request with 403 Forbidden or redirects to `/home`. |
| 5 | Mutation Actions | Calling `deleteQuiz(123)` without session cookies | Server action returns `{ error: "Unauthorized" }` without executing SQL DELETE. |
| 6 | Server Action RPC | Invoking `clearLoginRateLimit` from client RPC endpoint | Endpoint returns 404 or fails compilation because function is not an exported server action. |
| 7 | Email Verification GET | GET request from anti-virus / email prefetch bot to `/verify-email/[token]` | Page displays confirmation form only; database `user_vrfy_tbl` remains untouched; no user inserted into `user_auth_tbl`. |
| 8 | Email Verification POST | Submitting expired verification token to POST action | Transaction detects `NOW() > expires_at`, deletes record, returns `{ success: false, message: "Token has expired" }`. |
| 9 | Session Revocation | Active JWT with `tokenVersion = 1` evaluated after password reset sets DB `token_version = 2` | Next-Auth `session` callback queries DB, detects version mismatch, invalidates session, forces user to re-authenticate. |
| 10 | OAuth Account Linking | Attacker logs in with OAuth provider for an email already registered with local password | Callback checks active session; finds no session; blocks auto-link; returns OAuth sign-in error. |
| 11 | OAuth Account Linking | Authenticated user in active session links OAuth provider in account settings | Active session verified; links provider ID in `user_oauth_tbl` safely. |
| 12 | OTP Verification | 4 incorrect attempts followed by 1 correct attempt | Attempts increment to 4, 5th attempt succeeds, resets attempts, marks OTP `is_used = 1`. |
| 13 | OTP Verification | 5 consecutive incorrect attempts | 5th attempt increments counter to 5, sets `locked_until` (or marks OTP permanently locked); subsequent 6th attempt rejected immediately even if code is correct. |
| 14 | OTP Replay | Submitting the same OTP to `resetPass` twice | First call succeeds and sets `is_used = 2`. Second call finds `is_used != 1`, fails immediately with replay error. |
| 15 | Password Reset Enumeration | Requesting reset for `nonexistent@example.com` vs `realuser@example.com` | Both requests return identical response text and response duration within ±20ms statistical deviation. |
| 16 | Password Reset Flooding | 10 rapid `reqPassReset` calls for the same email within 1 minute | First N calls permitted; subsequent calls rejected with rate limit error. |
| 17 | Concurrent Rate Limiting | 25 simultaneous calls to `checkRateLimit` with limit of 5 | Exactly 5 calls return `allowed: true`; remaining 20 return `allowed: false`; zero over-allocation bypass. |
| 18 | Concurrent Email Verification | 10 simultaneous POST requests with the same verification token | `SELECT ... FOR UPDATE` serializes the transaction: exactly 1 request succeeds in creating the account; 9 requests fail cleanly with "Token already used" without database deadlocks or duplicate records. |

---

## 2. Logic Chain

1. **Premise**: In modern web architectures combining Next.js App Router, Next-Auth, and MySQL, security mechanisms must be enforced at both the network boundary (middleware), the application RPC boundary (server actions), the session evaluation layer (JWT callbacks), and the database storage/transaction layer.
2. **Observation 1 (SEC-12)**: In `app/actions/auth.ts`, tokens are stored as plaintext strings in MySQL. If the database is compromised, read via SQL injection, or dumped in a backup, all active OTPs and verification tokens are readable in cleartext.
3. **Inference 1**: Under ASVS 2.7.5 and 3.4.2, sensitive one-time verifiers and session tokens must be stored cryptographically hashed (SHA-256) at rest. Furthermore, anti-brute-force defense requires attempt tracking columns (`attempts`, `locked_until`) and global session revocation requires `token_version` on `user_auth_tbl`. Therefore, Milestone 1 must provide idempotent schema migrations for these columns.
4. **Observation 2 (SEC-03, SEC-06, SEC-09, SEC-11)**:
   - Administrative pages (`/pending`, `/input`) lack Next.js middleware protection.
   - All 10 mutation functions in `app/actions/quiz.ts` do not invoke `requireAdmin()`.
   - `clearLoginRateLimit` is exported as a public server action RPC.
   - `/verify-email/[token]` executes account activation on GET.
5. **Inference 2**:
   - Under ASVS 4.1.1 and 4.1.3, access control must be enforced on a trusted server layer for both routes and RPC endpoints.
   - Under RFC 7231 and ASVS 13.2.1, GET requests must be idempotent and must never mutate state.
   - Under ASVS 2.2.1 and 13.1.4, administrative helpers must not be exposed over public RPC, and public registration must be protected by server-side anti-automation (reCAPTCHA v3). Therefore, Milestone 2 must enforce route middleware, action authorization guards, RPC encapsulation, and POST-only email verification.
6. **Observation 3 (SEC-04, SEC-05)**:
   - Next-Auth JWTs have a default lifespan of 30 days. When a user changes their password or logs out, the JWT remains cryptographically valid because the session callback does not verify revocation state against MySQL.
   - In `auth.ts`, `signIn` links any OAuth identity matching an existing email without requiring the user to prove ownership of the existing local session.
7. **Inference 3**:
   - Under ASVS 3.3.1, 3.3.3, and 3.5.3, session revocation must be immediate across all active sessions upon password reset and logout. Comparing `token.tokenVersion` against `user_auth_tbl.token_version` in the session callback achieves instantaneous server-side JWT revocation.
   - Under ASVS 3.2.1, 3.6.1, and 3.7.1, automatic account linking without an existing authenticated session enables pre-hijacking and account takeover. Automatic linking must be disallowed unless initiated within an active session. Therefore, Milestone 3 must remediate session callbacks, token version increments, and OAuth linking policies.
8. **Observation 4 (SEC-01, SEC-02, SEC-08, SEC-10)**:
   - 6-digit numeric OTPs have only 1,000,000 combinations. Without attempt counters or rate limits, they can be brute-forced in minutes.
   - Replay is possible if consumed OTPs are not transitioned to a distinct terminal state (`is_used = 2`) and checked for expiration.
   - In `reqPassReset`, an unhandled TypeError on non-existent emails creates an observable discrepancy in error messages and timing (user enumeration), while lack of rate limiting allows flooding.
9. **Inference 4**:
   - Under ASVS 2.2.1, 2.7.2, 2.7.3, 2.8.4, and 3.7.1, OTPs must strictly enforce a 5-attempt limit, short validity windows, and terminal state consumption (`is_used = 2`).
   - Under ASVS 2.1.8, 2.5.3, and CWE-204/CWE-208, password reset endpoints must return identical messages and timing regardless of email existence, with rate limiting against email flooding. Therefore, Milestone 4 must remediate OTP lifecycle, rate limiting, and timing uniformity.
10. **Observation 5 (SEC-07, SEC-13)**:
    - `checkRateLimit` reads the row, inspects it in memory, and writes back. Under 100 concurrent requests, all 100 see `attempts = 0` and pass through.
    - `verifyEmail` reads the token outside the transaction without pessimistic locking. Multiple concurrent requests with the same token can create duplicate accounts.
11. **Inference 5**:
    - Under ASVS 11.1.6 (CWE-367 / TOCTOU), rate limiting counters must update atomically in the database engine using `INSERT ... ON DUPLICATE KEY UPDATE`.
    - Under ASVS 4.1.5, concurrent token consumption must be locked using `SELECT ... FOR UPDATE` inside an explicit transaction. Therefore, Milestone 5 must refactor rate limiting and email verification to eliminate race windows.

---

## 3. Caveats

1. **Database Environment**: Verification scripts executing against live MySQL instances require environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`) or an active test database container. Unit tests mocking the `mysql2/promise` pool must adhere strictly to identical SQL query semantics, including `SELECT ... FOR UPDATE` and `ON DUPLICATE KEY UPDATE` behavior.
2. **Next-Auth v5 Beta**: The application uses `next-auth: 5.0.0-beta.32`. In Auth.js v5, the `auth()` helper is used in middleware and server actions. When testing standalone scripts via `tsx`, Next-Auth handlers may need mocked headers or synthetic request contexts.
3. **Google reCAPTCHA v3**: In production, reCAPTCHA verifies against Google's verification endpoint with `process.env.RECAPTCHA_SECRET_KEY`. In test environments (`tests/test-m2.ts`), tests should verify that missing/invalid tokens are rejected and allow injecting a mock or test bypass key for automated CI/CD runs.
4. **Scope Boundaries**: This specification addresses SEC-01 through SEC-13 across Milestones 1-5. It does not introduce alterations to client-side styling, UI components, or quiz content business logic outside access control and security boundaries.

---

## 4. Conclusion & Test Suite Specifications

To ensure objective compliance verification by Challenger and Auditor roles, standalone TypeScript test scripts (`tests/test-m1.ts` through `tests/test-m5.ts`) executable via `npx tsx` must be authored according to the following specifications:

### 4.1 Milestone 1: Database Schema & Token Storage Hardening (`tests/test-m1.ts`)
- **Objective**: Verify database schema changes, idempotency of migration scripts, and SHA-256 token hashing at rest.
- **ASVS Mappings**: 2.7.5, 3.4.2, 3.7.1, 6.2.2.
- **Required Test Cases**:
  1. `test_migration_idempotency`: Execute `migrations/001_harden_token_storage.sql` twice consecutively on the database. Ensure both executions complete with exit code 0 without errors or duplicate column warnings.
  2. `test_schema_columns`: Inspect `information_schema.columns` or `DESCRIBE`:
     - `user_auth_tbl` must include `token_version` (`INT NOT NULL DEFAULT 1`).
     - `user_otp_tbl` must include `attempts` (`INT NOT NULL DEFAULT 0`) and `locked_until` (`DATETIME NULL`).
     - `user_vrfy_tbl` must include `attempts` (`INT NOT NULL DEFAULT 0`) and `locked_until` (`DATETIME NULL`).
  3. `test_token_storage_sha256`:
     - When generating an OTP in `reqPassReset`, the database row in `user_otp_tbl.otp_code` must store a 64-character hex string representing `sha256(otpCode)`, not the raw 6-digit code.
     - When generating a verification token in `signUp`, `user_vrfy_tbl.verification_token` must store a 64-character hex string representing `sha256(rawToken)`, not the raw token.
  4. `test_rollback_script`: Execute the corresponding rollback script. Confirm all added columns are cleanly dropped and database returns to baseline. Re-run migration script to confirm forward reproducibility.

### 4.2 Milestone 2: Route Protection & Access Control (`tests/test-m2.ts`)
- **Objective**: Verify Next.js route middleware, administrative action guards, RPC encapsulation, and POST-only email verification.
- **ASVS Mappings**: 3.1.1, 4.1.1, 4.1.3, 4.2.1, 13.1.4, 13.2.1, RFC 7231.
- **Required Test Cases**:
  1. `test_unauthenticated_route_redirect`:
     - Simulate HTTP GET requests to `/pending`, `/pending/review`, `/input`, `/input/new` without session cookies.
     - Verify response is HTTP 307 / 302 redirecting to `/login`.
  2. `test_non_admin_route_forbidden`:
     - Simulate HTTP GET requests to `/pending` and `/input` with a session cookie for `user_role = 'user'`.
     - Verify response is HTTP 403 Forbidden or redirected away from administrative panel.
  3. `test_mutation_actions_require_admin`:
     - Individually invoke all 10 mutation functions in `app/actions/quiz.ts` without an admin session:
       1. `createQuiz`
       2. `updateQuiz`
       3. `deleteQuiz`
       4. `deleteUnit`
       5. `reviewPendingQuiz`
       6. `updatePendingQuiz`
       7. `updatePendingNote`
       8. `updatePendingQuizFromForm`
       9. `updatePendingUnitFromForm`
       10. `deletePendingQuiz`
     - Verify each function call returns `{ error: "Unauthorized" }` or throws an unauthorized error without modifying the database.
  4. `test_clear_login_rate_limit_not_exported`:
     - Inspect exported members of `app/actions/auth.ts`.
     - Assert that `clearLoginRateLimit` is NOT an exported identifier in the module.
  5. `test_recaptcha_server_side_enforcement`:
     - Invoke `signUp` without a reCAPTCHA token or with an invalid token.
     - Verify signup is rejected with `{ error: "reCAPTCHA verification failed." }` and no verification record is created.
  6. `test_email_verification_get_does_not_mutate`:
     - Simulate an HTTP GET request to `/verify-email/[token]`.
     - Verify that the verification record in `user_vrfy_tbl` remains unchanged, and no user is created in `user_auth_tbl`.
     - Verify that only an explicit POST action activates the account.

### 4.3 Milestone 3: Authentication & Session Revocation (`tests/test-m3.ts`)
- **Objective**: Verify server-side session revocation via `token_version` and secure OAuth account linking restrictions.
- **ASVS Mappings**: 3.2.1, 3.3.1, 3.3.3, 3.5.3, 3.6.1, 3.7.1.
- **Required Test Cases**:
  1. `test_session_revocation_on_token_version_mismatch`:
     - Construct a valid Next-Auth JWT token payload containing `id: userId, tokenVersion: 1`.
     - Update `user_auth_tbl SET token_version = 2 WHERE user_id = userId`.
     - Invoke the `session` callback with this JWT.
     - Verify the callback invalidates the session (returns `null` or unauthenticated session).
  2. `test_password_reset_increments_token_version`:
     - Query `token_version` for user before password reset.
     - Complete a password reset flow via `resetPass`.
     - Query `token_version` in `user_auth_tbl`. Verify it has incremented by 1.
  3. `test_logout_increments_token_version`:
     - Invoke user logout action.
     - Verify `token_version` is incremented, immediately terminating all other active 30-day JWT sessions.
  4. `test_unauthenticated_oauth_linking_blocked`:
     - Create an existing local user with `email = 'target@example.com'`.
     - Trigger Next-Auth `signIn` callback with OAuth account (e.g. Google or GitHub) with email `'target@example.com'`, but with NO active session.
     - Verify `signIn` returns `false` or rejects the attempt with an error. Verify NO entry is created in `user_oauth_tbl`.
  5. `test_authenticated_oauth_linking_allowed`:
     - Trigger `signIn` callback when the user is already authenticated in an active session as `user_id = targetUserId`.
     - Verify `signIn` succeeds and safely links the OAuth account in `user_oauth_tbl`.

### 4.4 Milestone 4: OTP Lifecycle, Anti-Abuse & Rate Limiting (`tests/test-m4.ts`)
- **Objective**: Verify OTP attempt counters, permanent lockouts, replay prevention, and anti-enumeration protections.
- **ASVS Mappings**: 2.1.8, 2.2.1, 2.5.3, 2.7.2, 2.7.3, 2.8.4, 3.7.1, 3.7.2.
- **Required Test Cases**:
  1. `test_otp_max_attempts_lockout`:
     - Create a valid OTP record for a user.
     - Submit 4 incorrect OTP values to `verifyOTP`. Verify each returns `{ error: "Invalid OTP" }` and increments `attempts`.
     - Submit a 5th incorrect OTP. Verify `attempts` reaches 5 and `locked_until` is set (or OTP is permanently invalidated).
     - Submit the CORRECT OTP on the 6th attempt. Verify it is rejected due to lockout/invalidation.
  2. `test_otp_replay_prevention`:
     - Generate a valid OTP and verify it via `verifyOTP` (transitions to `is_used = 1`).
     - Call `resetPass` with the OTP. Verify password is reset and OTP transitions to `is_used = 2`.
     - Immediately call `resetPass` again with the same OTP. Verify the call is rejected with `{ error: "Invalid or expired OTP" }`.
  3. `test_otp_expiration_enforcement`:
     - Insert an OTP with `expires_at = NOW() - INTERVAL 1 MINUTE`.
     - Call `verifyOTP` and `resetPass`.
     - Verify request is rejected with expiration error.
  4. `test_req_pass_reset_anti_enumeration`:
     - Call `reqPassReset('existing_user@example.com')`.
     - Call `reqPassReset('nonexistent_user@example.com')`.
     - Assert that BOTH return the exact same payload: `{ success: true, message: "If an account exists with this email, a reset code has been sent." }`.
     - Measure execution timing across 50 requests of both existing and non-existent emails. Assert that mean response times do not reveal user presence (variance within acceptable margin).
  5. `test_req_pass_reset_rate_limiting`:
     - Send repeated `reqPassReset` calls for the same email address.
     - Verify that calls exceeding the rate threshold (e.g. 5 calls in 15 minutes) are blocked with a rate limit error.

### 4.5 Milestone 5: Concurrency & Transaction Isolation (`tests/test-m5.ts`)
- **Objective**: Verify atomic database operations for rate limiting and pessimistic transaction locking for email verification under high concurrency.
- **ASVS Mappings**: 4.1.5, 11.1.6, CWE-362, CWE-367.
- **Required Test Cases**:
  1. `test_check_rate_limit_atomic_concurrency`:
     - Clear the rate limit key `test-concurrent-key`.
     - Launch 25 concurrent `checkRateLimit('test-concurrent-key', true)` promises via `Promise.all`.
     - Given a configured `MAX_ATTEMPTS = 5`:
       - Assert that EXACTLY 5 promises receive `{ allowed: true }`.
       - Assert that EXACTLY 20 promises receive `{ allowed: false }`.
       - Inspect `rate_limit_tbl`: verify `attempts = 25` and `blocked = TRUE`.
       - Verify zero race-condition over-allowance.
  2. `test_verify_email_transaction_pessimistic_lock`:
     - Insert a pending user in `user_vrfy_tbl` with a test token.
     - Launch 10 simultaneous calls to `verifyEmail(testToken)` via `Promise.all`.
     - Assert that EXACTLY 1 promise returns `{ success: true }`.
     - Assert that the other 9 promises return `{ success: false }` without throwing unhandled exceptions or deadlocks.
     - Query `user_auth_tbl`: assert that EXACTLY 1 row was created with the user's email.
     - Query `player_tbl`: assert that EXACTLY 1 profile was created.
     - Query `user_vrfy_tbl`: assert that the verification record was cleanly deleted/consumed.

---

## 5. Verification Method

To independently verify all findings and test suite specifications:

1. **Verify ASVS Requirements**:
   ```bash
   curl -s https://raw.githubusercontent.com/OWASP/ASVS/v4.0.3/4.0/en/0x12-V3-Session-management.md | grep -E "3\.[1-7]\.[0-9]"
   curl -s https://raw.githubusercontent.com/OWASP/ASVS/v4.0.3/4.0/en/0x19-V11-BusLogic.md | grep "11\.1\.6"
   ```
2. **Verify Vulnerability Locations in Codebase**:
   - SEC-12: `grep -n "randomBytes" app/actions/auth.ts` and `grep -n "randomInt" app/actions/auth.ts`
   - SEC-03: `grep -n "requireAdmin" app/actions/quiz.ts` (note absence inside mutation functions)
   - SEC-06: `grep -n "export async function clearLoginRateLimit" app/actions/auth.ts`
   - SEC-11: `grep -n "verifyEmail" app/verify-email/\[token\]/page.tsx`
   - SEC-04/05: `grep -n -C 5 "signIn" auth.ts` and `grep -n -C 5 "tokenVersion" auth.ts`
   - SEC-01/02: `grep -n -C 10 "verifyOTP" app/actions/auth.ts` and `grep -n -C 10 "resetPass" app/actions/auth.ts`
   - SEC-07: `grep -n -C 10 "checkRateLimit" lib/rate-limit.ts`
   - SEC-13: `grep -n -C 15 "verifyEmail" app/actions/auth.ts`
3. **Verify Milestone Test Script Execution**:
   Once implemented, each test script must run independently via:
   ```bash
   npx tsx tests/test-m1.ts
   npx tsx tests/test-m2.ts
   npx tsx tests/test-m3.ts
   npx tsx tests/test-m4.ts
   npx tsx tests/test-m5.ts
   ```
   All test scripts must complete with exit code 0 and all assertions passing.
