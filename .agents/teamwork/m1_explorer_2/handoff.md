# Handoff Report: Milestone 1 Token Storage Hardening (SEC-12)

**Author:** Explorer 2 (Milestone 1)  
**Date:** 2026-10-12  
**Target Vulnerability:** SEC-12 (Cleartext Token Storage at Rest in `user_vrfy_tbl` and `user_otp_tbl`)  
**Scope:** `app/actions/auth.ts` and token lifecycle integration with schema migrations (`user_vrfy_tbl`, `user_otp_tbl`) and verification tests.

---

## 1. Observation

A detailed review of `app/actions/auth.ts`, `app/login/page.tsx`, `app/verify-email/[token]/page.tsx`, and database query patterns reveals how cleartext tokens are currently generated, stored, and verified.

### 1.1 Cleartext Token Generation and Insertion in `signUp`
In `app/actions/auth.ts` (lines 58–67):
```typescript
58: const verificationToken = crypto.randomBytes(32).toString("hex");
59: const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
60: 
61: // Store temporarily
62: await db.query<ResultSetHeader>(
63:     `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at) VALUES (?, ?, ?, ?, ?)`,
64:     [trimmedUsername, normalizedEmail, hashed, verificationToken, verificationExpires]
65: )
66: 
67: const verificationLink = `https://quizweb.dev/verify-email/${verificationToken}`;
```
- **Finding:** `verificationToken` is a 64-character hexadecimal string generated from 32 random bytes. It is stored directly in cleartext in `user_vrfy_tbl.verification_token`.
- **Finding:** The newly mandated columns `attempts` and `locked_until` are completely absent from the `INSERT` query.

### 1.2 Cleartext Token Lookup in `verifyEmail`
In `app/actions/auth.ts` (lines 189–204):
```typescript
189: export async function verifyEmail(token: string) {
190:     if (!token) {
191:         return {
192:             success: true,
193:             message: "Invalid verification link.",
194:         };
195:     }
196: 
197:     const connection = await db.getConnection();
198: 
199:     try {
200:         // Find pending verification
201:         const [rows] = await connection.query<RowDataPacket[]>(
202:             `SELECT verify_id, username, email, password_hash, expires_at FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1`,
203:             [token]
204:         );
```
- **Finding:** `token` is received directly from the URL route `/verify-email/[token]` (in `app/verify-email/[token]/page.tsx:14`).
- **Finding:** Line 202 executes a direct lookup `WHERE verification_token = ?` using the raw `token`. If hashed tokens are stored in the database without updating this query, lookups will fail to match.
- **Finding:** Line 192 exhibits a bug: when `!token`, it returns `{ success: true, message: "Invalid verification link." }`.
- **Finding:** `verifyEmail` lacks any checking or tracking of `attempts` or `locked_until`.

### 1.3 Cleartext OTP Generation and Insertion in `reqPassReset`
In `app/actions/auth.ts` (lines 331–350):
```typescript
331: // Generate la code
332: const otpCode = String(randomInt(100000, 999999));
333: 
334: // Expire 5 mins
335: const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
336: 
337: // Invalidate any existing unused OTPs for this user
338: await db.query(
339:     "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
340:     [userId, "password_reset"]
341: );
342: 
343: // Insert new OTP
344: await db.query(
345:     "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, ?, ?)",
346:     [userId, otpCode, expiresAt, 0, "password_reset"]
347: );
348: 
349: // Send to email
350: await sendEmail({
...
450:     <div class="otp-code">${otpCode}</div>
```
- **Finding:** `otpCode` is a 6-digit numeric string with only 900,000 possible values (100,000 to 999,999). It is stored directly in cleartext in `user_otp_tbl.otp_code`.
- **Finding:** Anyone with read access to the database (backup dump, compromised connection, read-only SQL injection) can read valid OTPs and hijack accounts instantly.
- **Finding:** Line 345 omits `attempts` and `locked_until` columns.

### 1.4 Cleartext OTP Verification in `verifyOTP`
In `app/actions/auth.ts` (lines 496–522):
```typescript
496: // Find valid OTP
497: const [otps] = await db.query<RowDataPacket[]>(
498:     `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
499:     WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`,
500:     [userId, "password_reset"]
501: );
502: 
503: if (otps.length === 0) {
504:     return { error: "Invalid or expired OTP" };
505: }
506: 
507: const otp = otps[0];
...
514: if (otp.otp_code !== otpCode) {
515:     return { error: "Invalid OTP. Please try again." };
516: }
517: 
518: // Mark OTP as used
519: await db.query(
520:     "UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?",
521:     [otp.otp_id]
522: );
```
- **Finding:** Line 514 compares `otp.otp_code !== otpCode` directly without hashing. Once `user_otp_tbl.otp_code` stores a 64-character SHA-256 hash, this check will always fail against the raw 6-digit input.
- **Finding:** On failed OTP match, `verifyOTP` does NOT increment `attempts` or track failed attempts, allowing brute-force attempts across the entire 6-digit space.

### 1.5 Cleartext OTP Verification in `resetPass`
In `app/actions/auth.ts` (lines 552–560):
```typescript
552: // Verify again
553: const [otps] = await db.query<RowDataPacket[]>(
554:     `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
555:     WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
556:     [userId, "password_reset"]
557: );
558: 
559: if (otps.length === 0 || otps[0].otp_code !== otpCode || otps[0].is_used === 0) {
560:     return { error: "Invalid or expired OTP" };
561: }
```
- **Finding:** Line 559 performs `otps[0].otp_code !== otpCode`. Without hashing `otpCode`, `resetPass` will fail whenever the database stores SHA-256 hashes.

### 1.6 Frontend Consumption
In `app/login/page.tsx`:
- Line 242: `const result = await verifyOTP(forgotEmail, forgotOTP);`
- Line 267: `const result = await resetPass(forgotEmail, forgotOTP, newPassword);`
The client sends the raw 6-digit numeric string `forgotOTP`.
In `app/verify-email/[token]/page.tsx`:
- Line 14: `const result = await verifyEmail(token);`
The client sends the raw token from the URL.

---

## 2. Logic Chain

1. **Vulnerability Mechanics (ASVS 2.7.5, 3.4.2; SEC-12):**
   Cleartext tokens in database tables expose active credentials during database leaks, backup exposures, or SQL injection flaws. In particular, a 6-digit OTP stored in cleartext allows complete account takeover without requiring access to the victim's email account.

2. **Hashing Standard:**
   Standardizing on `crypto.createHash('sha256').update(rawToken).digest('hex')` produces a 64-character lowercase hexadecimal hash.
   - For `user_vrfy_tbl`: raw token is a 32-byte cryptographically secure random string (64 hex characters, 256 bits of entropy). Stored value is the SHA-256 hash (64 hex characters).
   - For `user_otp_tbl`: raw token is a 6-digit numeric string sent via email to the user. Stored value is the SHA-256 hash (64 hex characters).

3. **Lookup Strategy in `verifyEmail`:**
   Because `verifyEmail` looks up a single row by token (`WHERE verification_token = ?`), hashing the input token with SHA-256 prior to the SQL query (`[hashToken(token.trim())]`) matches the stored 64-character hash at database index speed with zero pre-image leakage.

4. **Lookup Strategy in `verifyOTP`:**
   In `verifyOTP`, looking up by `WHERE user_id = ? AND purpose = 'password_reset' AND is_used = 0 ORDER BY expires_at DESC LIMIT 1` rather than filtering by `otp_code` in the SQL query is **critical**:
   - If the SQL query filtered by `AND otp_code = ?`, a wrong OTP would return 0 rows. The server would have no target row on which to increment `attempts` or enforce lockout!
   - By querying the user's active OTP row, checking lockout status, and comparing the SHA-256 hash using `crypto.timingSafeEqual`, the system can:
     1. Increment `attempts = attempts + 1` on incorrect submissions.
     2. Set `locked_until = NOW()` (or future timestamp) when `attempts >= 5`.
     3. Lock out brute-force attacks after 5 failed attempts (satisfying SEC-01 / ASVS 3.7.1).
     4. Mark `is_used = 1` only upon exact match.

5. **Lookup Strategy in `resetPass`:**
   `resetPass` must re-verify the OTP submitted with the new password. Hashing the input `otpCode` and comparing `timingSafeEqualStr(otps[0].otp_code, hashedInput)` guarantees that valid consumed tokens match without exposing cleartext OTPs.

6. **Attempt and Lockout Initialization:**
   In `signUp` and `reqPassReset`, new rows must explicitly initialize `attempts = 0` and `locked_until = NULL`. Explicit initialization prevents driver-dependent null/undefined bugs and guarantees deterministic test results.

---

## 3. Caveats

1. **Encapsulation in Next.js App Router (`"use server"`):**
   In Next.js App Router, every `export` in a file with `"use server";` becomes an accessible HTTP Server Action RPC endpoint. Helper functions like `hashToken` and `timingSafeEqualStr` **must NOT be exported** from `app/actions/auth.ts`.
2. **Column Width in `user_otp_tbl`:**
   If `user_otp_tbl` historically defined `otp_code VARCHAR(6)`, attempting to insert a 64-character SHA-256 hex string will cause MySQL error `ER_DATA_TOO_LONG` (Data too long for column 'otp_code'). Explorer 1's migration script (`002_security_hardening.sql`) must ensure `otp_code` is `VARCHAR(255)` or `VARCHAR(64)`.
3. **Email Sending vs. Offline Test Harness:**
   In `signUp` and `reqPassReset`, database token generation and insertion occur before `sendEmail()`. In automated test environments without a valid `RESEND_API_KEY`, testing actions directly requires verifying database state before email delivery or mocking `sendEmail`.
4. **Transition to Milestone 4 (SEC-01, SEC-02) and Milestone 5 (SEC-13):**
   In Milestone 1, we implement SHA-256 hashing, lookup updates, and column initialization. Full rate-limiting (`reqPassReset`), transaction isolation (`SELECT ... FOR UPDATE` in `verifyEmail`), and permanent lockout semantics (`is_used = 2`) will be fully integrated in Milestones 4 and 5 without breaking M1's token hashing foundation.

---

## 4. Conclusion & Concrete Implementation Plan

### 4.1 Internal Helper Functions (to add in `app/actions/auth.ts`)
```typescript
function hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
}

function timingSafeEqualStr(a: string, b: string): boolean {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}
```

### 4.2 Code Changes by Function

#### 1. `signUp` (`app/actions/auth.ts` lines 58–67)
**Current:**
```typescript
const verificationToken = crypto.randomBytes(32).toString("hex");
const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);

// Store temporarily
await db.query<ResultSetHeader>(
    `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [trimmedUsername, normalizedEmail, hashed, verificationToken, verificationExpires]
)

const verificationLink = `https://quizweb.dev/verify-email/${verificationToken}`;
```
**Proposed Hardened Replacement:**
```typescript
const rawVerificationToken = crypto.randomBytes(32).toString("hex");
const hashedVerificationToken = hashToken(rawVerificationToken);
const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);

// Store hashed token with initialized attempt tracking
await db.query<ResultSetHeader>(
    `INSERT INTO user_vrfy_tbl (username, email, password_hash, verification_token, expires_at, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    [trimmedUsername, normalizedEmail, hashed, hashedVerificationToken, verificationExpires]
);

// Email contains cleartext raw token
const verificationLink = `https://quizweb.dev/verify-email/${rawVerificationToken}`;
```

#### 2. `verifyEmail` (`app/actions/auth.ts` lines 189–228)
**Current:**
```typescript
export async function verifyEmail(token: string) {
    if (!token) {
        return {
            success: true,
            message: "Invalid verification link.",
        };
    }
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT verify_id, username, email, password_hash, expires_at FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1`,
            [token]
        );
```
**Proposed Hardened Replacement:**
```typescript
export async function verifyEmail(token: string) {
    if (!token || typeof token !== "string" || !token.trim()) {
        return {
            success: false,
            message: "Invalid verification link.",
        };
    }

    const hashedToken = hashToken(token.trim());
    const connection = await db.getConnection();

    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `SELECT verify_id, username, email, password_hash, expires_at, attempts, locked_until FROM user_vrfy_tbl WHERE verification_token = ? LIMIT 1`,
            [hashedToken]
        );

        if (rows.length === 0) {
            return {
                success: false,
                message: "This verification link is invalid or has already been used.",
            };
        }

        const pendingUser = rows[0];

        // Check lockout status
        if (pendingUser.locked_until && new Date() < new Date(pendingUser.locked_until)) {
            return {
                success: false,
                message: "This verification link has been locked due to too many failed attempts.",
            };
        }
        if (pendingUser.attempts >= 5) {
            return {
                success: false,
                message: "This verification link has been locked due to too many failed attempts.",
            };
        }
```

#### 3. `reqPassReset` (`app/actions/auth.ts` lines 331–353)
**Current:**
```typescript
const otpCode = String(randomInt(100000, 999999));
const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

await db.query(
    "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
    [userId, "password_reset"]
);

await db.query(
    "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose) VALUES (?, ?, ?, ?, ?)",
    [userId, otpCode, expiresAt, 0, "password_reset"]
);

await sendEmail({
    to: email,
    subject: "QuizWeb - Password Reset",
    html: `... <div class="otp-code">${otpCode}</div> ...`
});
```
**Proposed Hardened Replacement:**
```typescript
const rawOtp = String(randomInt(100000, 999999));
const hashedOtp = hashToken(rawOtp);
const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

await db.query(
    "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ? AND is_used = 0",
    [userId, "password_reset"]
);

await db.query(
    "INSERT INTO user_otp_tbl (user_id, otp_code, expires_at, is_used, purpose, attempts, locked_until) VALUES (?, ?, ?, ?, ?, 0, NULL)",
    [userId, hashedOtp, expiresAt, 0, "password_reset"]
);

// Email contains the cleartext 6-digit raw OTP
await sendEmail({
    to: email,
    subject: "QuizWeb - Password Reset",
    html: `... <div class="otp-code">${rawOtp}</div> ...`
});
```

#### 4. `verifyOTP` (`app/actions/auth.ts` lines 478–528)
**Current:**
```typescript
export async function verifyOTP(email: string, otpCode: string) {
    if (!email || !otpCode) {
        return { error: "Email and OTP code are required." };
    }
...
    const [otps] = await db.query<RowDataPacket[]>(
        `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
        WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`,
        [userId, "password_reset"]
    );
...
    if (otp.otp_code !== otpCode) {
        return { error: "Invalid OTP. Please try again." };
    }
```
**Proposed Hardened Replacement:**
```typescript
export async function verifyOTP(email: string, otpCode: string) {
    if (!email || !otpCode || typeof otpCode !== "string") {
        return { error: "Email and OTP code are required." };
    }

    try {
        const [users] = await db.query<RowDataPacket[]>(
            "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
            [email.trim().toLowerCase()]
        );

        if (users.length === 0) {
            return { error: "Invalid email." };
        }

        const userId = users[0].user_id;
        const hashedInputOtp = hashToken(otpCode.trim());

        const [otps] = await db.query<RowDataPacket[]>(
            `SELECT otp_id, otp_code, expires_at, is_used, attempts, locked_until FROM user_otp_tbl
            WHERE user_id = ? AND purpose = ? AND is_used = 0 ORDER BY expires_at DESC LIMIT 1`,
            [userId, "password_reset"]
        );

        if (otps.length === 0) {
            return { error: "Invalid or expired OTP" };
        }

        const otp = otps[0];

        // Check lockout status
        if (otp.locked_until && new Date() < new Date(otp.locked_until)) {
            return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
        }
        if (otp.attempts >= 5) {
            return { error: "Too many failed attempts. This OTP has been locked. Please request a new one." };
        }

        // Check expiration
        if (new Date(otp.expires_at) < new Date()) {
            return { error: "OTP has expired. Please request a new one." };
        }

        // Timing-safe comparison of SHA-256 hashes
        const isMatch = timingSafeEqualStr(otp.otp_code, hashedInputOtp);
        if (!isMatch) {
            const newAttempts = (otp.attempts || 0) + 1;
            if (newAttempts >= 5) {
                await db.query(
                    "UPDATE user_otp_tbl SET attempts = ?, locked_until = NOW() WHERE otp_id = ?",
                    [newAttempts, otp.otp_id]
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

        // Mark OTP as verified (is_used = 1)
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE otp_id = ?",
            [otp.otp_id]
        );

        return { success: true, message: "OTP verified successfully." };
    } catch (error) { ... }
}
```

#### 5. `resetPass` (`app/actions/auth.ts` lines 532–565)
**Current:**
```typescript
const [otps] = await db.query<RowDataPacket[]>(
    `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
    WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
    [userId, "password_reset"]
);

if (otps.length === 0 || otps[0].otp_code !== otpCode || otps[0].is_used === 0) {
    return { error: "Invalid or expired OTP" };
}
```
**Proposed Hardened Replacement:**
```typescript
const hashedInputOtp = hashToken(otpCode.trim());

const [otps] = await db.query<RowDataPacket[]>(
    `SELECT otp_id, otp_code, expires_at, is_used FROM user_otp_tbl
    WHERE user_id = ? AND purpose = ? ORDER BY expires_at DESC LIMIT 1`,
    [userId, "password_reset"]
);

if (
    otps.length === 0 ||
    !timingSafeEqualStr(otps[0].otp_code, hashedInputOtp) ||
    otps[0].is_used === 0
) {
    return { error: "Invalid or expired OTP" };
}
```

---

## 5. Verification Method

To independently verify the implementation when applied in Milestone 1:

### 5.1 Static Code Inspection
```bash
# Verify hashToken helper definition
grep -n "createHash('sha256')" app/actions/auth.ts

# Verify attempt and lockout initialization in INSERT queries
grep -n "attempts, locked_until" app/actions/auth.ts

# Verify timingSafeEqual usage
grep -n "timingSafeEqual" app/actions/auth.ts
```

### 5.2 Standalone Test Verification (`tests/test-m1.ts`)
The test harness `tests/test-m1.ts` must execute the following checks via `npx --yes tsx tests/test-m1.ts`:
1. **Verification Token Storage Test:**
   - Execute `signUp(formData)` with a test username/email.
   - Query `user_vrfy_tbl` directly via SQL for the created row.
   - Assert `verification_token.length === 64`.
   - Assert `verification_token` does NOT match the raw token, but equals `crypto.createHash('sha256').update(rawToken).digest('hex')`.
   - Assert `attempts === 0` and `locked_until === null`.
2. **OTP Storage Test:**
   - Execute `reqPassReset(email)` with an existing test user.
   - Query `user_otp_tbl` directly via SQL for the created row.
   - Assert `otp_code.length === 64`.
   - Assert `otp_code` does NOT match the raw 6-digit number, but equals `crypto.createHash('sha256').update(rawOtp).digest('hex')`.
   - Assert `attempts === 0` and `locked_until === null`.
3. **Token Verification Test:**
   - Call `verifyEmail(rawToken)` -> asserts `{ success: true }`.
   - Call `verifyEmail('invalid-token')` -> asserts `{ success: false }`.
   - Call `verifyOTP(email, rawOtp)` -> asserts `{ success: true }`.
   - Call `verifyOTP(email, '000000')` -> asserts failure and checks that `attempts` was incremented to 1.
   - Call `resetPass(email, rawOtp, 'NewPassword123!')` -> asserts success and password updated.

### 5.3 Invalidation Conditions
- Any occurrence of raw `randomBytes` hex string stored directly in `user_vrfy_tbl.verification_token`.
- Any occurrence of raw 6-digit numeric OTP stored directly in `user_otp_tbl.otp_code`.
- Any equality check in `verifyOTP` or `resetPass` comparing raw input directly against `otp.otp_code` without SHA-256 hashing.
- Failure of `tests/test-m1.ts` on hashed token verification assertions.
