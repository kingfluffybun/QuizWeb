## 2026-10-12T19:37:56Z
You are Explorer 2 for Milestone 2: RPC Reduction, reCAPTCHA & POST Email Verification (SEC-06, SEC-09, SEC-11).
Your working directory is: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_2
Project root: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management

You MUST read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md.

Objective:
Investigate and design:
1. SEC-06: Remove public export of `clearLoginRateLimit` in `app/actions/auth.ts` so it cannot be invoked as an unauthenticated server action RPC.
2. SEC-09: Enforce Google reCAPTCHA v3 verification strictly server-side in `signUp` in `app/actions/auth.ts`:
   - Receive reCAPTCHA token in signup request.
   - Verify token against Google's verification API endpoint (`https://www.google.com/recaptcha/api/siteverify`).
   - Reject signup if verification fails or score is insufficient.
   - Support test environments (e.g., test bypass token or mocked secret key).
3. SEC-11: Convert `/verify-email/[token]` from an automatic GET mutation into an explicit user-initiated POST activation action:
   - Inspect `app/verify-email/[token]/page.tsx` and related components.
   - Ensure page GET load only renders confirmation UI (e.g. "Click to activate account" form/button) without mutating `user_vrfy_tbl` or inserting into `user_auth_tbl`.
   - Form submission sends an explicit POST action that calls `verifyEmail(token)`.
Do NOT implement or modify code directly. Recommend the exact implementation in your handoff report.
Write your report to /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m2_explorer_2/handoff.md and notify me when complete.
