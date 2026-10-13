# Milestone 3 Technical Investigation & Implementation Plan (SEC-04, SEC-05)

## 1. Observation

### 1.1 `auth.ts` NextAuth Configuration & Session Strategy
- **File**: `auth.ts:10-72`
  - NextAuth is initialized as `export const { handlers, auth, signIn, signOut } = NextAuth({ secret: process.env.AUTH_SECRET, session: { strategy: "jwt" }, providers: [...] })`.
  - In `authorize(credentials)` (`auth.ts:45-52`), the query only selects:
    ```typescript
    SELECT a.user_id, a.email, a.password_hash, a.user_role, p.username 
    FROM user_auth_tbl a 
    LEFT JOIN player_tbl p ON a.user_id = p.user_id 
    WHERE a.email = ? LIMIT 1
    ```
    `a.token_version` is NOT selected, nor returned in the user object (`auth.ts:65-70`).
- **File**: `auth.ts:134-153`
  - In `callbacks.jwt({ token, user })`:
    ```typescript
    if (user) {
        token.id = user.id;
        const u = user as { role?: string; user_role?: string };
        token.role = u.role || u.user_role || "user";
        token.user_role = u.user_role || u.role || "user";
    }
    return token;
    ```
    No `tokenVersion` or `token_version` property is attached to the JWT payload.
  - In `callbacks.session({ session, token })`:
    ```typescript
    if (token && session.user) {
        session.user.id = token.id as string;
        const t = token as { role?: string; user_role?: string };
        const s = session.user as { id?: string; role?: string; user_role?: string };
        s.role = t.role || t.user_role || "user";
        s.user_role = t.user_role || t.role || "user";
    }
    return session;
    ```
    No database lookup is performed against `user_auth_tbl` to verify `token_version`. A 30-day JWT remains valid until expiration even after password reset or logout (violating ASVS 3.1.1, 3.3.1, 3.3.3, 3.5.3).

### 1.2 Auth.js v5 Beta Internal Session Termination Mechanics
- **Package**: `@auth/core@0.34.2` & `next-auth@5.0.0-beta.32`
- **File**: `node_modules/@auth/core/lib/actions/session.js:28-56`
  ```javascript
  const token = await callbacks.jwt({
      token: payload,
      ...(isUpdate && { trigger: "update" }),
      session: newSession,
  });
  const newExpires = fromDate(sessionMaxAge);
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
  - When `callbacks.jwt` returns `null`, `@auth/core` executes `response.cookies?.push(...sessionStore.clean())`, injecting a cookie deletion header:
    `authjs.session-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`.
  - Furthermore, `response.body` remains `null`.
- **File**: `node_modules/next-auth/lib/index.js:22-33`
  ```javascript
  async session(...args) {
      const session = 
      (await config.callbacks?.session?.(...args)) ?? {
          ...args[0].session,
          expires: args[0].session.expires?.toISOString?.() ??
              args[0].session.expires,
      };
      const user = args[0].user ?? args[0].token;
      return { user, ...session };
  }
  ```
  - In `next-auth`'s wrapper for React Server Components `auth()` and middleware `auth(req)`, `getSession` wraps `callbacks.session`. If `callbacks.session` returns `null` while `token` is non-null, the nullish coalescing operator `??` falls back to the default session and assigns `user = args[0].token`, causing `auth()` to return a truthy session!
  - **Empirically verified via node test**: When `callbacks.jwt` returns `null`, `token` is `null`, `@auth/core` immediately terminates the session, cleans the session cookie (`Max-Age=0`), and `auth()` returns `null`.
  - Conversely, for direct unit tests invoking `callbacks.session({ session, token })`, returning `null` from `callbacks.session` is also expected by interface contracts.
  - Therefore, both `callbacks.jwt` and `callbacks.session` must execute the `token_version` check and return `null` on version mismatch.

### 1.3 `resetPass` Password Reset Token Version Handling
- **File**: `app/actions/auth.ts:688-698`
  ```typescript
  // Hash the new pass
  const hashed = await argon2.hash(newPassword);

  // Update
  await db.query(
      "UPDATE user_auth_tbl SET password_hash = ? WHERE user_id = ?",
      [hashed, userId]
  );

  // Invalidate all OTPs for this user
  await db.query(
      "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ?",
      [userId, "password_reset"]
  );
  ```
  - `user_auth_tbl` is updated with `password_hash = ?`, but `token_version` is NOT incremented.
  - Active sessions on other devices remain completely valid after a password reset (SEC-05 violation).

### 1.4 Signout & Logout Token Version Handling
- **File**: `app/home/page.tsx:31-34`
  ```typescript
  async function handleSignOut() {
      "use server";
      await signOut({ redirectTo: "/login" });
  }
  ```
- **File**: `node_modules/@auth/core/lib/actions/signout.js:15-19`
  ```javascript
  if (session.strategy === "jwt") {
      const salt = options.cookies.sessionToken.name;
      const token = await jwt.decode({ ...jwt, token: sessionToken, salt });
      await events.signOut?.({ token });
  }
  ```
  - NextAuth's `signOut()` action deletes client cookies, but does NOT invalidate the underlying JWT on the database side.
  - Any previously extracted JWT remains valid for up to 30 days.
  - `auth.ts` currently defines no `events.signOut` handler, and `app/actions/auth.ts` lacks a dedicated server action that updates `token_version`.

### 1.5 `auth.ts:callbacks.signIn` OAuth Account Linking Vulnerability
- **File**: `auth.ts:76-133`
  ```typescript
  // 1. Check if user already exists in user_auth_tbl and is verified
  const [existingUser] = await db.query<RowDataPacket[]>(
      "SELECT user_id, user_role FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1 LIMIT 1",
      [user.email]
  );
  ...
  // 2. Link OAuth connection in user_oauth_tbl
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
  - If a user registered with local credentials (`email: user@domain.com`), an unauthenticated attacker presenting a Google or GitHub account with `user@domain.com` is automatically linked to the existing user's `userId`, granting full account access without requiring authentication or password verification (SEC-04 violation / ASVS 3.2.1, 3.6.1).

---

## 2. Logic Chain

1. **Root Cause Analysis for SEC-05**:
   - `user_auth_tbl.token_version` was created in Milestone 1 (`migrations/002_security_hardening.sql`) with `INT NOT NULL DEFAULT 1`.
   - `auth.ts` does not select `token_version` in `authorize()` and does not include it in `token.tokenVersion`.
   - Therefore, neither `jwt` callback nor `session` callback compares the incoming token's version against the database record.
   - Even when password reset or logout occurs, the database record's `token_version` remains untouched or unverified, allowing stale/stolen JWTs to retain full authorization for the entire 30-day lifetime.

2. **Revocation Flow Architecture**:
   - At Login (`authorize()` & OAuth `signIn`):
     - Select `a.token_version` from `user_auth_tbl`.
     - Pass `tokenVersion: user.token_version ?? 1` to the returned user object.
   - At Token Generation (`jwt` callback on `trigger === "signIn"`):
     - Attach `token.tokenVersion = user.tokenVersion ?? 1`.
   - On Every Request (`jwt` & `session` callbacks):
     - Query `SELECT token_version, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1` using `token.id || token.sub`.
     - If user does not exist OR `rows[0].token_version !== token.tokenVersion`:
       - In `jwt`: return `null`. This prompts `@auth/core` to purge session cookies via `Max-Age=0` and sets `response.body = null`.
       - In `session`: return `null as any`. This guarantees compliance with direct contract callers.
       - Result: Middleware sees `req.auth = null` and redirects to `/login`. RSC `auth()` returns `null`. Revocation is immediate.
   - On Password Reset (`resetPass`):
     - Update query:
       ```sql
       UPDATE user_auth_tbl 
       SET password_hash = ?, token_version = token_version + 1 
       WHERE user_id = ?
       ```
     - Instantly invalidates all tokens previously issued across all user devices.
   - On Logout (`events.signOut` & `handleSignOut` / server action):
     - In NextAuth `events: { async signOut(message) { ... } }`:
       - Extract `userId = message.token?.id || message.token?.sub`.
       - Execute `UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?`.
     - In `app/home/page.tsx:handleSignOut` (and optional `app/actions/auth.ts:logoutUser`):
       - Increment `token_version` for the current `session.user.id` prior to `signOut()`.

3. **Root Cause Analysis & Architecture for SEC-04**:
   - When OAuth sign-in (`google`, `github`) occurs, `callbacks.signIn` checks if `user.email` matches an existing record in `user_auth_tbl`.
   - To prevent account takeover, the callback must differentiate three distinct scenarios:
     1. **Case A: Returning OAuth User**: An existing record exists in `user_oauth_tbl` with `(provider_name, provider_account_id)`. Allow sign-in (`return true`).
     2. **Case B: Unlinked Existing Local Email**: `user_auth_tbl` has an account for `user.email`, but `user_oauth_tbl` has no link for this provider.
        - Check for an active, authenticated session using `getActiveSessionUser()`.
        - If NO active session exists OR the active session's `userId` does not match `existingUser.user_id`:
          - Reject sign-in immediately (`return false`).
          - Block automatic linking to prevent pre-hijacking and account takeover.
        - If an active session exists AND matches `existingUser.user_id`:
          - The user is already logged in and intentionally connecting an OAuth provider.
          - Insert into `user_oauth_tbl` and `return true`.
     3. **Case C: New User**: Neither `user_oauth_tbl` nor `user_auth_tbl` has a record for this email.
        - Insert into `user_auth_tbl` (`token_version = 1`, `is_email_verified = 1`), `player_tbl`, and `user_oauth_tbl`. Allow sign-in (`return true`).

4. **Session Extraction Mechanics for Account Linking**:
   - `getActiveSessionUser()` reads cookies via `cookies()` and fallback `headers()` from `next/headers`.
   - Decodes the session token using `decode` from `next-auth/jwt` with `process.env.AUTH_SECRET` and appropriate salt (`authjs.session-token` or `__Secure-authjs.session-token`).
   - Validates that the active session token's `tokenVersion` matches the current `token_version` in `user_auth_tbl` (preventing revoked sessions from authorizing links).

---

## 3. Caveats

1. **Auth.js v5 Beta Callback Signature Constraints**:
   - In NextAuth v5 beta, `callbacks.session` typing defines `session: Session`, but returning `null` or a session with `user: null` requires type casting (`null as any` or custom interface extension).
2. **Cookie Prefixing in HTTPS vs HTTP**:
   - NextAuth applies the `__Secure-` prefix to session cookies when the protocol is HTTPS or `x-forwarded-proto === 'https'`, but uses `authjs.session-token` in local HTTP development. The session decoding helper must inspect both cookie keys.
3. **Multi-device Logout Considerations**:
   - Incrementing `token_version` revokes ALL active sessions globally across all devices. This fulfills ASVS 3.3.1 and 3.3.3 requirements for security-hardened session termination. Single-device logout without revoking other sessions would require a stateful session table (which is not part of this architecture).
4. **Database Connection in Callbacks**:
   - `jwt` and `session` callbacks are invoked on every session verification request. Querying `user_auth_tbl` adds a fast indexed primary key query (`WHERE user_id = ? LIMIT 1`). This is the standard pattern for stateless JWT revocation in high-security applications.

---

## 4. Conclusion

Milestone 3 technical implementation requires modifications strictly across:
1. `auth.ts`:
   - Include `a.token_version` in `authorize()` database query and return in user object.
   - Add `events: { async signOut(message) { ... } }` to increment `token_version` on signout.
   - Update `callbacks.jwt`: attach `token.tokenVersion` on sign-in; query DB on subsequent calls and return `null` if `tokenVersion !== dbUser.token_version`.
   - Update `callbacks.session`: query DB and return `null` if `tokenVersion !== dbUser.token_version`.
   - Update `callbacks.signIn`: check `user_oauth_tbl` first. If email exists in `user_auth_tbl` but is unlinked, enforce `getActiveSessionUser()` check. Block linking (`return false`) if unauthenticated.
2. `app/actions/auth.ts`:
   - In `resetPass`: modify SQL query to increment `token_version = token_version + 1` alongside `password_hash = ?`.
   - Provide `logoutUser()` server action exporting safe logout that increments `token_version`.
3. `app/home/page.tsx`:
   - Update `handleSignOut` to increment `token_version` in `user_auth_tbl` for the authenticated user before executing `signOut()`.
4. `tests/test-m3.ts`:
   - Authored standalone test verification script covering all SEC-04 and SEC-05 criteria.

---

## 5. Proposed Code Changes

### 5.1 Proposed Diff for `auth.ts`
```typescript
// Proposed helper in auth.ts
async function getActiveSessionUser(): Promise<{ id: string; email?: string } | null> {
    try {
        const { cookies, headers } = await import("next/headers");
        const { decode } = await import("next-auth/jwt");
        let sessionToken: string | undefined;
        let isSecure = false;

        try {
            const cookieStore = await cookies();
            const secureCookie = cookieStore.get("__Secure-authjs.session-token");
            const standardCookie = cookieStore.get("authjs.session-token");
            if (secureCookie?.value) {
                sessionToken = secureCookie.value;
                isSecure = true;
            } else if (standardCookie?.value) {
                sessionToken = standardCookie.value;
            }
        } catch {
            // cookies() not available in current scope
        }

        if (!sessionToken) {
            try {
                const headerList = await headers();
                const cookieHeader = headerList.get("cookie") || "";
                const cookiesParsed = Object.fromEntries(
                    cookieHeader.split("; ").map((c) => {
                        const [k, ...v] = c.split("=");
                        return [k.trim(), v.join("=")];
                    })
                );
                if (cookiesParsed["__Secure-authjs.session-token"]) {
                    sessionToken = cookiesParsed["__Secure-authjs.session-token"];
                    isSecure = true;
                } else if (cookiesParsed["authjs.session-token"]) {
                    sessionToken = cookiesParsed["authjs.session-token"];
                }
            } catch {
                // headers() not available in current scope
            }
        }

        if (!sessionToken || !process.env.AUTH_SECRET) return null;

        const decoded = await decode({
            token: sessionToken,
            secret: process.env.AUTH_SECRET,
            salt: isSecure ? "__Secure-authjs.session-token" : "authjs.session-token",
        });

        const userId = decoded?.id || decoded?.sub;
        if (!userId) return null;

        const [rows] = await db.query<RowDataPacket[]>(
            "SELECT token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
            [userId]
        );
        if (rows.length === 0) return null;
        if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== rows[0].token_version) {
            return null;
        }

        return { id: String(userId), email: decoded.email as string | undefined };
    } catch {
        return null;
    }
}
```

```typescript
// Proposed updates to auth.ts callbacks and events:
export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" },
    providers: [
        Google,
        Github({
            clientId: process.env.AUTH_GITHUB_ID!,
            clientSecret: process.env.AUTH_GITHUB_SECRET!,
        }),
        Credentials({
            name: "credentials",
            credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
            async authorize(credentials) {
                // ...
                const [rows] = await db.query<RowDataPacket[]>(
                    `SELECT a.user_id, a.email, a.password_hash, a.user_role, a.token_version, p.username 
                    FROM user_auth_tbl a 
                    LEFT JOIN player_tbl p ON a.user_id = p.user_id 
                    WHERE a.email = ? LIMIT 1`,
                    [email]
                );
                const user = rows[0];
                if (!user || !user.password_hash) return null;
                const valid = await argon2.verify(user.password_hash, password);
                if (!valid) return null;

                return {
                    id: String(user.user_id),
                    email: user.email,
                    name: user.username,
                    role: user.user_role || "user",
                    user_role: user.user_role || "user",
                    tokenVersion: user.token_version ?? 1,
                };
            },
        }),
    ],
    events: {
        async signOut(message) {
            if ("token" in message && message.token) {
                const userId = message.token.id || message.token.sub;
                if (userId) {
                    await db.query(
                        "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
                        [userId]
                    );
                }
            }
        },
    },
    callbacks: {
        async signIn({ user, account }) {
            if ((account?.provider === "google" || account?.provider === "github") && user.email) {
                try {
                    // 1. Check if OAuth account is already linked
                    const [existingOAuth] = await db.query<RowDataPacket[]>(
                        "SELECT user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
                        [account.provider, account.providerAccountId]
                    );

                    let userId: number;
                    if (existingOAuth.length > 0) {
                        userId = existingOAuth[0].user_id;
                        const [userRow] = await db.query<RowDataPacket[]>(
                            "SELECT user_role, token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
                            [userId]
                        );
                        user.id = String(userId);
                        (user as any).tokenVersion = userRow[0]?.token_version ?? 1;
                        (user as any).role = userRow[0]?.user_role || "user";
                        (user as any).user_role = userRow[0]?.user_role || "user";
                        return true;
                    }

                    // 2. Check if an account with this email already exists
                    const [existingUser] = await db.query<RowDataPacket[]>(
                        "SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ? LIMIT 1",
                        [user.email]
                    );

                    if (existingUser.length > 0) {
                        // Existing email: MUST verify active authenticated session to link (SEC-04)
                        const activeUser = await getActiveSessionUser();
                        if (!activeUser || String(activeUser.id) !== String(existingUser[0].user_id)) {
                            console.warn(`[SEC-04] Blocked unauthenticated OAuth linking attempt for email: ${user.email}`);
                            return false;
                        }

                        userId = existingUser[0].user_id;
                        await db.query(
                            "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
                            [userId, account.provider, account.providerAccountId]
                        );

                        user.id = String(userId);
                        (user as any).tokenVersion = existingUser[0].token_version ?? 1;
                        (user as any).role = existingUser[0].user_role || "user";
                        (user as any).user_role = existingUser[0].user_role || "user";
                        return true;
                    }

                    // 3. Brand new user registration via OAuth
                    const [authResult] = await db.query<ResultSetHeader>(
                        "INSERT INTO user_auth_tbl (email, is_email_verified, token_version) VALUES (?, 1, 1)",
                        [user.email]
                    );
                    userId = authResult.insertId;

                    await db.query(
                        "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
                        [userId, user.name || `player_${userId}`]
                    );

                    await db.query(
                        "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
                        [userId, account.provider, account.providerAccountId]
                    );

                    user.id = String(userId);
                    (user as any).tokenVersion = 1;
                    (user as any).role = "user";
                    (user as any).user_role = "user";
                    return true;
                } catch (error) {
                    console.error("Database error during OAuth sign-in:", error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                const u = user as { role?: string; user_role?: string; tokenVersion?: number };
                token.role = u.role || u.user_role || "user";
                token.user_role = u.user_role || u.role || "user";
                token.tokenVersion = u.tokenVersion ?? 1;
                return token;
            }

            // Revocation check on subsequent requests (SEC-05)
            const userId = token.id || token.sub;
            if (!userId) return null;

            const [rows] = await db.query<RowDataPacket[]>(
                "SELECT token_version, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
                [userId]
            );
            if (rows.length === 0) return null;

            const currentVersion = rows[0].token_version ?? 1;
            if (token.tokenVersion !== currentVersion) {
                return null; // Terminate session & trigger cookie clean
            }

            if (rows[0].user_role) {
                token.role = rows[0].user_role;
                token.user_role = rows[0].user_role;
            }
            return token;
        },
        async session({ session, token }) {
            if (!token || !session?.user) return null as any;

            const userId = token.id || token.sub;
            if (!userId) return null as any;

            const [rows] = await db.query<RowDataPacket[]>(
                "SELECT token_version, user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
                [userId]
            );
            if (rows.length === 0) return null as any;

            const currentVersion = rows[0].token_version ?? 1;
            if (token.tokenVersion !== currentVersion) {
                return null as any; // Terminate session
            }

            session.user.id = String(userId);
            const t = token as { role?: string; user_role?: string };
            const s = session.user as { id?: string; role?: string; user_role?: string };
            s.role = t.role || t.user_role || rows[0].user_role || "user";
            s.user_role = t.user_role || t.role || rows[0].user_role || "user";
            return session;
        },
    },
});
```

### 5.2 Proposed Update for `app/actions/auth.ts:resetPass`
```typescript
        // Hash the new pass
        const hashed = await argon2.hash(newPassword);

        // Update password AND increment token_version to revoke active sessions (SEC-05)
        await db.query(
            "UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1 WHERE user_id = ?",
            [hashed, userId]
        );

        // Invalidate all OTPs for this user
        await db.query(
            "UPDATE user_otp_tbl SET is_used = 1 WHERE user_id = ? AND purpose = ?",
            [userId, "password_reset"]
        );
```

### 5.3 Proposed Update for `app/home/page.tsx:handleSignOut`
```typescript
    async function handleSignOut() {
        "use server";
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

## 6. Verification Method

### 6.1 Test Suite Structure for `tests/test-m3.ts`
The test verification harness `tests/test-m3.ts` must contain 6 distinct suites:
1. **Suite 1: Environment & Mock Setup**:
   - Worktree `node_modules` junction resolution.
   - Mocking `next/headers` and `next/navigation` (`redirect`).
   - Mocking Resend email dispatch.
   - `db.query` interceptor harness.
2. **Suite 2: Static Schema & Contract Verification**:
   - Verify `002_security_hardening.sql` defines `token_version INT NOT NULL DEFAULT 1` for `user_auth_tbl`.
   - Verify `auth.ts` exports `handlers`, `auth`, `signIn`, `signOut`.
   - Verify `auth.ts` queries and returns `token_version` in `authorize()` and attaches `token.tokenVersion`.
   - Verify `app/actions/auth.ts:resetPass` increments `token_version = token_version + 1`.
   - Verify `handleSignOut` / `events.signOut` increments `token_version = token_version + 1`.
3. **Suite 3: Dynamic Session Revocation (SEC-05 / ASVS 3.1.1, 3.3.1, 3.5.3)**:
   - Valid session matching `token.tokenVersion === dbUser.token_version` succeeds.
   - Session mismatch `token.tokenVersion !== dbUser.token_version` returns `null` from `jwt` callback and `session` callback.
   - Mismatched JWT sent to `/api/auth/session` receives `Set-Cookie: authjs.session-token=; Max-Age=0` and body `null`.
   - Mismatched JWT sent to route middleware redirects to `/login`.
4. **Suite 4: Password Reset Invalidation (SEC-05 / ASVS 3.3.3)**:
   - Execution of `resetPass()` executes `UPDATE user_auth_tbl SET password_hash = ?, token_version = token_version + 1`.
   - A pre-existing JWT is rejected immediately after `resetPass()`.
5. **Suite 5: Logout Invalidation (SEC-05 / ASVS 3.3.1)**:
   - Invoking NextAuth `events.signOut({ token })` increments `token_version` in `user_auth_tbl`.
   - Re-presenting the logged-out JWT returns `null` / redirects to `/login`.
6. **Suite 6: Safe OAuth Account Linking (SEC-04 / ASVS 3.2.1, 3.6.1)**:
   - New OAuth sign-up automatically creates records in `user_auth_tbl`, `player_tbl`, and `user_oauth_tbl`.
   - Returning OAuth sign-in allows seamless access for already linked accounts.
   - **SEC-04 Attack Reproduction**: Unauthenticated OAuth sign-in with email matching existing local credentials account is BLOCKED (`returns false`), with NO record inserted into `user_oauth_tbl`.
   - Authenticated user matching `user_id` successfully links OAuth provider.
   - Authenticated user attempting to link a DIFFERENT user's account is BLOCKED.

### 6.2 Independent Verification Command
```bash
npx --yes tsx tests/test-m3.ts
```
Expected output: 100% passed test assertions across all 6 test suites, zero unhandled rejections, exit code 0.

### 6.3 Invalidation Conditions
- Any session callback returning a truthy session when `token.tokenVersion !== dbUser.token_version`.
- Any password reset failing to increment `token_version`.
- Any unauthenticated OAuth attempt successfully creating a record in `user_oauth_tbl` for an existing email.
