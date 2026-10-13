"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { verifyEmail } from "@/app/actions/auth";

interface VerifyEmailClientProps {
    token: string;
}

export default function VerifyEmailClient({ token }: VerifyEmailClientProps) {
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [message, setMessage] = useState<string>("");

    async function handleActivate(e: React.FormEvent) {
        e.preventDefault();
        if (status === "submitting") return;
        setStatus("submitting");

        try {
            // Explicit POST Server Action invocation
            const result = await verifyEmail(token);
            if (result.success) {
                setStatus("success");
                setMessage(result.message || "Email verified successfully!");
            } else {
                setStatus("error");
                setMessage(result.message || "Verification failed. The link may have expired or been used.");
            }
        } catch {
            setStatus("error");
            setMessage("An error occurred during verification. Please try again.");
        }
    }

    return (
        <main className="main-email">
            <div className="email-container">
                <div className="logo">
                    <Image className="logo-img" src="/assets/QuizWeb-Logo.svg" width={96} height={96} alt="QuizWeb" />
                    <p className="logo-text">QuizWeb</p>
                </div>

                {status === "idle" && (
                    <form onSubmit={handleActivate} method="POST">
                        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "#333", margin: "24px 0 12px" }}>
                            Activate Your Account
                        </h1>
                        <p className="message" style={{ marginBottom: "28px" }}>
                            Click the button below to confirm your email verification and activate your QuizWeb account.
                        </p>
                        <button
                            type="submit"
                            id="activate-account-btn"
                            style={{
                                background: "#9966FF",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                padding: "14px 28px",
                                fontSize: "16px",
                                fontWeight: 600,
                                cursor: "pointer",
                                width: "100%",
                            }}
                        >
                            Activate Account
                        </button>
                    </form>
                )}

                {status === "submitting" && (
                    <div style={{ padding: "32px 0" }}>
                        <p className="message">Activating your account, please wait...</p>
                    </div>
                )}

                {status === "success" && (
                    <>
                        <div className="success-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#9966FF" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-badge-check success-icon"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m16 9-5.5 5.5L8 12"/></svg>
                        </div>
                        <p className="success-title">Email Verified!</p>
                        <p className="message">{message}</p>
                        <div style={{ marginTop: "24px" }}>
                            <Link
                                href="/login"
                                style={{
                                    display: "inline-block",
                                    background: "#9966FF",
                                    color: "#ffffff",
                                    textDecoration: "none",
                                    padding: "12px 28px",
                                    borderRadius: "8px",
                                    fontWeight: 600,
                                }}
                            >
                                Proceed to Login
                            </Link>
                        </div>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="failed-logo">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef2e2e" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-triangle-alert failed-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        </div>
                        <p className="failed-title">Verification Failed</p>
                        <p className="message">{message}</p>
                        <div style={{ marginTop: "24px" }}>
                            <Link
                                href="/login"
                                style={{
                                    color: "#9966FF",
                                    textDecoration: "underline",
                                    fontWeight: 500,
                                }}
                            >
                                Return to Login
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
