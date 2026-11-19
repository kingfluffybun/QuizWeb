"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { checkLoginRateLimit } from "@/app/actions/auth";
import { preloadLearnSections } from "@/lib/learn-cache";
import {
  EmailFieldIcon,
  LockFieldIcon,
  REMEMBERED_EMAIL_KEY,
  sanitizeRedirectUrl,
} from "./auth-constants";

interface LoginFormProps {
  active: boolean;
  isLoading: boolean;
  error: string;
  callbackUrl: string | null;
  setError: (msg: string) => void;
  setIsLoading: (loading: boolean) => void;
  onForgotPassword: () => void;
}

export default function LoginForm({
  active,
  isLoading,
  error,
  callbackUrl,
  setError,
  setIsLoading,
  onForgotPassword,
}: LoginFormProps) {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const rememberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (remembered && emailInputRef.current && !emailInputRef.current.value) {
        emailInputRef.current.value = remembered;
        if (rememberRef.current) rememberRef.current.checked = true;
      }
    } catch {
      // Ignore storage access failures
    }
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string) ?? "";
    const password = (formData.get("password") as string) ?? "";

    if (!email || !password) {
      setError("Please enter your email and password.");
      setIsLoading(false);
      return;
    }

    try {
      if (rememberRef.current?.checked) {
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch {
      // Ignore storage access failures
    }

    const rateCheck = await checkLoginRateLimit(email);
    if (!rateCheck.allowed) {
      setError(rateCheck.message || "Too many login attempts. Please try again later.");
      setIsLoading(false);
      return;
    }

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      const remaining = Math.max(0, rateCheck.remaining - 1);
      if (remaining <= 3) {
        setError(`Invalid email or password. ${remaining} attempts remaining.`);
      } else {
        setError("Invalid email or password.");
      }
      setIsLoading(false);
      return;
    }

    preloadLearnSections(undefined, true).catch((err) => {
      console.warn("Background learn preload notice:", err);
    });

    router.push(sanitizeRedirectUrl(callbackUrl));
    router.refresh();
  }

  return (
    <form className={`formView ${active ? "active" : ""}`} noValidate onSubmit={handleLogin}>
      <label className="input-group">
        <EmailFieldIcon />
        <input
          ref={emailInputRef}
          type="email"
          placeholder=" "
          name="email"
          autoComplete="email"
        />
        <span className="floating-label">Email address</span>
      </label>

      <label className="input-group">
        <LockFieldIcon />
        <input
          type="password"
          placeholder=" "
          name="password"
          autoComplete="current-password"
        />
        <span className="floating-label">Password</span>
      </label>

      {active && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="formActions">
        <label className="remember-row" htmlFor="remember-me">
          <input ref={rememberRef} id="remember-me" type="checkbox" className="remember-me" />
          <span>Remember Me</span>
        </label>
        <a
          className="forgot-link"
          href="#forgot-password"
          onClick={(e) => {
            e.preventDefault();
            onForgotPassword();
          }}
        >
          Forgot Password?
        </a>
      </div>

      <button type="submit" className="submit-btn" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </button>

      <div className="divider-row" aria-hidden="true">
        <span className="divider-line"></span>
        <span className="divider-text">Or sign in with</span>
        <span className="divider-line"></span>
      </div>

      <div className="social-row">
        <button
          type="button"
          className="social-btn"
          onClick={() => signIn("google", { callbackUrl: sanitizeRedirectUrl(callbackUrl) })}
        >
          <span className="social-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
              <path d="M 15.003906 3 C 8.3749062 3 3 8.373 3 15 C 3 21.627 8.3749062 27 15.003906 27 C 25.013906 27 27.269078 17.707 26.330078 13 L 25 13 L 22.732422 13 L 15 13 L 15 17 L 22.738281 17 C 21.848702 20.448251 18.725955 23 15 23 C 10.582 23 7 19.418 7 15 C 7 10.582 10.582 7 15 7 C 17.009 7 18.839141 7.74575 20.244141 8.96875 L 23.085938 6.1289062 C 20.951937 4.1849063 18.116906 3 15.003906 3 z" />
            </svg>
          </span>
          <span>Google</span>
        </button>

        <button
          type="button"
          className="social-btn"
          onClick={() => signIn("github", { callbackUrl: sanitizeRedirectUrl(callbackUrl) })}
        >
          <span className="social-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-github" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
            </svg>
          </span>
          <span>Github</span>
        </button>
      </div>
    </form>
  );
}
