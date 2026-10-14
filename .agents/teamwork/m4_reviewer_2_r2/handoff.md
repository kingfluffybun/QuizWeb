# Milestone 4 Independent Quality & Adversarial Review Report (Iteration 2)

**Reviewer**: Milestone 4 Reviewer 2 (Iteration 2) (`m4_reviewer_2_r2`)  
**Roles**: reviewer, critic  
**Target Files**: `app/actions/auth.ts`, `tests/test-m4.ts`  
**Interface Contracts**: `PROJECT.md`, `ORIGINAL_REQUEST.md` (R4, AC-M4), OWASP ASVS v4.0.3 Chapter 2 & Chapter 3  
**Final Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Source Code Inspection (`app/actions/auth.ts`)
- **Server-Side Rate Limiting in `verifyOTP` (SEC-01 / ASVS 2.2.1, 3.7.1)**:
  - Line 6: Imported `checkRateLimit, clearRateLimit` from `@/lib/rate-limit`.
  - Lines 620–625: Evaluates rate limit prior to checking token expiration or code comparison:
    ```typescript
    const rateLimit = await checkRateLimit(`otp_verify_${normalizedEmail}`, false);
    if (!rateLimit.allowed) {
        return { error: "Too many OTP verification attempts. Please try again later." };
    }
    ```
  - Line 634: Incurs rate limit attempt on mismatched code:
    ```typescript
    const rlResult = await checkRateLimit(`otp_verify_${normalizedEmail}`, true);
    ```
  - Lines 649–651: Clears the rate limit bucket upon successful OTP verification:
    ```typescript
    await clearRateLimit(`otp_verify_${normalizedEmail}`);
    ```

- **Atomic Attempt Counter & Concurrency Hardening (SEC-01 / ASVS 3.7.1)**:
  - Lines 635–638: Atomic database row update eliminates application-layer lost updates under concurrency:
    ```typescript
    await db.query(
        "UPDATE user_otp_tbl SET attempts = attempts + 1, locked_until = IF(attempts + 1 >= 5, NOW(), locked_until) WHERE otp_id = ?",
        [otp.otp_id]
    );
    ```
  - Lines 615–618: Pre-check rejects pre-locked OTP records before checking expiration or OTP hash:
    ```typescript
    if (otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until))) {
        return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
    }
    ```

- **State Machine Invariant Consistency (`reqPassReset`)**:
  - Lines 441–445: Invalidation of prior unused reset OTPs transitions records to `is_used = 2` (consumed/invalidated):
    ```typescript
    // Invalidate any existing unused OTPs for this user
    await db.query(
        "UPDATE user_otp_tbl SET is_used = 2 WHERE user_id = ? AND purpose = ? AND is_used = 0",
        [userId, "password_reset"]
    );
    ```
  - Strictly preserves the schema contract: `0 = unused`, `1 = verified`, `2 = consumed`.

- **Replay Protection & Consumed State (`resetPass`) (SEC-02 / ASVS 2.8.4, 3.7.2)**:
  - Lines 688–703: Enforces `is_used === 1`, `expires_at > NOW()`, and timing-safe hash comparison before resetting password.
  - Lines 714–717: Transitions OTP to `is_used = 2` (consumed):
    ```typescript
    await db.query(
        "UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?",
        [otps[0].otp_id]
    );
    ```
  - Line 708–711: Increments `token_version = token_version + 1` in `user_auth_tbl` to invalidate active JWT sessions (SEC-05).

- **Anti-Enumeration Parity & Flooding Prevention (`reqPassReset`) (SEC-08, SEC-10 / ASVS 2.1.8, 2.5.3, 11.1.3)**:
  - Lines 407–410: Rate limiting enforced via `checkRateLimit("req_reset_" + normalizedEmail, true)` before user existence check.
  - Lines 412, 421–423, 571–574: Both existing and nonexistent email lookups return exact generic message:
    `"If an account exists with this email, a reset code has been sent."`

### 1.2 Integrity Violation Audit
- **Hardcoded test outputs**: None. No hardcoded emails, bypass branches, or static return values exist in `app/actions/auth.ts`.
- **Facade implementations**: None. Real crypto (`crypto.createHash("sha256")`, `crypto.timingSafeEqual`), real database queries (`mysql2/promise`), and real rate-limiting tables are utilized.
- **Dummy assertions in test suites**: Zero occurrences of `assert.ok(true)` or dummy passes found in `tests/test-m4.ts`, `tests/test-m4-challenger-1.ts`, or `tests/test-m4-challenger2.ts`.

### 1.3 Independent Test Suite Execution Results
- `npx --yes tsx tests/test-m4.ts`:
  `Test Execution Summary: 34/34 Passed. Status: ALL VERIFICATIONS PASSED (exit code 0)`
- `npx --yes tsx tests/test-m4-challenger-1.ts`:
  `Adversarial Audit Summary: 19/19 Probes Passed. Defect(s) Identified: 0. VERDICT: CONFIRM_CORRECTNESS (exit code 0)`
- `npx --yes tsx tests/test-m4-challenger2.ts`:
  `Summary: 14/14 Passed (0 Failed) (exit code 0)`
- `npx --yes tsx tests/test-m1.ts && npx --yes tsx tests/test-m2.ts && npx --yes tsx tests/test-m3.ts`:
  All 74 regression tests passed with exit code 0 (M1: 13/13, M2: 31/31, M3: 30/30).
- `npx --yes tsx tests/test-m1-challenger.ts && npx --yes tsx tests/adversarial-m1-challenger2.ts`:
  41/41 challenger tests passed (25/25 and 16/16).
- `npx eslint app/actions/auth.ts tests/test-m4-challenger-1.ts tests/test-m4.ts tests/test-m4-challenger2.ts`:
  0 errors, 0 warnings.

---

## 2. Logic Chain

1. **Resolution of Concurrency Lost Update Vulnerability (SEC-01)**:
   - *Premise*: In Iteration 1, `verifyOTP` read `attempts` into memory and wrote back `(otp.attempts || 0) + 1`. Under concurrent bursts, multiple parallel requests observed the same initial count (e.g. 0), overwriting each other and leaving `attempts = 1`.
   - *Mechanism*: In Iteration 2, row-level atomic query `UPDATE user_otp_tbl SET attempts = attempts + 1, locked_until = IF(attempts + 1 >= 5, NOW(), locked_until) WHERE otp_id = ?` ensures that every request is serialized by InnoDB storage locks.
   - *Proof*: PROBE-06 dispatched 20 concurrent requests with wrong OTPs; `attempts` reached 20 (>= 5), `locked_until` was set, and subsequent submission of the correct OTP was permanently rejected.

2. **Resolution of Missing Server-Side Rate Limiting (SEC-01 / ASVS 2.2.1, 3.7.1)**:
   - *Premise*: In Iteration 1, `verifyOTP` lacked request rate-limiting, allowing rapid brute-force attempts within the 5-attempt budget.
   - *Mechanism*: In Iteration 2, `checkRateLimit("otp_verify_" + normalizedEmail, false)` checks rate limit prior to code processing, failed verification increments the bucket, and successful verification clears it via `clearRateLimit`.
   - *Proof*: Verified in PROBE-07 and validated dynamically during consecutive attempts.

3. **Resolution of State Machine Inconsistency (SEC-02 / PROJECT.md)**:
   - *Premise*: In Iteration 1, `reqPassReset` line 443 transitioned superseded unused OTPs to `is_used = 1` (verified) instead of `2` (consumed).
   - *Mechanism*: Line 443 now updates unverified OTPs to `is_used = 2`. Because `resetPass` strictly requires `is_used === 1`, cancelled tokens can never be used to reset passwords.
   - *Proof*: Verified in PROBE-19 and Suite 3 of `test-m4.ts`.

4. **Zero Regressions and Adversarial Robustness**:
   - Total regression test pass count: 141/141 passed with 0 failures across all milestone and challenger test suites.

---

## 3. Caveats

- **Rate Limit Storage Engine (Milestone 5 planned work)**:
  `lib/rate-limit.ts` currently handles rate limiting with individual SELECT/INSERT/UPDATE queries. Atomic consolidation using `INSERT ... ON DUPLICATE KEY UPDATE` is scheduled for Milestone 5 (F-19 / SEC-07). This is documented in `PROJECT.md` and does not block Milestone 4.
- No other caveats.

---

## 4. Conclusion

**Verdict: APPROVE**

- **Correctness**: SEC-01, SEC-02, SEC-08, and SEC-10 requirements from `ORIGINAL_REQUEST.md` and `PROJECT.md` are accurately implemented and verified.
- **Completeness**: All 3 defects identified in Iteration 1 (PROBE-06 lost update race condition, PROBE-07 missing rate limiting, PROBE-19 invalid state transition) have been comprehensively remediated.
- **Integrity**: Zero hardcoded test values, facades, or shortcuts exist in implementation files.
- **Robustness**: 141/141 total tests pass across Milestones 1–4, and ESLint reports 0 errors and 0 warnings.

---

## 5. Verification Method

To independently reproduce and verify this review verdict:

1. **Run Milestone 4 Verification Suite**:
   ```bash
   npx --yes tsx tests/test-m4.ts
   ```
   *Expected Output*: 34/34 Tests Passed, exit code 0.

2. **Run Challenger 1 Adversarial Suite**:
   ```bash
   npx --yes tsx tests/test-m4-challenger-1.ts
   ```
   *Expected Output*: 19/19 Probes Passed, `VERDICT: CONFIRM_CORRECTNESS`, exit code 0.

3. **Run Challenger 2 Adversarial Suite**:
   ```bash
   npx --yes tsx tests/test-m4-challenger2.ts
   ```
   *Expected Output*: 14/14 Tests Passed, exit code 0.

4. **Run Milestones 1–3 Regression Suite**:
   ```bash
   npx --yes tsx tests/test-m1.ts && \
   npx --yes tsx tests/test-m2.ts && \
   npx --yes tsx tests/test-m3.ts
   ```
   *Expected Output*: 74/74 Tests Passed, exit code 0.

5. **Lint Verification**:
   ```bash
   npx eslint app/actions/auth.ts tests/test-m4-challenger-1.ts tests/test-m4.ts tests/test-m4-challenger2.ts
   ```
   *Expected Output*: 0 errors, 0 warnings, exit code 0.
