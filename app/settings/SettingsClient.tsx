"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  changePassword,
  setPasswordForOAuth,
  updateUsername,
} from "@/app/actions/credentials";
import AccountTab from "./components/AccountTab";
import SecurityTab from "./components/SecurityTab";
import ElevationTab from "./components/ElevationTab";
import AccessibilityTab from "./components/AccessibilityTab";

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

const USERNAME_REGEX = /^[a-zA-Z0-9_.\- ]{3,30}$/;
const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,24}$/;

export default function SettingsClient({ initialUser }: SettingsClientProps) {
  const [user, setUser] = useState<SettingsUserData | null>(initialUser);
  const [selectedTab, setSelectedTab] = useState<
    "account" | "security" | "elevation" | "accessibility"
  >(initialUser ? "account" : "accessibility");

  const activeTab =
    user?.role === "admin"
      ? selectedTab
      : selectedTab === "elevation"
        ? "account"
        : selectedTab;

  const [globalBanner, setGlobalBanner] = useState<{
    type: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  const [usernameInput, setUsernameInput] = useState(initialUser?.username || "");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isPendingUsername, startUsernameTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPendingPassword, startPasswordTransition] = useTransition();

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
        "Username must be 3-30 characters long and contain only letters, numbers, spaces, dots, hyphens, and underscores.",
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
        setUsernameError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
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
        "Password must be 8-24 characters and contain uppercase, lowercase, numbers, and special symbols.",
      );
      return;
    }

    startPasswordTransition(async () => {
      try {
        const res = user?.hasPassword
          ? currentPassword
            ? await changePassword(currentPassword, newPassword, confirmPassword)
            : null
          : await setPasswordForOAuth(newPassword, confirmPassword);

        if (!res) {
          setPasswordError("Current password is required.");
          return;
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
        setPasswordError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
      }
    });
  };

  return (
    <div className="settings-card">
      <div className="settings-header">
        <h1>Settings &amp; Preferences</h1>
        <p>Manage your profile, credentials, security, and accessibility options.</p>
      </div>

      {globalBanner && (
        <div
          className={`settings-alert alert-${globalBanner.type}`}
          role="alert"
          aria-live="polite"
        >
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

      {!user && (
        <div className="settings-alert alert-info" role="status">
          <div className="alert-content">
            <strong>Guest Mode</strong>
            <p>
              Sign in to customize your username, update passwords, and manage administrative
              credentials.
            </p>
          </div>
          <Link
            href="/login?callbackUrl=/settings"
            className="settings-btn settings-btn-primary settings-btn-sm"
          >
            Sign In
          </Link>
        </div>
      )}

      {user && (
        <div className="settings-user-summary">
          <div className="user-summary-avatar" aria-hidden="true">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-summary-details">
            <div className="user-summary-header">
              <h2>{user.username}</h2>
              <span className={`role-badge role-${user.role}`}>
                {user.role === "admin"
                  ? "Admin"
                  : user.role === "maintainer"
                    ? "Maintainer"
                    : "Player"}
              </span>
              <span
                className={`account-badge ${user.hasPassword ? "badge-local" : "badge-oauth"}`}
              >
                {user.hasPassword ? "Password Set" : "OAuth-Only"}
              </span>
            </div>
            <p className="user-summary-email">{user.email || "No email on file"}</p>
          </div>
        </div>
      )}

      <nav className="settings-tabs" role="tablist" aria-label="Settings categories">
        {user && (
          <>
            <button
              type="button"
              role="tab"
              className={`settings-tab-btn ${activeTab === "account" ? "active" : ""}`}
              onClick={() => setSelectedTab("account")}
              aria-selected={activeTab === "account"}
            >
              Account
            </button>
            <button
              type="button"
              role="tab"
              className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setSelectedTab("security")}
              aria-selected={activeTab === "security"}
            >
              Password &amp; Security
            </button>
            {user.role === "admin" && (
              <button
                type="button"
                role="tab"
                className={`settings-tab-btn ${activeTab === "elevation" ? "active" : ""}`}
                onClick={() => setSelectedTab("elevation")}
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
          onClick={() => setSelectedTab("accessibility")}
          aria-selected={activeTab === "accessibility"}
        >
          Accessibility
        </button>
      </nav>

      {user && activeTab === "account" && (
        <AccountTab
          username={user.username}
          usernameInput={usernameInput}
          usernameError={usernameError}
          isPending={isPendingUsername}
          onUsernameChange={(val) => {
            setUsernameInput(val);
            if (usernameError) setUsernameError(null);
          }}
          onSubmit={handleUsernameSubmit}
        />
      )}

      {user && activeTab === "security" && (
        <SecurityTab
          hasPassword={user.hasPassword}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          passwordError={passwordError}
          isPending={isPendingPassword}
          onCurrentPasswordChange={setCurrentPassword}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handlePasswordSubmit}
        />
      )}

      {user && user.role === "admin" && activeTab === "elevation" && <ElevationTab />}

      {activeTab === "accessibility" && <AccessibilityTab />}
    </div>
  );
}
