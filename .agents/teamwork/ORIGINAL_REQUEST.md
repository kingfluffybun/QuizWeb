# Original User Request

## 2026-10-12T18:54:36Z

Remediate all 13 security vulnerabilities identified in the QuizWeb security audit report across the Next.js, Next-Auth, and MySQL stack, executed in a strict 5-milestone sequence with continuous OWASP ASVS Chapter 3 compliance verification and standalone test verification scripts.

Working directory: `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management`
Integrity mode: development

## Requirements

### R1. Milestone 1: Database Schema & Token Storage Hardening
- Update schemas to add `token_version` (`INT DEFAULT 1`) to `user_auth_tbl`.
- Add attempt tracking columns (`attempts INT DEFAULT 0`, `locked_until DATETIME NULL`) and SHA-256 hashed token storage for `user_otp_tbl` and `user_vrfy_tbl` (resolving SEC-12).
- Provide versioned, idempotent SQL migration and rollback scripts under a `migrations/` directory.

### R2. Milestone 2: Route Protection & Access Control
- Create Next.js middleware to restrict `/pending/*` and `/input/*` exclusively to authenticated users with `user_role === 'admin'` (resolving SEC-03).
- Wrap all 10 mutation actions in [`app/actions/quiz.ts`](file:///home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/app/actions/quiz.ts) with `requireAdmin()` checks (resolving SEC-03).
- Remove public exports of `clearLoginRateLimit` from [`app/actions/auth.ts`](file:///home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/app/actions/auth.ts) and enforce Google reCAPTCHA v3 verification strictly server-side in `signUp` (resolving SEC-06, SEC-09).
- Convert `/verify-email/[token]` from an automatic GET mutation into an explicit user-initiated POST activation action (resolving SEC-11).

### R3. Milestone 3: Authentication & Session Revocation
- Update [`auth.ts`](file:///home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/auth.ts) Next-Auth configuration: validate `token.tokenVersion` against `user_auth_tbl` on every session callback to immediately terminate revoked sessions (resolving SEC-05).
- Increment `token_version` in `user_auth_tbl` upon password resets and logouts to revoke active 30-day JWTs (resolving SEC-05).
- Prevent automatic OAuth account linking for existing emails unless an active, authenticated session is already present (resolving SEC-04).

### R4. Milestone 4: OTP Lifecycle, Anti-Abuse & Rate Limiting
- Add server-side rate limiting and an attempt counter in `verifyOTP` (permanently lock/invalidate OTP after 5 failed attempts) (resolving SEC-01).
- Enforce strict `expires_at` validation and transition consumed OTPs to `is_used = 2` in `resetPass` to prevent replay (resolving SEC-02).
- Fix `reqPassReset` to return uniform timing/responses, prevent user enumeration, and enforce request rate limiting against email flooding (resolving SEC-08, SEC-10).

### R5. Milestone 5: Concurrency & Transaction Isolation
- Refactor `checkRateLimit` in [`lib/rate-limit.ts`](file:///home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/lib/rate-limit.ts) to execute atomically via `INSERT ... ON DUPLICATE KEY UPDATE` without TOCTOU windows (resolving SEC-07).
- Wrap `verifyEmail` queries in explicit database transactions using `SELECT ... FOR UPDATE` (resolving SEC-13).

## Verification Resources & Standard
- Standalone verification test scripts must be authored in a `tests/` directory (e.g. `tests/test-m1.ts`, `tests/test-m2.ts`, etc.) executing with `node` / `npx tsx`.
- Challenger and Auditor roles must independently verify that all tests pass and that the implementation complies with OWASP ASVS v4.0.3 Chapter 3 prior to finalizing each milestone.
- Do not advance to the next milestone until the current milestone's verification passes completely.

## Acceptance Criteria

### Milestone 1 Acceptance
- [ ] Schema migration script exists and executes idempotently without syntax errors.
- [ ] New tokens stored in `user_otp_tbl` and `user_vrfy_tbl` are SHA-256 hashes, not cleartext strings.
- [ ] `tests/test-m1.ts` passes.

### Milestone 2 Acceptance
- [ ] Direct unauthenticated HTTP requests to `/pending` and `/input` receive redirects to `/login`.
- [ ] Calling any of the 10 administrative mutation server actions without admin authentication returns an unauthorized error.
- [ ] `clearLoginRateLimit` cannot be invoked as an unauthenticated server action RPC.
- [ ] Loading `/verify-email/[token]` does not create accounts or delete tokens until explicit form submission.
- [ ] `tests/test-m2.ts` passes.

### Milestone 3 Acceptance
- [ ] Incrementing `token_version` in the database causes subsequent requests with existing JWTs to be rejected / logged out.
- [ ] Password reset execution automatically increments `token_version`.
- [ ] OAuth sign-in with an email matching an unlinked local account is blocked unless initiated by an authenticated user.
- [ ] `tests/test-m3.ts` passes.

### Milestone 4 Acceptance
- [ ] Entering 5 incorrect OTPs locks the OTP record and rejects further attempts.
- [ ] Re-submitting an already used OTP to `resetPass` fails with an invalid token error.
- [ ] `reqPassReset` returns identical responses regardless of whether the target email exists.
- [ ] `tests/test-m4.ts` passes.

### Milestone 5 Acceptance
- [ ] Simulated concurrent calls to `checkRateLimit` execute without race condition bypasses.
- [ ] Concurrent requests to `verifyEmail` with the same token do not result in duplicate account insertions or race errors.
- [ ] `tests/test-m5.ts` passes.


## 2026-10-13T10:09:31Z

Continue where you left off. Milestones 1–4 are sealed and passed. Proceed with Milestone 5 (Concurrency & Transaction Isolation: SEC-07, SEC-13) as dispatched in .agents/teamwork/m5_worker_1/DISPATCH.md. Verify all test suites and complete the post-victory audit.

## 2026-10-14T11:06:58Z

Post-Victory Audit Remediation Complete:

1. ESLint Errors Resolved:
- Refactored `auth.ts` lines 187, 203, 294, and 306 from `any` to strict types (`ExtendedToken`, `ExtendedSession`, `ExtendedUser`).
- Refactored `tests/test-m3.ts` lines 475 and 644 from `as any` to typed callback function signatures.
- Verified: `npx eslint lib/rate-limit.ts app/actions/auth.ts middleware.ts auth.ts tests/test-m1.ts tests/test-m2.ts tests/test-m3.ts tests/test-m4.ts tests/test-m5.ts` now exits with 0 errors and 0 warnings (Exit Code: 0).

2. Dummy Assertions Eliminated:
- Replaced placeholder `assert.ok(true)` in `tests/test-m5.ts` line 960 with authentic cryptographic SHA-256 digest validation and session token_version checks.
- Replaced placeholder `assert.ok(true)` in `tests/test-m5-challenger-2.ts` line 1110 with authentic transaction boundary checks (`beginTransaction`, `commit`, `rollback`, `FOR UPDATE`).
- Verified zero instances of `assert.ok(true)` across the entire test codebase.

3. Complete Verification Suite:
- All 136 milestone tests passed (test-m1 through test-m5).
- All 269 challenger and adversarial probes passed (including test-m5-challenger-2).
- Ready for clean-room Victory Re-Audit.
