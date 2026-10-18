"use client";

import React from "react";
import type { PendingReviewItem } from "@/app/actions/admin";

export interface AdminReviewQueueProps {
  queue: PendingReviewItem[];
  isPending: boolean;
  onApprove: (pendingId: number) => Promise<void>;
  onOpenRejectModal: (item: PendingReviewItem) => void;
}

export default function AdminReviewQueue({
  queue,
  isPending,
  onApprove,
  onOpenRejectModal,
}: AdminReviewQueueProps) {
  return (
    <div className="admin-review-queue">
      <div className="admin-queue-header">
        <div>
          <h2 className="admin-section-title">Pending Submissions Queue</h2>
          <p className="admin-section-subtitle">
            Community lesson units and quiz questions awaiting administrative editorial review.
          </p>
        </div>
        <div className="admin-queue-count-pill">
          {queue.length} Pending
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="admin-queue-empty">
          <div className="admin-queue-empty-icon">✓</div>
          <h3>Queue is all clear</h3>
          <p>There are no pending quiz units awaiting editorial review right now.</p>
        </div>
      ) : (
        <div className="admin-queue-list">
          {queue.map((item) => (
            <div key={item.pending_id} className="admin-queue-card">
              <div className="admin-queue-card-main">
                <div className="admin-queue-card-header">
                  <span className="admin-queue-id-tag">Submission #{item.pending_id}</span>
                  <span className="admin-queue-sec-tag">Section #{item.sec_id}</span>
                  <span className="admin-badge admin-badge-pending">Pending</span>
                </div>

                <h3 className="admin-queue-title">{item.unit_title}</h3>

                <div className="admin-queue-author-info">
                  <span>Submitted by: <strong>{item.pending_name}</strong></span>
                  {item.author_id && <span>(Author ID: {item.author_id})</span>}
                </div>

                {item.pending_note && (
                  <div className="admin-queue-note">
                    <span className="admin-queue-note-label">Author Note:</span>
                    <p>{item.pending_note}</p>
                  </div>
                )}
              </div>

              <div className="admin-queue-card-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-success"
                  onClick={() => onApprove(item.pending_id)}
                  disabled={isPending}
                >
                  Approve Unit
                </button>

                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => onOpenRejectModal(item)}
                  disabled={isPending}
                >
                  Reject with Notes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
