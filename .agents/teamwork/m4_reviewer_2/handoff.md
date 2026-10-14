# Milestone 4 Independent Review & Adversarial Audit Report

**Reviewer**: Milestone 4 Reviewer 2  
**Roles**: Reviewer, Adversarial Critic  
**Date**: 2026-10-13  
**Working Directory**: `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m4_reviewer_2`  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Direct Source Code Inspection (`app/actions/auth.ts`)
- **SEC-01 (OTP Attempt Counter & Permanent Lockout in `verifyOTP`)**:
  In `app/actions/auth.ts` lines 613–640:
  ```typescript
  // Check lockout status
  if (otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until))) {
      return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
  }

  // Check if expired
  if (new Date(otp.expires_at) < new Date()) {
      return { error: "OTP has expired. Please request a new one." };
  }

  // Check if matches
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
  The lockout condition checks `otp.attempts >= 5` before code evaluation. Upon the 5th failed attempt, `attempts = 5` and `locked_until = NOW()` are persisted. Any subsequent invocation (even with the correct code) fails closed immediately on `otp.attempts >= 5`.

- **SEC-02 (OTP Expiration & Replay Attack Prevention in `resetPass`)**:
  In `app/actions/auth.ts` lines 679–708:
  ```typescript
  // Verify again: check is_used = 1 and unexpired (SEC-02)
  const [otps] = await db.query<RowDataPacket[]>(
      `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
      WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
      [userId, "password_reset"]
  );

  if (
      otps.length === 0 ||
      !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) ||
      otps[0].is_used !== 1 ||
      new Date(otps[0].expires_at) < new Date()
  ) {
      return { error: "Invalid or expired OTP" };
  }
  ...
  // Transition OTP record to consumed status (is_used = 2) to prevent replay (SEC-02)
  await db.query(
      "UPDATE user_otp_tbl SET is_used = 2 WHERE otp_id = ?",
      [otps[0].otp_id]
  );
  ```
  `resetPass` strictly requires `otps[0].is_used === 1` and `new Date(otps[0].expires_at) >= new Date()`. Once password reset completes, the record transitions to `is_used = 2`. Replay submissions immediately fail the `is_used !== 1` guard and return `"Invalid or expired OTP"`.

- **SEC-08 (Anti-Enumeration in `reqPassReset`)**:
  In `app/actions/auth.ts` lines 412–424:
  ```typescript
  const genericMessage = "If an account exists with this email, a reset code has been sent.";

  try {
      // SEC-08: Check if user exists in user_auth_tbl
      const [users] = await db.query<RowDataPacket[]>(
          "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
          [normalizedEmail]
      );

      if (users.length === 0) {
          return { success: true, message: genericMessage };
      }
  ```
  Non-existent emails return `{ success: true, message: genericMessage }` directly without querying `player_tbl` or accessing `users[0]`, completely eliminating the prior `TypeError: Cannot read properties of undefined (reading 'user_id')`. Both branches return identical message strings.

- **SEC-10 (Email Flooding Rate Limiting in `reqPassReset`)**:
  In `app/actions/auth.ts` lines 406–410:
  ```typescript
  // SEC-10: Rate limiting against email flooding
  const rateLimit = await checkRateLimit(`req_reset_${normalizedEmail}`, true);
  if (!rateLimit.allowed) {
      return { error: "Too many password reset requests. Please try again later." };
  }
  ```
  Requests are gated prior to database user lookups, OTP generation, or email dispatch.

### 1.2 Integrity Inspection
- Checked `app/actions/auth.ts` for hardcoded test emails, mock bypasses, dummy logic, or facade implementations: **None detected**.
- Checked `tests/test-m4.ts` for fake assertions or hardcoded return values: **None detected**. Tests dynamically invoke real server action functions with stateful mock database records and real Argon2/SHA-256 cryptographic computations.

### 1.3 Test Execution Results
All test commands were executed directly in the project environment:
1. `npx --yes tsx tests/test-m4.ts`: **34/34 passed** (Exit code 0).
2. `npx --yes tsx tests/test-m1.ts`: **13/13 passed** (Exit code 0).
3. `npx --yes tsx tests/test-m2.ts`: **31/31 passed** (Exit code 0).
4. `npx --yes tsx tests/test-m3.ts`: **30/30 passed** (Exit code 0).
- Total regression suite: **108/108 passed**, zero regressions across all milestones.
5. `npx eslint app/actions/auth.ts tests/test-m4.ts`: **0 errors, 0 warnings** (Exit code 0).

---

## 2. Logic Chain

1. **SEC-01 Compliance**:
   - Observation 1.1 shows that `verifyOTP` evaluates `otp.attempts >= 5` prior to code comparison.
   - On mismatch, the counter is incremented. When reaching 5, `UPDATE user_otp_tbl SET attempts = 5, locked_until = NOW()` is persisted.
   - Any further attempt evaluates `otp.attempts >= 5` to true, regardless of `locked_until` passage of time.
   - Therefore, brute-forcing 6-digit numeric OTPs is bounded to at most 5 attempts before the token is permanently locked, fulfilling ASVS 3.7.1 and SEC-01.

2. **SEC-02 Compliance**:
   - Observation 1.1 shows that `resetPass` checks `otps[0].is_used !== 1` and expiration.
   - Successful reset transitions the OTP to `is_used = 2`.
   - Any replay invocation encounters `is_used === 2`, which violates `otps[0].is_used !== 1` and aborts.
   - Unverified OTPs (`is_used = 0`) are also blocked from `resetPass`.
   - Therefore, OTP replay and unverified token consumption are completely mitigated, fulfilling ASVS 2.8.4, 3.7.2, and SEC-02.

3. **SEC-08 Compliance**:
   - Observation 1.1 shows that when `users.length === 0`, `reqPassReset` terminates early with `{ success: true, message: genericMessage }`.
   - No properties on `users[0]` are dereferenced, preventing the unhandled TypeError.
   - Response message `"If an account exists with this email, a reset code has been sent."` is identical for existing and non-existing accounts, fulfilling ASVS 2.1.8, 2.5.3, and SEC-08.

4. **SEC-10 Compliance**:
   - Observation 1.1 shows that `checkRateLimit` is called on `req_reset_${normalizedEmail}` before any OTP generation or outbound emails.
   - At attempt 5, the rate limiter blocks subsequent requests, preventing mailbombing and Resend quota depletion, fulfilling ASVS 2.2.1, 11.1.3, and SEC-10.

5. **Integrity & Regressions**:
   - Observation 1.2 and 1.3 confirm that all 108 tests pass with genuine logic, strict static checks pass, and no regressions exist in M1, M2, or M3.

---

## 3. Caveats

- **Rate Limit Atomicity**: Under Milestone 4, `checkRateLimit` runs against the existing `rate_limit_tbl` schema. Concurrency atomicity via `INSERT ... ON DUPLICATE KEY UPDATE` is scheduled for Milestone 5 (SEC-07).
- No other caveats.

---

## 4. Quality Review Report

**Verdict**: **APPROVE**

### Findings
- **[Minor] Observation 1: Parameter type validation in `resetPass`**:
  In `app/actions/auth.ts` line 663, `email.trim().toLowerCase()` and line 676 `otpCode.trim()` assume string types. If a non-string or undefined argument is passed, it triggers a TypeError caught by the generic catch block (returning `"Failed to reset password. Please try again."`). While secure (fails closed), adding explicit type guards `if (!email || typeof email !== "string" || !otpCode || typeof otpCode !== "string")` like `verifyOTP` does would avoid exception throwing.
- **[Minor] Observation 2: Invalidation of unused OTPs in `reqPassReset`**:
  In `app/actions/auth.ts` line 443, older unused OTPs are updated via `SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0`. Since `is_used = 1` signifies "verified" and `is_used = 2` signifies "consumed/invalidated", setting `is_used = 2` for invalidated tokens is semantically more descriptive. However, because `resetPass` orders by `expires_at DESC LIMIT 1`, older invalidated tokens are shadowed by the newly inserted OTP and cannot be used.

### Verified Claims
- SEC-01: 5-attempt counter permanently locks OTP → verified via `test-m4.ts` Suite 1 (T1.1–T1.5) and source analysis → **PASS**
- SEC-02: Expiration and replay prevention (`is_used = 2`) → verified via `test-m4.ts` Suite 2 & Suite 3 (T2.1–T3.5) → **PASS**
- SEC-08: Anti-enumeration & uniform response without TypeError → verified via `test-m4.ts` Suite 4 (T4.1–T4.5) → **PASS**
- SEC-10: Rate limiting against email flooding → verified via `test-m4.ts` Suite 5 (T5.1–T5.5) → **PASS**
- M1–M3 regression prevention → verified via `test-m1.ts`, `test-m2.ts`, `test-m3.ts` → **PASS**

### Coverage Gaps
- None. All requirements in Milestone 4 scope have been verified.

### Unverified Items
- None.

---

## 5. Adversarial Challenge Report

**Overall Risk Assessment**: **LOW**

### Challenges Evaluated

1. **Challenge 1: Replay with concurrently generated OTPs**
   - *Attack scenario*: An attacker requests two OTPs in quick succession. They verify the first OTP (`is_used = 1`), then request a second OTP, and attempt to submit the first OTP to `resetPass`.
   - *Test outcome*: In `resetPass`, the database query fetches the latest record ordered by `expires_at DESC LIMIT 1`. Because the second OTP has a newer expiration timestamp, `otps[0]` is the second OTP. The first OTP code fails hash comparison against `otps[0].otp_code`.
   - *Result*: **PASS (Mitigated)**.

2. **Challenge 2: Brute force bypass after lockout expiration**
   - *Attack scenario*: An attacker triggers 5 failed attempts. `locked_until` is set to `NOW()`. After 1 millisecond, `new Date() < new Date(otp.locked_until)` is false. The attacker attempts code guessing again.
   - *Test outcome*: The guard condition is `otp.attempts >= 5 || (otp.locked_until !== null && new Date() < new Date(otp.locked_until))`. Because `otp.attempts` is 5, the first disjunct evaluates to true permanently.
   - *Result*: **PASS (Mitigated)**.

3. **Challenge 3: Account takeover via unverified OTP in `resetPass`**
   - *Attack scenario*: An attacker skips `verifyOTP` and immediately invokes `resetPass` with a newly generated OTP code.
   - *Test outcome*: The newly generated OTP has `is_used = 0`. `resetPass` requires `otps[0].is_used === 1`. The call is rejected with `"Invalid or expired OTP"`.
   - *Result*: **PASS (Mitigated)**.

4. **Challenge 4: Denial of Service via Email Flooding**
   - *Attack scenario*: An attacker attempts to flood a user's inbox with reset codes.
   - *Test outcome*: `checkRateLimit("req_reset_" + normalizedEmail, true)` triggers on the 5th attempt within 15 minutes. Subsequent requests return `"Too many password reset requests. Please try again later."` without generating OTPs or dispatching emails.
   - *Result*: **PASS (Mitigated)**.

---

## 6. Verification Method

To independently reproduce this verification:

```bash
# 1. Run Milestone 4 verification suite
npx --yes tsx tests/test-m4.ts

# 2. Run complete regression suite
npx --yes tsx tests/test-m1.ts
npx --yes tsx tests/test-m2.ts
npx --yes tsx tests/test-m3.ts

# 3. Run ESLint check
npx eslint app/actions/auth.ts tests/test-m4.ts
```

All commands must exit with code 0.
