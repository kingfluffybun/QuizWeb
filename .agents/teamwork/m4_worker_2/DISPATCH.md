# Dispatch — Milestone 4 Remediation Worker (m4_worker_2)

## Working Directory
`/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_2`

## Objective
Remediate the defects identified by Challenger 1 in Milestone 4 Iteration 1:

1. **Fix Concurrency Race Condition in `verifyOTP` (SEC-01)**:
   - In `app/actions/auth.ts` lines 610–645:
   - Current code reads `otp.attempts` in JS memory and writes `UPDATE ... SET attempts = newAttempts`, allowing 20 concurrent requests to read `attempts = 0` and overwrite `attempts = 1`, bypassing the 5-attempt lockout (PROBE-06 in `tests/test-m4-challenger-1.ts`).
   - Fix: Use an atomic SQL update or transaction with `SELECT ... FOR UPDATE` so that concurrent requests cannot lose updates:
     ```sql
     UPDATE user_otp_tbl 
     SET attempts = attempts + 1, 
         locked_until = IF(attempts + 1 >= 5, NOW(), locked_until) 
     WHERE otp_id = ?
     ```
     Immediately check the updated attempt count (e.g., query updated row or check if previous attempts + 1 >= 5) and return the locked error if attempts >= 5.
     Also ensure the pre-check validates:
     ```typescript
     if (otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until))) {
         return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
     }
     ```

2. **Add Server-Side Rate Limiting to `verifyOTP` (SEC-01 / ASVS 2.2.1, 3.7.1)**:
   - In `app/actions/auth.ts`, inside `verifyOTP`:
   - Call `checkRateLimit("otp_verify_" + normalizedEmail, true)` before processing OTP or on failure.
   - If `!rateLimit.allowed`, return `{ error: "Too many OTP verification attempts. Please try again later." }`.

3. **Fix State Inconsistency in `reqPassReset`**:
   - In `app/actions/auth.ts` lines 441–446:
   - When invalidating existing unused OTPs upon a new reset request:
     ```typescript
     await db.query(
         "UPDATE user_otp_tbl SET is_used = 2 WHERE user_id = ? AND purpose = ? AND is_used = 0",
         [userId, "password_reset"]
     );
     ```
     Transition unused tokens to `is_used = 2` (consumed/invalidated), NOT `is_used = 1` (verified).

4. **Verify All Test Suites**:
   - `npx --yes tsx tests/test-m4-challenger-1.ts` (all 19/19 probes must pass)
   - `npx --yes tsx tests/test-m4-challenger2.ts` (all 14/14 probes must pass)
   - `npx --yes tsx tests/test-m4.ts` (all tests must pass)
   - `npx --yes tsx tests/test-m1.ts`
   - `npx --yes tsx tests/test-m2.ts`
   - `npx --yes tsx tests/test-m3.ts`
   Ensure 0 errors and 0 linter warnings.

5. **Integrity Warning**:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

6. **Output**:
   Write `handoff.md` in `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_2/handoff.md`. Send completion message to parent.

## 2026-10-13T03:43:34Z
You are Milestone 4 Remediation Worker (m4_worker_2). Your working directory is:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_2

Authoritative Requirements:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md

Master Scope:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md

Challenger 1 findings to remediate:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_challenger_1/handoff.md

Read your full dispatch instructions at:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_worker_2/DISPATCH.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Remediate:
1. SEC-01 in `verifyOTP`: replace in-memory read-modify-write of attempts with atomic database update (`UPDATE user_otp_tbl SET attempts = attempts + 1, locked_until = IF(attempts + 1 >= 5, NOW(), locked_until) WHERE otp_id = ?`) or transaction so that 20 concurrent wrong attempts cannot bypass lockout (fixes PROBE-06 in test-m4-challenger-1.ts).
2. SEC-01 in `verifyOTP`: add server-side rate limiting via `checkRateLimit` (e.g. `otp_verify_` + normalizedEmail).
3. State machine in `reqPassReset`: update unused OTPs to `is_used = 2` (consumed), not `1` (verified).
4. Run all test suites: `tests/test-m4-challenger-1.ts` (must pass 19/19), `tests/test-m4-challenger2.ts`, `tests/test-m4.ts`, `tests/test-m1.ts`, `tests/test-m2.ts`, `tests/test-m3.ts`. Ensure 0 errors.
5. Write `handoff.md` in your working directory and notify parent orchestrator.
