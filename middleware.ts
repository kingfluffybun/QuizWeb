import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const middleware = auth(async function middleware(req) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Only protect /pending/* and /input/* routes
  const isProtected =
    pathname.startsWith("/pending") || pathname.startsWith("/input");
  if (!isProtected) {
    return NextResponse.next();
  }

  const session = req.auth;
  let user = session?.user as { role?: string; user_role?: string; id?: string } | undefined;
  let role = user?.role || user?.user_role;

  // Extract role/user from session with JWT token fallback (e.g. standard cookie test harnesses)
  if (!user || !role) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
    });
    if (token) {
      role = (token.role as string) || (token.user_role as string);
      user = {
        id: (token.id || token.sub) as string,
        role,
        user_role: role,
      };
    }
  }

  // 1. Unauthenticated: redirect to /login with callbackUrl
  if (!user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Non-admin: reject with 403 or redirect to /home
  if (role !== "admin") {
    if (req.headers.get("accept")?.includes("application/json")) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
    return NextResponse.redirect(new URL("/home", nextUrl.origin));
  }

  return NextResponse.next();
});

export default middleware;

export const config = {
  matcher: ["/pending/:path*", "/input/:path*"],
};
