import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const session = req.auth;

    const isAdminRoute = pathname.startsWith("/input") || pathname.startsWith("/pending");
    const isUserRoute = pathname.startsWith("/dashboard");

    if (isAdminRoute || isUserRoute) {
        if (!session?.user) {
            const loginUrl = new URL("/login", req.url);
            loginUrl.searchParams.set("callbackUrl", pathname);
            return NextResponse.redirect(loginUrl);
        }

        if (isAdminRoute && session.user.role !== "admin") {
            return NextResponse.redirect(new URL("/", req.url));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/input/:path*", "/pending/:path*", "/dashboard/:path*"],
};
