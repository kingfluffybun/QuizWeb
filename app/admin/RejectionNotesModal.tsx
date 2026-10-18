"use client";

import React, { useState, useTransition, useEffect, useRef } from "react";
import type { PendingReviewItem } from "@/app/actions/admin";

export interface RejectionNotesModalProps {
  isOpen: boolean;
  targetItem: PendingReviewItem | null;
  onClose: () => void;
  onSubmit: (pendingId: number, rejectionNotes: string) => Promise<boolean>;
}

export default function RejectionNotesModal({
  isOpen,
  targetItem,
  onClose,
  onSubmit,
}: RejectionNotesModalProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen || !targetItem) return null;

  const handleClose = () => {
    setNotes("");
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("A rejection note is required explaining what needs to be changed before resubmission.");
      return;
    }

    startTransition(async () => {
      const success = await onSubmit(targetItem.pending_id, notes.trim());
      if (success) {
        setNotes("");
        setError(null);
        onClose();
      } else {
        setError("Failed to reject unit. Please try again.");
      }
    });
  };

  return (
    <div className="admin-modal-backdrop" onClick={handleClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-reject-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h2 id="modal-reject-title" className="admin-modal-title">
            Reject Unit Submission
          </h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={handleClose}
            aria-label="Close rejection dialog"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <div className="admin-modal-target-box">
              <span className="admin-modal-target-label">Unit Title:</span>
              <strong className="admin-modal-target-val">{targetItem.unit_title}</strong>
            </div>

            <p className="admin-modal-description">
              Please provide constructive editorial feedback so the maintainer understands required corrections before resubmitting.
            </p>

            <div className="admin-form-group">
              <label htmlFor="rejection-notes-input" className="admin-label">
                Feedback &amp; Revision Notes <span className="admin-required">*</span>
              </label>
              <textarea
                ref={textareaRef}
                id="rejection-notes-input"
                className="admin-textarea"
                rows={4}
                placeholder="e.g. Please clarify question 3 explanations and check spelling on slide 2..."
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                required
              />
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
              className="admin-btn admin-btn-danger"
              disabled={isPending || !notes.trim()}
            >
              {isPending ? "Submitting..." : "Reject Submission"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
