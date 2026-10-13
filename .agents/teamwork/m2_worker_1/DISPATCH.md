## 2026-10-12T19:50:49Z
You are the Worker for Milestone 2: Route Protection & Access Control (SEC-03, SEC-06, SEC-09, SEC-11).
Your working directory is: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_worker_1
Project root: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management

You MUST read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md and the three Explorer handoff reports:
- /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_1/handoff.md
- /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_2/handoff.md
- /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks:
1. Create `middleware.ts` in project root:
   - Protect `/pending/:path*` and `/input/:path*`.
   - Intercept unauthenticated users and redirect to `/login?callbackUrl=...`.
   - Intercept non-admin users (`user_role !== 'admin'`) and return 403 Forbidden or redirect.
   - Allow admin users through.
2. Update `app/actions/quiz.ts`:
   - Implement `requireAdmin()` checking session role from Auth.js `auth()`.
   - Wrap all 10 mutation functions with `await requireAdmin()`:
     `createQuiz`, `updateQuiz`, `deleteQuiz`, `deleteUnit`, `reviewPendingQuiz`, `updatePendingQuiz`, `updatePendingNote`, `updatePendingQuizFromForm`, `updatePendingUnitFromForm`, `deletePendingQuiz`.
3. Update `app/actions/auth.ts`:
   - SEC-06: Remove public `export` from `clearLoginRateLimit`. Keep it internal only.
   - SEC-09: Implement server-side reCAPTCHA v3 verification in `signUp`. Call Google `siteverify` API, reject missing/invalid tokens with `{ error: "reCAPTCHA verification failed." }`, and allow `test-bypass-recaptcha-token` for testing environments.
4. Update `app/login/page.tsx`:
   - Remove any client invocation of `clearLoginRateLimit` and ensure client passes reCAPTCHA token to `signUp`.
5. Update `app/verify-email/[token]/page.tsx`:
   - Convert from automatic GET mutation into an explicit user-initiated POST activation form.
   - GET request renders confirmation UI with ZERO database mutations.
   - User form submit executes a Server Action calling `verifyEmail(token)`.
6. Author `tests/test-m2.ts`:
   - Standalone verification script executing with `npx --yes tsx tests/test-m2.ts` or `node`.
   - Tests unauthenticated and non-admin access to protected routes.
   - Tests all 10 mutation functions requiring admin authorization.
   - Tests removal of public `clearLoginRateLimit` RPC export.
   - Tests server-side reCAPTCHA v3 verification in `signUp`.
   - Tests zero-mutation GET and user-initiated POST activation in `/verify-email/[token]`.
   - Exits code 0 on all tests passing.
7. Execute test suite: `npx --yes tsx tests/test-m2.ts` and `npx eslint`.
8. Document all commands, results, and code changes in /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_worker_1/handoff.md.
9. Send a completion message back to me when done.
