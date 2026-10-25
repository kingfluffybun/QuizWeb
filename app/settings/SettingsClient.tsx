"use client";

import React, { useState, useEffect, useTransition, useSyncExternalStore } from "react";
import Link from "next/link";
import { updateUsername, changePassword, setPasswordForOAuth } from "@/app/actions/credentials";

export interface SettingsUserData {
  id: string;
  email: string;
  username: string;
  role: string;
  hasPassword: boolean;
}

interface SettingsClientProps {
  initialUser: SettingsUserData | null;
}

// Regex rules matching authoritative contracts
const USERNAME_REGEX = /^[a-zA-Z0-9_.\- ]{3,30}$/;
const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,24}$/;

const emptySubscribe = () => () => {};

interface AccessibilitySettings {
  theme: string;
  uiScale: string;
  reduceMotion: boolean;
}

const defaultAccessibility: AccessibilitySettings = {
  theme: "system",
  uiScale: "100",
  reduceMotion: false,
};

let cachedAccessibility: AccessibilitySettings | null = null;
let accessibilityListeners: Array<() => void> = [];

function getAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === "undefined") return defaultAccessibility;
  if (cachedAccessibility) return cachedAccessibility;
  try {
    const saved = localStorage.getItem("app-accessibility-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      cachedAccessibility = {
        theme: parsed.theme || "system",
        uiScale: parsed.uiScale || "100",
        reduceMotion: parsed.reduceMotion ?? false,
      };
      return cachedAccessibility;
    }
  } catch {}
  cachedAccessibility = defaultAccessibility;
  return cachedAccessibility;
}

function updateAccessibilitySettings(updater: (prev: AccessibilitySettings) => AccessibilitySettings) {
  const next = updater(getAccessibilitySettings());
  cachedAccessibility = next;
  try {
    localStorage.setItem("app-accessibility-settings", JSON.stringify(next));
  } catch {}
  accessibilityListeners.forEach((l) => l());
}

function subscribeAccessibility(listener: () => void) {
  accessibilityListeners.push(listener);
  return () => {
    accessibilityListeners = accessibilityListeners.filter((l) => l !== listener);
  };
}

export default function SettingsClient({ initialUser }: SettingsClientProps) {
  const [user, setUser] = useState<SettingsUserData | null>(initialUser);
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Active section tab
  const [selectedTab, setSelectedTab] = useState<"account" | "security" | "elevation" | "accessibility">(
    initialUser ? "account" : "accessibility"
  );
  // Non-admin accounts cannot access elevation; derive activeTab directly without cascading effect render
  const activeTab = user?.role === "admin" ? selectedTab : selectedTab === "elevation" ? "account" : selectedTab;
  const setActiveTab = setSelectedTab;

  // Global alert banner
  const [globalBanner, setGlobalBanner] = useState<{
    type: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  // --- 1. Username Form State ---
  const [usernameInput, setUsernameInput] = useState(initialUser?.username || "");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isPendingUsername, startUsernameTransition] = useTransition();

  // --- 2. Password Form State ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPendingPassword, startPasswordTransition] = useTransition();

  // --- 3. Accessibility Preferences State ---
  const accessibility = useSyncExternalStore(
    subscribeAccessibility,
    getAccessibilitySettings,
    () => defaultAccessibility
  );
  const { theme, uiScale, reduceMotion } = accessibility;

  const setTheme = (nextTheme: string) =>
    updateAccessibilitySettings((prev) => ({ ...prev, theme: nextTheme }));
  const setUiScale = (nextUiScale: string) =>
    updateAccessibilitySettings((prev) => ({ ...prev, uiScale: nextUiScale }));
  const setReduceMotion = (nextReduceMotion: boolean) =>
    updateAccessibilitySettings((prev) => ({ ...prev, reduceMotion: nextReduceMotion }));

  // Apply accessibility settings to DOM
  useEffect(() => {
    if (!isMounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-motion", reduceMotion ? "reduce" : "normal");
    document.documentElement.removeAttribute("data-contrast");
    document.documentElement.style.setProperty("--base-scale", `${uiScale}%`);
    document.documentElement.style.setProperty("--settings-base-scale", `${uiScale}%`);
  }, [theme, uiScale, reduceMotion, isMounted]);

  if (!isMounted) return null;

  // --- Handlers ---
  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError(null);
    setGlobalBanner(null);

    const trimmed = usernameInput.trim();
    if (!trimmed) {
      setUsernameError("Username must be a valid non-empty string.");
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameError(
        "Username must be 3-30 characters long and contain only letters, numbers, spaces, dots, hyphens, and underscores."
      );
      return;
    }

    startUsernameTransition(async () => {
      try {
        const res = await updateUsername(trimmed);
        if (res.success) {
          if (user) setUser({ ...user, username: trimmed });
          setGlobalBanner({
            type: "success",
            message: `Username successfully updated to "${trimmed}"!`,
          });
        } else {
          setUsernameError(res.error || "Failed to update username.");
        }
      } catch (err: unknown) {
        setUsernameError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setGlobalBanner(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      setPasswordError(
        "Password must be 8-24 characters and contain uppercase, lowercase, numbers, and special symbols."
      );
      return;
    }

    startPasswordTransition(async () => {
      try {
        let res;
        if (user?.hasPassword) {
          if (!currentPassword) {
            setPasswordError("Current password is required.");
            return;
          }
          res = await changePassword(currentPassword, newPassword, confirmPassword);
        } else {
          res = await setPasswordForOAuth(newPassword, confirmPassword);
        }

        if (res.success) {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          if (user) setUser({ ...user, hasPassword: true });
          setGlobalBanner({
            type: "success",
            message: user?.hasPassword
              ? "Password changed successfully! Previous sessions across other devices have been invalidated."
              : "Password set successfully! Your account is now password-backed and eligible for staff promotion.",
          });
        } else {
          setPasswordError(res.error || "Failed to update password.");
        }
      } catch (err: unknown) {
        setPasswordError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  };

  const scaleMin = 90;
  const scaleMax = 125;
  const scalePercentage = ((Number(uiScale) - scaleMin) / (scaleMax - scaleMin)) * 100;

  // Password complexity helpers
  const passHasLength = newPassword.length >= 8 && newPassword.length <= 24;
  const passHasUpper = /[A-Z]/.test(newPassword);
  const passHasLower = /[a-z]/.test(newPassword);
  const passHasDigit = /[0-9]/.test(newPassword);
  const passHasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);

  return (
    <div className="settings-card">
      <div className="settings-header">
        <h1>Settings &amp; Preferences</h1>
        <p>Manage your profile, credentials, security, and accessibility options.</p>
      </div>

      {/* Global Alert Notification */}
      {globalBanner && (
        <div className={`settings-alert alert-${globalBanner.type}`} role="alert" aria-live="polite">
          <div className="alert-content">
            <p>{globalBanner.message}</p>
          </div>
          <button
            type="button"
            className="alert-dismiss"
            onClick={() => setGlobalBanner(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* Unauthenticated Visitor Callout */}
      {!user && (
        <div className="settings-alert alert-info" role="status">
          <div className="alert-content">
            <strong>Guest Mode</strong>
            <p>
              Sign in to customize your username, update passwords, and manage administrative credentials.
            </p>
          </div>
          <Link href="/login?callbackUrl=/settings" className="settings-btn settings-btn-primary settings-btn-sm">
            Sign In
          </Link>
        </div>
      )}

      {/* Authenticated User Overview */}
      {user && (
        <div className="settings-user-summary">
          <div className="user-summary-avatar" aria-hidden="true">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-summary-details">
            <div className="user-summary-header">
              <h2>{user.username}</h2>
              <span className={`role-badge role-${user.role}`}>
                {user.role === "admin" ? "Admin" : user.role === "maintainer" ? "Maintainer" : "Player"}
              </span>
              <span className={`account-badge ${user.hasPassword ? "badge-local" : "badge-oauth"}`}>
                {user.hasPassword ? "Password Set" : "OAuth-Only"}
              </span>
            </div>
            <p className="user-summary-email">{user.email || "No email on file"}</p>
          </div>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <nav className="settings-tabs" role="tablist" aria-label="Settings categories">
        {user && (
          <>
            <button
              type="button"
              role="tab"
              className={`settings-tab-btn ${activeTab === "account" ? "active" : ""}`}
              onClick={() => setActiveTab("account")}
              aria-selected={activeTab === "account"}
            >
              Account
            </button>
            <button
              type="button"
              role="tab"
              className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
              aria-selected={activeTab === "security"}
            >
              Password &amp; Security
            </button>
            {user.role === "admin" && (
              <button
                type="button"
                role="tab"
                className={`settings-tab-btn ${activeTab === "elevation" ? "active" : ""}`}
                onClick={() => setActiveTab("elevation")}
                aria-selected={activeTab === "elevation"}
              >
                Staff Elevation
              </button>
            )}
          </>
        )}
        <button
          type="button"
          role="tab"
          className={`settings-tab-btn ${activeTab === "accessibility" ? "active" : ""}`}
          onClick={() => setActiveTab("accessibility")}
          aria-selected={activeTab === "accessibility"}
        >
          Accessibility
        </button>
      </nav>

      {/* --- TAB 1: Account (Username Change) --- */}
      {user && activeTab === "account" && (
        <section className="settings-section" aria-labelledby="heading-username">
          <h2 id="heading-username" className="settings-section-title">Change Username</h2>
          <p className="settings-section-desc">
            Your username is visible across leaderboards and challenge submissions.
          </p>

          <form onSubmit={handleUsernameSubmit} className="settings-form">
            <div className="settings-form-group">
              <div className="settings-label-row">
                <label htmlFor="settings-username-input">New Username</label>
                <span className="settings-char-count">{usernameInput.length}/30</span>
              </div>
              <input
                id="settings-username-input"
                type="text"
                className={`settings-input ${usernameError ? "has-error" : ""}`}
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  if (usernameError) setUsernameError(null);
                }}
                maxLength={30}
                placeholder="Enter new username"
                aria-invalid={!!usernameError}
                aria-describedby="username-hint username-error"
                disabled={isPendingUsername}
              />
              <span id="username-hint" className="settings-field-hint">
                3–30 characters. Letters, numbers, spaces, dots, hyphens, and underscores.
              </span>
              {usernameError && (
                <p id="username-error" className="settings-field-error" role="alert">
                  {usernameError}
                </p>
              )}
            </div>

            <div className="settings-form-actions">
              <button
                type="submit"
                className="settings-btn settings-btn-primary"
                disabled={isPendingUsername || usernameInput.trim() === user.username}
              >
                {isPendingUsername ? "Saving..." : "Save Username"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* --- TAB 2: Password & Security (Adaptive) --- */}
      {user && activeTab === "security" && (
        <section className="settings-section" aria-labelledby="heading-password">
          <h2 id="heading-password" className="settings-section-title">
            {user.hasPassword ? "Change Password" : "Set Account Password"}
          </h2>

          {!user.hasPassword && (
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

          <form onSubmit={handlePasswordSubmit} className="settings-form">
            {user.hasPassword && (
              <div className="settings-form-group">
                <label htmlFor="settings-current-password">Current Password</label>
                <div className="settings-input-wrapper">
                  <input
                    id="settings-current-password"
                    type={showCurrentPass ? "text" : "password"}
                    className="settings-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    disabled={isPendingPassword}
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
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new compliant password"
                  disabled={isPendingPassword}
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

              {/* Password Complexity Checklist */}
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={isPendingPassword}
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
                disabled={isPendingPassword || !newPassword || !confirmPassword}
              >
                {isPendingPassword
                  ? "Processing..."
                  : user.hasPassword
                  ? "Change Password"
                  : "Set Password"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* --- TAB 3: Staff Elevation (Admin Only) --- */}
      {user && user.role === "admin" && activeTab === "elevation" && (
        <section className="settings-section" aria-labelledby="heading-elevation">
          <h2 id="heading-elevation" className="settings-section-title">Admin Access Elevation</h2>
          <p className="settings-section-desc">
            Administrative privileges and staff access status.
          </p>

          <div className="settings-alert alert-success" role="status">
            <div className="alert-content">
              <strong>Administrator Privileges Active</strong>
              <p>Your account currently holds full administrator permissions.</p>
            </div>
            <Link href="/admin" className="settings-btn settings-btn-primary settings-btn-sm">
              Open Admin Dashboard
            </Link>
          </div>
        </section>
      )}

      {/* --- TAB 4: Accessibility Options (Preserved from existing UI) --- */}
      {activeTab === "accessibility" && (
        <section className="settings-section" aria-labelledby="heading-accessibility">
          <h2 id="heading-accessibility" className="settings-section-title">Theme Preference</h2>
          <div className="theme-grid">
            <button
              type="button"
              className={`theme-btn ${theme === "light" ? "active" : ""}`}
              onClick={() => setTheme("light")}
            >
              <div className="theme-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z" />
                </svg>
              </div>
              Light Mode
            </button>

            <button
              type="button"
              className={`theme-btn ${theme === "dark" ? "active" : ""}`}
              onClick={() => setTheme("dark")}
            >
              <div className="theme-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z" />
                </svg>
              </div>
              Dark Mode
            </button>

            <button
              type="button"
              className={`theme-btn ${theme === "system" ? "active" : ""}`}
              onClick={() => setTheme("system")}
            >
              <div className="theme-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h4v2h8v-2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z" />
                </svg>
              </div>
              System Default
            </button>
          </div>

          <h2 className="settings-section-title">Display &amp; Text</h2>
          <div className="scale-label-row">
            <div className="toggle-info">
              <strong>Interface Scaling</strong>
              <span>Adjust the size of text and UI elements globally.</span>
            </div>
            <span className="scale-badge">{uiScale}%</span>
          </div>

          <div className="range-container">
            <span className="range-icon small">A</span>
            <input
              type="range"
              className="range-slider"
              min={scaleMin}
              max={scaleMax}
              step="5"
              value={uiScale}
              onChange={(e) => setUiScale(e.target.value)}
              style={{
                background: `linear-gradient(to right, var(--settings-primary) ${scalePercentage}%, var(--settings-border) ${scalePercentage}%)`,
              }}
              aria-label="Interface scaling"
            />
            <span className="range-icon large">A</span>
          </div>

          <h2 className="settings-section-title">Motion</h2>
          <div className="toggle-row">
            <div className="toggle-info">
              <strong>Reduce Motion</strong>
              <span>Disable background animations and page transitions.</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={reduceMotion}
                onChange={(e) => setReduceMotion(e.target.checked)}
                aria-label="Toggle reduce motion"
              />
              <span className="slider"></span>
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
