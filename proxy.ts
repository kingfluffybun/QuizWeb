import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const adminRoutes = ["/admin", "/pending"];
const staffRoutes = ["/maintainer", "/input"];

const SESSION_COOKIE_CANDIDATES = [
  { name: "__Secure-authjs.session-token", secure: true },
  { name: "authjs.session-token", secure: false },
  { name: "__Secure-next-auth.session-token", cookieName: "__Secure-next-auth.session-token" },
  { name: "next-auth.session-token", cookieName: "next-auth.session-token" },
] as const;

function hasSessionCookieVariant(req: NextRequest, baseName: string): boolean {
  return req.cookies.has(baseName) || req.cookies.has(`${baseName}.0`);
}

function prefersJson(req: NextRequest): boolean {
  return Boolean(req.headers.get("accept")?.includes("application/json"));
}

export async function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isAdminPath = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
  const isStaffPath = staffRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (!isAdminPath && !isStaffPath) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const isHttps =
    nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

  let token = null;
  if (secret) {
    for (const candidate of SESSION_COOKIE_CANDIDATES) {
      if (!hasSessionCookieVariant(req, candidate.name)) continue;
      // Do not fall back to non-secure cookie names when running over HTTPS in production
      if (isHttps && process.env.NODE_ENV === "production" && !candidate.name.startsWith("__Secure-")) {
        continue;
      }
      token = await getToken({
        req,
        secret,
        ...("cookieName" in candidate
          ? { cookieName: candidate.cookieName }
          : { secureCookie: candidate.secure }),
      });
      if (token) break;
    }
  }

  if (!token) {
    if (prefersJson(req)) {
      return NextResponse.json(
        { error: "Unauthorized: Authentication required" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", nextUrl.origin);
    const fullPath = nextUrl.search ? `${pathname}${nextUrl.search}` : pathname;
    loginUrl.searchParams.set("callbackUrl", fullPath);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token.role as string) || (token.user_role as string);

  if (isAdminPath && role !== "admin") {
    if (prefersJson(req)) {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/home", nextUrl.origin));
  }

  if (isStaffPath && role !== "admin" && role !== "maintainer") {
    if (prefersJson(req)) {
      return NextResponse.json(
        { error: "Forbidden: Maintainer or Admin role required" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/home", nextUrl.origin));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    "/admin/:path*",
    "/pending/:path*",
    "/maintainer/:path*",
    "/input/:path*",
  ],
};
