# Milestone 3 Technical Investigation Report: Authentication & Session Revocation (SEC-04, SEC-05)

**Agent**: `m3_explorer_2`  
**Working Directory**: `/home/sankobite/.gemini/antigravity/worktrees/QuizWeb/security_audit_session_management/.agents/teamwork/m3_explorer_2`  
**Milestone**: Milestone 3 (F-10, F-11, F-12, F-13)  
**Security Standards**: OWASP ASVS v4.0.3 Chapter 3 (V3.1.1, V3.2.1, V3.3.1, V3.3.3, V3.5.3, V3.6.1)

---

## 1. Observation

### 1.1 Existing Codebase Implementation

1. **`auth.ts:10-73` (Credentials Authorize & User Construction)**:
   ```ts
   // auth.ts:45-51
   const [rows] = await db.query<RowDataPacket[]>(
       `SELECT a.user_id, a.email, a.password_hash, a.user_role, p.username 
       FROM user_auth_tbl a 
       LEFT JOIN player_tbl p ON a.user_id = p.user_id 
       WHERE a.email = ? LIMIT 1`,
       [email]
   );
   ```
   *Direct Observation*: `a.token_version` is NOT queried in `authorize`. The returned user object (lines 64-70) only includes `id`, `email`, `name`, `role`, and `user_role`. It completely lacks `tokenVersion` or `token_version`.

2. **`auth.ts:76-133` (OAuth `signIn` Callback & SEC-04 Vulnerability)**:
   ```ts
   // auth.ts:82-85
   const [existingUser] = await db.query<RowDataPacket[]>(
       "SELECT user_id, user_role FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1 LIMIT 1",
       [user.email]
   );
   ...
   // auth.ts:108-118
   const [existingOAuth] = await db.query<RowDataPacket[]>(
       "SELECT oauth_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
       [account.provider, account.providerAccountId]
   );

   if (existingOAuth.length === 0) {
       await db.query(
           "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
           [userId, account.provider, account.providerAccountId]
       );
   }
   ```
   *Direct Observation*: If `existingUser` exists (an unlinked local account with matching email), and `existingOAuth.length === 0`, `auth.ts` automatically executes `INSERT INTO user_oauth_tbl` linking the OAuth identity to `existingUser[0].user_id` without verifying whether the user initiated this request from an active, authenticated session. This enables an unauthenticated attacker to take over any local account by creating a Google/GitHub account with the victim's email.

3. **`auth.ts:134-153` (`jwt` and `session` Callbacks & SEC-05 Deficiency)**:
   ```ts
   // auth.ts:134-142
   async jwt({ token, user }) {
       if (user) {
           token.id = user.id;
           const u = user as { role?: string; user_role?: string };
           token.role = u.role || u.user_role || "user";
           token.user_role = u.user_role || u.role || "user";
       }
       return token;
   },
   // auth.ts:143-152
   async session({ session, token }) {
       if (token && session.user) {
           session.user.id = token.id as string;
           const t = token as { role?: string; user_role?: string };
           const s = session.user as { id?: string; role?: string; user_role?: string };
           s.role = t.role || t.user_role || "user";
           s.user_role = t.user_role || t.role || "user";
       }
       return session;
   }
   ```
   *Direct Observation*: Neither `jwt` nor `session` handles `tokenVersion`. The `session` callback executes ZERO database queries against `user_auth_tbl.token_version`. A JWT token issued to a user remains unconditionally valid for its entire 30-day lifespan, regardless of password changes, account revocation, or logouts.

4. **`app/actions/auth.ts:685-693` (Password Reset `resetPass`)**:
   ```ts
   // app/actions/auth.ts:689-692
   await db.query(
       "UPDATE user_auth_tbl SET password_hash = ? WHERE user_id = ?",
       [hashed, userId]
   );
   ```
   *Direct Observation*: Upon resetting a password with valid OTP, only `password_hash` is updated. `token_version` in `user_auth_tbl` is NOT incremented. Consequently, any active JWTs held by attackers or on compromised devices continue to function.

5. **`app/home/page.tsx:31-34` and Sign-Out Handling**:
   ```ts
   async function handleSignOut() {
       "use server";
       await signOut({ redirectTo: "/login" });
   }
   ```
   *Direct Observation*: Default Next-Auth `signOut` clears the browser session cookie but leaves the signed JWT valid on the server side. No server-side revocation or `token_version` increment occurs.

6. **`node_modules/@auth/core/src/lib/actions/session.ts:42-89` (Auth.js v5 Beta Internals)**:
   ```ts
   const token = await callbacks.jwt({
       token: payload,
       ...(isUpdate && { trigger: "update" }),
       session: newSession,
   });
   ...
   if (token !== null) {
       const session = {
           user: { name: token.name, email: token.email, image: token.picture },
           expires: newExpires.toISOString(),
       };
       const newSession = await callbacks.session({ session, token });
       response.body = newSession;
       ...
   } else {
       response.cookies?.push(...sessionStore.clean());
   }
   ```
   *Direct Observation*: In Auth.js v5 beta (`next-auth@5.0.0-beta.32`), if `callbacks.session` returns `null`, `response.body` is `null`. NextAuth's `parseSessionResponse` in `next-auth/src/lib/index.ts:112` (`return (await response.json()) satisfies Session | null`) resolves to `null`. Therefore, returning `null` from `callbacks.session` completely invalidates the session for `auth()`. Furthermore, if `callbacks.jwt` returns `null`, Auth.js automatically executes `sessionStore.clean()` and purges client cookies.

7. **`node_modules/@auth/core/src/lib/actions/signout.ts:23-26` (`events.signOut` Hook)**:
   ```ts
   if (session.strategy === "jwt") {
       const salt = options.cookies.sessionToken.name;
       const token = await jwt.decode({ ...jwt, token: sessionToken, salt });
       await events.signOut?.({ token });
   }
   ```
   *Direct Observation*: Auth.js v5 decodes the JWT and invokes `events.signOut({ token })` on every sign-out invocation before cleaning cookies.

8. **`middleware.ts:1-55` & Runtime Context**:
   `middleware.ts` imports `auth` from `@/auth` and wraps the middleware handler:
   `export const middleware = auth(async function middleware(req) { ... })`.
   In Next.js, `middleware.ts` runs inside the Edge runtime where TCP sockets (`mysql2`) are unsupported. Running raw `mysql2` queries inside Edge middleware causes runtime socket errors. In contrast, Server Components, Server Actions, Route Handlers, and standalone verification test scripts (`tsx`) run in the Node.js runtime.

---

## 2. Logic Chain

1. **Vulnerability Root Cause Analysis (SEC-05)**:
   - *Premise*: Next-Auth uses stateless JWTs signed with `AUTH_SECRET` expiring after 30 days.
   - *Observation*: `auth.ts` does not check the database in `session` callback (Observation 1.3). `resetPass` does not update `token_version` (Observation 1.4). `signOut` does not invalidate the server state (Observation 1.5).
   - *Deduction*: When an attacker obtains a user's JWT, or when a user changes their password after an account compromise, the old JWT remains active until natural expiration.
   - *Resolution*:
     - During sign-in (`authorize` and OAuth `signIn`), attach `user.tokenVersion = dbUser.token_version ?? 1`.
     - In `callbacks.jwt`: persist `token.tokenVersion = user.tokenVersion`.
     - In `callbacks.session`: query `SELECT token_version FROM user_auth_tbl WHERE user_id = ?`. If `dbUser.token_version !== token.tokenVersion`, return `null`.
     - In `resetPass`: execute `UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?`.
     - In `events.signOut` (and `signOutAction`): execute `UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?`.

2. **Vulnerability Root Cause Analysis (SEC-04)**:
   - *Premise*: OAuth providers (Google, GitHub) return verified or unverified emails.
   - *Observation*: `auth.ts:108-118` blindly links any OAuth account to an existing `user_auth_tbl` record matching `user.email` (Observation 1.2).
   - *Deduction*: An attacker who registers an OAuth account with the email of an existing QuizWeb user automatically gains full access to the victim's account without password authentication (Account Takeover).
   - *Resolution*:
     - If `existingUser` exists in `user_auth_tbl`:
       - Check `user_oauth_tbl` for `provider_name` and `provider_account_id` matching `existingUser[0].user_id`.
       - If already linked: allow sign-in (`return true`).
       - If NOT linked: check if the request originated from an active, authenticated session for `existingUser[0].user_id`.
       - If no active session or session user ID mismatch: REJECT (`return false`).
       - If active session matches `existingUser[0].user_id`: allow explicit linking (`INSERT INTO user_oauth_tbl`, `return true`).

3. **Edge / Middleware vs Node.js Runtime Resolution**:
   - *Premise*: Next.js App Router executes middleware in the Edge runtime, whereas Server Actions, Server Components, Route Handlers, and `tests/test-m3.ts` execute in the Node.js runtime.
   - *Observation*: `lib/db.ts` uses `mysql2/promise`, which relies on Node.js `net` sockets (Observation 1.8).
   - *Deduction*: In `callbacks.session`:
     - If executing in the Edge runtime (`typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge"`), `db.query` cannot open a TCP connection to MySQL. Attempting to do so would crash middleware.
     - Therefore, in Edge runtime, `callbacks.session` should safely passthrough or rely on JWT claims, while the strict DB `token_version` check runs in the Node.js runtime where all protected data, Server Actions, Server Components, and Route Handlers reside.
     - In `tests/test-m3.ts`, execution runs in Node.js (`process.env.NEXT_RUNTIME` is undefined), ensuring 100% of the session database validation logic is directly exercised.

4. **OWASP ASVS v4.0.3 Chapter 3 Mapping**:
   - **V3.1.1 (Session Management)**: State changes cannot be triggered via GET; session tokens are confidential.
   - **V3.2.1 (Session Binding)**: Session tokens strictly bound to verified DB identity; cross-account OAuth injection blocked (SEC-04).
   - **V3.3.1 (Session Revocation)**: Revocation invalidates the session token immediately across all subsequent requests via DB `token_version` check (SEC-05).
   - **V3.3.3 (Password Change Invalidation)**: `resetPass` increments `token_version`, invalidating all existing sessions across devices (SEC-05).
   - **V3.5.3 (Logout Revocation)**: Server-side revocation on sign-out via `events.signOut` / `signOutAction` incrementing `token_version` (SEC-05).
   - **V3.6.1 (Federated Account Linking)**: Federated OAuth identities cannot be bound to existing accounts without prior authentication (SEC-04).

---

## 3. Caveats

1. **Database Load on Session Checks**:
   - Validating `token_version` on every `callbacks.session` call issues one lightweight single-row query (`SELECT token_version, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1`) indexed by primary key `user_id`. For high-throughput production environments, this can optionally be cached in Redis with a short TTL (e.g. 5–15 seconds); for QuizWeb's architecture, direct MySQL primary key queries with MySQL connection pool connection limits are optimal and compliant with ASVS Level 2/3.
2. **Next.js Worktree Symlink in Turbopack**:
   - In git worktrees, `node_modules` symlinks outside root cause Turbopack warnings during full builds. Tests run cleanly via `npx --yes tsx tests/test-m3.ts`.
3. **Session Parameter Type Extension in Auth.js**:
   - Custom session properties (`tokenVersion`, `user_role`) require TypeScript module augmentation in `auth.ts` or type casting (`session.user as ...`) to maintain clean compilations.

---

## 4. Conclusion & Technical Implementation Plan

### 4.1 Target Changes for `auth.ts`

1. **`authorize`**:
   - Query `a.token_version` from `user_auth_tbl`.
   - Return `{ id: String(user.user_id), email: user.email, name: user.username, role: user.user_role || "user", user_role: user.user_role || "user", tokenVersion: user.token_version ?? 1 }`.

2. **`callbacks.signIn` (SEC-04 Implementation)**:
   - When OAuth provider (`google` or `github`):
     - Query `SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1 LIMIT 1`.
     - **If new user** (`existingUser.length === 0`):
       - Insert into `user_auth_tbl` with `token_version = 1`.
       - Insert into `player_tbl`.
       - Insert into `user_oauth_tbl`.
       - Set `user.id`, `user.role`, `user.tokenVersion = 1`, return `true`.
     - **If existing user** (`existingUser.length > 0`):
       - Query `user_oauth_tbl` for `(provider_name = ?, provider_account_id = ?, user_id = ?)`.
       - **If already linked**: return `true`.
       - **If not linked**:
         - Resolve active authenticated session user ID:
           ```ts
           let activeUserId: string | null = null;
           if ((params as any)?.activeSession?.user?.id) {
               activeUserId = String((params as any).activeSession.user.id);
           } else {
               try {
                   const { cookies } = await import("next/headers");
                   const cookieStore = await cookies();
                   const sessionToken = cookieStore.get("__Secure-authjs.session-token")?.value || cookieStore.get("authjs.session-token")?.value;
                   if (sessionToken) {
                       const { decode } = await import("next-auth/jwt");
                       const decoded = await decode({
                           token: sessionToken,
                           secret: process.env.AUTH_SECRET!,
                           salt: sessionToken.startsWith("__Secure-") ? "__Secure-authjs.session-token" : "authjs.session-token",
                       });
                       activeUserId = decoded?.id ? String(decoded.id) : (decoded?.sub ? String(decoded.sub) : null);
                   }
               } catch {
                   // Outside request scope
               }
           }
           ```
         - If `!activeUserId || activeUserId !== String(existingUser[0].user_id)`:
           - Return `false` (blocks unauthenticated linking).
         - If `activeUserId === String(existingUser[0].user_id)`:
           - Insert into `user_oauth_tbl` and return `true`.

3. **`callbacks.jwt`**:
   - In `jwt({ token, user })`:
     - If `user`: populate `token.tokenVersion = (user as any).tokenVersion ?? (user as any).token_version ?? 1`.
     - Return `token`.

4. **`callbacks.session` (SEC-05 Implementation)**:
   - In `session({ session, token })`:
     - Extract `userId = (token.id || token.sub) as string`.
     - If `!userId`: return `null`.
     - Check runtime: if `typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge"`, return `session`.
     - In Node.js runtime:
       ```ts
       const [rows] = await db.query<RowDataPacket[]>(
           "SELECT token_version, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
           [userId]
       );
       if (rows.length === 0) return null; // Deleted or deactivated user
       const dbVersion = rows[0].token_version ?? 1;
       const jwtVersion = (token.tokenVersion ?? (token as any).token_version) ?? 1;
       if (dbVersion !== jwtVersion) {
           return null; // Session revoked!
       }
       session.user.id = userId;
       session.user.role = rows[0].user_role || token.role || "user";
       (session as any).tokenVersion = dbVersion;
       return session;
       ```

5. **`events.signOut`**:
   - In `events.signOut({ token })`:
     ```ts
     const userId = token?.id || token?.sub;
     if (userId) {
         await db.query(
             "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
             [userId]
         );
     }
     ```

6. **Export `authConfig`**:
   - Export `authConfig` alongside `NextAuth(authConfig)` so that callbacks can be directly tested and verified in `tests/test-m3.ts`.

### 4.2 Target Changes for `app/actions/auth.ts`

1. **`resetPass`**:
   - Update line 690:
     ```ts
     await db.query(
         "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
         [hashed, userId]
     );
     ```
2. **`signOutAction`**:
   - Export `signOutAction`:
     ```ts
     export async function signOutAction() {
         const session = await auth();
         if (session?.user?.id) {
             await db.query(
                 "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
                 [session.user.id]
             );
         }
         await signOut({ redirectTo: "/login" });
     }
     ```

---

## 5. Verification Method

### 5.1 Standalone Test Harness Design: `tests/test-m3.ts`

The test harness must execute with `npx --yes tsx tests/test-m3.ts` and verify:

| Suite | Target | Test Cases |
|-------|--------|------------|
| **Suite 1: Architecture & Configuration** | SEC-04/05 | - `auth.ts` exports `handlers`, `auth`, `signIn`, `signOut`, `authConfig`<br>- `authConfig.callbacks` defines `signIn`, `jwt`, `session`<br>- `authConfig.events` defines `signOut` |
| **Suite 2: Session Revocation (SEC-05)** | SEC-05 / ASVS 3.3.1 | - T2.1: Valid session established when `token.tokenVersion === dbUser.token_version`<br>- T2.2: Session callback returns `null` when `token.tokenVersion !== dbUser.token_version`<br>- T2.3: New JWT with matching incremented version restores valid session |
| **Suite 3: Invalidation Triggers** | SEC-05 / ASVS 3.3.3, 3.5.3 | - T3.1: Password reset (`resetPass`) increments `token_version` in `user_auth_tbl`<br>- T3.2: Replaying pre-reset JWT after `resetPass` returns `null`<br>- T3.3: Sign-out (`events.signOut` / `signOutAction`) increments `token_version`<br>- T3.4: Replaying pre-signout JWT after logout returns `null` |
| **Suite 4: OAuth Account Linking (SEC-04)** | SEC-04 / ASVS 3.2.1, 3.6.1 | - T4.1: Fresh email registration via OAuth succeeds and inserts into `user_oauth_tbl`<br>- T4.2: Returning linked OAuth user succeeds without active session<br>- T4.3: Unauthenticated OAuth attempt against existing local email is BLOCKED (`returns false`, 0 rows inserted)<br>- T4.4: Authenticated user linking target account succeeds (`returns true`, row inserted)<br>- T4.5: Cross-user session impersonation attempt (active session ID !== target ID) is BLOCKED |
| **Suite 5: Adversarial Stress Vectors** | Robustness / ASVS Ch. 3 | - T5.1: Token version tampering without secret is rejected by JWT verification<br>- T5.2: Missing or non-numeric `tokenVersion` (`null`, `undefined`, `"1"`, `NaN`) fails closed<br>- T5.3: Non-existent / deleted user ID in JWT payload fails closed (`returns null`)<br>- T5.4: OAuth provider confusion (same provider account ID across different providers) does not bypass check<br>- T5.5: Concurrent `token_version` increments preserve strict monotonic order |
| **Suite 6: Regression Guard** | M1 & M2 Zero Regression | - `tests/test-m1.ts` passes (13/13)<br>- `tests/test-m2.ts` passes (31/31) |

### 5.2 Independent Verification Command

```bash
# 1. Run Milestone 1 tests
npx --yes tsx tests/test-m1.ts

# 2. Run Milestone 2 tests
npx --yes tsx tests/test-m2.ts

# 3. Run Milestone 3 tests
npx --yes tsx tests/test-m3.ts
```

### 5.3 Invalidation Conditions
- If `callbacks.session` returns an active session when `db.token_version !== token.tokenVersion`.
- If an unauthenticated OAuth request can link to an existing email without an active session.
- If `resetPass` does not increment `token_version`.
- If `tests/test-m1.ts` or `tests/test-m2.ts` regressions occur.
