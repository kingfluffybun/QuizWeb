# Milestone 4 Challenger 1 Handoff Report: Adversarial Verification of SEC-01 & SEC-02

## 1. Observation

1. **Vulnerability SEC-01 Concurrency Race Condition (Lost Update in `verifyOTP` Attempt Counter)**:
   In `app/actions/auth.ts` lines 624–640:
   ```typescript
   const isMatch = timingSafeEqualStr(otp.otp_code, hashedInputOtp);
   if (!isMatch) {
       const newAttempts = (otp.attempts || 0) + 1;
       if (newAttempts >= 5) {
           await db.query(
               "UPDATE user_otp_tbl SET attempts = 5, locked_until = NOW() WHERE otp_id = ?",
               [otp.otp_id]
           );
           return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
       } else {
           await db.query(
               "UPDATE user_otp_tbl SET attempts = ? WHERE otp_id = ?",
               [newAttempts, otp.otp_id]
           );
           return { error: "Invalid OTP. Please try again." };
       }
   }
   ```
   - Prior to code comparison, `otp.attempts` is fetched in memory via:
     `SELECT otp_id, otp_code, expires_at, is_used, attempts, locked_until FROM user_otp_tbl WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`.
   - On mismatch, the code computes `newAttempts = (otp.attempts || 0) + 1` in application memory and updates via `UPDATE user_otp_tbl SET attempts = ? WHERE otp_id = ?` with parameter `newAttempts`.
   - There is NO pessimistic row lock (`SELECT ... FOR UPDATE`), no atomic SQL expression (`attempts = attempts + 1`), and no database transaction.
   - When 20 rapid concurrent verification requests with wrong OTPs are dispatched simultaneously (`tests/test-m4-challenger-1.ts` PROBE-06):
     ```typescript
     const wrongPromises = Array.from({ length: 20 }, (_, i) =>
         verifyOTP(email, `9000${String(i).padStart(2, "0")}`)
     );
     await Promise.all(wrongPromises);
     ```
     All 20 requests execute the initial `SELECT` concurrently before any update is written. Every request reads `otp.attempts = 0`. Each computes `newAttempts = 1` and executes `UPDATE user_otp_tbl SET attempts = 1`.
     **Verbatim Result**: After 20 failed attempts, database records `attempts = 1` (expected `>= 5`), `locked_until = null`, and a subsequent 21st request with the correct OTP succeeds with `{ success: true, message: "OTP verified successfully." }`. The 5-attempt permanent lockout is completely bypassed by burst concurrency.

2. **Vulnerability SEC-01 Missing Rate Limiting on `verifyOTP`**:
   - `ORIGINAL_REQUEST.md` R4 explicitly specifies:
     > *"Add server-side rate limiting and an attempt counter in `verifyOTP` (permanently lock/invalidate OTP after 5 failed attempts) (resolving SEC-01)."*
   - `PROJECT.md` Feature Inventory F-14 explicitly specifies:
     > *"F-14 | SEC-01 | OTP Lifecycle: Server-side rate limiting and 5-attempt counter with permanent lockout in verifyOTP | M4 | ORIGINAL_REQUEST R4, ASVS 2.2.1, 3.7.1"*
   - Inspection of `app/actions/auth.ts` lines 581–654 confirms that `checkRateLimit` is **never called** inside `verifyOTP`. While `reqPassReset` implements rate limiting (`checkRateLimit('req_reset_' + normalizedEmail)`), `verifyOTP` relies solely on the attempt counter, leaving the endpoint open to high-frequency brute force bursts.

3. **Inconsistent State Transition in `reqPassReset`**:
   In `app/actions/auth.ts` lines 441–446:
   ```typescript
   // Invalidate any existing unused OTPs for this user
   await db.query(
       "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
       [userId, "password_reset"]
   );
   ```
   - According to `PROJECT.md` Database Schema Contracts (line 55): `is_used` states are `0=unused, 1=verified, 2=consumed`.
   - When invalidating existing unused OTPs upon a new reset request, setting them to `is_used = 1` marks them as "verified" rather than "consumed/invalidated" (`is_used = 2`).

4. **SEC-02 Replay Prevention & State Transitions (Confirmed Correct)**:
   In `app/actions/auth.ts` lines 679–707:
   - `resetPass` strictly checks `otps[0].is_used === 1` and `new Date(otps[0].expires_at) >= new Date()`.
   - Consumed OTPs are transitioned to `is_used = 2`.
   - Submitting an OTP with `is_used = 0` (unverified) returns `{ error: "Invalid or expired OTP" }`.
   - Re-submitting an already consumed OTP (`is_used = 2`) returns `{ error: "Invalid or expired OTP" }` with zero password changes and zero `token_version` increments.
   - Submitting an expired OTP (even by 1ms) returns `{ error: "Invalid or expired OTP" }`.
   - 10 consecutive replays fail closed without state drift.

5. **Test Suite Execution Outputs**:
   - `npx --yes tsx tests/test-m4.ts`: 34/34 passed (exit code 0).
   - `npx --yes tsx tests/test-m1.ts`: 15/15 passed (exit code 0).
   - `npx --yes tsx tests/test-m2.ts`: 31/31 passed (exit code 0).
   - `npx --yes tsx tests/test-m3.ts`: 30/30 passed (exit code 0).
   - `npx --yes tsx tests/test-m4-challenger-1.ts`: 16/19 probes passed, 3 defects empirically reproduced (exit code 0).
   - `npx eslint tests/test-m4-challenger-1.ts`: 0 errors, 0 warnings (exit code 0).

---

## 2. Logic Chain

1. **Logic Step 1: Concurrency Race Condition in SEC-01**:
   - Observation 1 demonstrates that `verifyOTP` reads `attempts` from the database in memory and then writes back `newAttempts = (otp.attempts || 0) + 1` via `UPDATE ... SET attempts = ?`.
   - Under concurrent requests, all requests in the same execution burst read the same initial value `attempts = 0`.
   - Each concurrent request calculates `newAttempts = 1` and overwrites the column with `1`.
   - As proven empirically by PROBE-06 in `tests/test-m4-challenger-1.ts`, sending 20 concurrent failed attempts only increments `attempts` to 1, leaving `locked_until = null`.
   - Consequently, an attacker can execute large parallel batches of guesses without triggering the 5-attempt permanent lockout, directly defeating OWASP ASVS V3.7.1 and SEC-01.

2. **Logic Step 2: Missing Rate Limiting in SEC-01**:
   - Observation 2 demonstrates that `checkRateLimit` is missing from `verifyOTP`, despite being explicitly mandated in both `ORIGINAL_REQUEST.md` R4 and `PROJECT.md` Feature F-14.
   - Without rate limiting, the concurrency race condition described in Step 1 is further exacerbated because an attacker is not constrained by per-window throttling when attempting OTP codes.

3. **Logic Step 3: State Machine Violation in `reqPassReset`**:
   - Observation 3 shows that line 443 updates unused OTPs to `is_used = 1`.
   - Because `is_used = 1` represents "verified", marking an unverified token as `1` violates the state machine definition (`0=unused, 1=verified, 2=consumed`). Although `resetPass` selects the latest OTP by `ORDER BY expires_at DESC`, unverified tokens must transition directly to `is_used = 2` upon cancellation.

4. **Logic Step 4: Correctness of SEC-02 Replay Defenses**:
   - Observation 4 confirms that all sequential replay attack vectors, unverified submissions, consumed tokens, and expired OTP boundaries fail closed.
   - The password update, session revocation (`token_version = token_version + 1`), and consumed status (`is_used = 2`) occur correctly upon valid execution.

---

## 3. Caveats

1. **Milestone 5 Separation**:
   Milestone 5 is designated for "Concurrency & Transaction Isolation". However, the explicit milestone scope in `PROJECT.md` (Features F-19 and F-20) confines Milestone 5 to `checkRateLimit` (SEC-07) and `verifyEmail` (SEC-13). Milestone 4 owns Feature F-14 (`verifyOTP` attempt counter and rate limiting). Therefore, this concurrency vulnerability in `verifyOTP` falls squarely within Milestone 4 and cannot be assumed to be resolved in Milestone 5.
2. **Environment**:
   The mock database harness interceptor accurately reproduces the non-atomic read-modify-write lost update behavior that occurs on real MySQL instances when row-level locks or atomic SQL expressions are omitted.

---

## 4. Conclusion

**Verdict: DEFECTS_FOUND**

While sequential verification and SEC-02 replay prevention are solidly implemented, Milestone 4 contains three concrete defects that must be remediated by `m4_worker_1`:

1. **[HIGH] SEC-01 Concurrency Race Condition in `verifyOTP`**:
   Non-atomic `(otp.attempts || 0) + 1` read-modify-write allows concurrent requests to overwrite `attempts = 1`, bypassing the 5-attempt permanent lockout.
   - *Mitigation*: Update `app/actions/auth.ts` lines 624–640 to use atomic SQL increment:
     ```sql
     UPDATE user_otp_tbl SET attempts = attempts + 1, locked_until = IF(attempts >= 4, NOW(), NULL) WHERE otp_id = ?
     ```
     Or wrap the lookup and update in a transaction using `SELECT ... FOR UPDATE`.
2. **[MEDIUM] SEC-01 Missing Rate Limiting in `verifyOTP`**:
   `verifyOTP` lacks server-side rate limiting required by R4 and F-14.
   - *Mitigation*: Add `const rateLimit = await checkRateLimit("verify_otp_" + email.trim().toLowerCase(), true);` at the entry of `verifyOTP`.
3. **[LOW] Inconsistent State Transition in `reqPassReset`**:
   Line 443 invalidates unused OTPs to `is_used = 1` instead of `2`.
   - *Mitigation*: Change `SET is_used = 1` to `SET is_used = 2` on line 443.

---

## 5. Verification Method

To independently reproduce and verify these findings:

1. **Run Milestone 4 Adversarial Challenge Harness**:
   ```bash
   npx --yes tsx tests/test-m4-challenger-1.ts
   ```
   **Expected**: Shows PROBE-06 (Lost Update race condition), PROBE-07 (Missing rate limit), and PROBE-19 (State transition inconsistency) reproduced, reporting `VERDICT: DEFECTS_FOUND`.

2. **Run Worker Milestone 4 Harness**:
   ```bash
   npx --yes tsx tests/test-m4.ts
   ```
   **Expected**: 34/34 tests pass (sequential cases pass).

3. **Run Full Milestone Regression Suite**:
   ```bash
   npx --yes tsx tests/test-m1.ts && \
   npx --yes tsx tests/test-m2.ts && \
   npx --yes tsx tests/test-m3.ts && \
   npx --yes tsx tests/test-m4.ts
   ```
   **Expected**: 110/110 tests pass with exit code 0.

4. **Run Linter**:
   ```bash
   npx eslint tests/test-m4-challenger-1.ts
   ```
   **Expected**: 0 errors, 0 warnings.
