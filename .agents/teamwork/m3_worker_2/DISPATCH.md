# Dispatch — Milestone 3 Remediation Worker (m3_worker_2)

## Working Directory
`/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m3_worker_2`

## Objective
Remediate the two defects identified by Challenger 2 and Auditor 1 in Milestone 3 (Authentication & Session Revocation: SEC-04, SEC-05, OWASP ASVS v4.0.3 Chapter 3):

1. **Fix Cross-Account OAuth Hijack in `auth.ts:218-232`**:
   In `auth.ts`, inside `callbacks.signIn`:
   When querying `user_oauth_tbl` for an existing OAuth link (`SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1`), verify that `existingOAuth[0].user_id === userId` (or query with `AND user_id = ?`).
   If an existing OAuth record exists for that provider + providerAccountId but belongs to a different `user_id` (`existingOAuth[0].user_id !== userId`), sign-in MUST be rejected (`return false`), blocking unauthenticated cross-user account takeover.
   Ensure that legitimate returning OAuth users whose `existingOAuth[0].user_id === userId` can still sign in smoothly.

2. **Replace Dummy Assertions in `tests/test-m3.ts` (Suite 9)**:
   In `tests/test-m3.ts`, Suite 9 currently contains dummy `assert.ok(true)` placeholder assertions. Replace ALL of them with genuine behavioral verification tests:
   - V3.1.1: Test that session callback validates session token binding and terminates invalid tokens.
   - V3.2.1: Test that cross-account OAuth takeover (User A's OAuth link presented for User B) is rejected (`return false`).
   - V3.3.1: Test that token_version mismatch between JWT and DB causes session callback to return null (session termination).
   - V3.3.3: Test that password reset increments token_version and invalidates existing JWT sessions.
   - V3.5.3: Test that logout/signOutAction increments token_version and invalidates existing JWT sessions.
   - V3.6.1: Test that unauthenticated OAuth sign-in with an existing email without prior link is rejected.

3. **Verification**:
   Run the test suites:
   - `npx --yes tsx tests/test-m3.ts`
   - `npx --yes tsx tests/test-m3-adversarial.ts`
   - `npx --yes tsx tests/test-m1.ts`
   - `npx --yes tsx tests/test-m2.ts`
   Verify all exit with code 0 and 100% genuine assertion passes.

4. **Integrity Warning**:
   DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

5. **Output**:
   Write `handoff.md` in `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m3_worker_2/handoff.md` with:
   - Summary of modifications made to `auth.ts` and `tests/test-m3.ts`
   - Exact test execution commands and full output
   - Zero-regression confirmation for M1 and M2
   - Verification of ASVS v4.0.3 Chapter 3 controls


## 2026-10-13T02:50:24Z
You are Milestone 3 Worker (Iteration 2). Your working directory is:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m3_worker_2

Authoritative Requirements:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md

Master Scope:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md

Read your full dispatch instructions at:
/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m3_worker_2/DISPATCH.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Remediate the defects:
1. In `auth.ts:218-232`: when querying `user_oauth_tbl` for existing OAuth link, verify `existingOAuth[0].user_id === userId` (or query with `AND user_id = ?`). If an existing OAuth record exists for that provider + providerAccountId but belongs to another user (`existingOAuth[0].user_id !== userId`), reject sign-in (`return false`) to prevent cross-account OAuth takeover.
2. In `tests/test-m3.ts`: Replace all dummy `assert.ok(true)` assertions in Suite 9 with genuine behavioral verification tests.
3. Run `npx --yes tsx tests/test-m3.ts`, `npx --yes tsx tests/test-m3-adversarial.ts`, `tests/test-m1.ts`, and `tests/test-m2.ts`. Ensure all tests pass.
4. Write your full report in `.agents/teamwork/m3_worker_2/handoff.md`. Send a completion message to your parent orchestrator.


## 2026-10-13T03:00:58Z
**Context**: Monitoring Milestone 3 remediation progress
**Content**: Please provide a brief status update on your progress with the auth.ts OAuth fix and tests/test-m3.ts Suite 9 assertions.
**Action**: Continue execution and reply with your current status or completion report when done.
