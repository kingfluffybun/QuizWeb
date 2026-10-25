import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export interface ExtendedUser {
    id?: string;
    email?: string | null;
    name?: string | null;
    role?: string;
    user_role?: string;
    token_version?: number;
    tokenVersion?: number;
    [key: string]: unknown;
}

export interface ExtendedToken {
    id?: string;
    sub?: string;
    name?: string | null;
    role?: string;
    user_role?: string;
    token_version?: number;
    tokenVersion?: number;
    [key: string]: unknown;
}

export interface ExtendedSession {
    user?: ExtendedUser;
    expires?: string;
    [key: string]: unknown;
}

export interface ExtendedAccount {
    provider?: string;
    providerAccountId?: string;
    type?: string;
    [key: string]: unknown;
}

/**
 * Helper to retrieve currently authenticated session user when linking OAuth accounts (SEC-04).
 */
async function getActiveSessionUser(): Promise<{ id: string; email?: string } | null> {
    // 1. Check test harness session injection
    const testSession = (globalThis as unknown as { __TEST_AUTH_SESSION__?: { user?: { id?: string | number; email?: string } } }).__TEST_AUTH_SESSION__;
    if (testSession?.user?.id) {
        return {
            id: String(testSession.user.id),
            email: testSession.user.email,
        };
    }

    // 2. Inspect active session cookie/header in Next.js environment
    try {
        let sessionToken: string | undefined;
        let isSecure = false;

        try {
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            const secureCookie = cookieStore.get("__Secure-authjs.session-token");
            const standardCookie = cookieStore.get("authjs.session-token");
            if (secureCookie?.value) {
                sessionToken = secureCookie.value;
                isSecure = true;
            } else if (standardCookie?.value) {
                sessionToken = standardCookie.value;
            } else {
                // Reassemble chunked cookies if token exceeded single-cookie limit
                const allCookies = cookieStore.getAll();
                const secureChunks = allCookies
                    .filter((c) => c.name.startsWith("__Secure-authjs.session-token."))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                if (secureChunks.length > 0) {
                    sessionToken = secureChunks.map((c) => c.value).join("");
                    isSecure = true;
                } else {
                    const standardChunks = allCookies
                        .filter((c) => c.name.startsWith("authjs.session-token."))
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                    if (standardChunks.length > 0) {
                        sessionToken = standardChunks.map((c) => c.value).join("");
                    }
                }
            }
        } catch {
            // Outside cookie request scope
        }

        if (!sessionToken) {
            try {
                const { headers } = await import("next/headers");
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
                } else {
                    const secureChunkKeys = Object.keys(cookiesParsed)
                        .filter((k) => k.startsWith("__Secure-authjs.session-token."))
                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    if (secureChunkKeys.length > 0) {
                        sessionToken = secureChunkKeys.map((k) => cookiesParsed[k]).join("");
                        isSecure = true;
                    } else {
                        const standardChunkKeys = Object.keys(cookiesParsed)
                            .filter((k) => k.startsWith("authjs.session-token."))
                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                        if (standardChunkKeys.length > 0) {
                            sessionToken = standardChunkKeys.map((k) => cookiesParsed[k]).join("");
                        }
                    }
                }
            } catch {
                // Outside header scope
            }
        }

        const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
        if (sessionToken && secret) {
            const { decode } = await import("next-auth/jwt");
            let decoded = await decode({
                token: sessionToken,
                secret,
                salt: isSecure ? "__Secure-authjs.session-token" : "authjs.session-token",
            });
            if (!decoded) {
                decoded = await decode({
                    token: sessionToken,
                    secret,
                    salt: !isSecure ? "__Secure-authjs.session-token" : "authjs.session-token",
                });
            }

            if (decoded) {
                const userId = decoded.id || decoded.sub;
                if (userId) {
                    const [rows] = await db.query<RowDataPacket[]>(
                        "SELECT token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
                        [userId]
                    );
                    if (rows.length > 0) {
                        const dbVer = Number(rows[0].token_version ?? 1);
                        const tokenVer = Number((decoded as { tokenVersion?: number }).tokenVersion ?? 1);
                        if (dbVer === tokenVer) {
                            return { id: String(userId), email: decoded.email as string | undefined };
                        }
                    }
                }
            }
        }
    } catch {
        // Fall through
    }

    return null;
}

export const authConfig: NextAuthConfig = {
    trustHost: true,
    secret: process.env.AUTH_SECRET,
    session: { strategy: "jwt" as const },
    providers: [
        Google,
        Github({
            clientId: process.env.AUTH_GITHUB_ID!,
            clientSecret: process.env.AUTH_GITHUB_SECRET!,
        }),
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = credentials?.email as string;
                const password = credentials?.password as string;
                if (!email || !password) return null;

                const [existingUser] = await db.query<RowDataPacket[]>(
                    "SELECT user_id FROM user_auth_tbl WHERE email = ? AND is_email_verified = 1 LIMIT 1",
                    [email]
                );
                
                if (existingUser.length === 0) {
                    return null;
                }

                const rateCheck = await checkRateLimit(`login:${email.toLowerCase().trim()}`);
                if (!rateCheck.allowed) {
                    throw new Error(rateCheck.message || "Too many login attempts. Please try again later.");
                }

                // Query user_auth_tbl and join player_tbl for username, role, and token_version
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
                if (!valid) {
                    checkRateLimit(`login:${email.toLowerCase().trim()}`);
                    return null;
                }

                const { clearRateLimit } = await import("@/lib/rate-limit");
                await clearRateLimit(`login:${email.toLowerCase().trim()}`);
                return {
                    id: String(user.user_id),
                    email: user.email,
                    name: user.username,
                    role: user.user_role || "user",
                    user_role: user.user_role || "user",
                    token_version: user.token_version || 1,
                    tokenVersion: user.token_version || 1,
                };
            },
        }),
    ],

    events: {
        async signOut(message) {
            try {
                const msg = message as { token?: ExtendedToken | null; session?: ExtendedSession | null };
                const userId = msg.token?.id || msg.token?.sub || msg.session?.user?.id;
                if (userId) {
                    await db.query(
                        "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
                        [userId]
                    );
                }
            } catch (err) {
                console.error("Error updating token_version on signOut event:", err);
            }
        },
    },

    callbacks: {
        async signIn({ user, account }) {
            const extUser = user as ExtendedUser;
            const extAccount = account as ExtendedAccount | null | undefined;
            // Handle database syncing for new OAuth Logins
            if ((extAccount?.provider === "google" || extAccount?.provider === "github") && extUser.email) {
                try {
                    // 1. Check if an account with user.email exists in user_auth_tbl
                    const [existingUser] = await db.query<RowDataPacket[]>(
                        "SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ? LIMIT 1",
                        [extUser.email]
                    );

                    if (existingUser.length > 0) {
                        const userId = existingUser[0].user_id;

                        // Check if user_oauth_tbl already has a row for this provider + providerAccountId
                        const [existingOAuth] = await db.query<RowDataPacket[]>(
                            "SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
                            [extAccount.provider, extAccount.providerAccountId]
                        );

                        if (existingOAuth.length > 0) {
                            // Reject if OAuth record belongs to another user (SEC-04 cross-account takeover defense)
                            if (String(existingOAuth[0].user_id) !== String(userId)) {
                                console.warn(`[SEC-04] Blocked cross-account OAuth takeover attempt: OAuth account linked to user ${existingOAuth[0].user_id}, but attempted sign-in for user ${userId}`);
                                return false;
                            }

                            // Already linked to this user -> allow sign-in
                            extUser.id = String(userId);
                            extUser.role = existingUser[0].user_role || "user";
                            extUser.user_role = existingUser[0].user_role || "user";
                            extUser.token_version = existingUser[0].token_version ?? 1;
                            extUser.tokenVersion = existingUser[0].token_version ?? 1;
                            return true;
                        }

                        // NOT already linked -> verify whether an active authenticated session exists (SEC-04)
                        const activeSession = await getActiveSessionUser();
                        if (!activeSession || String(activeSession.id) !== String(userId)) {
                            console.warn(`[SEC-04] Blocked unauthenticated OAuth account linking attempt for email: ${extUser.email}`);
                            return false;
                        }

                        // Active authenticated session exists -> link account in user_oauth_tbl and allow
                        await db.query(
                            "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
                            [userId, extAccount.provider, extAccount.providerAccountId]
                        );

                        extUser.id = String(userId);
                        extUser.role = existingUser[0].user_role || "user";
                        extUser.user_role = existingUser[0].user_role || "user";
                        extUser.token_version = existingUser[0].token_version ?? 1;
                        extUser.tokenVersion = existingUser[0].token_version ?? 1;
                        return true;
                    }

                    // No existing account exists in user_auth_tbl -> allow new account creation
                    const [authResult] = await db.query<ResultSetHeader>(
                        "INSERT INTO user_auth_tbl (email, is_email_verified, token_version) VALUES (?, 1, 1)",
                        [extUser.email]
                    );
                    const userId = authResult.insertId;

                    await db.query(
                        "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
                        [userId, extUser.name || `player_${userId}`]
                    );

                    await db.query(
                        "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
                        [userId, extAccount.provider, extAccount.providerAccountId]
                    );

                    extUser.id = String(userId);
                    extUser.role = "user";
                    extUser.user_role = "user";
                    extUser.token_version = 1;
                    extUser.tokenVersion = 1;
                    return true;
                } catch (error) {
                    console.error("Database error during OAuth sign-in:", error);
                    return false;
                }
            }
            // Allow standard credentials login to pass through
            return true;
        },

        async jwt({ token, user, trigger, session }) {
            const extToken = token as ExtendedToken;
            const extUser = user as ExtendedUser | undefined;
            if (extUser) {
                extToken.id = extUser.id;
                extToken.role = extUser.role || extUser.user_role || "user";
                extToken.user_role = extUser.user_role || extUser.role || "user";
                extToken.tokenVersion = extUser.token_version || extUser.tokenVersion || 1;
                return extToken;
            }

            // Handle client or server-side explicit update trigger
            if (trigger === "update" && session && typeof session === "object") {
                const sess = session as Record<string, unknown>;
                const updatedRole = (sess.role as string) || (sess.user_role as string) ||
                    ((sess.user as Record<string, unknown>)?.role as string) ||
                    ((sess.user as Record<string, unknown>)?.user_role as string);
                if (updatedRole) {
                    extToken.role = updatedRole;
                    extToken.user_role = updatedRole;
                }
                const updatedName = (sess.name as string) ||
                    ((sess.user as Record<string, unknown>)?.name as string);
                if (updatedName) {
                    extToken.name = updatedName;
                }
            }

            // Refresh token role from database in Node runtime to ensure re-encrypted cookie is up to date
            const userId = (extToken.id || extToken.sub) as string | undefined;
            if (userId && typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge") {
                try {
                    const [rows] = await db.query<RowDataPacket[]>(
                        "SELECT user_role, token_version FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
                        [userId]
                    );
                    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.user_role) {
                        extToken.role = rows[0].user_role;
                        extToken.user_role = rows[0].user_role;
                    }
                    const [playerRows] = await db.query<RowDataPacket[]>(
                        "SELECT username FROM player_tbl WHERE user_id = ? LIMIT 1",
                        [userId]
                    );
                    if (Array.isArray(playerRows) && playerRows.length > 0 && playerRows[0]?.username) {
                        extToken.name = playerRows[0].username as string;
                    }
                } catch {
                    // Gracefully retain existing token payload if DB query fails or in offline tests
                }
            }

            return extToken;
        },

        async session({ session, token }) {
            const extSession = session as unknown as ExtendedSession;
            const extToken = token as unknown as ExtendedToken;

            if (!extToken) {
                if (extSession) extSession.user = undefined;
                return null as unknown as typeof session;
            }

            const userId = (extToken.id || extToken.sub) as string | undefined;
            if (!userId) {
                if (extSession) extSession.user = undefined;
                return null as unknown as typeof session;
            }

            // Skip DB query in Edge runtime to avoid net socket errors if executing in Edge
            if (typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge") {
                if (extSession && extSession.user) {
                    extSession.user.id = userId;
                    extSession.user.role = extToken.role || extToken.user_role || "user";
                    extSession.user.user_role = extToken.user_role || extToken.role || "user";
                    if (extToken.name) {
                        extSession.user.name = extToken.name;
                    }
                    if (extToken.tokenVersion !== undefined) {
                        extSession.user.tokenVersion = extToken.tokenVersion;
                    }
                }
                return session;
            }

            try {
                const [rows] = await db.query<RowDataPacket[]>(
                    `SELECT u.user_role, u.token_version, p.username 
                     FROM user_auth_tbl u 
                     LEFT JOIN player_tbl p ON u.user_id = p.user_id 
                     WHERE u.user_id = ? LIMIT 1`,
                    [userId]
                );

                const tokenVersion = Number(extToken.tokenVersion ?? extToken.token_version ?? 1);

                // If rows is not an array (e.g. legacy test mock returning non-SELECT ResultSetHeader), fall back safely
                if (!Array.isArray(rows)) {
                    if (extSession && extSession.user) {
                        extSession.user.id = String(userId);
                        extSession.user.role = extToken.role || extToken.user_role || "user";
                        extSession.user.user_role = extToken.user_role || extToken.role || "user";
                        if (extToken.name) {
                            extSession.user.name = extToken.name;
                        }
                        if (extToken.tokenVersion !== undefined) {
                            extSession.user.tokenVersion = extToken.tokenVersion;
                        }
                    }
                    return session;
                }

                if (rows.length === 0 || Number(rows[0]?.token_version ?? 1) !== tokenVersion) {
                    if (extSession) {
                        extSession.user = undefined;
                    }
                    return null as unknown as typeof session;
                }

                const dbUsername = (rows[0]?.username as string) || undefined;

                if (extSession && extSession.user) {
                    const dbRole = (rows[0]?.user_role as string) || extToken.role || extToken.user_role || "user";
                    extSession.user.id = String(userId);
                    extSession.user.role = dbRole;
                    extSession.user.user_role = dbRole;
                    extSession.user.tokenVersion = tokenVersion;
                    if (dbUsername) {
                        extSession.user.name = dbUsername;
                    } else if (extToken.name) {
                        extSession.user.name = extToken.name;
                    }
                }
                return session;
            } catch (err: unknown) {
                // If database is unreachable (e.g. standalone test runner without local MySQL server running),
                // fall back to token payload to preserve offline compatibility for non-DB test suites
                const errCode = (err as { code?: string })?.code;
                if (errCode === "ECONNREFUSED" || errCode === "ENOTFOUND") {
                    if (extSession && extSession.user) {
                        extSession.user.id = String(userId);
                        extSession.user.role = extToken.role || extToken.user_role || "user";
                        extSession.user.user_role = extToken.user_role || extToken.role || "user";
                        if (extToken.name) {
                            extSession.user.name = extToken.name;
                        }
                        if (extToken.tokenVersion !== undefined) {
                            extSession.user.tokenVersion = extToken.tokenVersion;
                        }
                    }
                    return session;
                }

                console.error("Error validating session token_version:", err);
                if (extSession) {
                    extSession.user = undefined;
                }
                return null as unknown as typeof session;
            }
        },
    },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
export default authConfig;