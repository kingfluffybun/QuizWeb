# Dispatch — Milestone 5 Implementation Worker (m5_worker_1)

## Working Directory
`/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m5_worker_1`

## Objective
Implement Milestone 5: Concurrency & Transaction Isolation (SEC-07, SEC-13) and author standalone verification test suite `tests/test-m5.ts`.

### 1. Requirements & Code Implementations:

- **SEC-07 (Atomic Rate Limiting in `lib/rate-limit.ts`)**:
  - Refactor `checkRateLimit` in `lib/rate-limit.ts` to execute atomically without TOCTOU race condition windows.
  - Eliminate the multi-step `SELECT ... DELETE ... INSERT ... SELECT ... UPDATE` sequence.
  - Implement atomic query semantics:
    - Use atomic SQL statements (such as `INSERT ... ON DUPLICATE KEY UPDATE` and atomic condition expressions) to serialize concurrent requests at the database engine level.
    - Ensure `attempts`, `reset_at`, and `blocked` state transitions happen atomically.
    - Maintain strict backward-compatibility for caller signature and return contract:
      `checkRateLimit(key: string, isIncrement: boolean = false)` returning `{ allowed: boolean, remaining: number, resetIn: number, message?: string }`.
      `clearRateLimit(key: string)` deleting the key.
    - Verify that concurrent bursts (e.g. 50 parallel requests) are strictly throttled at the limit threshold (`MAX_ATTEMPTS = 5`), with zero race condition bypasses.

- **SEC-13 (Transaction Isolation & Pessimistic Locking in `app/actions/auth.ts`)**:
  - In `app/actions/auth.ts`, refactor `verifyEmail(token: string)`:
    - Acquire connection from pool: `const connection = await db.getConnection();`
    - Start database transaction immediately: `await connection.beginTransaction();`
    - Execute pessimistic row lock:
      ```sql
      SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until 
      FROM user_vrfy_tbl 
      WHERE verification_token = ? 
      FOR UPDATE
      ```
    - If no row is returned (token invalid or already consumed by a concurrent transaction):
      `await connection.rollback();`
      return `{ success: false, message: "This verification link is invalid or has already been used." }`.
    - Check expiration and lockout:
      - If expired: `DELETE FROM user_vrfy_tbl WHERE verify_id = ?`, commit transaction, return expired message.
      - If locked: rollback transaction, return locked message.
    - Check if email or username already exists in `user_auth_tbl` / `player_tbl`:
      - If exists: rollback transaction, return error message.
    - Insert into `user_auth_tbl` (with `is_email_verified = 1, user_role = 'user'`).
    - Insert into `player_tbl`.
    - Delete from `user_vrfy_tbl WHERE verify_id = ?`.
    - Commit transaction: `await connection.commit();`
    - In `catch (error)` block: `await connection.rollback();`
    - In `finally` block: `connection.release();`
    - Verify that 10 or 20 concurrent requests with the identical verification token result in exactly 1 successful registration, with all other concurrent requests rolling back cleanly and returning the invalid/already-used message without duplicate key crashes or race errors.

### 2. Author Standalone Test Suite `tests/test-m5.ts`:
- Follow the clean standalone test pattern established in `tests/test-m3.ts` and `tests/test-m4.ts` (with mock DB and real application logic testing).
- Cover:
  - Suite 1: SEC-07 Atomic Rate Limiting (50 concurrent requests throttled at 5 attempts, zero bypasses).
  - Suite 2: SEC-07 Rate limit window expiry, reset, and blocked duration.
  - Suite 3: SEC-13 Transaction Isolation & Pessimistic Locking (concurrent requests with same token: exactly 1 succeeds, others fail cleanly without race errors).
  - Suite 4: SEC-13 Transaction Rollback Guarantee (rollback on error leaves zero orphaned records).
  - Suite 5: Edge cases & boundary values.
  - Suite 6: Full multi-milestone zero regression guard (M1, M2, M3, M4).
  - Suite 7: OWASP ASVS v4.0.3 Chapter 3 & Chapter 4 / Chapter 11 compliance audit.

### 3. Verification Commands:
- `npx --yes tsx tests/test-m5.ts`
- `npx --yes tsx tests/test-m1.ts`
- `npx --yes tsx tests/test-m2.ts`
- `npx --yes tsx tests/test-m3.ts`
- `npx --yes tsx tests/test-m4.ts`
- `npx eslint lib/rate-limit.ts app/actions/auth.ts tests/test-m5.ts`

### 4. Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### 5. Output:
Write `handoff.md` in `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m5_worker_1/handoff.md`. Send completion message to parent.
