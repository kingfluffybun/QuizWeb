# Milestone 4 Independent Quality & Adversarial Review Report

## Review Summary

**Verdict**: **APPROVE**  
**Integrity Attestation**: **VERIFIED** — Zero integrity violations detected. No hardcoded test outputs, no mock facades in production source, no task bypasses, no fabricated verification logs, and no self-certifying shortcuts.  
**Adversarial Risk Assessment**: **LOW** (Residual concurrency items scoped to Milestone 5)

---

## 1. Observation

Direct observations from independent inspection, execution, and static analysis:

1. **Integrity Audit**:
   - Production source code (`app/actions/auth.ts`) contains real implementations for:
     - `reqPassReset`: Input validation via regex (`!/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), normalization via `trim().toLowerCase()`, rate limit gating via `await checkRateLimit(...)`, database user lookup, cryptographically secure OTP generation via `randomInt(100000, 999999)`, SHA-256 token hashing via `crypto.createHash("sha256")`, expiration setting (`Date.now() + 5 * 60 * 1000`), transactional email dispatch via `sendEmail`, and uniform return shape (`{ success: true, message: genericMessage }`).
     - `verifyOTP`: Email and OTP input validation, SHA-256 token hashing of input, database lookup for active unconsumed OTPs (`is_used = 0`), lockout verification (`attempts >= 5 || (locked_until !== null && new Date() < new Date(locked_until))`), expiration check (`new Date(otp.expires_at) < new Date()`), constant-time string comparison (`timingSafeEqualStr`), attempt incrementation and 5th-attempt permanent lockout (`attempts = 5, locked_until = NOW()`), and state transition to `is_used = 1`.
     - `resetPass`: Password length enforcement (`newPassword.length < 8`), user lookup, SHA-256 token hashing, single-use state verification (`otps[0].is_used !== 1 || new Date(otps[0].expires_at) < new Date() || !timingSafeEqualStr(...)`), Argon2 password hashing (`argon2.hash`), session revocation via token version increment (`token_version = token_version + 1`), state transition to consumed (`is_used = 2`), and confirmation email dispatch.
   - No mock conditionals (`if (process.env.NODE_ENV === 'test') return { success: true }`), hardcoded OTP codes, or facade bypasses exist in `app/actions/auth.ts` for M4 endpoints.

2. **Test Suite Verification Execution**:
   - `npx --yes tsx tests/test-m4.ts`
     - Exit code: 0
     - Result: `34/34 Passed` across all 8 suites:
       - Suite 1: SEC-01 OTP Attempt Counter & Permanent Lockout (5/5)
       - Suite 2: SEC-02 Strict Expiration Enforcement (3/3)
       - Suite 3: SEC-02 Replay Prevention & Consumed State Transition (5/5)
       - Suite 4: SEC-08 User Enumeration Prevention (5/5)
       - Suite 5: SEC-10 Rate Limiting & Anti-Flooding on reqPassReset (5/5)
       - Suite 6: Adversarial Robustness & Edge Cases (4/4)
       - Suite 7: Zero Regression Verification Guard (3/3)
       - Suite 8: OWASP ASVS v4.0.3 Compliance Audit (4/4)
   - `npx --yes tsx tests/test-m1.ts`
     - Exit code: 0, `13/13 Passed`
   - `npx --yes tsx tests/test-m2.ts`
     - Exit code: 0, `31/31 Passed`
   - `npx --yes tsx tests/test-m3.ts`
     - Exit code: 0, `30/30 Passed`
   - Full regression total: **108/108 tests passing** with zero failures across M1, M2, M3, and M4.

3. **Linter Inspection**:
   - `npx eslint app/actions/auth.ts tests/test-m4.ts`
     - Exit code: 0 (0 errors, 0 warnings).

4. **Codebase Line References**:
   - `app/actions/auth.ts`:
     - Line 400: `if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))`
     - Lines 407–410: `const rateLimit = await checkRateLimit("req_reset_" + normalizedEmail, true); if (!rateLimit.allowed) { return { error: "Too many password reset requests. Please try again later." }; }`
     - Lines 421–423: `if (users.length === 0) { return { success: true, message: genericMessage }; }` (Resolves SEC-08 user enumeration TypeError)
     - Line 443: `UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0` (Legacy unused OTP update)
     - Lines 614–616: `if (otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until)))` (Resolves SEC-01 permanent lockout)
     - Lines 624–640: `if (!isMatch) { const newAttempts = (otp.attempts || 0) + 1; if (newAttempts >= 5) { UPDATE ... SET attempts = 5, locked_until = NOW() ... } else { UPDATE ... SET attempts = ? ... } }`
     - Lines 685–692: `if (otps.length === 0 || !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) || otps[0].is_used !== 1 || new Date(otps[0].expires_at) < new Date()) { return { error: "Invalid or expired OTP" }; }` (Resolves SEC-02 expiry check)
     - Lines 698–701: `UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?` (Maintains SEC-05 session revocation)
     - Lines 704–707: `UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?` (Resolves SEC-02 replay prevention)

---

## 2. Logic Chain

1. **SEC-01 (OTP 5-Attempt Permanent Lockout in `verifyOTP`)**:
   - *Observation*: Line 614 checks `otp.attempts >= 5`. Line 627 checks `if (newAttempts >= 5)`, executing `UPDATE user_otp_tbl SET attempts = 5, locked_until = NOW() WHERE otp_id = ?`.
   - *Reasoning*: Because `attempts` is incremented on every mismatched OTP and capped at 5 with `attempts = 5`, subsequent calls to `verifyOTP` evaluate `otp.attempts >= 5` as `true` prior to executing `timingSafeEqualStr`. Consequently, an attacker who fails 5 times is permanently blocked from attempting further guesses, even if subsequent submissions provide the genuine 6-digit code.
   - *Conclusion*: SEC-01 is correctly implemented and verified by Suite 1 (T1.1, T1.2, T1.3, T1.4, T1.5).

2. **SEC-02 (Strict Expiration & Replay Prevention in `resetPass`)**:
   - *Observation*: Line 689 validates `new Date(otps[0].expires_at) < new Date()`. Line 688 validates `otps[0].is_used !== 1`. Line 705 executes `UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?`.
   - *Reasoning*:
     - If an OTP has expired, `resetPass` rejects the request with `"Invalid or expired OTP"`.
     - Direct submission of an unverified OTP (`is_used = 0`) fails the `otps[0].is_used !== 1` condition.
     - Following a successful password change, the record transitions to `is_used = 2` (consumed). Any re-submission of the identical token fails `otps[0].is_used !== 1` because `is_used` is now `2`, completely thwarting token replay attacks.
   - *Conclusion*: SEC-02 is correctly implemented and verified by Suite 2 (T2.1, T2.2, T2.3) and Suite 3 (T3.1, T3.2, T3.3, T3.4, T3.5).

3. **SEC-08 (Anti-Enumeration in `reqPassReset`)**:
   - *Observation*: Line 416 queries `user_auth_tbl`. Line 421 executes `if (users.length === 0) return { success: true, message: genericMessage };` without referencing `users[0].user_id` or `player_tbl`.
   - *Reasoning*: In the prior implementation, non-existent emails threw `TypeError: Cannot read properties of undefined (reading 'user_id')`, triggering catch-block errors that differed from existing user responses. The new check safely branches before accessing index 0, returning the exact generic message `"If an account exists with this email, a reset code has been sent."` across both branches.
   - *Conclusion*: SEC-08 is correctly implemented and verified by Suite 4 (T4.1, T4.2, T4.3, T4.4, T4.5).

4. **SEC-10 (Rate Limiting Against Email Flooding in `reqPassReset`)**:
   - *Observation*: Line 407 calls `await checkRateLimit("req_reset_" + normalizedEmail, true)` before executing database queries or `sendEmail`.
   - *Reasoning*: Both registered and unregistered target emails hit the rate limit state machine. Once the threshold (5 attempts per 15 minutes) is exceeded, the server action terminates immediately with `{ error: "Too many password reset requests. Please try again later." }` without dispatching transactional emails or creating OTP database rows.
   - *Conclusion*: SEC-10 is correctly implemented and verified by Suite 5 (T5.1, T5.2, T5.3, T5.4, T5.5).

5. **OWASP ASVS v4.0.3 Conformance**:
   - V2.1.8 & V2.5.3 (Anti-enumeration credential recovery): VERIFIED.
   - V2.2.1 & V11.1.3 (Anti-automation rate limiting on password recovery): VERIFIED.
   - V2.8.4 & V3.7.2 (Single-use OTP replay prevention): VERIFIED.
   - V3.7.1 (OTP attempt counting & lockout): VERIFIED.

---

## 3. Adversarial Challenges & Findings

### [Low/Observation] Finding 1: Unused OTP Invalidation Transition in `reqPassReset` (Legacy Artifact)
- **Location**: `app/actions/auth.ts`, line 443
  ```typescript
  await db.query(
      "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
      [userId, "password_reset"]
  );
  ```
- **Analysis**:
  - In the baseline legacy system, `is_used = 1` signified "used".
  - In Milestone 4's three-state model (`0 = unused`, `1 = verified`, `2 = consumed`), updating superseded unused OTPs to `is_used = 1` technically assigns them the "verified" state instead of "consumed/invalidated".
  - **Attack Scenario Explored**: Can an attacker replay a superseded OTP directly in `resetPass`?
  - **Result**: No bypass is possible because `resetPass` executes `ORDER BY expires_at DESC LIMIT 1`. The newly generated OTP has a later `expires_at` and is in `is_used = 0` state, which shadows the older record. Furthermore, `verifyOTP` only queries `is_used = 0`, so the older OTP cannot be verified either.
  - **Recommendation**: For semantic cleanliness and defense-in-depth, update line 443 during Milestone 5 to `UPDATE user_otp_tbl SET is_used = 2 WHERE user_id = ? AND purpose = ? AND is_used = 0`.

### [Low/Observation] Finding 2: Concurrency & Transaction Isolation Window on Attempt Counter
- **Location**: `app/actions/auth.ts`, lines 601–638
- **Analysis**:
  - The OTP verification workflow executes a `SELECT`, evaluates `isMatch` and `attempts` in Node.js runtime memory, and subsequently executes `UPDATE user_otp_tbl SET attempts = ?`.
  - In a highly concurrent multi-request burst (e.g. 20 concurrent threads executing in under 2ms), a TOCTOU read-modify-write race condition could allow slightly more than 5 attempts before the lock engages.
  - **Scope Boundary**: This concurrency and transaction isolation requirement is explicitly assigned to **Milestone 5** (`F-19`, `F-20`, `SEC-07`, `SEC-13`, `SELECT ... FOR UPDATE` transactions). Milestone 4's single-thread lifecycle contracts are completely sound.

---

## 4. Caveats

- **Transactional Email Transport**: Real-world external network transmission via Resend is intercepted via test harness fetch mocking. Resend production key provisioning is required in production deployment.
- **Milestone 5 Interlocks**: Atomic rate-limit queries (`INSERT ... ON DUPLICATE KEY UPDATE`) and pessimistic locking (`SELECT ... FOR UPDATE`) are scheduled for implementation in Milestone 5 and do not affect Milestone 4 acceptance.

---

## 5. Conclusion

The Milestone 4 implementation in `app/actions/auth.ts` and test suite `tests/test-m4.ts` satisfies all security and architectural requirements defined in `PROJECT.md` and `ORIGINAL_REQUEST.md`:
- **SEC-01**: 5-attempt counter permanently locks OTPs and rejects subsequent attempts.
- **SEC-02**: Strict `expires_at` validation enforced; consumed OTP transitions to `is_used = 2`, preventing replay attacks.
- **SEC-08**: Anti-enumeration enforced without TypeError; uniform generic message returned.
- **SEC-10**: Request rate limiting prevents email flooding on `reqPassReset`.
- **Zero Regressions**: M1, M2, M3, and M4 suites pass with 108/108 total assertions.
- **Integrity**: Fully certified with zero integrity violations.

**Verdict**: **APPROVE**

---

## 6. Verification Method

To independently reproduce this verification:

1. **Run Milestone 4 Verification**:
   ```bash
   npx --yes tsx tests/test-m4.ts
   ```
   *Expected output*: `Test Execution Summary: 34/34 Passed`, exit code `0`.

2. **Run Full Regression Suite**:
   ```bash
   npx --yes tsx tests/test-m1.ts && \
   npx --yes tsx tests/test-m2.ts && \
   npx --yes tsx tests/test-m3.ts && \
   npx --yes tsx tests/test-m4.ts
   ```
   *Expected output*: All 4 test scripts exit with code `0` (108/108 passing tests).

3. **Run Lint Checks**:
   ```bash
   npx eslint app/actions/auth.ts tests/test-m4.ts
   ```
   *Expected output*: 0 errors, 0 warnings.
