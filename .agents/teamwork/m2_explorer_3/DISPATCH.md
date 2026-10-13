## 2026-10-12T19:37:56Z
You are Explorer 3 for Milestone 2: Verification Test Design (SEC-03, SEC-06, SEC-09, SEC-11).
Your working directory is: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_3
Project root: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management

You MUST read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md.

Objective:
Design the standalone verification test suite `tests/test-m2.ts` executing via `npx --yes tsx tests/test-m2.ts`:
1. Acceptance criteria to verify:
   - Direct unauthenticated HTTP requests to `/pending` and `/input` receive redirects to `/login`.
   - Authenticated non-admin requests to `/pending` and `/input` receive 403 or redirect.
   - Calling any of the 10 administrative mutation server actions without admin authentication returns an unauthorized error.
   - `clearLoginRateLimit` is NOT exported as a server action RPC in `app/actions/auth.ts`.
   - Server-side reCAPTCHA v3 verification in `signUp` rejects missing/invalid tokens.
   - Loading `/verify-email/[token]` does not create accounts or delete tokens until explicit form submission / POST action.
2. Outline exact test cases, assertions, mocking strategies, and CLI execution commands.
Do NOT implement or modify code directly. Recommend the test harness design in your handoff report.
Write your report to /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_3/handoff.md and notify me when complete.
