import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            role?: string;
        } & DefaultSession["user"];
    }

    interface User {
        role?: string;
    }
}



interface UserAuthRow extends RowDataPacket {
    user_id: number;
    email: string;
    password_hash?: string;
    username?: string;
    role?: string;
    is_email_verified?: boolean;
}

// Constant-time dummy hash for timing attack mitigation when user is not found
const DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$9Z8vOqZ/7V+qM8Q7kYw3wz4e5r6t7y8u9i0o1p2a3s4";

function checkIsAdmin(email?: string | null, role?: string | null): boolean {
    if (role === "admin") return true;
    if (!email) return false;
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    return adminEmails.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
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

                const normalizedEmail = email.toLowerCase().trim();
                const rateCheck = await checkRateLimit(`login:${normalizedEmail}`);
                if (!rateCheck.allowed) {
                    throw new Error(rateCheck.message || "Too many login attempts. Please try again later.");
                }

                // Query user_auth_tbl and join player_tbl for the username
                const [rows] = await db.query<UserAuthRow[]>(
                    `SELECT a.user_id, a.email, a.password_hash, p.username 
                    FROM user_auth_tbl a 
                    LEFT JOIN player_tbl p ON a.user_id = p.user_id 
                    WHERE a.email = ? LIMIT 1`,
                    [normalizedEmail]
                );
                const user = rows[0];

                if (!user || !user.password_hash) {
                    // Finding 9: Timing Attack & User Enumeration Mitigation
                    await argon2.verify(DUMMY_HASH, password).catch(() => {});
                    // Finding 2: Server-side increment
                    await checkRateLimit(`login:${normalizedEmail}`, true);
                    return null;
                }

                const valid = await argon2.verify(user.password_hash, password);
                if (!valid) {
                    // Finding 2: Server-side increment on invalid password
                    await checkRateLimit(`login:${normalizedEmail}`, true);
                    return null;
                }

                // Finding 2: Clear failure count on success
                await clearRateLimit(`login:${normalizedEmail}`);

                const isAdmin = checkIsAdmin(user.email, user.role);
                return {
                    id: String(user.user_id),
                    email: user.email,
                    name: user.username,
                    role: isAdmin ? "admin" : "user",
                };
            },
        }),
    ],

    callbacks: {
        async signIn({ user, account }) {
            // Finding 4: Correct operator precedence grouping
            if ((account?.provider === "google" || account?.provider === "github") && user.email) {
                const connection = await db.getConnection();
                try {
                    // Finding 10: Multi-table transaction
                    await connection.beginTransaction();

                    // 1. Check if user already exists in user_auth_tbl
                    const [existingUser] = await connection.query<UserAuthRow[]>(
                        "SELECT user_id, is_email_verified FROM user_auth_tbl WHERE email = ? LIMIT 1",
                        [user.email]
                    );

                    let userId: number;

                    if (existingUser.length === 0) {
                        // Insert new user authentication record
                        const [authResult] = await connection.query<ResultSetHeader>(
                            "INSERT INTO user_auth_tbl (email, is_email_verified) VALUES (?, ?)",
                            [user.email, true]
                        );
                        userId = authResult.insertId;

                        // Insert new player profile
                        await connection.query(
                            "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
                            [userId, user.name || `player_${userId}`]
                        );
                    } else {
                        // Finding 4: Pre-Account Takeover Protection
                        if (!existingUser[0].is_email_verified) {
                            await connection.rollback();
                            console.warn(`[Security] Blocked OAuth linking to unverified credential account: ${user.email}`);
                            return false;
                        }
                        userId = existingUser[0].user_id;
                    }

                    // 2. Link OAuth connection in user_oauth_tbl
                    const [existingOAuth] = await connection.query<RowDataPacket[]>(
                        "SELECT oauth_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ? LIMIT 1",
                        [account.provider, account.providerAccountId]
                    );

                    if (existingOAuth.length === 0) {
                        await connection.query(
                            "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, ?, ?)",
                            [userId, account.provider, account.providerAccountId]
                        );
                    }

                    await connection.commit();

                    // Attach the true DB user_id and role to the user object for the JWT callback
                    user.id = String(userId);
                    const isAdmin = checkIsAdmin(user.email, existingUser[0]?.role);
                    user.role = isAdmin ? "admin" : "user";
                    return true;
                } catch (error) {
                    await connection.rollback();
                    console.error("Database error during OAuth sign-in:", error);
                    return false; 
                } finally {
                    connection.release();
                }
            }
            // Allow standard credentials login to pass through
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role || "user";
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = (token.role as string) || "user";
            }
            return session;
        },
    },
});