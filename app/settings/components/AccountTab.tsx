"use client";

import React from "react";

interface AccountTabProps {
  username: string;
  usernameInput: string;
  usernameError: string | null;
  isPending: boolean;
  onUsernameChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AccountTab({
  username,
  usernameInput,
  usernameError,
  isPending,
  onUsernameChange,
  onSubmit,
}: AccountTabProps) {
  return (
    <section className="settings-section" aria-labelledby="heading-username">
      <h2 id="heading-username" className="settings-section-title">Change Username</h2>
      <p className="settings-section-desc">
        Your username is visible across leaderboards and challenge submissions.
      </p>

      <form onSubmit={onSubmit} className="settings-form">
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
            onChange={(e) => onUsernameChange(e.target.value)}
            maxLength={30}
            placeholder="Enter new username"
            aria-invalid={!!usernameError}
            aria-describedby="username-hint username-error"
            disabled={isPending}
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
            disabled={isPending || usernameInput.trim() === username}
          >
            {isPending ? "Saving..." : "Save Username"}
          </button>
        </div>
      </form>
    </section>
  );
}
