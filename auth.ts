import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import argon2 from "argon2";
import { db } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const { handlers, signIn, signOut, auth } = NextAuth({
    session: {
        strategy: "jwt",
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const email = credentials.email as string;
                const password = credentials.password as string;

                const [authRows] = await db.query<RowDataPacket[]>(
                    "SELECT user_id, password_hash FROM user_auth_tbl WHERE email = ? LIMIT 1",
                    [email]
                );

                if (authRows.length === 0) return null;
                const userAuth = authRows[0];

                if (!userAuth.password_hash) return null;

                const isValid = await argon2.verify(userAuth.password_hash, password);
                if (!isValid) return null;

                return { id: userAuth.user_id.toString(), email: email };
            }
        })
    ],
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider !== "google") return true;

            const connection = await db.getConnection();

            try {
                const [oauthRows] = await connection.query<RowDataPacket[]>(
                    "SELECT user_id FROM user_oauth_tbl WHERE provider_name = 'google' AND provider_account_id = ? LIMIT 1",
                    [account.providerAccountId]
                );

                if (oauthRows.length > 0) return true;

                await connection.beginTransaction();

                const [emailRows] = await connection.query<RowDataPacket[]>(
                    "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
                    [user.email]
                );

                let dbUserId: number;

                if (emailRows.length > 0) {
                    dbUserId = emailRows[0].user_id;
                    await connection.query(
                        "UPDATE user_auth_tbl SET is_email_verified = true WHERE user_id = ?",
                        [dbUserId]
                    );
                } else {
                    const [authResult] = await connection.query<ResultSetHeader>(
                        "INSERT INTO user_auth_tbl (email, password_hash, is_email_verified, created_at) VALUES (?, NULL, true, NOW())",
                        [user.email]
                    );
                    dbUserId = authResult.insertId;

                    const baseName = user.name?.replace(/\s+/g, '') || user.email?.split('@')[0] || "Player";
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                    const finalUsername = `${baseName}${randomSuffix}`.substring(0, 50);

                    await connection.query(
                        "INSERT INTO player_tbl (user_id, username, xp, max_streak) VALUES (?, ?, 0, 0)",
                        [dbUserId, finalUsername]
                    );
                }

                await connection.query(
                    "INSERT INTO user_oauth_tbl (user_id, provider_name, provider_account_id) VALUES (?, 'google', ?)",
                    [dbUserId, account.providerAccountId]
                );

                await connection.commit();
                return true;

            } catch (error) {
                await connection.rollback();
                console.error("Google Sign-In Error:", error);
                return false;
            } finally {
                connection.release();
            }
        },

        async jwt({ token, user, account }) {
            
            if (user && user.email) {

                const [rows] = await db.query<RowDataPacket[]>(
                    "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
                    [user.email]
                );
                
                if (rows.length > 0) {
                    token.dbUserId = rows[0].user_id.toString();
                }
            }
            return token;
        },

        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.dbUserId as string;
            }
            return session;
        }
    }
});