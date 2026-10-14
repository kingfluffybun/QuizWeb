# Milestone 4 Forensic Audit Report: OTP Lifecycle, Anti-Abuse & Rate Limiting

## Forensic Audit Report

**Work Product**: `app/actions/auth.ts`, `tests/test-m4.ts`
**Profile**: General Project (Integrity Mode: development)
**Verdict**: **CLEAN**

### Phase Results
- **Phase 1: Source Code & Integrity Analysis**:
  - Hardcoded output detection: **PASS** — No hardcoded return values, expected strings, or bypass paths in `app/actions/auth.ts`.
  - Facade detection: **PASS** — Complete, genuine business logic implemented for `reqPassReset`, `verifyOTP`, and `resetPass` with database queries, cryptographically secure random OTP generation, SHA-256 token hashing, timing-safe equality checks, and state transitions.
  - Pre-populated artifact detection: **PASS** — No pre-populated logs, result files, or cached outputs found in workspace.
  - Test cheat / dummy assertion detection: **PASS** — Zero dummy assertions (`assert.ok(true)`) found in `tests/test-m4.ts`. All 34 tests execute authentic validations against actual server actions and stateful database tables.
- **Phase 2: Behavioral & Specification Verification**:
  - SEC-01 (ASVS V3.7.1, V2.2.1): **PASS** — 5-attempt counter increments on failure and permanently locks OTP on 5th attempt (`attempts = 5`, `locked_until = NOW()`); subsequent attempts (even with correct code) are rejected.
  - SEC-02 (ASVS V2.8.4, V3.7.2): **PASS** — Strict expiration check (`new Date(otps[0].expires_at) < new Date()`); consumed OTP transitions to `is_used = 2`; replay attacks fail with `"Invalid or expired OTP"`.
  - SEC-08 (ASVS V2.1.8, V2.5.3): **PASS** — Eliminates `TypeError` when `users.length === 0`; returns identical generic message `"If an account exists with this email, a reset code has been sent."` for existing and non-existent emails.
  - SEC-10 (ASVS V2.2.1, V11.1.3): **PASS** — Enforces rate limiting (`checkRateLimit`) on `reqPassReset` prior to database queries, preventing email flooding and resource exhaustion.
  - Zero Regressions (M1, M2, M3): **PASS** — Full regression suite passes across all milestones (108/108 tests passing).

---

## 1. Observation

1. **Static Analysis of `app/actions/auth.ts`**:
   - **`reqPassReset` (lines 399–579)**:
     - Input validation:
       ```typescript
       if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
           return { error: "Please enter a valid email address." };
       }
       const normalizedEmail = email.trim().toLowerCase();
       ```
     - Rate limiting (SEC-10):
       ```typescript
       const rateLimit = await checkRateLimit(`req_reset_${normalizedEmail}`, true);
       if (!rateLimit.allowed) {
           return { error: "Too many password reset requests. Please try again later." };
       }
       ```
     - Non-existent user handling (SEC-08):
       ```typescript
       const [users] = await db.query<RowDataPacket[]>(
           "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
           [normalizedEmail]
       );
       if (users.length === 0) {
           return { success: true, message: genericMessage };
       }
       ```
       `users[0].user_id` is never accessed when `users.length === 0`, completely preventing the prior `TypeError` that previously leaked account non-existence.
     - Identical response message:
       `const genericMessage = "If an account exists with this email, a reset code has been sent.";` is returned for both existing (line 573) and non-existent users (line 422).

   - **`verifyOTP` (lines 582–653)**:
     - Lockout enforcement before code comparison (SEC-01):
       ```typescript
       if (otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until))) {
           return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
       }
       ```
     - Expiration check:
       ```typescript
       if (new Date(otp.expires_at) < new Date()) {
           return { error: "OTP has expired. Please request a new one." };
       }
       ```
     - Timing-safe hash comparison and attempt counter increment:
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
     - Verification success marks record:
       `UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?`

   - **`resetPass` (lines 656–813)**:
     - Strict verification state requirement (SEC-02):
       ```typescript
       if (
           otps.length === 0 ||
           !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) ||
           otps[0].is_used !== 1 ||
           new Date(otps[0].expires_at) < new Date()
       ) {
           return { error: "Invalid or expired OTP" };
       }
       ```
     - Consumed state transition (SEC-02):
       ```typescript
       await db.query(
           "UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?",
           [otps[0].otp_id]
       );
       ```
       Transitioning to `is_used = 2` prevents any replay, as any subsequent call fails the `otps[0].is_used !== 1` condition.
     - Session revocation on password reset (SEC-05):
       ```typescript
       await db.query(
           "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
           [hashed, userId]
       );
       ```

2. **Forensic Analysis of `tests/test-m4.ts`**:
   - 34 comprehensive tests across 8 suites:
     - Suite 1: SEC-01 OTP Attempt Counter & Lockout (T1.1–T1.5)
     - Suite 2: SEC-02 Strict Expiration Enforcement (T2.1–T2.3)
     - Suite 3: SEC-02 Replay Prevention & State Transition `is_used = 2` (T3.1–T3.5)
     - Suite 4: SEC-08 User Enumeration Prevention & Parity (T4.1–T4.5)
     - Suite 5: SEC-10 Rate Limiting & Anti-Flooding (T5.1–T5.5)
     - Suite 6: Adversarial Robustness & Edge Cases (T6.1–T6.4)
     - Suite 7: Zero Regression Verification Guard for M1, M2, M3
     - Suite 8: OWASP ASVS v4.0.3 Chapter 2 & Chapter 3 Compliance Matrix
   - Grep verification for dummy assertions: zero instances of `assert.ok(true)` or trivial tautologies.
   - Code dynamically imports `../app/actions/auth` and tests authentic exported functions (`reqPassReset`, `verifyOTP`, `resetPass`).

3. **Independent Test Execution**:
   - `npx --yes tsx tests/test-m4.ts`: Exited 0. 34/34 passed.
   - `npx --yes tsx tests/test-m1.ts`: Exited 0. 13/13 passed.
   - `npx --yes tsx tests/test-m2.ts`: Exited 0. 31/31 passed.
   - `npx --yes tsx tests/test-m3.ts`: Exited 0. 30/30 passed.
   - Cumulative: 108/108 tests passing across all milestone suites.
   - `npx eslint app/actions/auth.ts tests/test-m4.ts`: Exited 0. 0 errors, 0 warnings.

---

## 2. Logic Chain

1. **Authentication Integrity & Anti-Abuse (SEC-01 & ASVS V3.7.1, V2.2.1)**:
   - Observation 1 demonstrates that `verifyOTP` checks `otp.attempts >= 5` prior to code verification.
   - On failed attempts, `attempts` is incremented in the database.
   - When `newAttempts >= 5`, `attempts` is set to 5 and `locked_until` is updated.
   - Observation 2 & 3 demonstrate that attempts 1 to 4 return retry errors while the 5th attempt locks the OTP. Subsequent attempts (even with the correct code) are rejected because `otp.attempts >= 5`.
   - Therefore, SEC-01 is authentically implemented without backdoors.

2. **Replay Prevention & Single-Use Tokens (SEC-02 & ASVS V2.8.4, V3.7.2)**:
   - Observation 1 demonstrates that `resetPass` mandates `otps[0].is_used === 1`. Unverified OTPs (`is_used = 0`) cannot be used to reset passwords.
   - Upon successful password reset, `user_otp_tbl` is updated to `is_used = 2`.
   - Observation 2 demonstrates that re-submitting an already used OTP with `is_used = 2` is rejected with `"Invalid or expired OTP"`.
   - Expired OTPs are strictly rejected by checking `new Date(otps[0].expires_at) < new Date()`.
   - Therefore, SEC-02 replay prevention and expiration enforcement are verified.

3. **Anti-Enumeration Uniformity (SEC-08 & ASVS V2.1.8, V2.5.3)**:
   - Observation 1 demonstrates that `reqPassReset` checks `users.length === 0` and returns immediately with `genericMessage`.
   - No properties of `users[0]` are dereferenced when the user does not exist, neutralizing the `TypeError` and eliminating error message differentiation.
   - Observation 2 (T4.1–T4.4) verifies identical response messages and sub-100ms timing parity between existing and non-existent user accounts.
   - Therefore, SEC-08 is genuinely remediated.

4. **Email Flooding Rate Limiting (SEC-10 & ASVS V2.2.1, V11.1.3)**:
   - Observation 1 demonstrates that `checkRateLimit` is called on normalized email before any database lookup or email dispatch.
   - Observation 2 (T5.1–T5.3) verifies that after reaching the threshold, subsequent requests are blocked, resulting in zero additional database records and zero emails sent.
   - Therefore, SEC-10 is verified.

---

## 3. Caveats

- **Rate Limit Storage**: Rate limiting currently operates via `lib/rate-limit.ts`. The atomic `INSERT ... ON DUPLICATE KEY UPDATE` refactor for concurrent race prevention is planned for Milestone 5 (SEC-07).
- No other caveats.

---

## 4. Conclusion

The Milestone 4 work product (`app/actions/auth.ts`, `tests/test-m4.ts`) is completely authentic, complies with OWASP ASVS v4.0.3 Chapter 2 & Chapter 3, contains zero test cheats or facade implementations, and causes zero regressions across Milestones 1, 2, and 3.

**Verdict**: **CLEAN**

---

## 5. Verification Method

To independently verify this verdict:

1. Run the Milestone 4 verification suite:
   ```bash
   npx --yes tsx tests/test-m4.ts
   ```
   *Expected result*: 34/34 tests pass across all 8 suites with exit code 0.

2. Run the full regression verification suite:
   ```bash
   npx --yes tsx tests/test-m1.ts && \
   npx --yes tsx tests/test-m2.ts && \
   npx --yes tsx tests/test-m3.ts && \
   npx --yes tsx tests/test-m4.ts
   ```
   *Expected result*: All 108 tests pass with exit code 0.

3. Run code quality inspection:
   ```bash
   npx eslint app/actions/auth.ts tests/test-m4.ts
   ```
   *Expected result*: 0 errors, 0 warnings.
