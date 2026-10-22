"use client";

import React from "react";

export interface AdminStatsCardsProps {
  totalQuizzes: number;
  pendingCount: number;
  totalUsers: number;
  totalContributors: number;
}

export default function AdminStatsCards({
  totalQuizzes,
  pendingCount,
  totalUsers,
  totalContributors,
}: AdminStatsCardsProps) {
  return (
    <div className="admin-stats-grid">
      <div className="admin-stat-card stat-total">
        <div className="admin-stat-icon admin-stat-icon-purple">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          </svg>
        </div>
        <div className="admin-stat-details">
            <div className="admin-stat-label">Active <br></br> Lesson Units</div>
            <div className="admin-stat-value">{totalQuizzes}</div>
        </div>
      </div>

      <div className="admin-stat-card stat-pending">
        <div className="admin-stat-icon admin-stat-icon-amber">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <div className="admin-stat-details">
            <div className="admin-stat-label">Submissions <br></br> In Queue</div>
            <div className="admin-stat-value">{pendingCount}</div>
        </div>
      </div>

      <div className="admin-stat-card stat-users">
        <div className="admin-stat-icon admin-stat-icon-blue">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="10" cy="7" r="4" />
            <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="admin-stat-details">
          <div className="admin-stat-label">Registered <br></br> Accounts</div>
          <div className="admin-stat-value">{totalUsers}</div>
        </div>
      </div>

      <div className="admin-stat-card stat-contributors">
        <div className="admin-stat-icon admin-stat-icon-emerald">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
          </svg>
        </div>
        <div className="admin-stat-details">
          <div className="admin-stat-label">Active <br></br> Authors</div>
          <div className="admin-stat-value">{totalContributors}</div>
        </div>
      </div>
    </div>
  );
}
