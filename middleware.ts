import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const adminRoutes = ["/admin", "/pending"];
const staffRoutes = ["/maintainer", "/input"];

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // 1. Programmatic route categorization (exact boundary matching)
  const isAdminPath = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  const isStaffPath = staffRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Pass through any public routes or static assets
  if (!isAdminPath && !isStaffPath) {
    return NextResponse.next();
  }

  let user: { role?: string; user_role?: string; id?: string } | undefined;
  let role: string | undefined;

  // Keep the proxy bundle edge-safe: full auth.ts imports Node-only database and Argon2 modules.
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

  // 2. Unauthenticated check: redirect to /login preserving full pathname and query params
  if (!user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    const fullPath = nextUrl.search ? `${pathname}${nextUrl.search}` : pathname;
    loginUrl.searchParams.set("callbackUrl", fullPath);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Multi-Tier Authorization Checks
  // Tier 1: Admin-only paths (/admin, /pending) strictly require role === 'admin'
  if (isAdminPath) {
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
  }

  // Tier 2: Staff paths (/maintainer, /input) require role === 'admin' || role === 'maintainer'
  if (isStaffPath) {
    if (role !== "admin" && role !== "maintainer") {
      if (req.headers.get("accept")?.includes("application/json")) {
        return new NextResponse(
          JSON.stringify({ error: "Forbidden: Maintainer or Admin role required" }),
          { status: 403, headers: { "content-type": "application/json" } }
        );
      }
      return NextResponse.redirect(new URL("/home", nextUrl.origin));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export default middleware;

export const config = {
  matcher: [
    "/admin/:path*",
    "/pending/:path*",
    "/maintainer/:path*",
    "/input/:path*",
  ],
};
