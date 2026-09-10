import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    session: { strategy: "jwt" },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const pathname = nextUrl.pathname;
            const isAdminRoute = pathname.startsWith("/input") || pathname.startsWith("/pending");
            const isUserRoute = pathname.startsWith("/dashboard");

            if (isAdminRoute || isUserRoute) {
                if (!isLoggedIn) {
                    const loginUrl = new URL("/login", nextUrl);
                    loginUrl.searchParams.set("callbackUrl", pathname);
                    return Response.redirect(loginUrl);
                }

                if (isAdminRoute && auth?.user?.role !== "admin") {
                    return Response.redirect(new URL("/", nextUrl));
                }
            }

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
    providers: [],
} satisfies NextAuthConfig;
