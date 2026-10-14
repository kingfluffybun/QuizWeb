# Project: QuizWeb Security Audit Remediation & ASVS v4.0.3 Chapter 3 Compliance

## Architecture
- **Framework**: Next.js 16 (App Router) with React 19 and React Compiler
- **Authentication**: Next-Auth (Auth.js) v5 beta (`next-auth@5.0.0-beta.32`) with JWT session strategy
- **Database**: MySQL via `mysql2/promise` connection pool (`lib/db.ts`)
- **Password Hashing**: `argon2` / `argon2id`
- **Security Standard**: OWASP ASVS v4.0.3 Chapter 3 (Session Management) and related chapters (V2, V4, V11, V13)
- **Verification Harness**: Standalone TypeScript test scripts in `tests/` (`tests/test-m1.ts` through `tests/test-m5.ts`) runnable via `node` / `npx --yes tsx`.

---

## Feature Inventory
| # | Feature ID | Vulnerability | Description | Milestone | Source |
|---|------------|---------------|-------------|-----------|--------|
| 1 | F-01 | SEC-12 | Database Schema Migration (`token_version`, `attempts`, `locked_until`) and Idempotent Scripts | M1 | ORIGINAL_REQUEST R1, ASVS 3.3.1, 3.4.2 |
| 2 | F-02 | SEC-12 | Token Storage Hardening: SHA-256 hashed storage for `user_otp_tbl` and `user_vrfy_tbl` | M1 | ORIGINAL_REQUEST R1, ASVS 2.7.5, 3.4.2 |
| 3 | F-03 | SEC-12 | Milestone 1 Test Verification Script (`tests/test-m1.ts`) | M1 | ORIGINAL_REQUEST AC-M1 |
| 4 | F-04 | SEC-03 | Next.js Route Middleware (`middleware.ts`) guarding `/pending/*` and `/input/*` for `admin` role | M2 | ORIGINAL_REQUEST R2, ASVS 4.1.1, 4.1.3 |
| 5 | F-05 | SEC-03 | Authorization guards: wrap all 10 mutation actions in `app/actions/quiz.ts` with `requireAdmin()` | M2 | ORIGINAL_REQUEST R2, ASVS 4.1.1, 4.2.1 |
| 6 | F-06 | SEC-06 | Remove public export of `clearLoginRateLimit` in `app/actions/auth.ts` to prevent unauthenticated RPC | M2 | ORIGINAL_REQUEST R2, ASVS 4.1.2, 13.1.4 |
| 7 | F-07 | SEC-09 | Server-side Google reCAPTCHA v3 verification enforcement in `signUp` | M2 | ORIGINAL_REQUEST R2, ASVS 2.2.1, 11.1.4 |
| 8 | F-08 | SEC-11 | Convert `/verify-email/[token]` from automatic GET mutation into explicit user-initiated POST | M2 | ORIGINAL_REQUEST R2, ASVS 3.1.1, 13.2.1 |
| 9 | F-09 | SEC-03/06/09/11 | Milestone 2 Test Verification Script (`tests/test-m2.ts`) | M2 | ORIGINAL_REQUEST AC-M2 |
| 10 | F-10 | SEC-05 | Next-Auth Session Revocation: validate `token.tokenVersion` against `user_auth_tbl` on session callback | M3 | ORIGINAL_REQUEST R3, ASVS 3.1.1, 3.3.1 |
| 11 | F-11 | SEC-05 | Automatic `token_version` increment on password resets (`resetPass`) and logouts | M3 | ORIGINAL_REQUEST R3, ASVS 3.3.3, 3.5.3 |
| 12 | F-12 | SEC-04 | Prevent automatic OAuth account linking in `signIn` callback unless active authenticated session exists | M3 | ORIGINAL_REQUEST R3, ASVS 3.2.1, 3.6.1 |
| 13 | F-13 | SEC-04/05 | Milestone 3 Test Verification Script (`tests/test-m3.ts`) | M3 | ORIGINAL_REQUEST AC-M3 |
| 14 | F-14 | SEC-01 | OTP Lifecycle: Server-side rate limiting and 5-attempt counter with permanent lockout in `verifyOTP` | M4 | ORIGINAL_REQUEST R4, ASVS 2.2.1, 3.7.1 |
| 15 | F-15 | SEC-02 | OTP Replay Prevention & State Transition: enforce `expires_at` check and transition consumed OTP to `is_used = 2` | M4 | ORIGINAL_REQUEST R4, ASVS 2.8.4, 3.7.2 |
| 16 | F-16 | SEC-08 | Anti-Enumeration: uniform timing and identical response messages in `reqPassReset` regardless of user existence | M4 | ORIGINAL_REQUEST R4, ASVS 2.1.8, 2.5.3 |
| 17 | F-17 | SEC-10 | Email Flooding Prevention: rate limiting requests on `reqPassReset` | M4 | ORIGINAL_REQUEST R4, ASVS 2.2.1, 11.1.3 |
| 18 | F-18 | SEC-01/02/08/10 | Milestone 4 Test Verification Script (`tests/test-m4.ts`) | M4 | ORIGINAL_REQUEST AC-M4 |
| 19 | F-19 | SEC-07 | Concurrency: refactor `checkRateLimit` in `lib/rate-limit.ts` to atomic `INSERT ... ON DUPLICATE KEY UPDATE` | M5 | ORIGINAL_REQUEST R5, ASVS 11.1.6 |
| 20 | F-20 | SEC-13 | Transaction Isolation: wrap `verifyEmail` in database transaction with pessimistic `SELECT ... FOR UPDATE` | M5 | ORIGINAL_REQUEST R5, ASVS 4.1.5, 11.1.6 |
| 21 | F-21 | SEC-07/13 | Milestone 5 Test Verification Script (`tests/test-m5.ts`) | M5 | ORIGINAL_REQUEST AC-M5 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Milestone 1: Database Schema & Token Storage Hardening | F-01, F-02, F-03 (SEC-12, schema migrations, SHA-256 token hashing, `tests/test-m1.ts`) | none | DONE |
| 2 | Milestone 2: Route Protection & Access Control | F-04, F-05, F-06, F-07, F-08, F-09 (SEC-03, SEC-06, SEC-09, SEC-11, `tests/test-m2.ts`) | M1 | IN_PROGRESS |
| 3 | Milestone 3: Authentication & Session Revocation | F-10, F-11, F-12, F-13 (SEC-04, SEC-05, `tests/test-m3.ts`) | M1, M2 | PLANNED |
| 4 | Milestone 4: OTP Lifecycle, Anti-Abuse & Rate Limiting | F-14, F-15, F-16, F-17, F-18 (SEC-01, SEC-02, SEC-08, SEC-10, `tests/test-m4.ts`) | M1, M3 | PLANNED |
| 5 | Milestone 5: Concurrency & Transaction Isolation | F-19, F-20, F-21 (SEC-07, SEC-13, `tests/test-m5.ts`) | M1, M2, M4 | PLANNED |

---

## Interface Contracts

### 1. Database Schema Contracts (`migrations/`)
- `user_auth_tbl`: `token_version INT NOT NULL DEFAULT 1`
- `user_otp_tbl`: `otp_code VARCHAR(255)` (storing 64-char hex SHA-256 hash), `attempts INT NOT NULL DEFAULT 0`, `locked_until DATETIME NULL`, `is_used INT NOT NULL DEFAULT 0` (0=unused, 1=verified, 2=consumed)
- `user_vrfy_tbl`: `verification_token VARCHAR(255)` (storing 64-char hex SHA-256 hash), `attempts INT NOT NULL DEFAULT 0`, `locked_until DATETIME NULL`
- `rate_limit_tbl`: `limit_key VARCHAR(255) PRIMARY KEY`, `attempts INT NOT NULL DEFAULT 0`, `reset_at BIGINT NOT NULL`, `blocked TINYINT(1) NOT NULL DEFAULT 0`

### 2. Route Protection & Authorization (`middleware.ts`, `app/actions/quiz.ts`)
- `middleware.ts`: Intercepts `/pending/:path*` and `/input/:path*`. Requires authenticated session with `user_role === 'admin'`. Unauthenticated redirects to `/login`. Non-admin redirects or returns 403.
- `requireAdmin()`: Returns `Promise<{ id: string, role: string }>` if admin, throws `Error("Unauthorized: Admin role required")` or returns `{ error: "Unauthorized" }` if not.
- 10 mutation functions in `app/actions/quiz.ts` call `await requireAdmin()` before performing any DB operations.

### 3. Session Revocation & OAuth Linking (`auth.ts`)
- `callbacks.session`: Queries `user_auth_tbl.token_version` by `token.id`. If `dbUser.token_version !== token.tokenVersion`, terminates session / returns null.
- `callbacks.signIn`: For OAuth providers (`google`, `github`), if an existing account exists for the email, linking is rejected unless an active session is currently authenticated.

### 4. OTP & Reset Password Contracts (`app/actions/auth.ts`)
- `reqPassReset(email: string)`: Returns `{ success: true, message: "If an account exists with this email, a reset code has been sent." }` for both existing and nonexistent users. Rate limited to 5 attempts per 15 minutes.
- `verifyOTP(email: string, otp: string)`: Hashes `otp` with SHA-256 before lookup. Checks `attempts < 5` and `locked_until === null`. Increments `attempts` on invalid code. Sets `attempts = 5` and locks on 5th failure. Transitions to `is_used = 1` on success.
- `resetPass(email: string, otp: string, newPassword: string)`: Checks `is_used === 1` and `NOW() < expires_at`. Updates password, transitions OTP to `is_used = 2`, increments `token_version = token_version + 1` in `user_auth_tbl`.

### 5. Rate Limiting & Transaction Contracts (`lib/rate-limit.ts`, `app/actions/auth.ts`)
- `checkRateLimit(key: string, isIncrement: boolean)`: Executes single atomic query:
  `INSERT INTO rate_limit_tbl (limit_key, attempts, reset_at, blocked) VALUES (?, 1, ?, 0) ON DUPLICATE KEY UPDATE attempts = IF(reset_at < ?, 1, attempts + ?), reset_at = IF(reset_at < ?, ?, reset_at), blocked = IF(attempts >= ?, 1, 0)`
- `verifyEmail(token: string)`: Opens `await db.getConnection()`, executes `await connection.beginTransaction()`. Executes `SELECT ... FROM user_vrfy_tbl WHERE verification_token = ? FOR UPDATE`. Inserts into `user_auth_tbl` and `player_tbl`, deletes from `user_vrfy_tbl`, and commits transaction.

---

## Code Layout
- `migrations/`:
  - `001_initial_schema.sql` (baseline idempotent table DDLs)
  - `002_security_hardening.sql` (idempotent schema modifications for M1)
  - `002_security_hardening_rollback.sql` (rollback script for M1)
- `middleware.ts`: Next.js root route middleware for route protection (M2)
- `app/actions/quiz.ts`: Admin mutation actions with `requireAdmin()` (M2)
- `app/actions/auth.ts`: Authentication, signup, OTP, resetPass, verifyEmail actions (M1, M2, M3, M4, M5)
- `app/verify-email/[token]/`: User-initiated POST email verification (M2)
- `auth.ts`: Next-Auth configuration with session revocation & OAuth linking (M3)
- `lib/rate-limit.ts`: Atomic rate limiting implementation (M5)
- `tests/`:
  - `tests/test-m1.ts`: Milestone 1 verification script
  - `tests/test-m2.ts`: Milestone 2 verification script
  - `tests/test-m3.ts`: Milestone 3 verification script
  - `tests/test-m4.ts`: Milestone 4 verification script
  - `tests/test-m5.ts`: Milestone 5 verification script
