"use client";

import React from "react";
import type { MaintainerStats } from "../MaintainerStudioClient";

export type SubmissionFilterStatus = "all" | "pending" | "approved" | "rejected";

interface MaintainerStatsRibbonProps {
  stats: MaintainerStats;
  statusFilter: SubmissionFilterStatus;
  hidden: boolean;
  onSelectFilter: (status: SubmissionFilterStatus) => void;
}

export default function MaintainerStatsRibbon({
  stats,
  statusFilter,
  hidden,
  onSelectFilter,
}: MaintainerStatsRibbonProps) {
  const handleCardKeyDown = (
    e: React.KeyboardEvent,
    status: SubmissionFilterStatus,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectFilter(status);
    }
  };

  return (
    <section
      className="maintainer-stats-ribbon"
      aria-label="Author Submission Statistics"
      hidden={hidden}
    >
      <div
        className={`stat-card stat-card-total ${statusFilter === "all" ? "active-stat-card" : ""}`}
        onClick={() => onSelectFilter("all")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => handleCardKeyDown(e, "all")}
        aria-label="Filter all submissions"
      >
        <div className="stat-card-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div className="stat-card-body">
          <span className="stat-card-label">Total Submissions</span>
          <span className="stat-card-value">{stats.total}</span>
        </div>
      </div>

      <div
        className={`stat-card stat-card-approved ${statusFilter === "approved" ? "active-stat-card" : ""}`}
        onClick={() => onSelectFilter("approved")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => handleCardKeyDown(e, "approved")}
        aria-label="Filter approved submissions"
      >
        <div className="stat-card-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div className="stat-card-body">
          <span className="stat-card-label">Approved</span>
          <span className="stat-card-value">{stats.approved}</span>
        </div>
      </div>

      <div
        className={`stat-card stat-card-pending ${statusFilter === "pending" ? "active-stat-card" : ""}`}
        onClick={() => onSelectFilter("pending")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => handleCardKeyDown(e, "pending")}
        aria-label="Filter pending submissions"
      >
        <div className="stat-card-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="stat-card-body">
          <span className="stat-card-label">Pending Review</span>
          <span className="stat-card-value">{stats.pending}</span>
        </div>
      </div>

      <div
        className={`stat-card stat-card-rejected ${statusFilter === "rejected" ? "active-stat-card" : ""}`}
        onClick={() => onSelectFilter("rejected")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => handleCardKeyDown(e, "rejected")}
        aria-label="Filter rejected submissions needing action"
      >
        <div className="stat-card-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
          </svg>
        </div>
        <div className="stat-card-body">
          <span className="stat-card-label">Action Needed</span>
          <span className="stat-card-value">{stats.rejected}</span>
        </div>
      </div>
    </section>
  );
}
