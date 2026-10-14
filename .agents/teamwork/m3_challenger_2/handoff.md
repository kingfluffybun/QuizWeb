# Adversarial Challenge Report: Milestone 3 OAuth Account Linking Defenses (SEC-04)

**Agent**: `m3_challenger_2`  
**Role**: Empirical Challenger (`critic`, `specialist`)  
**Target Vulnerabilities**: SEC-04 (Insecure OAuth Account Linking), OWASP ASVS v4.0.3 (V3.2.1, V3.6.1)  
**Verdict**: **DEFECTS_FOUND**  

---

## 1. Observation

### 1.1 Baseline Test Suite Execution (`tests/test-m3.ts`)
Tool command: `npx --yes tsx tests/test-m3.ts`
Result: Exit code 0, 30/30 tests passed.
In `tests/test-m3.ts:665-676` (Test T6.2):
```typescript
await runTest("T6.2: Returning OAuth user with existing link allows sign-in without active session", async () => {
    // User 2 already has github linked with gh-linked-200
    const userObj = { id: "", email: "user@quizweb.dev", name: "Regular User" };
    const accountObj = { provider: "github", providerAccountId: "gh-linked-200" };

    (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

    const allowed = await signInCallback({ user: userObj, account: accountObj as never });
    assert.strictEqual(allowed, true, "Returning linked OAuth user sign-in must be permitted");
    assert.strictEqual(userObj.id, "2", "User object ID must be set to existing user 2");
});
```
The baseline test harness only tested the happy path where the incoming `user.email` matched the user who owned `account.providerAccountId`.

### 1.2 Inspection of `auth.ts` Implementation
File: `auth.ts:208-232`:
```typescript
208:                     // 1. Check if an account with user.email exists in user_auth_tbl
209:                     const [existingUser] = await db.query<RowDataPacket[]>(
210:                         "SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ? LIMIT 1",
211:                         [user.email]
212:                     );
213: 
214:                     if (existingUser.length > 0) {
215:                         const userId = existingUser[0].user_id;
216: 
217:                         // Check if user_oauth_tbl already has a row for this provider + providerAccountId
218:                         const [existingOAuth] = await db.query<RowDataPacket[]>(
219:                             "SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
220:                             [account.provider, account.providerAccountId]
221:                         );
222: 
223:                         if (existingOAuth.length > 0) {
224:                             // Already linked -> allow sign-in
225:                             user.id = String(userId);
226:                             const userWithRole = user as { role?: string; user_role?: string; token_version?: number; tokenVersion?: number };
227:                             userWithRole.role = existingUser[0].user_role || "user";
228:                             userWithRole.user_role = existingUser[0].user_role || "user";
229:                             userWithRole.token_version = existingUser[0].token_version ?? 1;
230:                             userWithRole.tokenVersion = existingUser[0].token_version ?? 1;
231:                             return true;
232:                         }
```
At lines 218-220, `user_oauth_tbl` is queried with only `[account.provider, account.providerAccountId]`—the `user_id` is NOT part of the query filter. At line 223, `if (existingOAuth.length > 0)` evaluates whether any row was returned for that provider and provider account ID, but NEVER validates whether `existingOAuth[0].user_id === userId`.

### 1.3 Adversarial Test Harness Execution (`tests/test-m3-adversarial.ts`)
Tool command: `npx --yes tsx tests/test-m3-adversarial.ts`
Result output:
```
========================================================
 Milestone 3 Adversarial Challenge: OAuth SEC-04 Defenses
 Standards: OWASP ASVS v4.0.3 Chapter 3 (V3.2.1, V3.6.1)
========================================================

[SEC-04] Blocked unauthenticated OAuth account linking attempt for email: victim@quizweb.dev
  ✔ Probe 1: Unauthenticated OAuth signIn for existing email -> REJECTED (PASSED)
  ✔ Probe 2: Authenticated OAuth self-linking -> LINKED (PASSED)
  ✔ Probe 3: New user OAuth registration -> CREATED & LINKED (PASSED)
[SEC-04] Blocked unauthenticated OAuth account linking attempt for email: victim@quizweb.dev
  ✔ Probe 4: Adversarial cross-user authenticated linking -> BLOCKED (PASSED)
  ✖ Probe 5: Adversarial OAuth hijack -> VULNERABLE! Attacker logged in as User 1 (Admin) via User 2's OAuth link!
  ✔ Probe 6: Legitimate returning OAuth sign-in -> PERMITTED (PASSED)
[SEC-04] Blocked unauthenticated OAuth account linking attempt for email: attacker@quizweb.dev
  ✔ Probe 7: Provider isolation check -> ISOLATED (PASSED)

========================================================
 Verification Summary: 6/7 Probes Passed
 VERDICT: DEFECTS_FOUND (1 Critical Defect(s) Identified)

 [CRITICAL DEFECT] PROBE-5: Adversarial OAuth Hijack: OAuth account bound to User 2 must NOT permit unauthenticated login as User 1 (Admin)
   Evidence: OAuth account 'attacker-gh-200' bound to user_id: 2. When presented with email 'admin@quizweb.dev', signIn returned true and set user.id = '1' (role: admin)
========================================================
```

---

## 2. Logic Chain

1. **Premise 1**: Under OWASP ASVS v4.0.3 V3.2.1 and V3.6.1, an identity provider account bound to User A must never be used to access or authenticate as User B without explicit authorization and mutual ownership verification.
2. **Premise 2**: In `auth.ts:210`, `existingUser` resolves the target account based on the incoming `user.email`. When `user.email = "admin@quizweb.dev"`, `existingUser` resolves to `userId = 1`.
3. **Premise 3**: In `auth.ts:218-220`, `existingOAuth` queries `user_oauth_tbl` for `WHERE provider_name = ? AND provider_account_id = ? LIMIT 1` across all records in the table, without scoping to `userId`.
4. **Premise 4**: If an attacker owns an existing OAuth link (e.g., `user_id = 2, provider_name = "github", provider_account_id = "attacker-gh-200"`), `existingOAuth` returns 1 row (`existingOAuth[0].user_id = 2`).
5. **Premise 5**: Because `existingOAuth.length > 0` is true, code execution enters `auth.ts:223-231`. The code omits checking `existingOAuth[0].user_id === userId`.
6. **Premise 6**: Line 225 assigns `user.id = String(userId)` (which is `1`, the Admin) and line 227 assigns `userWithRole.role = existingUser[0].user_role` ("admin"), and returns `true`.
7. **Conclusion**: An attacker presenting an OAuth credential previously bound to their own account can take over any arbitrary account (including administrator accounts) simply by specifying the victim's email. This constitutes an authentication bypass and account takeover defect.

---

## 3. Caveats

1. **OAuth Provider Email Verification**: If the upstream OAuth provider (e.g., Google Workspace or GitHub Enterprise) strictly prevents users from presenting emails they do not own, the attack requires the attacker to have added or swapped the target email on their identity provider. However, application-level defense-in-depth requires QuizWeb to never bind or authenticate mismatched internal user IDs, regardless of upstream provider claims.
2. **Stateless Test Environment**: The issue was reproduced both through static inspection of `auth.ts:213-231` and dynamic test harness execution in `tests/test-m3-adversarial.ts`.

---

## 4. Conclusion

**Verdict**: **DEFECTS_FOUND**

A critical security defect exists in `auth.ts:callbacks.signIn`:
- **Vulnerability**: Unauthenticated Cross-Account OAuth Hijack / Missing Account Ownership Check
- **Location**: `auth.ts:218-232`
- **Impact**: Full account takeover / privilege escalation to `admin`.
- **Required Remediation**:
  In `auth.ts`, update lines 218-232 so that `existingOAuth` either checks `WHERE user_id = ? AND provider_name = ? AND provider_account_id = ?` OR verifies `String(existingOAuth[0].user_id) === String(userId)`. If `existingOAuth[0].user_id !== userId`, the sign-in attempt must fail closed (`return false`).

---

## 5. Verification Method

To independently verify this defect, execute the following command from the project root:

```bash
npx --yes tsx tests/test-m3-adversarial.ts
```

### Invalidation Conditions:
- The defect is confirmed resolved when `npx --yes tsx tests/test-m3-adversarial.ts` outputs:
  `Verification Summary: 7/7 Probes Passed` and `VERDICT: CONFIRM_CORRECTNESS`.
- Specifically, Probe 5 must pass by rejecting unauthenticated login attempts where `existingOAuth[0].user_id !== userId` (`res === false` or `user.id !== "1"`).
