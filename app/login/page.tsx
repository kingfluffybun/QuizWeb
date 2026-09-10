"use client";

import { useGoogleReCaptcha, GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { signUp, reqPassReset, verifyOTP, resetPass, sendSignupOTP, verifySignupOTP, resendSignupOTP } from "@/app/actions/auth";
import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as Assets from "@/app/components/illustrations/svg_assets";
import LoginQuiz from "@/app/components/loginQuiz";
import Image from "next/image";
import Link from "next/link";
import "#css/login.css";
import "#css/nav.css";

const passwordRules = [
    { key: "length", label: "8+ characters", test: (pw: string) => pw.length >= 8 },
    { key: "maxlength", label: "24 max characters", test: (pw: string) => pw.length <= 24 },
    { key: "upper", label: "uppercase", test: (pw: string) => /[A-Z]/.test(pw) },
    { key: "lower", label: "lowercase", test: (pw: string) => /[a-z]/.test(pw) },
    { key: "number", label: "number", test: (pw: string) => /[0-9]/.test(pw) },
    { key: "special", label: "symbol", test: (pw: string) => /[!@#$%^&*]/.test(pw) },
];

const strengthLevels = ["#333333","#e5484d", "#e5484d", "#f5a623", "#f5c518", "#8bc34a", "#34c759"];

function AuthPage() {
    const { executeRecaptcha } = useGoogleReCaptcha();
    const router = useRouter();

    const [mode, setMode] = useState<"login" | "signup">("login");
    const [contentMode, setContentMode] = useState<"login" | "signup">("login");
    const [isFading, setIsFading] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotStep, setForgotStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Login state
    const [loginEmail, setLoginEmail] = useState("");

    // Signup state
    const [signupUsername, setSignupUsername] = useState("");
    const [signupEmail, setSignupEmail] = useState("");
    const [signupPassword, setSignupPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);

    // Signup OTP state
    const [signupStep, setSignupStep] = useState<1 | 2>(1);
    const [signupOTP, setSignupOTP] = useState("");
    const [signupOTPSent, setSignupOTPSent] = useState(false);
    const [signupOtpSuccess, setSignupOtpSuccess] = useState("");
    const [signupVerificationToken, setSignupVerificationToken] = useState("");
    const [signupResendCooldown, setSignupResendCooldown] = useState(0);
    const [isSendingSignupOTP, setIsSendingSignupOTP] = useState(false);
    const [isVerifyingSignupOTP, setIsVerifyingSignupOTP] = useState(false);

    // ReCaptcha
    const [recaptchaVerified, setRecaptchaVerified] = useState(false);
    const [recaptchaLoading, setRecaptchaLoading] = useState(false);
    const [recaptchaToken, setRecaptchaToken] = useState("");

    // Forgot pass states
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotOTP, setForgotOTP] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [otpSent, setOTPSent] = useState(false);

    const fadeToken = useRef(0);
    const FADE_MS = 260;

    // Countdown effect for resending signup OTP
    useEffect(() => {
        if (signupResendCooldown <= 0) return;
        const timer = setInterval(() => {
            setSignupResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [signupResendCooldown]);

    // === Login ===
    async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isLoading) return;
        setError("");

        const formData = new FormData(e.currentTarget);
        const email = ((formData.get("email") as string) || loginEmail)?.trim().toLowerCase();
        const password = formData.get("password") as string;

        if (!email || !password) {
            setError("Please enter your email and password.");
            return;
        }

        setIsLoading(true);

        try {
            const res = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (res?.error) {
                setError("Invalid email or password, or your email has not been verified.");
                return;
            }

            router.push("/");
            router.refresh();
            return;
        } catch (err: unknown) {
            console.error("Login error:", err);
            const msg = err instanceof Error ? err.message : "Failed to sign in. Please try again.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }

    // === Signup OTP: Step 1 Send Code ===
    async function handleSendSignupOTP() {
        if (isSendingSignupOTP) return;
        setError("");
        setSignupOtpSuccess("");

        const cleanUser = signupUsername.trim();
        const cleanEmail = signupEmail.trim().toLowerCase();

        if (!cleanUser || cleanUser.length < 2) {
            setError("Please enter a valid username (at least 2 characters).");
            return;
        }
        if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
            setError("Please enter a valid email address.");
            return;
        }
        if (!recaptchaVerified) {
            setError("Please complete the 'I'm not a robot' verification first.");
            return;
        }

        setIsSendingSignupOTP(true);

        try {
            const result = await sendSignupOTP(cleanEmail, cleanUser, recaptchaToken);
            if (result?.error) {
                setError(result.error);
                if (result.error.toLowerCase().includes("recaptcha") || result.error.toLowerCase().includes("robot")) {
                    setRecaptchaVerified(false);
                    setRecaptchaToken("");
                }
                return;
            }

            setSignupOTPSent(true);
            setSignupOtpSuccess(result.message || `Verification code sent to ${cleanEmail}`);
            setSignupResendCooldown(60);
        } catch (err: unknown) {
            console.error("sendSignupOTP error:", err);
            setError("Failed to send verification code. Please try again.");
        } finally {
            setIsSendingSignupOTP(false);
        }
    }

    // === Signup OTP: Step 1 Verify Code ===
    async function handleVerifySignupOTP() {
        if (isVerifyingSignupOTP) return;
        setError("");

        const cleanOtp = signupOTP.trim();
        if (!cleanOtp || cleanOtp.length !== 6) {
            setError("Please enter the 6-digit verification code sent to your email.");
            return;
        }

        setIsVerifyingSignupOTP(true);

        try {
            const result = await verifySignupOTP(signupEmail.trim().toLowerCase(), cleanOtp);
            if (result?.error) {
                setError(result.error);
                return;
            }

            if (result.verificationToken) {
                setSignupVerificationToken(result.verificationToken);
                setSignupStep(2);
                setError("");
                setSignupOtpSuccess("");
            } else {
                setError("Verification failed. Please request a new code.");
            }
        } catch (err: unknown) {
            console.error("verifySignupOTP error:", err);
            setError("Failed to verify code. Please try again.");
        } finally {
            setIsVerifyingSignupOTP(false);
        }
    }

    // === Signup OTP: Resend Code ===
    async function handleResendSignupOTP() {
        if (signupResendCooldown > 0 || isSendingSignupOTP) return;
        setError("");
        setSignupOtpSuccess("");
        setIsSendingSignupOTP(true);

        try {
            const result = await resendSignupOTP(signupEmail.trim().toLowerCase(), signupUsername.trim());
            if (result?.error) {
                setError(result.error);
                return;
            }
            setSignupResendCooldown(60);
            setSignupOtpSuccess("A new verification code has been sent to your email.");
        } catch (err: unknown) {
            console.error("resendSignupOTP error:", err);
            setError("Failed to resend code. Please try again.");
        } finally {
            setIsSendingSignupOTP(false);
        }
    }

    // === Signup: Step 2 Finalize Account Creation ===
    async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (isLoading) return;
        setError("");
        setAttemptedSubmit(true);

        if (signupStep !== 2 || !signupVerificationToken) {
            setError("Please verify your email address before creating an account.");
            setSignupStep(1);
            return;
        }

        const cleanUser = signupUsername.trim();
        const cleanEmail = signupEmail.trim().toLowerCase();

        const failedRules = passwordRules.filter((rule) => !rule.test(signupPassword));
        const mismatched = signupPassword !== confirmPassword;

        if (failedRules.length > 0 || mismatched) {
            if (mismatched) {
                setError("Passwords do not match.");
            }
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.set("username", cleanUser);
            formData.set("email", cleanEmail);
            formData.set("password", signupPassword);
            formData.set("confirmPassword", confirmPassword);
            formData.set("verificationToken", signupVerificationToken);

            // 1. Create account in database
            const result = await signUp(formData);

            if (result?.error) {
                setError(result.error);
                if (result.error.toLowerCase().includes("verification") || result.error.toLowerCase().includes("expired")) {
                    setSignupStep(1);
                    setSignupOTPSent(false);
                    setSignupVerificationToken("");
                }
                return;
            }

            // 2. Account successfully created! Pre-fill login email
            setLoginEmail(cleanEmail);

            // 3. Attempt automatic login
            try {
                const res = await signIn("credentials", {
                    email: cleanEmail,
                    password: signupPassword,
                    redirect: false,
                });

                if (res?.error) {
                    setError("Account created successfully! Please sign in with your password.");
                    switchMode('login');
                    return;
                }

                router.push("/");
                router.refresh();
                return;
            } catch (authErr) {
                console.warn("Auto-login error after signup:", authErr);
                setError("Account created successfully! Please sign in with your password.");
                switchMode('login');
                return;
            }
        } catch (err: unknown) {
            console.error("Signup error:", err);
            const msg = err instanceof Error ? err.message : "Failed to create account. Please try again.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }

    // === ReCaptcha ===
    const handleReCaptchaVerify = async () => {
        if (!executeRecaptcha) {
            setError("ReCaptcha failed to load. Please refresh the page.");
            return;
        }
        setRecaptchaLoading(true);
        setError("");

        try {
            const timeoutPromise = new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("reCAPTCHA verification timed out")), 6000)
            );
            const token = await Promise.race([executeRecaptcha("signup"), timeoutPromise]);
            if (token) {
                setRecaptchaToken(token);
                setRecaptchaVerified(true);
            } else {
                setError("ReCaptcha failed to verify. Please try again.");
                setRecaptchaVerified(false);
                setRecaptchaToken("");
            }
        } catch (err) {
            console.error("reCAPTCHA client verification error:", err);
            setError("ReCaptcha verification timed out or failed. Please try again.");
            setRecaptchaVerified(false);
            setRecaptchaToken("");
        } finally {
            setRecaptchaLoading(false);
        }
    };

    // === Forgot Pass ===
    const openForgot = () => {
        setShowForgot(true);
        setForgotStep(1);
        setForgotEmail("");
        setForgotOTP("");
        setNewPassword("");
        setConfirmNewPassword("");
        setOTPSent(false);
        setError("");
    };
    const closeForgot = () => {
        setShowForgot(false);
        setForgotStep(1);
        setError("");
    };

    const handleSendOTP = async () => {
        if (!forgotEmail || !/\S+@\S+\.\S+/.test(forgotEmail)) {
            setError("Please enter a valid email address.");
            return;
        }
        setIsLoading(true);
        setError("");

        const result = await reqPassReset(forgotEmail);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
            return;
        }

        setOTPSent(true);
        setForgotStep(2);
        setIsLoading(false);
        setError("");
    };

    const handleVerifyOTP = async () => {
        if (!forgotOTP || forgotOTP.length !== 6) {
            setError("Please enter the sent OTP.");
            return;
        }
        setIsLoading(true);
        setError("");

        const result = await verifyOTP(forgotEmail, forgotOTP);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
            return;
        }

        setForgotStep(3);
        setIsLoading(false);
    }

    const handleResetPass = async () => {
        if (newPassword.length < 8 ) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError("Passwords do not match.");
            return;
        }
        setIsLoading(true);
        setError("");

        const result = await resetPass(forgotEmail, forgotOTP, newPassword);

        if (result?.error) {
            setError(result.error);
            setIsLoading(false);
            return;
        }

        setForgotStep(4);
        setIsLoading(false);
    };

    // === Switching ===
    const switchMode = (newMode: 'login' | 'signup') => {
        if (newMode === mode || isFading) return;
        setIsFading(true);
        setMode(newMode);
        setError("");
        setAttemptedSubmit(false);
        setRecaptchaVerified(false);
        setRecaptchaToken("");
        setSignupStep(1);
        setSignupOTP("");
        setSignupOTPSent(false);
        setSignupOtpSuccess("");
        setSignupVerificationToken("");
        setSignupResendCooldown(0);

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

    // === Rendering ===
    const isSignup = mode === 'signup';
    const isSignupContent = contentMode === 'signup';
    const fadeClass = isFading ? 'text-fade-out' : '';

    const passedRulesCount = passwordRules.filter((rule) => rule.test(signupPassword)).length;
    const allRulesPassed = passedRulesCount === passwordRules.length;
    const missingLabels = passwordRules.filter((rule) => !rule.test(signupPassword)).map((rule) => rule.label);
    const strengthColor = strengthLevels[passedRulesCount];

    const isSignupComplete = 
        signupUsername.trim().length >= 2 &&
        /\S+@\S+\.\S+/.test(signupEmail) &&
        allRulesPassed &&
        signupPassword === confirmPassword &&
        confirmPassword !== "" &&
        signupVerificationToken !== "";
    
    const forgotCopy: Record<number, [string, string, string]> = {
        1: ['Step 1', 'Enter your email', 'Use the registered email address for your account.'],
        2: ['Step 2', 'Enter the sent OTP', 'An OTP has been sent to your email.'],
        3: ['Step 3', 'Enter your new password', 'Create a new password for your account.'],
        4: ['Step 4', 'Password reset complete', ''],
    };
    const [stepLabel, stepTitle, stepText] = forgotCopy[forgotStep];

    const passwordsMismatch = attemptedSubmit && confirmPassword.length > 0 && signupPassword !== confirmPassword;
    const newPasswordMismatch = attemptedSubmit && newPassword.length > 0 && newPassword !== confirmPassword;

    const panelTitle = isSignupContent ? 'Create account' : 'Welcome back';
    const panelText = isSignupContent ? 'Start learning with QuizWeb in minutes.' : 'Pick up your WebDev quizzes where you left off.';
    const toggleText = isSignupContent ? 'Already have an account? Sign in' : 'New here? Create account';

    const formLabelText = isSignupContent 
        ? (signupStep === 2 ? 'Step 2 of 2' : 'Step 1 of 2') 
        : 'Access your account';
    const formTitleText = isSignupContent 
        ? (signupStep === 2 ? 'Set password' : 'Create account') 
        : 'Sign in';
    const formTextText = isSignupContent 
        ? (signupStep === 2 
            ? 'Create a secure password to complete your registration.' 
            : (signupOTPSent ? `Enter the 6-digit code sent to ${signupEmail.trim() || 'your email'}.` : "Verify your email to get started."))
        : 'Use your email and password to continue.';

    // HTML
    return (
        <div className="auth-page">
            <main className={`auth-card ${isSignup ? 'is-signup' : ''}`}>
                {/* Info */}
                <section className="info" aria-label="Authentication info">
                    <div className="brand">
                        <div className="brand-mark">
                            <Image src="/assets/QuizWeb-Logo.svg" alt="" width={45} height={45} />
                        </div>
                        <span>QuizWeb</span>
                    </div>

                    <div className="panel">
                        <h1 className={fadeClass} id="panelTitle">{panelTitle}</h1>
                        <p className={fadeClass} id="panelText">{panelText}</p>
                        <a
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

                    <div className="login-cloudscape" aria-hidden="true">
                        {/* Light */}
                        <div className="login-cloud login-cloud-top-left" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsTopLeft /></div>
                        <div className="login-cloud login-cloud-top-right" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsTopRight /></div>
                        <div className="login-cloud login-cloud-bottom-left" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsLeft /></div>
                        <div className="login-cloud login-cloud-bottom-right" aria-hidden="true" data-hide-on-theme="dark"><Assets.CloudsRight /></div>
                        {/* <Image src="/assets/landing-page/Clouds-topleft.svg" alt="" width={100} height={100} className="login-cloud login-cloud-top-left dark:hidden" priority data-hide-on-theme="dark"/>
                        <Image src="/assets/landing-page/Clouds-topright.svg" alt="" width={100} height={100} className="login-cloud login-cloud-top-right dark:hidden" priority data-hide-on-theme="dark"/> */}
                        {/* <Image src="/assets/landing-page/Clouds-left.svg" alt="" width={100} height={100} className="login-cloud login-cloud-bottom-left dark:hidden" data-hide-on-theme="dark"/>
                        <Image src="/assets/landing-page/Clouds-right.svg" alt="" width={100} height={100} className="login-cloud login-cloud-bottom-right dark:hidden" data-hide-on-theme="dark"/> */}

                        {/* Dark */}
                        <div className="login-cloud login-cloud-top-left" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsTopLeftDark /></div>
                        <div className="login-cloud login-cloud-top-right" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsTopRightDark /></div>
                        <div className="login-cloud login-cloud-bottom-left" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsLeftDark /></div>
                        <div className="login-cloud login-cloud-bottom-right" aria-hidden="true" data-hide-on-theme="light"><Assets.CloudsRightDark /></div>
                        {/* <Image src="/assets/landing-page/Clouds-topleft-dark.svg" alt="" width={100} height={100} className="login-cloud login-cloud-top-left hidden dark:block" priority data-hide-on-theme="light"/>
                        <Image src="/assets/landing-page/Clouds-topright-dark.svg" alt="" width={100} height={100} className="login-cloud login-cloud-top-right hidden dark:block" priority data-hide-on-theme="light"/> */}
                        {/* <Image src="/assets/landing-page/Clouds-left-dark.svg" alt="" width={100} height={100} className="login-cloud login-cloud-bottom-left hidden dark:block" data-hide-on-theme="light"/>
                        <Image src="/assets/landing-page/Clouds-right-dark.svg" alt="" width={100} height={100} className="login-cloud login-cloud-bottom-right hidden dark:block" data-hide-on-theme="light"/> */}
                    </div>

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
                            <form className={`formView ${!isSignupContent ? 'active' : ''}`} noValidate onSubmit={handleLogin}>
                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                    </span>
                                    <input 
                                        type="email" 
                                        placeholder=" " 
                                        name="email" 
                                        autoComplete="email" 
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                    />
                                    <span className="floating-label">Email address</span>
                                </label>

                                <label className="input-group">
                                    <span className="field-icon" aria-hidden="true">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                    </span>
                                    <input 
                                        type="password"
                                        placeholder=" "
                                        name="password"
                                        autoComplete="current-password"
                                    />
                                    <span className="floating-label">Password</span>
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

                                <button type="submit" className="submit-btn" disabled={isLoading}>
                                    {isLoading ? "Signing in..." : "Sign in"}
                                </button>

                                <div className="divider-row" aria-hidden="true">
                                    <span className="divider-line"></span>
                                    <span className="divider-text">Or sign in with</span>
                                    <span className="divider-line"></span>
                                </div>

                                <div className="social-row">
                                    <button type="button" className="social-btn" onClick={() => signIn("google", { callbackUrl: "/" })}>
                                        <span className="social-icon" aria-hidden="true">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><path d="M 15.003906 3 C 8.3749062 3 3 8.373 3 15 C 3 21.627 8.3749062 27 15.003906 27 C 25.013906 27 27.269078 17.707 26.330078 13 L 25 13 L 22.732422 13 L 15 13 L 15 17 L 22.738281 17 C 21.848702 20.448251 18.725955 23 15 23 C 10.582 23 7 19.418 7 15 C 7 10.582 10.582 7 15 7 C 17.009 7 18.839141 7.74575 20.244141 8.96875 L 23.085938 6.1289062 C 20.951937 4.1849063 18.116906 3 15.003906 3 z"/></svg>
                                        </span>
                                        <span>Google</span>
                                    </button>

                                    <button type="button" className="social-btn" onClick={() => signIn("github", { callbackUrl: "/" })}>
                                        <span className="social-icon" aria-hidden="true">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-github" viewBox="0 0 16 16">
                                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
                                            </svg>
                                        </span>
                                        <span>Github</span>
                                    </button>
                                </div>
                            </form>

                            {/* Signup Form */}
                            <form className={`formView ${isSignupContent ? 'active' : ''}`} onSubmit={handleSignup} noValidate>
                                {signupStep === 1 ? (
                                    <>
                                        <label className="input-group">
                                            <span className="field-icon" aria-hidden="true">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            </span>
                                            <input 
                                                type="text"
                                                placeholder=" "
                                                name="username" 
                                                autoComplete="name"
                                                value={signupUsername}
                                                onChange={(e) => setSignupUsername(e.target.value)}
                                                disabled={signupOTPSent || isSendingSignupOTP}
                                            />
                                            <span className="floating-label">Username</span>
                                        </label>

                                        <label className="input-group">
                                            <span className="field-icon" aria-hidden="true">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                            </span>
                                            <input
                                                type="email"
                                                placeholder=" " 
                                                name="email"
                                                autoComplete="email"
                                                value={signupEmail}
                                                onChange={(e) => setSignupEmail(e.target.value)}
                                                disabled={signupOTPSent || isSendingSignupOTP}
                                            />
                                            <span className="floating-label">Email address</span>
                                        </label>

                                        {!signupOTPSent ? (
                                            <>
                                                <div className="recaptcha-container">
                                                    <button
                                                        type="button"
                                                        className={`recaptcha-btn ${recaptchaVerified ? "verified" : ""}`}
                                                        onClick={handleReCaptchaVerify}
                                                        disabled={recaptchaLoading || recaptchaVerified}
                                                    >
                                                        {recaptchaVerified ? (
                                                            <>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                                <span>Verified</span>
                                                            </>
                                                        ) : recaptchaLoading ? (
                                                            <>
                                                                <span className="spinner" />
                                                                <span>Verifying...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                                <span>I&apos;m not a robot</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <p className="recaptcha-terms">
                                                        Protected by reCAPTCHA and subject to the Google{" "}
                                                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                                        {" "}and{" "}
                                                        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
                                                    </p>
                                                </div>

                                                {isSignupContent && error && (
                                                    <p className="form-error" role="alert">{error}</p>
                                                )}

                                                <button 
                                                    type="button" 
                                                    className="submit-btn" 
                                                    onClick={handleSendSignupOTP}
                                                    disabled={isSendingSignupOTP || !recaptchaVerified || signupUsername.trim().length < 2 || !/\S+@\S+\.\S+/.test(signupEmail.trim())}
                                                >
                                                    {isSendingSignupOTP ? (
                                                        <>
                                                            <span className="spinner" />
                                                            <span>Sending verification code...</span>
                                                        </>
                                                    ) : (
                                                        "Send verification code"
                                                    )}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="otp-sent-banner">
                                                    <div className="otp-sent-info">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                                                        <span>Code sent to <strong>{signupEmail.trim()}</strong></span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="otp-change-btn"
                                                        onClick={() => {
                                                            setSignupOTPSent(false);
                                                            setSignupOTP("");
                                                            setError("");
                                                            setSignupOtpSuccess("");
                                                        }}
                                                    >
                                                        Change
                                                    </button>
                                                </div>

                                                <label className="input-group">
                                                    <span className="field-icon" aria-hidden="true">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                    </span>
                                                    <input 
                                                        type="text"
                                                        placeholder=" "
                                                        maxLength={6}
                                                        inputMode="numeric"
                                                        autoComplete="one-time-code"
                                                        value={signupOTP}
                                                        onChange={(e) => setSignupOTP(e.target.value.replace(/\D/g, ''))}
                                                        disabled={isVerifyingSignupOTP}
                                                        autoFocus
                                                    />
                                                    <span className="floating-label">Enter 6-digit code</span>
                                                </label>

                                                {isSignupContent && error && (
                                                    <p className="form-error" role="alert">{error}</p>
                                                )}

                                                {signupOtpSuccess && !error && (
                                                    <p className="form-success" role="status">{signupOtpSuccess}</p>
                                                )}

                                                <button
                                                    type="button"
                                                    className="submit-btn"
                                                    onClick={handleVerifySignupOTP}
                                                    disabled={isVerifyingSignupOTP || signupOTP.length !== 6}
                                                >
                                                    {isVerifyingSignupOTP ? (
                                                        <>
                                                            <span className="spinner" />
                                                            <span>Verifying code...</span>
                                                        </>
                                                    ) : (
                                                        "Verify & Continue"
                                                    )}
                                                </button>

                                                <div className="otp-resend-row">
                                                    <span className="otp-resend-text">Didn&apos;t receive the code?</span>
                                                    {signupResendCooldown > 0 ? (
                                                        <span className="otp-cooldown">Resend in {signupResendCooldown}s</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="otp-resend-btn"
                                                            onClick={handleResendSignupOTP}
                                                            disabled={isSendingSignupOTP}
                                                        >
                                                            {isSendingSignupOTP ? "Sending..." : "Resend code"}
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="verified-email-card">
                                            <div className="verified-email-pill">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                <span>Verified: <strong>{signupEmail.trim()}</strong></span>
                                            </div>
                                            <button
                                                type="button"
                                                className="otp-change-btn"
                                                onClick={() => {
                                                    setSignupStep(1);
                                                    setSignupOTPSent(false);
                                                    setSignupOTP("");
                                                    setSignupVerificationToken("");
                                                    setError("");
                                                }}
                                            >
                                                Change
                                            </button>
                                        </div>

                                        <label className="input-group">
                                            <span className="field-icon" aria-hidden="true">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                            </span>
                                            <input
                                                type="password"
                                                placeholder=" "
                                                name="password"
                                                autoComplete="new-password"
                                                value={signupPassword}
                                                onChange={(e) => setSignupPassword(e.target.value)}
                                                autoFocus
                                            />
                                            <span className="floating-label">Create password</span>
                                        </label>

                                        <label className="input-group">
                                            <span className="field-icon" aria-hidden="true">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                            </span>
                                            <input 
                                                type="password"
                                                placeholder=" "
                                                name="confirmPassword"
                                                autoComplete="new-password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                            <span className="floating-label">Confirm password</span>
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
                                            {isLoading ? (
                                                <>
                                                    <span className="spinner" />
                                                    <span>Creating account...</span>
                                                </>
                                            ) : (
                                                "Create account"
                                            )}
                                        </button>
                                    </>
                                )}
                            </form>
                        </div>
                    </div>
                    <Link href="/" className="back-landing" aria-label="Back to Landing Page" title="Back to Landing Page">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M9 14 4 9l5-5" />
                            <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                        </svg>
                        <span>Back</span>
                    </Link>
                </section>
            </main>

            {/* Forgot Password Model */}
            <div className={`modal ${showForgot ? 'visible' : ''}`} role="dialog" aria-modal="true" aria-label="Forgot password">
                <div className="modalBox">
                    <button type="button" className="modalClose" aria-label="Close forgot password" onClick={closeForgot}>×</button>

                    <div className="modalHead">
                        <p className="eyebrow">{stepLabel}</p>
                        <h3>{stepTitle}</h3>
                        <p className="modalCopy">{stepText}</p>
                    </div>

                    {/* Step 1 */}
                    <div className={`step ${forgotStep === 1 ? 'active' : ''}`}>
                        <label className="input-group">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                            </span>
                            <input
                                type="email"
                                placeholder=" "
                                autoComplete="email" 
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                disabled={isLoading}
                            />
                            <span className="floating-label">Registered email address</span>
                        </label>
                        {otpSent && <p className="form-success">If an account exists, an OTP has been sent.</p>}
                        <button
                            type="button"
                            className="submit-btn" 
                            onClick={handleSendOTP}
                            disabled={isLoading}
                        >
                            {isLoading ? "Sending OTP..." : "Send OTP"}
                        </button>
                    </div>

                    {/* Step 2 */}
                    <div className={`step ${forgotStep === 2 ? 'active' : ''}`}>
                        <label className="input-group">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input
                                type="text"
                                placeholder=" "
                                maxLength={6}
                                value={forgotOTP}
                                onChange={(e) => setForgotOTP(e.target.value.replace(/\D/g, ''))}
                                disabled={isLoading}
                            />
                            <span className="floating-label">Enter 6-digit OTP</span>
                        </label>
                        <button
                            type="button"
                            className="submit-btn"
                            onClick={handleVerifyOTP}
                            disabled={isLoading || forgotOTP.length !== 6}
                        >
                            {isLoading ? "Verifying OTP..." : "Verify OTP"}
                        </button>
                        <button
                            type="button"
                            className="social-btn"
                            onClick={handleSendOTP}
                            disabled={isLoading}
                        >
                            Resend OTP
                        </button>
                    </div>
                    
                    {/* Step 3 */}
                    <div className={`step ${forgotStep === 3 ? 'active' : ''}`}>
                        <label className="input-group">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input
                                type="password"
                                placeholder=" "
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={isLoading}
                            />
                            <span className="floating-label">New password</span>
                        </label>
                        
                        {newPassword.length > 0 && (
                            <div className="password-strength">
                                <div className="strength-bar-track">
                                    {passwordRules.map((_, i) => (
                                        <span
                                            key={i}
                                            className="strength-bar-seg"
                                            style={{
                                                background: i < passwordRules.filter(r => r.test(newPassword)).length ?
                                                strengthLevels[passwordRules.filter(r => r.test(newPassword)).length] : undefined,
                                            }}
                                        ></span>
                                    ))}
                                </div>
                                <p className="strength-hint">
                                    {passwordRules.filter(r => !r.test(newPassword)).map(r => r.label).join(", ")}
                                </p>
                            </div>
                        )}

                        <label className="input-group">
                            <span className="field-icon" aria-hidden="true">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </span>
                            <input
                                type="password"
                                placeholder=" "
                                autoComplete="new-password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                disabled={isLoading}
                            />
                            <span className="floating-label">Confirm password</span>
                        </label>

                        {newPasswordMismatch && (
                            <p className="form-error" role="alert">Passwords do not match.</p>
                        )}

                        <button
                            type="button"
                            className="submit-btn"
                            onClick={handleResetPass}
                            disabled={isLoading || newPassword.length < 8 || newPassword !== confirmNewPassword}
                        >
                            {isLoading ? "Resetting password..." : "Reset Password"}
                        </button>
                    </div>
                    
                    {/* Step 4 */}
                    <div className={`step ${forgotStep === 4 ? 'active' : ''}`}>
                        <p className="doneMsg">Password reset complete. You can now return to Sign In.</p>
                        <button
                            type="button"
                            className="submit-btn"
                            onClick={() => { closeForgot(); switchMode('login'); }}
                        >
                            Return to Sign In
                        </button>
                    </div>

                    {error && <p className="form-error" role="alert">{error}</p>}

                    <a className="link" href="#" onClick={(e) => { e.preventDefault(); closeForgot(); switchMode('login'); }}>Back to sign in</a>
                </div>
            </div>
        </div>
    );
}

export default function AuthLoad() {
    return (
        <GoogleReCaptchaProvider 
            reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
            scriptProps={{
                async: false,
                defer: false,
                appendTo: "head",
                nonce: undefined
            }}
        >
                <AuthPage />
        </GoogleReCaptchaProvider>
    );
}