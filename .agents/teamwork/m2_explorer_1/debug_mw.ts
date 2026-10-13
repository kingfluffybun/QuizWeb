import { auth } from "../../../auth";
import { NextRequest, NextResponse } from "next/server";
import { encode, getToken } from "next-auth/jwt";

async function run() {
    const secret = process.env.AUTH_SECRET || "testsecrettestsecrettestsecret12";

    const mw = auth(async (req) => {
        const { nextUrl } = req;
        const session = req.auth;

        if (!session?.user) {
            const loginUrl = new URL("/login", nextUrl.origin);
            loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
            return NextResponse.redirect(loginUrl);
        }

        let role = (session.user as any)?.role || (session.user as any)?.user_role;
        if (!role) {
            const token = await getToken({ req, secret });
            role = (token?.role as string) || (token?.user_role as string);
        }

        if (role !== "admin") {
            return NextResponse.redirect(new URL("/home", nextUrl.origin));
        }

        return NextResponse.next();
    });

    // 1. Unauthenticated request to /pending
    const req1 = new NextRequest("http://localhost:3000/pending");
    const res1 = await mw(req1, {} as any);
    console.log("1. Unauthenticated /pending -> status:", res1?.status, "location:", res1?.headers.get("location"));

    // 2. Non-admin request to /input
    const userToken = await encode({
        token: { sub: "2", id: "2", role: "user", user_role: "user", email: "user@test.com" },
        secret,
        salt: "authjs.session-token",
    });
    const req2 = new NextRequest("http://localhost:3000/input", {
        headers: { cookie: `authjs.session-token=${userToken}`, host: "localhost:3000" },
    });
    const res2 = await mw(req2, {} as any);
    console.log("2. Non-admin /input -> status:", res2?.status, "location:", res2?.headers.get("location"));

    // 3. Admin request to /pending
    const adminToken = await encode({
        token: { sub: "1", id: "1", role: "admin", user_role: "admin", email: "admin@test.com" },
        secret,
        salt: "authjs.session-token",
    });
    const req3 = new NextRequest("http://localhost:3000/pending", {
        headers: { cookie: `authjs.session-token=${adminToken}`, host: "localhost:3000" },
    });
    const res3 = await mw(req3, {} as any);
    console.log("3. Admin /pending -> status:", res3?.status, "location:", res3?.headers.get("location"));
}

run().catch(console.error);
