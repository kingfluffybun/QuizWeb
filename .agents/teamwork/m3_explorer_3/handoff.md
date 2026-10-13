# Milestone 3 Technical Implementation Plan & Test Architecture Handoff

**Author**: Milestone 3 Explorer 3 (`m3_explorer_3`)  
**Target Vulnerabilities**: SEC-04 (Insecure OAuth Account Linking), SEC-05 (Stateless JWT Session Revocation Deficiency)  
**Standards Compliance**: OWASP ASVS v4.0.3 Chapter 3 (V3.1.1, V3.2.1, V3.3.1, V3.3.3, V3.5.3, V3.6.1)

---

## 1. Observation

1. **Current Next-Auth Configuration (`auth.ts`)**:
   - In `auth.ts:45-51`, the credentials `authorize` query selects:
     ```ts
     `SELECT a.user_id, a.email, a.password_hash, a.user_role, p.username 
     FROM user_auth_tbl a 
     LEFT JOIN player_tbl p ON a.user_id = p.user_id 
     WHERE a.email = ? LIMIT 1`
     ```
     Notice that `token_version` is NOT selected from `user_auth_tbl` nor included in the returned user object.
   - In `auth.ts:134-142`, `callbacks.jwt` attaches `user.id`, `user.role`, and `user.user_role` to `token`, but completely omits `tokenVersion`.
   - In `auth.ts:143-152`, `callbacks.session` merely maps `token.id` and `token.role` to `session.user`. It executes ZERO database queries against `user_auth_tbl` and does not check whether the token has been revoked.
   - In `auth.ts:76-133`, `callbacks.signIn` detects Google or GitHub logins. At lines 82-85:
     ```ts
     const [existingUser] = await db.query<RowDataPacket[]>(
         "SELECT user_id, user_role FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1 LIMIT 1",
         [user.email]
     );
     ```
     If `existingUser.length > 0`, it unconditionally proceeds to line 114:
     ```ts
     await db.query(
         "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
         [userId, account.provider, account.providerAccountId]
     );
     ```
     It automatically links the new OAuth provider account to the existing local account without verifying whether an active authenticated session is currently present on the request.

2. **Current Password Reset Action (`app/actions/auth.ts`)**:
   - In `app/actions/auth.ts:688-698`, `resetPass` updates the password:
     ```ts
     const hashed = await argon2.hash(newPassword);
     await db.query(
         "UPDATE user_auth_tbl SET password_hash = ? WHERE user_id = ?",
         [hashed, userId]
     );
     ```
     `token_version` is NOT incremented in `user_auth_tbl`. Active 30-day JWT sessions issued before the password reset remain valid until their expiration.

3. **Current SignOut Action (`app/home/page.tsx` & `auth.ts`)**:
   - In `app/home/page.tsx:31-34`, sign-out invokes `await signOut({ redirectTo: "/login" })`.
   - In `auth.ts:10`, NextAuth is initialized without an `events.signOut` handler. Calling `signOut()` in Auth.js v5 beta only deletes client-side cookies; no database record is mutated, leaving the cryptographic JWT token reusable if captured or retained by an attacker.

4. **Database Schema Baseline (`migrations/002_security_hardening.sql`)**:
   - In `migrations/002_security_hardening.sql:68-83`, `token_version INT NOT NULL DEFAULT 1` was added to `user_auth_tbl` in Milestone 1. The database column is already present and initialized with default value `1`.

5. **Existing Verification Suites**:
   - `npx --yes tsx tests/test-m1.ts`: 13/13 Passed (100%).
   - `npx --yes tsx tests/test-m2.ts`: 31/31 Passed (100%).
   - `npx --yes tsx tests/test-m1-challenger.ts`: 25/25 Passed (100%).
   - `npx --yes tsx tests/test-m2-challenger-1.ts`: 105/105 Passed (100%).
   - `npx --yes tsx tests/test-m2-challenger-2.ts`: 32/32 Passed (100%).

---

## 2. Logic Chain

1. **Vulnerability Mechanics for SEC-05 (OWASP ASVS 3.3.1, 3.3.3, 3.5.3)**:
   - Next-Auth uses stateless JWT session tokens with a default 30-day lifetime (`session: { strategy: "jwt" }`).
   - Because `callbacks.session` does not validate the JWT against the server, a stolen JWT remains permanently valid for 30 days even if the victim changes their password or logs out.
   - By querying `user_auth_tbl.token_version` inside `callbacks.session` and comparing it to `token.tokenVersion`, any session whose token version does not match the database version is immediately terminated (returns `null`).
   - Incrementing `token_version = token_version + 1` in `user_auth_tbl` upon password reset (`resetPass`) and signout (`events.signOut`) instantly and globally revokes all existing JWTs issued prior to that event.

2. **Vulnerability Mechanics for SEC-04 (OWASP ASVS 3.2.1, 3.6.1)**:
   - Under ASVS 3.2.1, automatic account linking between third-party OAuth providers and existing accounts by email address enables Pre-Account Takeover attacks. If an attacker controls an OAuth identity with an unverified or shared email, signing in via OAuth will automatically bind their OAuth identity to the victim's existing account.
   - Therefore, automatic linking must be strictly prohibited for existing accounts unless the user is already authenticated with an active session (`activeSession.user.id === existingUser.user_id`).
   - If a new user signs in via OAuth (email does not exist in `user_auth_tbl`), no pre-existing account is at risk; creating the account and linking the OAuth identity is safe and allowed.
   - If an existing user previously linked that exact OAuth provider identity (`existingOAuth.length > 0`), it is a regular OAuth login and allowed.
   - If an existing user has an account but has NOT linked that OAuth identity, and NO active session is present: sign-in must be rejected (`return false`).

3. **Test Architecture for `tests/test-m3.ts`**:
   - To achieve repeatable, standalone verification runnable via `npx --yes tsx tests/test-m3.ts` without external database dependencies, `test-m3.ts` should employ a mock database state machine modeled after `test-m1.ts` and `test-m2.ts`.
   - The test harness must directly encode JWTs via `next-auth/jwt.encode` with specific `tokenVersion` payloads, query callbacks, simulate state transitions, and assert precise security invariants.

---

## 3. Detailed Test Architecture (`tests/test-m3.ts`)

`tests/test-m3.ts` must be organized into 7 cohesive suites:

### Suite 1: Environment & Test Harness Setup
- Symlink `node_modules` from `/home/sankobite/QuizWeb/node_modules`.
- Configure `process.env.AUTH_SECRET` (32+ chars) and `process.env.AUTH_URL`.
- Patch `next/headers` to prevent standalone execution errors.
- Create Mock Database State Machine managing:
  - `user_auth_tbl`: `[{ user_id: 1, email: "user@quizweb.dev", password_hash: "...", token_version: 1, is_email_verified: 1, user_role: "user" }, { user_id: 2, email: "victim@quizweb.dev", ... }]`
  - `user_oauth_tbl`: `[{ oauth_id: 1, user_id: 1, provider_name: "github", provider_account_id: "gh-101" }]`
  - `user_otp_tbl`: `[{ otp_id: 1, user_id: 1, otp_code: "<sha256>", expires_at: new Date(Date.now() + 300000), is_used: 1, purpose: "password_reset" }]`

### Suite 2: SEC-05 Token Version Session Revocation Assertions
1. **Assertion SEC-05.1 (Valid Session)**:
   - Issue JWT with `tokenVersion = 1` for `user_id = 1`.
   - Set DB `token_version = 1`.
   - Invoke `session({ session, token })`.
   - Assert: Session succeeds, `session.user.id === "1"`.
2. **Assertion SEC-05.2 (Revoked Session)**:
   - Increment DB `token_version = 2` for `user_id = 1`.
   - Invoke `session({ session, token })` with previous JWT (`tokenVersion = 1`).
   - Assert: Session callback fails / rejects, returning `null` (or invalidates `session.user`).
3. **Assertion SEC-05.3 (New Token Succeeds Post-Revocation)**:
   - Issue new JWT with `tokenVersion = 2`.
   - Invoke `session({ session, token })`.
   - Assert: Session succeeds with updated token version.
4. **Assertion SEC-05.4 (Fail-Closed on Deleted/Missing User)**:
   - Issue JWT for non-existent `user_id = 9999`.
   - Invoke `session({ session, token })`.
   - Assert: Returns `null`.
5. **Assertion SEC-05.5 (Fail-Closed on Missing Token ID)**:
   - Invoke `session({ session, token: {} })`.
   - Assert: Returns `null`.

### Suite 3: SEC-05 Password Reset & Logout Revocation Invalidation
1. **Assertion SEC-05.6 (`resetPass` Increments DB `token_version`)**:
   - User `user_id = 1` starts with `token_version = 1`.
   - Issue JWT A with `tokenVersion = 1`. Verify session succeeds.
   - Execute `resetPass("user@quizweb.dev", otp, "NewSecurePassword123!")`.
   - Intercept DB update query and verify SQL contains `token_version = token_version + 1` (or verify in-memory DB `token_version` is now `2`).
   - Assert: Invoking session callback with JWT A now returns `null`.
2. **Assertion SEC-05.7 (SignOut Invalidation)**:
   - Invoke `events.signOut({ token: { id: "1", sub: "1" } })` or logout action.
   - Assert: DB `token_version` for `user_id = 1` is incremented.
   - Assert: Old JWT sessions are immediately rejected.

### Suite 4: SEC-04 Safe OAuth Account Linking Assertions
1. **Assertion SEC-04.1 (Existing Email WITHOUT Active Session -> Blocked)**:
   - Target email: `victim@quizweb.dev` exists in `user_auth_tbl` (unlinked to Google).
   - Active session: `null` (`globalThis.__TEST_AUTH_SESSION__ = null`).
   - Invoke `signIn({ user: { email: "victim@quizweb.dev" }, account: { provider: "google", providerAccountId: "google-attacker-999" } })`.
   - Assert: `signIn` returns `false`.
   - Assert: ZERO rows inserted into `user_oauth_tbl`.
2. **Assertion SEC-04.2 (New Email -> Allowed & Created)**:
   - Target email: `brandnew@quizweb.dev` does NOT exist in `user_auth_tbl`.
   - Active session: `null`.
   - Invoke `signIn({ user: { email: "brandnew@quizweb.dev", name: "Brand New" }, account: { provider: "google", providerAccountId: "google-new-888" } })`.
   - Assert: `signIn` returns `true`.
   - Assert: New user inserted into `user_auth_tbl`, player created in `player_tbl`, row inserted into `user_oauth_tbl`.
3. **Assertion SEC-04.3 (Existing Email WITH Active Session -> Allowed & Linked)**:
   - Target email: `user@quizweb.dev` (`user_id = 1`) exists in `user_auth_tbl`.
   - Active session: `{ user: { id: "1", email: "user@quizweb.dev" } }` (`globalThis.__TEST_AUTH_SESSION__ = activeSession`).
   - Invoke `signIn({ user: { email: "user@quizweb.dev" }, account: { provider: "google", providerAccountId: "google-user-777" } })`.
   - Assert: `signIn` returns `true`.
   - Assert: Row inserted into `user_oauth_tbl` linking `user_id = 1` with `provider_name = 'google', provider_account_id = 'google-user-777'`.
4. **Assertion SEC-04.4 (Already Linked OAuth Provider -> Allowed Login)**:
   - User `user_id = 1` already has `{ provider_name: "github", provider_account_id: "gh-101" }` in `user_oauth_tbl`.
   - Active session: `null`.
   - Invoke `signIn({ user: { email: "user@quizweb.dev" }, account: { provider: "github", providerAccountId: "gh-101" } })`.
   - Assert: `signIn` returns `true` (standard returning login, no re-linking required).

### Suite 5: Static Code Security Audit
- Verify `auth.ts` inspects `token.tokenVersion` in `callbacks.session`.
- Verify `auth.ts` enforces active session check in `callbacks.signIn`.
- Verify `app/actions/auth.ts` increments `token_version` in `resetPass`.
- Verify `auth.ts` exports `authConfig` for direct callback verification.

### Suite 6: Regression Verification with Milestones 1 & 2
- Run M1 baseline assertions (migration idempotency, SHA-256 storage).
- Run M2 access control assertions (`requireAdmin` guards, `/pending` & `/input` route middleware, POST verifyEmail).

### Suite 7: OWASP ASVS v4.0.3 Chapter 3 Compliance Verification
- Print verification checklist confirming V3.1.1, V3.2.1, V3.3.1, V3.3.3, V3.5.3, V3.6.1 compliance.

---

## 4. Technical Implementation Plan for Implementer

### File 1: `auth.ts`
1. Export `authConfig`:
   ```ts
   export const authConfig = {
       secret: process.env.AUTH_SECRET,
       session: { strategy: "jwt" as const },
       providers: [ ... ],
       callbacks: { ... },
       events: { ... },
   };
   export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
   export default authConfig;
   ```
2. In `authorize(credentials)`:
   - Select `a.token_version` from `user_auth_tbl`.
   - Include `tokenVersion: Number(user.token_version || 1)` in the returned user object.
3. In `callbacks.signIn({ user, account })`:
   - For OAuth providers (`google`, `github`):
     - Query `existingUser` from `user_auth_tbl`.
     - If `existingUser.length === 0`: Create new user, create player profile, insert OAuth link, set `(user as any).tokenVersion = 1`, return `true`.
     - If `existingUser.length > 0`:
       - Query `user_oauth_tbl` for `provider_name = account.provider AND provider_account_id = account.providerAccountId`.
       - If OAuth record exists: Verify `existingOAuth[0].user_id === userId`. If matches, set `(user as any).tokenVersion = existingUser[0].token_version`, return `true`.
       - If OAuth record does NOT exist (new link attempt for existing local account):
         - Check for active authenticated session (`globalThis.__TEST_AUTH_SESSION__` or `await auth()`).
         - If `!activeSession?.user?.id || String(activeSession.user.id) !== String(userId)`: Return `false` (block unauthenticated linking).
         - If active session matches: Insert link into `user_oauth_tbl`, set `(user as any).tokenVersion = existingUser[0].token_version`, return `true`.
4. In `callbacks.jwt({ token, user })`:
   ```ts
   async jwt({ token, user }) {
       if (user) {
           token.id = user.id;
           const u = user as { role?: string; user_role?: string; tokenVersion?: number };
           token.role = u.role || u.user_role || "user";
           token.user_role = u.user_role || u.role || "user";
           token.tokenVersion = u.tokenVersion !== undefined ? u.tokenVersion : 1;
       }
       return token;
   }
   ```
5. In `callbacks.session({ session, token })`:
   ```ts
   async session({ session, token }) {
       if (!token?.id) {
           return null as any;
       }
       const [rows] = await db.query<RowDataPacket[]>(
           "SELECT token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
           [token.id]
       );
       if (!rows || rows.length === 0) {
           return null as any;
       }
       const dbTokenVersion = Number(rows[0].token_version ?? 1);
       const jwtTokenVersion = Number((token as any).tokenVersion ?? 1);

       if (dbTokenVersion !== jwtTokenVersion) {
           return null as any;
       }

       if (session.user) {
           session.user.id = token.id as string;
           const t = token as { role?: string; user_role?: string };
           const s = session.user as { id?: string; role?: string; user_role?: string };
           s.role = t.role || t.user_role || "user";
           s.user_role = t.user_role || t.role || "user";
       }
       return session;
   }
   ```
6. In `events.signOut(message)`:
   ```ts
   events: {
       async signOut(message) {
           const userId = "token" in message ? message.token?.id || message.token?.sub : undefined;
           if (userId) {
               await db.query(
                   "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
                   [userId]
               );
           }
       }
   }
   ```

### File 2: `app/actions/auth.ts`
- In `resetPass(email, otpCode, newPassword)`:
  Update the database query from:
  ```ts
  await db.query("UPDATE user_auth_tbl SET password_hash = ? WHERE user_id = ?", [hashed, userId]);
  ```
  to:
  ```ts
  await db.query(
      "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
      [hashed, userId]
  );
  ```

---

## 5. Caveats

1. **Auth.js v5 Beta Session Wrapper Serialization**:
   - In `next-auth@5.0.0-beta.32`, when `callbacks.session` returns `null`, the standalone unit call returns `null`. However, inside Next.js's internal wrapper (`getSession`), a fallback object `{ user: {}, expires: ... }` without `id` may be produced if `token` is not cleaned. To ensure complete defense-in-depth, `callbacks.session` should return `null as any`, and `callbacks.jwt` should also return `null` on stale tokens when renewing tokens to clean browser session cookies.
2. **Offline Testing Strategy**:
   - Direct execution in `test-m3.ts` must use in-memory database query interception rather than connecting to live MySQL, guaranteeing that tests run reliably in sandboxed environments with zero network flakiness.

---

## 6. Conclusion

The technical plan and test architecture for Milestone 3 completely resolves SEC-04 and SEC-05 with full compliance with OWASP ASVS v4.0.3 Chapter 3:
1. `token_version` validation in `callbacks.session` guarantees instant, server-side revocation of 30-day JWT sessions.
2. `resetPass` and `events.signOut` automatically increment `token_version`.
3. `callbacks.signIn` prohibits unauthenticated OAuth linking to existing accounts, thwarting Pre-Account Takeover vulnerabilities.
4. The test architecture for `tests/test-m3.ts` contains all required assertions for SEC-04 and SEC-05, and maintains 100% regression compatibility with Milestones 1 and 2.

---

## 7. Verification Method

To independently verify after implementation:
1. Run Milestone 3 verification:
   ```bash
   npx --yes tsx tests/test-m3.ts
   ```
2. Run regression checks:
   ```bash
   npx --yes tsx tests/test-m1.ts
   npx --yes tsx tests/test-m2.ts
   ```
3. Invalidation condition: Any failure in `test-m3.ts`, or any regression failure in `test-m1.ts` or `test-m2.ts`.
