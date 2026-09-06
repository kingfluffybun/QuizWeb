import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { db } from "@/lib/db";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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

                const rateCheck = await checkRateLimit(`login:${email.toLowerCase().trim()}`);
                if (!rateCheck.allowed) {
                    throw new Error(rateCheck.message || "Too many login attempts. Please try again later.");
                }

                // Query user_auth_tbl and join player_tbl for the username
                const [rows] = await db.query<RowDataPacket[]>(
                    `SELECT a.user_id, a.email, a.password_hash, p.username 
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

                clearRateLimit(`login:${email.toLowerCase().trim()}`);
                return {
                    id: String(user.user_id),
                    email: user.email,
                    name: user.username,
                };
            },
        }),
    ],

    callbacks: {
        async signIn({ user, account }) {
            // Handle database syncing for new OAuth Logins
            if (account?.provider === "google" || account?.provider === "github" && user.email) {
                try {
                    // 1. Check if user already exists in user_auth_tbl
                    const [existingUser] = await db.query<RowDataPacket[]>(
                        "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
                        [user.email]
                    );

                    let userId: number;

                    if (existingUser.length === 0) {
                        // Insert new user authentication record
                        const [authResult] = await db.query<ResultSetHeader>(
                            "INSERT INTO user_auth_tbl (email, is_email_verified) VALUES (?, ?)",
                            [user.email, true]
                        );
                        userId = authResult.insertId;

                        // Insert new player profile
                        await db.query(
                            "INSERT INTO player_tbl (user_id, username) VALUES (?, ?)",
                            [userId, user.name || `player_${userId}`]
                        );
                    } else {
                        userId = existingUser[0].user_id;
                    }

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

                    // Attach the true DB user_id to the user object for the JWT callback
                    user.id = String(userId);
                    return true;
                } catch (error) {
                    console.error("Database error during Google sign-in:", error);
                    return false; 
                }
            }
            // Allow standard credentials login to pass through
            return true;
        },
        async jwt({ token, user }) {
            if (user) token.id = user.id;
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
});