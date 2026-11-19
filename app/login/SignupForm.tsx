"use client";

import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useState } from "react";
import { signUp } from "@/app/actions/auth";
import {
  EmailFieldIcon,
  LockFieldIcon,
  passwordRules,
  strengthLevels,
  UserFieldIcon,
} from "./auth-constants";

interface SignupFormProps {
  active: boolean;
  isLoading: boolean;
  error: string;
  attemptedSubmit: boolean;
  signupEmail: string;
  onSignupEmailChange: (email: string) => void;
  setAttemptedSubmit: (attempted: boolean) => void;
  setError: (msg: string) => void;
  setIsLoading: (loading: boolean) => void;
  onSignupSuccess: () => void;
}

function SignupFormInner({
  active,
  isLoading,
  error,
  attemptedSubmit,
  signupEmail,
  onSignupEmailChange,
  setAttemptedSubmit,
  setError,
  setIsLoading,
  onSignupSuccess,
}: SignupFormProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const [recaptchaLoading, setRecaptchaLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");

  const passedRulesCount = passwordRules.filter((rule) => rule.test(signupPassword)).length;
  const allRulesPassed = passedRulesCount === passwordRules.length;
  const missingLabels = passwordRules
    .filter((rule) => !rule.test(signupPassword))
    .map((rule) => rule.label);
  const strengthColor = strengthLevels[passedRulesCount];

  const isSignupComplete =
    signupUsername.trim() !== "" &&
    /\S+@\S+\.\S+/.test(signupEmail) &&
    allRulesPassed &&
    signupPassword === confirmPassword &&
    confirmPassword !== "" &&
    recaptchaVerified;

  const passwordsMismatch =
    attemptedSubmit && confirmPassword.length > 0 && signupPassword !== confirmPassword;

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    setAttemptedSubmit(true);

    const formData = new FormData(e.currentTarget);
    const password = (formData.get("password") as string) ?? "";
    const confirmPass = (formData.get("confirmPassword") as string) ?? "";

    const failedRules = passwordRules.filter((rule) => !rule.test(password));
    const mismatched = password !== confirmPass;

    if (failedRules.length > 0 || mismatched) {
      if (mismatched) setError("Passwords do not match.");
      return;
    }

    if (!recaptchaVerified) {
      setError("Please verify that you are not a robot.");
      return;
    }

    let token = recaptchaToken;
    if (executeRecaptcha) {
      try {
        token = await executeRecaptcha("signup");
      } catch {
        // Fallback to state token
      }
    }
    formData.set("recaptchaToken", token || "");

    setIsLoading(true);
    const result = await signUp(formData);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setSignupPassword("");
    setConfirmPassword("");
    setRecaptchaVerified(false);
    setRecaptchaToken("");
    onSignupSuccess();
  }

  const handleReCaptchaVerify = async () => {
    if (!executeRecaptcha) {
      setError("ReCaptcha failed to load. Please refresh the page");
      return;
    }
    setRecaptchaLoading(true);
    setError("");

    try {
      const token = await executeRecaptcha("signup");
      if (token) {
        setRecaptchaToken(token);
        setRecaptchaVerified(true);
      } else {
        setError("ReCaptcha failed to verify. Please try again.");
        setRecaptchaVerified(false);
      }
    } catch (err) {
      console.error(err);
      setError("ReCaptcha failed to verify. Please try again.");
      setRecaptchaVerified(false);
    } finally {
      setRecaptchaLoading(false);
    }
  };

  return (
    <form className={`formView ${active ? "active" : ""}`} onSubmit={handleSignup} noValidate>
      <label className="input-group">
        <UserFieldIcon />
        <input
          type="text"
          placeholder=" "
          name="username"
          autoComplete="name"
          value={signupUsername}
          onChange={(e) => setSignupUsername(e.target.value)}
        />
        <span className="floating-label">Username</span>
      </label>

      <label className="input-group">
        <EmailFieldIcon />
        <input
          type="email"
          placeholder=" "
          name="email"
          autoComplete="email"
          value={signupEmail}
          onChange={(e) => onSignupEmailChange(e.target.value)}
        />
        <span className="floating-label">Email address</span>
      </label>

      <label className="input-group">
        <LockFieldIcon />
        <input
          type="password"
          placeholder=" "
          name="password"
          autoComplete="new-password"
          value={signupPassword}
          onChange={(e) => setSignupPassword(e.target.value)}
        />
        <span className="floating-label">Create password</span>
      </label>

      <label className="input-group">
        <LockFieldIcon />
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
          <p className={`strength-hint ${allRulesPassed ? "is-good" : ""}`}>
            {allRulesPassed ? "Strong password" : `Needs: ${missingLabels.join(", ")}`}
          </p>
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
        </div>
      )}

      {passwordsMismatch && (
        <p className="form-error" role="alert">
          Passwords do not match.
        </p>
      )}

      {active && error && !passwordsMismatch && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {active && (
        <div className="recaptcha-container">
          <button
            type="button"
            className={`recaptcha-btn ${recaptchaVerified ? "verified" : ""}`}
            onClick={handleReCaptchaVerify}
            disabled={recaptchaLoading || recaptchaVerified}
          >
            {recaptchaVerified ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Verified</span>
              </>
            ) : recaptchaLoading ? (
              <>
                <span className="spinner" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>I&apos;m not a robot</span>
              </>
            )}
          </button>
          <p className="recaptcha-terms">
            Protected by reCAPTCHA and subject to the Google{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            .
          </p>
        </div>
      )}

      <button type="submit" className="submit-btn" disabled={isLoading || !isSignupComplete}>
        {isLoading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

export default function SignupForm(props: SignupFormProps & { recaptchaEnabled: boolean }) {
  const { recaptchaEnabled, ...formProps } = props;

  if (!recaptchaEnabled) {
    return <SignupFormInner {...formProps} />;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
        nonce: undefined,
      }}
    >
      <SignupFormInner {...formProps} />
    </GoogleReCaptchaProvider>
  );
}
