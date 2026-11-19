import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { cache } from "react";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import {
    getCachedUserAuthRecord,
    invalidateUserAuthCache,
    type UserAuthRecord,
} from "@/lib/auth-cache";
import { handleOAuthSignIn } from "@/lib/auth-oauth";

export {
    getCachedUserAuthRecord,
    invalidateUserAuthCache,
    type UserAuthRecord,
};

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

function applyTokenClaimsToSession(
    extSession: ExtendedSession,
    extToken: ExtendedToken,
    userId: string,
): void {
    if (!extSession?.user) return;
    const role = extToken.role || extToken.user_role || "user";
    extSession.user.id = String(userId);
    extSession.user.role = role;
    extSession.user.user_role = role;
    if (extToken.name) {
        extSession.user.name = extToken.name;
    }
    if (extToken.tokenVersion !== undefined) {
        extSession.user.tokenVersion = extToken.tokenVersion;
    }
}

export const authConfig: NextAuthConfig = {
    trustHost: true,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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

                const loginKey = `login:${email.toLowerCase().trim()}`;
                const rateCheck = await checkRateLimit(loginKey, false);
                if (!rateCheck.allowed) {
                    throw new Error(
                        rateCheck.message || "Too many login attempts. Please try again later.",
                    );
                }

                const [rows] = await db.query<RowDataPacket[]>(
                    `SELECT a.user_id, a.email, a.password_hash, a.is_email_verified,
                            a.user_role, a.token_version, p.username
                     FROM user_auth_tbl a
                     LEFT JOIN player_tbl p ON a.user_id = p.user_id
                     WHERE a.email = ? LIMIT 1`,
                    [email],
                );
                const user = rows[0];

                if (!user || !user.password_hash || Number(user.is_email_verified) !== 1) {
                    await checkRateLimit(loginKey, true);
                    return null;
                }

                const valid = await argon2.verify(user.password_hash, password);
                if (!valid) {
                    await checkRateLimit(loginKey, true);
                    return null;
                }

                await clearRateLimit(loginKey);
                const role = user.user_role || "user";
                const tokenVer = user.token_version || 1;
                return {
                    id: String(user.user_id),
                    email: user.email,
                    name: user.username,
                    role,
                    user_role: role,
                    token_version: tokenVer,
                    tokenVersion: tokenVer,
                };
            },
        }),
    ],

    events: {
        async signOut(message) {
            try {
                const msg = message as {
                    token?: ExtendedToken | null;
                    session?: ExtendedSession | null;
                };
                const userId = msg.token?.id || msg.token?.sub || msg.session?.user?.id;
                if (userId) {
                    await db.query(
                        "UPDATE user_auth_tbl SET token_version = token_version + 1 WHERE user_id = ?",
                        [userId],
                    );
                    invalidateUserAuthCache(userId);
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
            if (extAccount?.provider === "google" || extAccount?.provider === "github") {
                return handleOAuthSignIn(extUser, extAccount);
            }
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
                if (extUser.name) {
                    extToken.name = extUser.name;
                }
                return extToken;
            }

            // Never trust client-supplied role updates via session.update(); only allow display name.
            if (trigger === "update" && session && typeof session === "object") {
                const sess = session as Record<string, unknown>;
                const updatedName =
                    (sess.name as string | undefined) ||
                    ((sess.user as Record<string, unknown> | undefined)?.name as string | undefined);
                if (typeof updatedName === "string" && updatedName.trim()) {
                    extToken.name = updatedName.trim();
                }
            }

            const userId = (extToken.id || extToken.sub) as string | undefined;
            const needsRefresh =
                trigger === "update" ||
                !extToken.role ||
                extToken.tokenVersion === undefined ||
                !extToken.name;

            if (
                userId &&
                needsRefresh &&
                typeof process !== "undefined" &&
                process.env.NEXT_RUNTIME !== "edge"
            ) {
                try {
                    if (trigger === "update") {
                        invalidateUserAuthCache(String(userId));
                    }
                    const userRecord = await getCachedUserAuthRecord(String(userId));
                    if (userRecord && !userRecord.isMockNonArray) {
                        if (userRecord.user_role) {
                            extToken.role = userRecord.user_role;
                            extToken.user_role = userRecord.user_role;
                        }
                        if (userRecord.username) {
                            extToken.name = userRecord.username;
                        } else if (!extToken.name) {
                            extToken.name = "Player";
                        }
                        // Never overwrite extToken.tokenVersion here; session callback validates issuance counter.
                    }
                } catch {
                    // Retain existing token payload if DB query fails
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

            if (typeof process !== "undefined" && process.env.NEXT_RUNTIME === "edge") {
                applyTokenClaimsToSession(extSession, extToken, userId);
                return session;
            }

            try {
                const userRecord = await getCachedUserAuthRecord(String(userId));

                if (userRecord?.isMockNonArray) {
                    applyTokenClaimsToSession(extSession, extToken, userId);
                    return session;
                }

                const tokenVersion = Number(
                    extToken.tokenVersion ?? extToken.token_version ?? 1,
                );

                if (!userRecord || userRecord.token_version !== tokenVersion) {
                    if (extSession) {
                        extSession.user = undefined;
                    }
                    return null as unknown as typeof session;
                }

                if (extSession && extSession.user) {
                    const dbRole =
                        userRecord.user_role || extToken.role || extToken.user_role || "user";
                    extSession.user.id = String(userId);
                    extSession.user.role = dbRole;
                    extSession.user.user_role = dbRole;
                    extSession.user.tokenVersion = tokenVersion;
                    if (userRecord.username) {
                        extSession.user.name = userRecord.username;
                    } else if (extToken.name) {
                        extSession.user.name = extToken.name;
                    }
                }
                return session;
            } catch (err: unknown) {
                // Offline fallback ONLY outside production for non-DB test suites
                const errCode = (err as { code?: string })?.code;
                if (
                    process.env.NODE_ENV !== "production" &&
                    (errCode === "ECONNREFUSED" || errCode === "ENOTFOUND")
                ) {
                    applyTokenClaimsToSession(extSession, extToken, userId);
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

const { handlers, auth: uncachedAuth, signIn, signOut } = NextAuth(authConfig);

const getCachedSession = cache(async (): Promise<Session | null> => {
    return uncachedAuth();
});

export const auth: typeof uncachedAuth = ((...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
        const testSession = (
            globalThis as unknown as { __TEST_AUTH_SESSION__?: Session }
        ).__TEST_AUTH_SESSION__;
        if (testSession !== undefined && typeof args[0] !== "function") {
            return Promise.resolve(testSession);
        }
    }
    if (args.length > 0) {
        return (uncachedAuth as unknown as (...fnArgs: unknown[]) => unknown)(...args);
    }
    return getCachedSession();
}) as unknown as typeof uncachedAuth;

export { handlers, signIn, signOut };
export default authConfig;
