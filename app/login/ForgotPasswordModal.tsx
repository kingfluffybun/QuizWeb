"use client";

import { useEffect, useState } from "react";
import { reqPassReset, resetPass, verifyOTP } from "@/app/actions/auth";
import {
  EmailFieldIcon,
  LockFieldIcon,
  passwordRules,
  strengthLevels,
} from "./auth-constants";

interface ForgotPasswordModalProps {
  visible: boolean;
  isLoading: boolean;
  error: string;
  setError: (msg: string) => void;
  setIsLoading: (loading: boolean) => void;
  onClose: () => void;
  onReturnToLogin: () => void;
}

const FORGOT_COPY: Record<number, [string, string, string]> = {
  1: ["Step 1", "Enter your email", "Use the registered email address for your account."],
  2: ["Step 2", "Enter the sent OTP", "An OTP has been sent to your email."],
  3: ["Step 3", "Enter your new password", "Create a new password for your account."],
  4: ["Step 4", "Password reset complete", ""],
};

export default function ForgotPasswordModal({
  visible,
  isLoading,
  error,
  setError,
  setIsLoading,
  onClose,
  onReturnToLogin,
}: ForgotPasswordModalProps) {
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOTP, setForgotOTP] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otpSent, setOTPSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, onClose]);

  const resetLocalFields = () => {
    setForgotStep(1);
    setForgotEmail("");
    setForgotOTP("");
    setNewPassword("");
    setConfirmNewPassword("");
    setOTPSent(false);
    setError("");
  };

  const handleClose = () => {
    resetLocalFields();
    onClose();
  };

  const handleReturnToLogin = () => {
    resetLocalFields();
    onReturnToLogin();
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
  };

  const handleResetPass = async () => {
    if (newPassword.length < 8) {
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

  const [stepLabel, stepTitle, stepText] = FORGOT_COPY[forgotStep] ?? FORGOT_COPY[1];
  const passedNewRulesCount = passwordRules.filter((rule) => rule.test(newPassword)).length;
  const newPasswordMismatch =
    confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  return (
    <div
      className={`modal ${visible ? "visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Forgot password"
    >
      <div className="modalBox">
        <button
          type="button"
          className="modalClose"
          aria-label="Close forgot password"
          onClick={handleClose}
        >
          ×
        </button>

        <div className="modalHead">
          <p className="eyebrow">{stepLabel}</p>
          <h3>{stepTitle}</h3>
          <p className="modalCopy">{stepText}</p>
        </div>

        {/* Step 1 */}
        <div className={`step ${forgotStep === 1 ? "active" : ""}`}>
          <label className="input-group">
            <EmailFieldIcon />
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
          {otpSent && (
            <p className="form-success">If an account exists, an OTP has been sent.</p>
          )}
          <button type="button" className="submit-btn" onClick={handleSendOTP} disabled={isLoading}>
            {isLoading ? "Sending OTP..." : "Send OTP"}
          </button>
        </div>

        {/* Step 2 */}
        <div className={`step ${forgotStep === 2 ? "active" : ""}`}>
          <label className="input-group">
            <LockFieldIcon />
            <input
              type="text"
              placeholder=" "
              maxLength={6}
              value={forgotOTP}
              onChange={(e) => setForgotOTP(e.target.value.replace(/\D/g, ""))}
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
          <button type="button" className="social-btn" onClick={handleSendOTP} disabled={isLoading}>
            Resend OTP
          </button>
        </div>

        {/* Step 3 */}
        <div className={`step ${forgotStep === 3 ? "active" : ""}`}>
          <label className="input-group">
            <LockFieldIcon />
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
                      background:
                        i < passedNewRulesCount ? strengthLevels[passedNewRulesCount] : undefined,
                    }}
                  ></span>
                ))}
              </div>
              <p className="strength-hint">
                {passwordRules
                  .filter((r) => !r.test(newPassword))
                  .map((r) => r.label)
                  .join(", ")}
              </p>
            </div>
          )}

          <label className="input-group">
            <LockFieldIcon />
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
            <p className="form-error" role="alert">
              Passwords do not match.
            </p>
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
        <div className={`step ${forgotStep === 4 ? "active" : ""}`}>
          <p className="doneMsg">Password reset complete. You can now return to Sign In.</p>
          <button type="button" className="submit-btn" onClick={handleReturnToLogin}>
            Return to Sign In
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <a
          className="link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleReturnToLogin();
          }}
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
