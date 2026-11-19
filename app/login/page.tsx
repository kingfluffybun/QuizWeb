"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import * as Assets from "@/app/components/animations";
import LoginQuiz from "@/app/components/loginQuiz";
import "#css/login.css";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import ForgotPasswordModal from "./ForgotPasswordModal";

const FADE_MS = 260;

function AuthPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [contentMode, setContentMode] = useState<"login" | "signup">("login");
  const [hasOpenedSignup, setHasOpenedSignup] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const fadeToken = useRef(0);
  const fadeTimerA = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerB = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimerA.current) clearTimeout(fadeTimerA.current);
      if (fadeTimerB.current) clearTimeout(fadeTimerB.current);
    };
  }, []);

  const switchMode = (newMode: "login" | "signup") => {
    setSignupSuccess(false);
    if (newMode === mode || isFading) return;
    if (newMode === "signup") setHasOpenedSignup(true);

    setIsFading(true);
    setMode(newMode);
    setError("");
    setAttemptedSubmit(false);

    fadeToken.current += 1;
    const myToken = fadeToken.current;

    if (fadeTimerA.current) clearTimeout(fadeTimerA.current);
    if (fadeTimerB.current) clearTimeout(fadeTimerB.current);

    fadeTimerA.current = setTimeout(() => {
      if (myToken !== fadeToken.current) return;
      setContentMode(newMode);
      fadeTimerB.current = setTimeout(() => {
        if (myToken !== fadeToken.current) return;
        setIsFading(false);
      }, FADE_MS);
    }, FADE_MS);
  };

  const isSignup = mode === "signup";
  const isSignupContent = contentMode === "signup";
  const fadeClass = isFading ? "text-fade-out" : "";

  const panelTitle = isSignupContent ? "Create account" : "Welcome back";
  const panelText = isSignupContent
    ? "Start learning with QuizWeb in minutes."
    : "Pick up your WebDev quizzes where you left off.";
  const toggleText = isSignupContent
    ? "Already have an account? Sign in"
    : "New here? Create account";

  const formLabelText = signupSuccess
    ? "Verification"
    : isSignupContent
      ? "Get started"
      : "Access your account";
  const formTitleText = signupSuccess
    ? "Verify your email"
    : isSignupContent
      ? "Create account"
      : "Sign in";
  const formTextText = signupSuccess
    ? "Check your inbox to activate your account."
    : isSignupContent
      ? "A few details and you're ready to go."
      : "Use your email and password to continue.";

  return (
    <div className="auth-page">
      <main className={`auth-card ${isSignup ? "is-signup" : ""}`}>
        {/* Info */}
        <section className="info" aria-label="Authentication info">
          <div className="brand">
            <div className="brand-mark">
              <Image src="/assets/QuizWeb-Logo.svg" alt="" width={45} height={45} />
            </div>
            <span>QuizWeb</span>
          </div>

          <div className="panel">
            <h1 className={fadeClass} id="panelTitle">
              {panelTitle}
            </h1>
            <p className={fadeClass} id="panelText">
              {panelText}
            </p>
            <a
              className={`panel-toggle ${fadeClass}`}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setSignupSuccess(false);
                switchMode(isSignup ? "login" : "signup");
              }}
            >
              <span id="toggleText">{toggleText}</span>
            </a>
          </div>

          <p className="code-mark" aria-hidden="true">
            &lt;/&gt;
          </p>

          <div className="login-cloudscape" aria-hidden="true">
            <div className="login-cloud login-cloud-top-left" aria-hidden="true" data-hide-on-theme="dark">
              <Assets.CloudsTopLeft />
            </div>
            <div className="login-cloud login-cloud-top-right" aria-hidden="true" data-hide-on-theme="dark">
              <Assets.CloudsTopRight />
            </div>
            <div className="login-cloud login-cloud-bottom-left" aria-hidden="true" data-hide-on-theme="dark">
              <Assets.CloudsLeft />
            </div>
            <div className="login-cloud login-cloud-bottom-right" aria-hidden="true" data-hide-on-theme="dark">
              <Assets.CloudsRight />
            </div>

            <div className="login-cloud login-cloud-top-left" aria-hidden="true" data-hide-on-theme="light">
              <Assets.CloudsTopLeftDark />
            </div>
            <div className="login-cloud login-cloud-top-right" aria-hidden="true" data-hide-on-theme="light">
              <Assets.CloudsTopRightDark />
            </div>
            <div className="login-cloud login-cloud-bottom-left" aria-hidden="true" data-hide-on-theme="light">
              <Assets.CloudsLeftDark />
            </div>
            <div className="login-cloud login-cloud-bottom-right" aria-hidden="true" data-hide-on-theme="light">
              <Assets.CloudsRightDark />
            </div>
          </div>

          <LoginQuiz />
        </section>

        {/* Form */}
        <section className="formPanel" aria-label="Authentication form">
          <div className="formCard">
            <header className="formHead">
              <p className={`eyebrow ${fadeClass}`} id="formLabel">
                {formLabelText}
              </p>
              <h2 className={fadeClass} id="formTitle">
                {formTitleText}
              </h2>
              <p className={`helper ${fadeClass}`} id="formText">
                {formTextText}
              </p>
            </header>

            <div className="stack">
              {signupSuccess ? (
                <div
                  className="formView active verification-sent-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "1.25rem 0",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "rgba(153, 102, 255, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1.25rem",
                      color: "#9966FF",
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
                    </svg>
                  </div>
                  <h3 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                    Check your inbox
                  </h3>
                  <p style={{ color: "#a1a1aa", fontSize: "0.95rem", lineHeight: "1.5", margin: "0 0 0.5rem" }}>
                    We sent an activation link to:
                  </p>
                  <p style={{ color: "#9966FF", fontWeight: 600, fontSize: "1.05rem", margin: "0 0 1.25rem", wordBreak: "break-all" }}>
                    {signupEmail}
                  </p>
                  <p style={{ color: "#71717a", fontSize: "0.85rem", lineHeight: "1.4", margin: "0 0 1.75rem" }}>
                    Click the link in your email to activate your account. If you don&apos;t see it,
                    check your spam folder.
                  </p>
                  <button
                    type="button"
                    className="submit-btn"
                    style={{ width: "100%" }}
                    onClick={() => {
                      setSignupSuccess(false);
                      switchMode("login");
                    }}
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <LoginForm
                    active={!isSignupContent}
                    isLoading={isLoading}
                    error={error}
                    callbackUrl={callbackUrl}
                    setError={setError}
                    setIsLoading={setIsLoading}
                    onForgotPassword={() => {
                      setError("");
                      setShowForgot(true);
                    }}
                  />
                  <SignupForm
                    active={isSignupContent}
                    recaptchaEnabled={hasOpenedSignup}
                    isLoading={isLoading}
                    error={error}
                    attemptedSubmit={attemptedSubmit}
                    signupEmail={signupEmail}
                    onSignupEmailChange={setSignupEmail}
                    setAttemptedSubmit={setAttemptedSubmit}
                    setError={setError}
                    setIsLoading={setIsLoading}
                    onSignupSuccess={() => setSignupSuccess(true)}
                  />
                </>
              )}
            </div>
          </div>

          <Link
            href="/"
            className="back-landing"
            aria-label="Back to Landing Page"
            title="Back to Landing Page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
            </svg>
            <span>Back</span>
          </Link>
        </section>
      </main>

      <ForgotPasswordModal
        visible={showForgot}
        isLoading={isLoading}
        error={error}
        setError={setError}
        setIsLoading={setIsLoading}
        onClose={() => setShowForgot(false)}
        onReturnToLogin={() => {
          setShowForgot(false);
          switchMode("login");
        }}
      />
    </div>
  );
}

export default function AuthLoad() {
  return (
    <Suspense fallback={<div className="login-loading">Loading...</div>}>
      <AuthPage />
    </Suspense>
  );
}
