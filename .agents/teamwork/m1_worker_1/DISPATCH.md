## 2026-10-12T19:15:38Z
You are the Worker for Milestone 1: Database Schema & Token Storage Hardening (SEC-12).
Your working directory is: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_worker_1
Project root: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management

You MUST read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md and the three Explorer handoff reports:
- /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_explorer_1/handoff.md
- /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_explorer_2/handoff.md
- /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks:
1. Ensure the worktree can resolve dependencies: create symlink `node_modules -> /home/sankobite/QuizWeb/node_modules` if not already present.
2. Create `migrations/` directory and implement:
   - `migrations/001_initial_schema.sql` (baseline schema for all tables with IF NOT EXISTS)
   - `migrations/002_security_hardening.sql` (forward idempotent migration adding `token_version INT DEFAULT 1` to `user_auth_tbl`, and `attempts INT DEFAULT 0`, `locked_until DATETIME NULL` to `user_otp_tbl` and `user_vrfy_tbl`, with baseline fallback)
   - `migrations/002_security_hardening_rollback.sql` (idempotent rollback script dropping added columns)
   Ensure SQL scripts use standard session-level dynamic SQL without CLI DELIMITER directives for mysql2 compatibility.
3. Update `app/actions/auth.ts`:
   - Implement internal `hashToken(raw: string)` using SHA-256 and `timingSafeEqualStr(a: string, b: string)`.
   - Update `signUp`: store SHA-256 hashed verification token, initialize `attempts = 0`, `locked_until = NULL`. Email gets the raw token.
   - Update `reqPassReset`: store SHA-256 hashed OTP, initialize `attempts = 0`, `locked_until = NULL`. Email gets the raw 6-digit OTP.
   - Update `verifyEmail`: hash incoming token with SHA-256 before looking up in `user_vrfy_tbl`. Check `locked_until` and `attempts < 5`.
   - Update `verifyOTP`: look up active OTP row, check lockout, hash incoming OTP and compare with `timingSafeEqualStr`. Track and increment `attempts` on failure, lock if >= 5 attempts. Mark `is_used = 1` on success.
   - Update `resetPass`: hash incoming OTP with SHA-256 and compare with `timingSafeEqualStr`.
   - Do NOT export internal helpers (Next.js server action boundary safety).
4. Create `tests/test-m1.ts`:
   - Standalone verification script executing with `npx --yes tsx tests/test-m1.ts` or `node`.
   - Verifies migration script existence and idempotency (running twice passes cleanly).
   - Verifies schema column presence and defaults.
   - Verifies rollback script idempotency.
   - Verifies that new tokens in `user_otp_tbl` and `user_vrfy_tbl` are stored as SHA-256 hashes, not cleartext.
   - Verifies token verification logic against hashed tokens.
   - Must exit with code 0 on all tests passing.
5. Run the test command: `npx --yes tsx tests/test-m1.ts`.
6. Run `npm run lint` or `npx eslint` to verify no lint errors were introduced.
7. Document all commands, results, and code changes in `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_worker_1/handoff.md`.
8. Send a completion message back to me when done.
