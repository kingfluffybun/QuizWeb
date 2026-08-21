import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const {token} = await req.json();

        if (!token) {
            return NextResponse.json(
                {success: false, error: "No token provided."},
                {status: 400}
            );
        }

        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!secretKey) {
            return NextResponse.json(
                {success: false, error: "Server configuration error."},
                {status: 500}
            );
        }

        // Verify
        const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
        const response = await fetch(verifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: secretKey,
                response: token,
            }),
        });

        const data = await response.json();

        return NextResponse.json({
            success: data.success,
            score: data.score,
            challenge_ts: data.challenge_ts,
            hostname: data.hostname,
            errorCodes: data["error-codes"],
        });
    } catch (err) {
        return NextResponse.json(
            { success: false, error: "An error occurred." },
            { status: 500 }
        );
    }
}