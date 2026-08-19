import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import {db} from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: "jwt" },
    providers: [
        Google,

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

                const [rows] = await db.query<RowDataPacket[]>(
                    "SELECT * FROM user_tb WHERE email = ? LIMIT 1",
                    [email]
                );
                const user = rows[0];
                if (!user || !user.password) return null;

                const valid = await argon2.verify(password, user.password);
                if (!valid) return null;

                return {
                    id: String(user.id),
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],

    events: {
        async signIn({ user, account }) {
            if (account?.provider !== "google" || !user.email) return;

            await db.query(
                `INSERT INTO user_tb (email, username, image, createdAt)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE image = VALUES(image)`,
                [user.email, user.name, user.image]
            );
        },
    },

    callbacks: {
        async jwt({ token, user }) {
            if (user) token.id = user.id;
            return token;
        },
        async session({ session, token }) {
            if (token) session.user.id = token.id as string;
            return session;
        },
    },
});