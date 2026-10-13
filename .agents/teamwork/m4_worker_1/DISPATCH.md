# Dispatch — Milestone 4 Implementation Worker (m4_worker_1)

## Working Directory
`/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_1`

## Objective
Implement Milestone 4: OTP Lifecycle, Anti-Abuse & Rate Limiting (SEC-01, SEC-02, SEC-08, SEC-10) and author the standalone verification test suite `tests/test-m4.ts`.

### 1. Requirements & Code Implementations in `app/actions/auth.ts`:

- **SEC-01 (OTP Attempt Counter & Lockout in `verifyOTP`)**:
  - In `verifyOTP(email: string, otpCode: string)`:
    - Check if OTP record is locked (`attempts >= 5` or `locked_until !== null && new Date() < new Date(locked_until)`). If locked, return `{ error: "Too many failed attempts. This OTP has been locked. Please request a new one." }`.
    - Check if expired (`new Date(expires_at) < new Date()`).
    - If OTP code does not match (`!timingSafeEqualStr(otp.otp_code, hashedInputOtp)`):
      - Increment `attempts = attempts + 1`.
      - If new attempts >= 5, set `attempts = 5, locked_until = NOW()` in `user_otp_tbl` and return locked error.
      - If new attempts < 5, update `attempts` in `user_otp_tbl` and return `{ error: "Invalid OTP. Please try again." }`.
    - If OTP matches:
      - Transition `is_used = 1` (verified status) in `user_otp_tbl`.
      - Return `{ success: true, message: "OTP verified successfully." }`.

- **SEC-02 (OTP Replay Prevention & Consumed State in `resetPass`)**:
  - In `resetPass(email: string, otpCode: string, newPassword: string)`:
    - Verify OTP record exists with `is_used = 1` and `expires_at > NOW()`.
    - If `otps.length === 0 || !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) || otps[0].is_used !== 1`:
      - Return `{ error: "Invalid or expired OTP" }`.
    - Hash new password with `argon2`.
    - Update `password_hash` and increment `token_version = token_version + 1` in `user_auth_tbl` (SEC-05).
    - Transition the OTP record to `is_used = 2` (consumed status):
      `UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?` (or for that user/purpose).
    - Crucial: Any re-submission of the same OTP must fail with `{ error: "Invalid or expired OTP" }` because `is_used` is now `2`, preventing replay attacks completely.

- **SEC-08 (Anti-Enumeration in `reqPassReset`)**:
  - In `reqPassReset(email: string)`:
    - Query `user_auth_tbl` for user by email.
    - If `users.length === 0`:
      - Return `{ success: true, message: "If an account exists with this email, a reset code has been sent." }`.
      - Crucial fix: Do NOT access `users[0].user_id` when `users.length === 0` (which previously caused a TypeError that revealed user non-existence via the catch block).
    - If user exists:
      - Query `player_tbl` for username.
      - Generate 6-digit OTP, compute SHA-256 hash, insert into `user_otp_tbl` with `is_used = 0, attempts = 0, locked_until = NULL, expires_at = NOW() + 5 min`.
      - Send email via `sendEmail`.
      - Return identical response: `{ success: true, message: "If an account exists with this email, a reset code has been sent." }`.

- **SEC-10 (Email Flooding Prevention & Rate Limiting in `reqPassReset`)**:
  - Enforce rate limiting on `reqPassReset`:
    - Call `checkRateLimit("req_reset_" + email.trim().toLowerCase(), true)` (or IP/email rate limit).
    - If rate limited (e.g., > 5 requests within 15 minutes / 900 seconds), return `{ error: "Too many password reset requests. Please try again later." }`.

### 2. Standalone Verification Test Suite `tests/test-m4.ts`:
- Author `tests/test-m4.ts` executable via `npx --yes tsx tests/test-m4.ts`.
- Follow the clean standalone test pattern established in `tests/test-m3.ts` (with mock DB and real application logic testing).
- Cover:
  - Suite 1: SEC-01 OTP Attempt Counter (5 failed attempts locks OTP, subsequent attempts rejected).
  - Suite 2: SEC-02 Strict Expiration Enforcement (expired OTP rejected).
  - Suite 3: SEC-02 Replay Prevention (`resetPass` transitions to `is_used = 2`, repeated submissions rejected).
  - Suite 4: SEC-08 Anti-Enumeration (identical response and uniform timing for existing vs nonexistent email, no TypeError).
  - Suite 5: SEC-10 Rate Limiting against email flooding on `reqPassReset`.
  - Suite 6: Edge Cases & Boundary Conditions.
  - Suite 7: Zero Regression Guard (M1, M2, M3).
  - Suite 8: OWASP ASVS v4.0.3 Chapter 2 & Chapter 3 Compliance Matrix.

### 3. Verification Commands:
- `npx --yes tsx tests/test-m4.ts`
- `npx --yes tsx tests/test-m1.ts`
- `npx --yes tsx tests/test-m2.ts`
- `npx --yes tsx tests/test-m3.ts`

### 4. Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### 5. Output:
Write `handoff.md` in `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_1/handoff.md`. Send completion message to parent.


## 2026-10-13T03:20:17Z
You are Milestone 4 Worker (m4_worker_1). Your working directory is:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_1

Authoritative Requirements:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md

Master Scope:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md

Read your full dispatch instructions at:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_1/DISPATCH.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement:
1. SEC-01 in `verifyOTP`: 5-attempt counter permanently locking OTP on 5th failed attempt.
2. SEC-02 in `resetPass`: strict `expires_at` check, transition consumed OTP to `is_used = 2`, preventing replay.
3. SEC-08 in `reqPassReset`: fix user existence check (no TypeError on non-existent user), return identical responses to prevent enumeration.
4. SEC-10 in `reqPassReset`: enforce rate limiting against email flooding.
5. Author comprehensive standalone test harness `tests/test-m4.ts` (follow pattern of `tests/test-m3.ts`).
6. Run tests: `npx --yes tsx tests/test-m4.ts`, `tests/test-m1.ts`, `tests/test-m2.ts`, `tests/test-m3.ts`. Ensure all pass.
7. Write `handoff.md` in your working directory and notify parent orchestrator.
