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
      <div className="admin-stat-card">
        <div className="admin-stat-icon admin-stat-icon-purple">📚</div>
        <div className="admin-stat-details">
          <div className="admin-stat-value">{totalQuizzes}</div>
          <div className="admin-stat-label">Active Lesson Units</div>
        </div>
      </div>

      <div className="admin-stat-card">
        <div className="admin-stat-icon admin-stat-icon-amber">⏳</div>
        <div className="admin-stat-details">
          <div className="admin-stat-value">{pendingCount}</div>
          <div className="admin-stat-label">Submissions In Queue</div>
        </div>
      </div>

      <div className="admin-stat-card">
        <div className="admin-stat-icon admin-stat-icon-blue">👥</div>
        <div className="admin-stat-details">
          <div className="admin-stat-value">{totalUsers}</div>
          <div className="admin-stat-label">Registered Accounts</div>
        </div>
      </div>

      <div className="admin-stat-card">
        <div className="admin-stat-icon admin-stat-icon-emerald">✍️</div>
        <div className="admin-stat-details">
          <div className="admin-stat-value">{totalContributors}</div>
          <div className="admin-stat-label">Active Authors</div>
        </div>
      </div>
    </div>
  );
}
