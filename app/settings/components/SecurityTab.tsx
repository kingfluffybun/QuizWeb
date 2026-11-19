"use client";

import React, { useState } from "react";

interface SecurityTabProps {
  hasPassword: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordError: string | null;
  isPending: boolean;
  onCurrentPasswordChange: (val: string) => void;
  onNewPasswordChange: (val: string) => void;
  onConfirmPasswordChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SecurityTab({
  hasPassword,
  currentPassword,
  newPassword,
  confirmPassword,
  passwordError,
  isPending,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: SecurityTabProps) {
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const passHasLength = newPassword.length >= 8 && newPassword.length <= 24;
  const passHasUpper = /[A-Z]/.test(newPassword);
  const passHasLower = /[a-z]/.test(newPassword);
  const passHasDigit = /[0-9]/.test(newPassword);
  const passHasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);

  return (
    <section className="settings-section" aria-labelledby="heading-password">
      <h2 id="heading-password" className="settings-section-title">
        {hasPassword ? "Change Password" : "Set Account Password"}
      </h2>

      {!hasPassword && (
        <div className="settings-alert alert-warning" role="status">
          <div className="alert-content">
            <strong>Password Required for Staff Eligibility</strong>
            <p>
              Your account was created via OAuth. To enable email/password sign-in and qualify for
              staff roles (Maintainer or Admin), establish a compliant account password below.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="settings-form">
        {hasPassword && (
          <div className="settings-form-group">
            <label htmlFor="settings-current-password">Current Password</label>
            <div className="settings-input-wrapper">
              <input
                id="settings-current-password"
                type={showCurrentPass ? "text" : "password"}
                className="settings-input"
                value={currentPassword}
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                placeholder="Enter current password"
                disabled={isPending}
                required
              />
              <button
                type="button"
                className="settings-input-toggle"
                onClick={() => setShowCurrentPass(!showCurrentPass)}
                aria-label={showCurrentPass ? "Hide current password" : "Show current password"}
              >
                {showCurrentPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}

        <div className="settings-form-group">
          <label htmlFor="settings-new-password">New Password</label>
          <div className="settings-input-wrapper">
            <input
              id="settings-new-password"
              type={showNewPass ? "text" : "password"}
              className="settings-input"
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Enter new compliant password"
              disabled={isPending}
              required
            />
            <button
              type="button"
              className="settings-input-toggle"
              onClick={() => setShowNewPass(!showNewPass)}
              aria-label={showNewPass ? "Hide new password" : "Show new password"}
            >
              {showNewPass ? "Hide" : "Show"}
            </button>
          </div>

          <div className="password-requirements-box" aria-live="polite">
            <div className={`req-item ${passHasLength ? "met" : ""}`}>
              <span>{passHasLength ? "✔" : "○"}</span> 8–24 characters
            </div>
            <div className={`req-item ${passHasUpper ? "met" : ""}`}>
              <span>{passHasUpper ? "✔" : "○"}</span> At least 1 uppercase letter
            </div>
            <div className={`req-item ${passHasLower ? "met" : ""}`}>
              <span>{passHasLower ? "✔" : "○"}</span> At least 1 lowercase letter
            </div>
            <div className={`req-item ${passHasDigit ? "met" : ""}`}>
              <span>{passHasDigit ? "✔" : "○"}</span> At least 1 numeric digit
            </div>
            <div className={`req-item ${passHasSymbol ? "met" : ""}`}>
              <span>{passHasSymbol ? "✔" : "○"}</span> At least 1 special symbol
            </div>
          </div>
        </div>

        <div className="settings-form-group">
          <label htmlFor="settings-confirm-password">Confirm New Password</label>
          <div className="settings-input-wrapper">
            <input
              id="settings-confirm-password"
              type={showConfirmPass ? "text" : "password"}
              className="settings-input"
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              placeholder="Re-enter new password"
              disabled={isPending}
              required
            />
            <button
              type="button"
              className="settings-input-toggle"
              onClick={() => setShowConfirmPass(!showConfirmPass)}
              aria-label={showConfirmPass ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPass ? "Hide" : "Show"}
            </button>
          </div>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="settings-field-error" role="alert">
              Passwords do not match.
            </p>
          )}
        </div>

        {passwordError && (
          <p className="settings-field-error" role="alert">
            {passwordError}
          </p>
        )}

        <div className="settings-form-actions">
          <button
            type="submit"
            className="settings-btn settings-btn-primary"
            disabled={isPending || !newPassword || !confirmPassword}
          >
            {isPending
              ? "Processing..."
              : hasPassword
                ? "Change Password"
                : "Set Password"}
          </button>
        </div>
      </form>
    </section>
  );
}
