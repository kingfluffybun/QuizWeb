## 2026-10-12T19:06:11Z
You are Explorer 1 for Milestone 1: Database Schema & Token Storage Hardening (SEC-12).
Your working directory is: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_explorer_1
You MUST read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/PROJECT.md.
Project root: /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management

Objective:
Investigate and design the exact SQL migration scripts for Milestone 1 under `migrations/`:
1. Versioned idempotent forward migration:
   - Add `token_version INT DEFAULT 1` to `user_auth_tbl`
   - Add `attempts INT DEFAULT 0`, `locked_until DATETIME NULL` to `user_otp_tbl` and `user_vrfy_tbl`
   - Also provide baseline idempotent schema if tables do not exist
2. Versioned rollback script
3. Explain how idempotency can be guaranteed in MySQL (e.g., handling duplicate column errors or using stored procedure / INFORMATION_SCHEMA checks)
Do NOT implement or modify code. Recommend the exact SQL and structure in your handoff report.
Write your report to /home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m1_explorer_1/handoff.md and notify me when complete.
