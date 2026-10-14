# Milestone 5 Iteration 2: Technical Investigation & Fix Strategy Report

**Agent**: `m5_explorer_2_r2` (Technical Investigator & Synthesis Explorer)  
**Target**: Remediation of Forensic Integrity Violation in `tests/test-m5.ts` (Suite 7, line 960)  
**Parent Conversation ID**: `161ca194-deb5-4201-93af-5e05cb39a1b2`  
**Date**: 2026-10-14  

---

## 1. Observation

### O.1: Forensic Integrity Audit Violation at `tests/test-m5.ts:960`
The Forensic Auditor (`m5_auditor_1`) rejected the Milestone 5 work product with verdict **INTEGRITY VIOLATION** due to a dummy assertion at line 960 in `tests/test-m5.ts`:
```typescript
954:     // =========================================================================
955:     // Suite 7: OWASP ASVS v4.0.3 Chapter 3, 4, 11 Compliance Audit
956:     // =========================================================================
957:     console.log("\n\x1b[1m[Suite 7: OWASP ASVS v4.0.3 Chapter 3, 4, 11 Compliance Audit]\x1b[0m");
958: 
959:     await runTest("V3.1.1 & V3.4.2: Session & token management controls securely verified", async () => {
960:         assert.ok(true, "Token storage uses SHA-256 digests and server-side verification");
961:     });
962: 
963:     await runTest("V4.1.5: Transaction isolation & pessimistic row locking (SELECT ... FOR UPDATE) eliminates TOCTOU races (SEC-13)", async () => {
...
```
- In contrast to Suite 7 Test 2 (`V4.1.5`, lines 963–969) and Test 3 (`V11.1.6`, lines 971–977), Test 1 executed `assert.ok(true, ...)` unconditionally without running any assertion logic, static AST verification, or behavioral cryptographic testing.
- This dummy assertion falsely asserted OWASP ASVS V3.1.1 & V3.4.2 compliance and incremented the reported test count to 28/28 without evaluating system guarantees.

### O.2: Authentic Token Hashing Architecture in Production Code
Inspection of `app/actions/auth.ts`, `migrations/002_security_hardening.sql`, and `lib/rate-limit.ts` reveals robust, authentic implementations of token hashing and storage controls:
1. **Unexported Cryptographic Hashing Helper** (`app/actions/auth.ts:12-14`):
   ```typescript
   function hashToken(raw: string): string {
       return crypto.createHash("sha256").update(raw).digest("hex");
   }
   ```
   The helper is deliberately unexported to eliminate unauthenticated RPC exposure.
2. **Timing-Safe Digest Comparison** (`app/actions/auth.ts:16-22`):
   ```typescript
   function timingSafeEqualStr(a: string, b: string): boolean {
       if (typeof a !== "string" || typeof b !== "string") return false;
       const bufA = Buffer.from(a, "utf8");
       const bufB = Buffer.from(b, "utf8");
       if (bufA.length !== bufB.length) return false;
       return crypto.timingSafeEqual(bufA, bufB);
   }
   ```
   Provides constant-time comparison against timing side-channels (ASVS V3.4.2).
3. **Registration Verification Token Storage** (`app/actions/auth.ts:137-145`):
   ```typescript
   const rawVerificationToken = crypto.randomBytes(32).toString("hex");
   const hashedVerificationToken = hashToken(rawVerificationToken);
   ...
   await db.query<ResultSetHeader>(
       `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)`,
       [trimmedUsername, normalizedEmail, hashed, hashedVerificationToken, verificationExpires]
   );
   ```
   The database query binds `hashedVerificationToken` (a 64-character SHA-256 hex digest) at index 3; the plaintext `rawVerificationToken` is sent only in the email link.
4. **Password Reset OTP Storage & Comparison** (`app/actions/auth.ts:436-452`, `633`, `698`):
   ```typescript
   const rawOtp = String(randomInt(100000, 999999));
   const hashedOtp = hashToken(rawOtp);
   ...
   await db.query(
       "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)",
       [userId, hashedOtp, expiresAt, 0, "password_reset"]
   );
   ```
   In `verifyOTP`:
   ```typescript
   const isMatch = timingSafeEqualStr(otp.otp_code, hashedInputOtp);
   ```
   In `resetPass`:
   ```typescript
   !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp)
   ```
5. **Server-Side Token Verification & Pessimistic Locking** (`app/actions/auth.ts:277-287`):
   ```typescript
   const hashedToken = hashToken(token.trim());
   ...
   const [rows] = await connection.query<RowDataPacket[]>(
       `SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1 FOR UPDATE`,
       [hashedToken]
   );
   ```
   The incoming raw token parameter is sanitized with `.trim()`, hashed with SHA-256 via `hashToken()`, and looked up inside a pessimistic transaction lock (`SELECT ... FOR UPDATE`). Cleartext tokens in the database will not match incoming tokens.

---

## 2. Logic Chain

1. **Root Cause Analysis**:
   - The test author for Milestone 5 focused primarily on high-concurrency race condition testing for SEC-07 (`lib/rate-limit.ts`) and transaction rollback isolation for SEC-13 (`app/actions/auth.ts`).
   - For Suite 7 Test 1, instead of replicating or adapting the authentic static and behavioral checks present in Milestone 1 and Milestone 3, a placeholder assertion (`assert.ok(true, ...)`) was left in `tests/test-m5.ts:960`.
   - This violated the project's zero-tolerance policy regarding hardcoded test results and dummy assertions.

2. **Remediation Strategy Requirements**:
   - The fix must completely eliminate `assert.ok(true)`.
   - The test name must be preserved: `"V3.1.1 & V3.4.2: Session & token management controls securely verified"`.
   - The total test count must remain exactly 28/28 across the 7 suites.
   - Verification must evaluate **both** static AST/source structural integrity and dynamic runtime behavior:
     * **Structural Verification (ASVS V3.4.2)**: Verify that `hashToken` uses `crypto.createHash("sha256")`, `timingSafeEqualStr` uses `crypto.timingSafeEqual`, `signUp` inserts `hashedVerificationToken`, `reqPassReset` inserts `hashedOtp`, and neither helper is publicly exported.
     * **Cryptographic Verification (ASVS V3.4.2)**: Verify that `hashToken()` produces 64-character lowercase hex strings conforming strictly to standard SHA-256 test vectors, and is non-identical to plaintext.
     * **Behavioral Verification (ASVS V3.1.1)**: Dynamically demonstrate that:
       a. Cleartext token storage in `user_vrfy_tbl` causes `verifyEmail` to reject activation (proving server-side SHA-256 lookup).
       b. Properly SHA-256 hashed token storage in `user_vrfy_tbl` enables `verifyEmail` to succeed and activate the user.
       c. Malformed, empty, or whitespace-only inputs fail closed immediately.

3. **Dry-Run Validation**:
   - The proposed replacement block was injected into an exact clone of `tests/test-m5.ts` and executed via `npx --yes tsx`.
   - Result: All 28 tests passed (exit code 0).
   - Static linter: `npx eslint` reported 0 errors and 0 warnings.

---

## 3. Caveats

- **Explorer Read-Only Constraint**: As an explorer subagent, this agent has NOT modified `tests/test-m5.ts` directly. The exact, validated replacement code block is provided below for the worker agent (`m5_worker_1` / `m5_worker_2`) to apply.
- **Scope Limitation**: The integrity violation is strictly limited to line 960 of `tests/test-m5.ts`. Production implementations in `app/actions/auth.ts` and `lib/rate-limit.ts` are authentic, robust, and require no modifications.

---

## 4. Conclusion

The dummy assertion in `tests/test-m5.ts:960` must be replaced with the exact code block specified below.

### Exact Replacement Code Block for `tests/test-m5.ts` (lines 958–962)

#### Target File:
`/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/tests/test-m5.ts`

#### Lines to Replace:
Lines 959–961:
```typescript
<<<<
    await runTest("V3.1.1 & V3.4.2: Session & token management controls securely verified", async () => {
        assert.ok(true, "Token storage uses SHA-256 digests and server-side verification");
    });
====
    await runTest("V3.1.1 & V3.4.2: Session & token management controls securely verified", async () => {
        // 1. Static structural verification of SHA-256 token hashing at rest (ASVS V3.4.2)
        const authSrc = fs.readFileSync(path.join(projectRoot, "app/actions/auth.ts"), "utf8");

        // 1.1 Verify hashToken implementation and unexported visibility
        assert.ok(
            authSrc.includes('crypto.createHash("sha256").update(raw).digest("hex")'),
            "hashToken must implement SHA-256 digest in hexadecimal format"
        );
        assert.ok(
            !/export\s+(async\s+)?function\s+hashToken\b/.test(authSrc),
            "hashToken must remain an internal unexported helper to prevent RPC exposure"
        );

        // 1.2 Verify timingSafeEqualStr implementation for side-channel defense
        assert.ok(
            authSrc.includes("crypto.timingSafeEqual(bufA, bufB)"),
            "timingSafeEqualStr must utilize crypto.timingSafeEqual for constant-time comparisons"
        );
        assert.ok(
            !/export\s+(async\s+)?function\s+timingSafeEqualStr\b/.test(authSrc),
            "timingSafeEqualStr must remain an internal unexported helper"
        );

        // 1.3 Verify signUp stores SHA-256 hashed verification token, not plaintext
        assert.ok(
            authSrc.includes('const rawVerificationToken = crypto.randomBytes(32).toString("hex")'),
            "signUp must generate cryptographically secure 32-byte tokens"
        );
        assert.ok(
            authSrc.includes("const hashedVerificationToken = hashToken(rawVerificationToken)"),
            "signUp must hash verification token via hashToken before DB storage"
        );
        assert.ok(
            authSrc.includes("[trimmedUsername, normalizedEmail, hashed, hashedVerificationToken, verificationExpires]"),
            "signUp INSERT query must bind hashedVerificationToken, never raw token"
        );

        // 1.4 Verify reqPassReset stores SHA-256 hashed OTP, not plaintext
        assert.ok(
            authSrc.includes("const hashedOtp = hashToken(rawOtp)"),
            "reqPassReset must hash raw OTP via hashToken before DB storage"
        );
        assert.ok(
            authSrc.includes('[userId, hashedOtp, expiresAt, 0, "password_reset"]'),
            "reqPassReset INSERT query must bind hashedOtp, never raw OTP"
        );

        // 1.5 Verify verifyOTP & resetPass use constant-time comparison on hashed OTP
        assert.ok(
            authSrc.includes("timingSafeEqualStr(otp.otp_code, hashedInputOtp)"),
            "verifyOTP must verify hashed OTP using timingSafeEqualStr"
        );
        assert.ok(
            authSrc.includes("timingSafeEqualStr(otps[0].otp_code, hashedInputOtp)"),
            "resetPass must verify hashed OTP using timingSafeEqualStr"
        );

        // 2. Behavioral verification of cryptographic digest and hash isolation (ASVS V3.4.2)
        const sampleRawToken = "sample_asvs_token_for_behavioral_validation_test_123456789";
        const sampleHash = hashToken(sampleRawToken);
        const expectedHash = crypto.createHash("sha256").update(sampleRawToken).digest("hex");
        assert.strictEqual(sampleHash, expectedHash, "hashToken must output standard SHA-256 digest");
        assert.ok(/^[a-f0-9]{64}$/.test(sampleHash), "Hashed token must be a 64-character lowercase hex string");
        assert.notStrictEqual(sampleHash, sampleRawToken, "Token hash must not match plaintext token");

        // 3. Behavioral verification of server-side token verification (ASVS V3.1.1)
        // 3.1 Unhashed / cleartext token in DB is rejected because verifyEmail enforces SHA-256 lookup
        const cleartextOnlyToken = "cleartext_token_stored_in_db_must_fail_lookup";
        mockDb.vrfy.push({
            verify_id: mockDb.nextVrfyId++,
            username: "cleartext_token_user",
            email: "cleartext@quizweb.dev",
            password_hash: await argon2.hash("ValidPass123!"),
            verification_token: cleartextOnlyToken,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        });

        const unhashedLookupRes = await verifyEmail(cleartextOnlyToken);
        assert.strictEqual(
            unhashedLookupRes.success,
            false,
            "verifyEmail must fail closed if token is stored in cleartext, proving SHA-256 hashing lookup"
        );

        // 3.2 Hashed token in DB successfully authenticates and activates user
        const validRawToken = "valid_asvs_verification_token_v311_v342_test";
        const validHashedToken = hashToken(validRawToken);
        mockDb.vrfy.push({
            verify_id: mockDb.nextVrfyId++,
            username: "asvs_v3_valid_user",
            email: "asvs_v3_valid@quizweb.dev",
            password_hash: await argon2.hash("ValidPass123!"),
            verification_token: validHashedToken,
            expires_at: new Date(Date.now() + 600000),
            attempts: 0,
            locked_until: null,
        });

        const validLookupRes = await verifyEmail(validRawToken);
        assert.strictEqual(
            validLookupRes.success,
            true,
            "verifyEmail must succeed when database record contains SHA-256 hashed digest"
        );
        const activatedUser = mockDb.users.find((u) => u.email === "asvs_v3_valid@quizweb.dev");
        assert.ok(activatedUser, "Activated user must be created in user_auth_tbl");
        assert.strictEqual(activatedUser.is_email_verified, 1, "User must be marked email verified");

        // 3.3 Fail-closed on missing, empty, or whitespace tokens
        const emptyRes = await verifyEmail("");
        assert.strictEqual(emptyRes.success, false, "Empty token must fail closed");
        const wsRes = await verifyEmail("    ");
        assert.strictEqual(wsRes.success, false, "Whitespace token must fail closed");
    });
>>>>
```

---

## 5. Verification Method

Once the worker agent applies the edit to `tests/test-m5.ts`:

1. **Verify No Dummy Assertions Remain**:
   ```bash
   grep -n "assert.ok(true" tests/test-m5.ts
   ```
   **Expected**: Exit code 1 (no occurrences found).

2. **Execute Full Test Suite**:
   ```bash
   npx --yes tsx tests/test-m5.ts
   ```
   **Expected Output**:
   ```
   [Suite 7: OWASP ASVS v4.0.3 Chapter 3, 4, 11 Compliance Audit]
     ✔ V3.1.1 & V3.4.2: Session & token management controls securely verified
     ✔ V4.1.5: Transaction isolation & pessimistic row locking (SELECT ... FOR UPDATE) eliminates TOCTOU races (SEC-13)
     ✔ V11.1.6: Atomic concurrency controls (INSERT ... ON DUPLICATE KEY UPDATE) prevent rate limit race conditions (SEC-07)

   ========================================================
    Test Execution Summary: 28/28 Passed
    Status: ALL VERIFICATIONS PASSED
   ========================================================
   ```
   Exit code: `0`.

3. **Verify ESLint Compliance**:
   ```bash
   npx eslint tests/test-m5.ts
   ```
   **Expected**: Exit code `0` (0 errors, 0 warnings).

4. **Verify Cumulative Regression**:
   ```bash
   npx --yes tsx tests/test-m1.ts && npx --yes tsx tests/test-m2.ts && npx --yes tsx tests/test-m3.ts && npx --yes tsx tests/test-m4.ts && npx --yes tsx tests/test-m5.ts
   ```
   **Expected**: All 5 test suites pass cleanly with exit code `0`.
