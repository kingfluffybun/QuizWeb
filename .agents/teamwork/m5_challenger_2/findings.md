# Empirical Findings: Milestone 5 SEC-13 Verification

**Author**: `m5_challenger_2`  
**Date**: 2026-10-14  
**Target**: SEC-13 (Transaction Isolation & Pessimistic Locking in `app/actions/auth.ts` `verifyEmail`)  
**Verdict**: **CONFIRM_CORRECTNESS**

---

## Executive Summary

An exhaustive adversarial challenge suite (`tests/test-m5-challenger-2.ts`) comprising 28 automated tests across 7 attack categories was developed and executed to empirically challenge the SEC-13 remediation in `app/actions/auth.ts`. 

All 28 adversarial challenge tests passed with zero failures. Baseline regression suites for Milestones 1 through 5 (136 tests) and all prior milestone challenger suites (255 tests) were executed and passed with 100% success rate.

---

## Detailed Test Suite Breakdown

### 1. High Concurrency Parallel Verification (Same Token)
- **Probe 1.1**: 50 simultaneous parallel calls to `verifyEmail(rawToken)` using the same valid token.
  - Result: Exactly 1 call succeeded (`success: true`), exactly 49 calls rolled back cleanly with `"This verification link is invalid or has already been used."`.
  - Zero unhandled rejections or crashes.
- **Probe 1.2**: User and Player record counts.
  - Result: Exactly 1 record created in `user_auth_tbl`, exactly 1 record created in `player_tbl`. Matching `user_id`, `is_email_verified = 1`. Zero orphaned records.
- **Probe 1.3**: Verification token deletion.
  - Result: Token deleted from `user_vrfy_tbl` upon transaction commit.
- **Probe 1.4**: Post-activation replay resistance.
  - Result: 50 immediate parallel replay requests all returned `"This verification link is invalid or has already been used."` without side effects.
- **Probe 1.5**: Non-existent token race.
  - Result: 20 simultaneous parallel requests on random non-existent token all cleanly rolled back with invalid/already used message.

### 2. Multi-Token Collision Races
- **Probe 2.1**: Email Collision Race.
  - Setup: Two distinct pending verification tokens (Token A and Token B) sharing the exact same email address.
  - Execution: 25 requests for Token A and 25 requests for Token B fired concurrently (50 requests total).
  - Result: Exactly 1 token succeeded in account creation; all requests for the other token rolled back with `"An account already exists with this email address."` or `"This verification link is invalid or has already been used."`.
  - Table state: Exactly 1 record in `user_auth_tbl`, zero duplicate key errors.
- **Probe 2.2**: Username Collision Race.
  - Setup: Two distinct pending tokens targeting different emails but the exact same username.
  - Execution: 25 requests for Token A and 25 requests for Token B fired concurrently.
  - Result: Exactly 1 token succeeded; the colliding token was blocked by `player_tbl` pre-check with `"This username is already taken."`, rolling back cleanly. Zero orphaned `user_auth_tbl` records.

### 3. Transaction Atomicity & Failure Injection
- **Probe 3.1**: Mid-transaction failure during `INSERT INTO player_tbl`.
  - Simulation: Threw error during player insertion after user auth insertion.
  - Result: Caught by `catch` block, `connection.rollback()` executed. Verified `user_auth_tbl` had zero records for the email. Token in `user_vrfy_tbl` preserved.
- **Probe 3.2**: Mid-transaction failure during `DELETE FROM user_vrfy_tbl`.
  - Simulation: Threw error during token deletion after user & player creation.
  - Result: Full rollback. Zero records created in `user_auth_tbl` or `player_tbl`.
- **Probe 3.3**: Commit failure simulation.
  - Simulation: Threw error during `connection.commit()`.
  - Result: Rolled back cleanly. Zero state mutations committed.
- **Probe 3.4**: Pre-existing email collision.
  - Result: Clean rollback, returns `"An account already exists with this email address."`, zero player insertions.
- **Probe 3.5**: Pre-existing username collision.
  - Result: Clean rollback, returns `"This username is already taken."`, zero auth insertions.

### 4. Connection Pool Leak Prevention
- **Probe 4.1**: 100 heterogeneous operations under heavy concurrent mixing.
  - Breakdown: 20 valid, 20 expired, 20 locked, 20 non-existent, 20 colliding.
  - Result: Total acquired connections = 100; total released connections = 100; active connections at completion = 0.
- **Probe 4.2**: Guaranteed connection release on mid-transaction crash.
  - Result: Active connections remained 0 after exception caught and rolled back.

### 5. Token State Machine & Expiration
- **Probe 5.1**: Expired token deletion.
  - Result: Token deleted from `user_vrfy_tbl`, transaction committed, returns `"This verification link has expired. Please sign up again."`. Zero users created.
- **Probe 5.2**: Concurrency on expired token.
  - Result: Exactly 1 request cleaned up and committed; 19 saw deleted token and returned invalid/already used.
- **Probe 5.3 & 5.4**: Locked tokens (`attempts >= 5` or future `locked_until`).
  - Result: Clean rollback, returned `"This verification link has been locked due to too many failed attempts."`. Zero users created.
- **Probe 5.5**: Expired lockout window (`locked_until` in past, `attempts < 5`).
  - Result: Succeeded normally.

### 6. Malformed & Adversarial Inputs
- **Probe 6.1 & 6.2**: Non-string and empty inputs (`""`, `"   "`, `null`, `undefined`, number, boolean, object, array).
  - Result: Evaluated before `db.getConnection()`; returned `{ success: false, message: "Invalid verification link." }` with 0 database connections opened.
- **Probe 6.3**: SQL Injection strings (`' OR 1=1 --`, `'; DROP TABLE...`).
  - Result: Safely SHA-256 hashed and parameterized; returned invalid/already used without syntax crash.
- **Probe 6.4**: Oversized strings (10,000 characters).
  - Result: Handled cleanly without server crash.

### 7. Static Code Audit & Standards Compliance
- Confirmed `SELECT ... FOR UPDATE` row locking query in `app/actions/auth.ts`.
- Confirmed `beginTransaction()`, `commit()`, and `rollback()` boundaries.
- Confirmed `finally { connection.release(); }`.
- Verified OWASP ASVS v4.0.3 Chapter 4 (V4.1.5) and Chapter 13 (V13.1.4).

---

## Verdict

**CONFIRM_CORRECTNESS**: The SEC-13 implementation is robust, correct, and fully resilient against concurrency race conditions, transaction aborts, and resource exhaustion.
