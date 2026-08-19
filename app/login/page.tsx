"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { signUp } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import LoginQuiz from "@/app/components/loginQuiz";
import "#css/login.css";

const passwordRules = [
    { key: "length", label: "8+ characters", test: (pw: string) => pw.length >= 8 },
    { key: "upper", label: "uppercase", test: (pw: string) => /[A-Z]/.test(pw) },
    { key: "lower", label: "lowercase", test: (pw: string) => /[a-z]/.test(pw) },
    { key: "number", label: "number", test: (pw: string) => /[0-9]/.test(pw) },
    { key: "special", label: "symbol", test: (pw: string) => /[!@#$%^&*]/.test(pw) },
];

const strengthLevels = ["#e5484d", "#e5484d", "#f5a623", "#f5c518", "#8bc34a", "#34c759"];

export default function AuthPage() {
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [contentMode, setContentMode] = useState<"login" | "signup">("login");
    const [isFading, setIsFading] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotStep, setForgotStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [error, setError] = useState("");

    // Signup password validation
    const [signupUsername, setSignupUsername] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    const fadeToken = useRef(0);
    const FADE_MS = 260;

    const router = useRouter();

    // Login
    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isLoading) return;
        setError("");
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        if (!email || !password) {
            setError("Please enter your email and password.");
            setIsLoading(false);
            return;
        }

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError("Invalid email or password.");
            setIsLoading(false);
            return;
        } else {
            router.push("/");
        }
    }

    // Signup
    async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isLoading) return;
        setError("");
        setAttemptedSubmit(true);

        const formData = new FormData(e.currentTarget);
        const password = formData.get("password") as string;
        const confirmPass = formData.get("confirmPassword") as string;

        const failedRules = passwordRules.filter((rule) => !rule.test(password));
        const mismatched = password !== confirmPass;

        if (failedRules.length > 0 || mismatched) {
            if (mismatched) {
                setError("Passwords do not match.");
            }
            return;
        }

        setIsLoading(true);

        const result = await signUp(formData);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
            return;
        }

        await signIn("credentials", {
            email: formData.get("email") as string,
            password,
            redirect: false,
        });

        router.push("/");
    }

    // Switching
    const switchMode = (newMode: 'login' | 'signup') => {
        if (newMode === mode || isFading) return;
        setIsFading(true);
        setMode(newMode);
        setError("");
        setAttemptedSubmit(false);

        fadeToken.current += 1;
        const myToken = fadeToken.current;

        setTimeout(() => {
            if (myToken !== fadeToken.current) return;
            setContentMode(newMode);
            setTimeout(() => {
                if (myToken !== fadeToken.current) return;
                setIsFading(false);
            }, FADE_MS);
        }, FADE_MS);
    };

    // Forgot Password
    const openForgot = () => {
        setShowForgot(true);
        setForgotStep(1);
    };
    const closeForgot = () => {
        setShowForgot(false);
        setForgotStep(1);
    };

    // Forgot Content
    const forgotCopy: Record<number, [string, string, string]> = {
        1: ['Step 1', 'Enter your email', 'Use the registered email address for your account.'],
        2: ['Step 2', '', ''],
        3: ['Step 3', '', ''],
        4: ['Step 4', '', ''],
    };
    const [stepLabel, stepTitle, stepText] = forgotCopy[forgotStep];

    // Custom content
    const isSignup = mode === 'signup';
    const isSignupContent = contentMode === 'signup';
    const fadeClass = isFading ? 'text-fade-out' : '';

    const panelTitle = isSignupContent ? 'Create account' : 'Welcome back';
    const panelText = isSignupContent ? 'Start learning with QuizWeb in minutes.' : 'Pick up your HTML, CSS, and JS quizzes where you left off.';
    const toggleText = isSignupContent ? 'Already have an account? Sign in' : 'New here? Create account';

    const formLabelText = isSignupContent ? 'Get started' : 'Access your account';
    const formTitleText = isSignupContent ? 'Create account' : 'Sign in';
    const formTextText = isSignupContent ? "A few details and you're ready to go." : 'Use your email and password to continue.';

    const passwordsMismatch = attemptedSubmit && confirmPassword.length > 0 && signupPassword !== confirmPassword;

    const passedRulesCount = passwordRules.filter((rule) => rule.test(signupPassword)).length;
    const allRulesPassed = passedRulesCount === passwordRules.length;
    const missingLabels = passwordRules.filter((rule) => !rule.test(signupPassword)).map((rule) => rule.label);
    const strengthColor = strengthLevels[passedRulesCount];

    // Signup all fields needed
    const isSignupComplete = 
    signupUsername.trim() !== "" &&
    /\S+@\S+\.\S+/.test(signupEmail) &&
    allRulesPassed &&
    signupPassword === confirmPassword &&
    confirmPassword !== "";

    // HTML
    return (
        <div className="auth-page">
            <main className={`auth-card ${isSignup ? 'is-signup' : ''}`} id="auth">
                <div className="editor-bar" aria-hidden="true">
                    <span className="editor-dots"><span></span><span></span><span></span></span>
                    <div className="editor-tabs">
                        <span className="editor-tab active"><span className="tab-dot"></span>index.html</span>
                        <span className="editor-tab"><span className="tab-dot"></span>style.css</span>
                    </div>
                </div>

                {/* Info */}
                <section className="info" aria-label="Authentication info">
                    <div className="brand">
                        <div className="brand-mark" aria-hidden="true"></div>
                        <span>QuizWeb</span>
                    </div>

                    <div className="panel">
                        <p className={`tag ${fadeClass}`} id="panelLabel"></p>
                        <h1 className={fadeClass} id="panelTitle">{panelTitle}</h1>
                        <p className={fadeClass} id="panelText">{panelText}</p>
                        <a id="toggleLink" 
                            className={`panel-toggle ${fadeClass}`} 
                            href="#" 
                            onClick={(e) => {
                                e.preventDefault();
                                switchMode(isSignup ? 'login' : 'signup');
                            }}
                        >
                            <span id="toggleText">{toggleText}</span>
                        </a>
                    </div>

                    <p className="code-mark" aria-hidden="true">&lt;/&gt;</p>
                    <div className="blob" aria-hidden="true"></div>

                    <LoginQuiz />
                </section>

                {/* Form */}
                <section className="formPanel" aria-label="Authentication form">
                    <div className="formCard">
                        <header className="formHead">
                            <p className={`eyebrow ${fadeClass}`} id="formLabel">{formLabelText}</p>
                            <h2 className={fadeClass} id="formTitle">{formTitleText}</h2>
                            <p className={`helper ${fadeClass}`} id="formText">{formTextText}</p>
                        </header>

                        <div className="stack">
                            {/* Login Form */}
                            <form id="signIn" className={`formView ${!isSignupContent ? 'active' : ''}`} noValidate onSubmit={handleLogin}>
                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                    </span>
                                    <input type="email" placeholder="Email address" name="email" autoComplete="email" />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input 
                                        type="password"
                                        placeholder="Password"
                                        name="password"
                                        autoComplete="current-password"
                                    />
                                </label>

                                {!isSignupContent && error && (
                                    <p className="form-error" role="alert">{error}</p>
                                )}

                                <div className="formActions">
                                    <label className="remember-row" htmlFor="remember-me">
                                        <input id="remember-me" type="checkbox" className="remember-me" />
                                        <span>Remember Me</span>
                                    </label>
                                    <a className="forgot-link" href="#forgot-password" 
                                        onClick={(e) => { e.preventDefault(); openForgot(); }}
                                    >
                                        Forgot Password?
                                    </a>
                                </div>

                                <button type="submit" className="submit-btn" id="signInBtn" disabled={isLoading}>
                                    {isLoading ? "Signing in..." : "Sign in"}
                                </button>

                                <div className="divider-row" aria-hidden="true">
                                    <span className="divider-line"></span>
                                    <span className="divider-text">OR</span>
                                    <span className="divider-line"></span>
                                </div>

                                <button type="button" className="social-btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
                                    <span className="social-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path d="M 15.003906 3 C 8.3749062 3 3 8.373 3 15 C 3 21.627 8.3749062 27 15.003906 27 C 25.013906 27 27.269078 17.707 26.330078 13 L 25 13 L 22.732422 13 L 15 13 L 15 17 L 22.738281 17 C 21.848702 20.448251 18.725955 23 15 23 C 10.582 23 7 19.418 7 15 C 7 10.582 10.582 7 15 7 C 17.009 7 18.839141 7.74575 20.244141 8.96875 L 23.085938 6.1289062 C 20.951937 4.1849063 18.116906 3 15.003906 3 z"/></svg>
                                    </span>
                                    <span>Continue with Google</span>
                                </button>
                            </form>

                            {/* Signup Form */}
                            <form id="signUp" className={`formView ${isSignupContent ? 'active' : ''}`} onSubmit={handleSignup} noValidate>
                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    </span>
                                    <input 
                                        type="text"
                                        placeholder="Username"
                                        name="username" 
                                        autoComplete="name"
                                        value={signupUsername}
                                        onChange={(e) => setSignupUsername(e.target.value)}
                                    />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                    </span>
                                    <input
                                        type="email"
                                        placeholder="Email address" 
                                        name="email"
                                        autoComplete="email"
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                    />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input
                                        type="password"
                                        placeholder="Create password"
                                        name="password"
                                        autoComplete="new-password"
                                        value={signupPassword}
                                        onChange={(e) => setSignupPassword(e.target.value)}
                                    />
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input 
                                        type="password"
                                        placeholder="Confirm password"
                                        name="confirmPassword"
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </label>

                                {signupPassword.length > 0 && (
                                    <div className="password-strength">
                                        <div className="strength-bar-track">
                                            {passwordRules.map((_, i) => (
                                                <span
                                                    key={i}
                                                    className="strength-bar-seg"
                                                    style={{
                                                        background: i < passedRulesCount ? strengthColor : undefined,
                                                    }}
                                                ></span>
                                            ))}
                                        </div>
                                        <p className={`strength-hint ${allRulesPassed ? "is-good" : ""}`}>
                                            {allRulesPassed ? "Strong password" : `Needs: ${missingLabels.join(", ")}`}
                                        </p>
                                    </div>
                                )}

                                {passwordsMismatch && (
                                    <p className="form-error" role="alert">Passwords do not match.</p>
                                )}

                                {isSignupContent && error && !passwordsMismatch && (
                                    <p className="form-error" role="alert">{error}</p>
                                )}

                                <button type="submit" className="submit-btn" disabled={isLoading || !isSignupComplete}>
                                    {isLoading ? "Creating account..." : "Create account"}
                                </button>
                            </form>
                        </div>
                    </div>
                </section>
            </main>

            {/* Forgot Password Model */}
            <div id="forgot" className={`modal ${showForgot ? 'visible' : ''}`} role="dialog" aria-modal="true" aria-label="Forgot password">
                <div className="modalBox">
                    <button type="button" className="modalClose" aria-label="Close forgot password" onClick={closeForgot}>×</button>

                    <div className="modalHead">
                        <p className="eyebrow" id="stepLabel">{stepLabel}</p>
                        <h3 id="stepTitle">{stepTitle}</h3>
                        <p className="modalCopy" id="stepText">{stepText}</p>
                    </div>

                    <div className={`step ${forgotStep === 1 ? 'active' : ''}`} id="step1">
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                            </span>
                            <input type="email" placeholder="Registered email address" autoComplete="email" />
                        </label>
                        <button type="button" className="submit-btn" onClick={() => setForgotStep(2)}>Send OTP</button>
                    </div>

                    <div className={`step ${forgotStep === 2 ? 'active' : ''}`} id="step2">
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input type="text" placeholder="Enter 6-digit OTP" maxLength={6} />
                        </label>
                        <button type="button" className="submit-btn" onClick={() => setForgotStep(3)}>Verify OTP</button>
                    </div>

                    <div className={`step ${forgotStep === 3 ? 'active' : ''}`} id="step3">
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input
                                type="password"
                                placeholder="New password"
                                autoComplete="new-password"
                            />
                        </label>
                        <label className="input-group modal-input">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input
                                type="password"
                                placeholder="Confirm password"
                                autoComplete="new-password"
                            />
                        </label>
                        <button type="button" className="submit-btn" onClick={() => setForgotStep(4)}>Reset Password</button>
                    </div>

                    <div className={`step ${forgotStep === 4 ? 'active' : ''}`} id="step4">
                        <p className="doneMsg">Password reset complete. You can now return to Sign In.</p>
                        <button type="button" className="submit-btn"
                            onClick={() => { closeForgot(); switchMode('login'); }}
                        >
                            Return to Sign In
                        </button>
                    </div>

                    <a className="link" href="#" onClick={(e) => { e.preventDefault(); closeForgot(); switchMode('login'); }}>Back to sign in</a>
                </div>
            </div>
        </div>
    );
}