"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import type { AdminUserRecord } from "@/app/actions/admin";
import { promoteUser } from "@/app/actions/admin";

export interface AdminSecretKeyModalProps {
  isOpen: boolean;
  targetUser: AdminUserRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminSecretKeyModal({
  isOpen,
  targetUser,
  onClose,
  onSuccess,
}: AdminSecretKeyModalProps) {
  const [secretKey, setSecretKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleClose = () => {
    setSecretKey("");
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretKey) {
      setError("Admin secret key is required.");
      return;
    }

    startTransition(async () => {
      const res = await promoteUser(targetUser.user_id, "admin", secretKey);
      if (res.success) {
        setSecretKey("");
        setError(null);
        onSuccess();
      } else {
        setError(res.error || "Invalid secret key or promotion rejected.");
      }
    });
  };

  return (
    <div className="admin-modal-backdrop" onClick={handleClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-secret-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2 id="modal-secret-title" className="admin-modal-title">
            Elevate to Administrator
          </h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={handleClose}
            aria-label="Close elevation dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <div className="admin-modal-target-box">
              <span className="admin-modal-target-label">Target Account:</span>
              <strong className="admin-modal-target-val">
                {targetUser.username} ({targetUser.email})
              </strong>
            </div>

            <div className="admin-modal-notice">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>
                Administrative role distribution is protected. Enter the server <code>ADMIN_SECRET_KEY</code> to confirm elevation. Failed attempts are rate-limited.
              </span>
            </div>

            <div className="admin-form-group">
              <label htmlFor="admin-secret-input" className="admin-label">
                Master Secret Key
              </label>
              <div className="admin-input-wrapper">
                <input
                  ref={inputRef}
                  id="admin-secret-input"
                  type={showKey ? "text" : "password"}
                  className="admin-input"
                  placeholder="Enter ADMIN_SECRET_KEY"
                  value={secretKey}
                  onChange={(e) => {
                    setSecretKey(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isPending}
                  required
                />
                <button
                  type="button"
                  className="admin-input-toggle"
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? "Hide secret key" : "Show secret key"}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="admin-field-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="admin-modal-footer">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={isPending || !secretKey}
            >
              {isPending ? "Verifying..." : "Confirm Elevation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
