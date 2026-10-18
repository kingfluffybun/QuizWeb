"use client";

import React from "react";
import type { PlatformAnalytics } from "@/app/actions/admin";

export interface AdminAnalyticsViewProps {
  analytics: PlatformAnalytics;
  pendingCount: number;
  userCount: number;
}

export default function AdminAnalyticsView({
  analytics,
}: AdminAnalyticsViewProps) {
  const totalQuizzes = analytics.totalQuizzes || 1; // Prevent division by zero

  return (
    <div className="admin-analytics-view">
      <div className="admin-analytics-grid">
        {/* Category Breakdown Card */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Curriculum by Category</h3>
            <span className="admin-card-subtitle">{analytics.categories.length} Total Categories</span>
          </div>
          <div className="admin-chart-list">
            {analytics.categories.length === 0 ? (
              <p className="admin-chart-empty">No category data recorded.</p>
            ) : (
              analytics.categories.map((cat) => {
                const percentage = Math.round((cat.count / totalQuizzes) * 100);
                return (
                  <div key={cat.category} className="admin-chart-row">
                    <div className="admin-chart-row-labels">
                      <span className="admin-chart-row-name">{cat.category}</span>
                      <span className="admin-chart-row-value">{cat.count} units ({percentage}%)</span>
                    </div>
                    <div className="admin-chart-track">
                      <div
                        className="admin-chart-bar"
                        style={{ width: `${Math.max(percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Difficulty Distribution Card */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Difficulty Level Distribution</h3>
            <span className="admin-card-subtitle">Student Skill Progression</span>
          </div>
          <div className="admin-chart-list">
            {analytics.difficulties.length === 0 ? (
              <p className="admin-chart-empty">No difficulty data recorded.</p>
            ) : (
              analytics.difficulties.map((diff) => {
                const percentage = Math.round((diff.count / totalQuizzes) * 100);
                const diffKey = diff.difficulty.toLowerCase();
                return (
                  <div key={diff.difficulty} className="admin-chart-row">
                    <div className="admin-chart-row-labels">
                      <span className="admin-chart-row-name">
                        <span className={`admin-diff-dot admin-diff-${diffKey}`} />
                        {diff.difficulty}
                      </span>
                      <span className="admin-chart-row-value">{diff.count} units ({percentage}%)</span>
                    </div>
                    <div className="admin-chart-track">
                      <div
                        className={`admin-chart-bar admin-chart-bar-${diffKey}`}
                        style={{ width: `${Math.max(percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Maintainer Contributors Card */}
        <div className="admin-card admin-card-full-width">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Top Author Contributors</h3>
            <span className="admin-card-subtitle">Approved Curriculum Contributors</span>
          </div>
          <div className="admin-leaderboard">
            {analytics.contributors.length === 0 ? (
              <p className="admin-chart-empty">No contributor submission records found.</p>
            ) : (
              <table className="admin-table" aria-label="Contributor Leaderboard">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: "80px" }}>Rank</th>
                    <th scope="col">Contributor ID</th>
                    <th scope="col" className="text-right">Approved Units</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analytics.contributors]
                    .sort((a, b) => b.totalUnits - a.totalUnits)
                    .map((contrib, idx) => (
                      <tr key={contrib.authorId}>
                        <td>
                          <span className={`admin-rank-badge ${idx < 3 ? `rank-${idx + 1}` : ""}`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td>
                          <strong>Author #{contrib.authorId}</strong>
                        </td>
                        <td className="text-right">
                          <span className="admin-units-pill">{contrib.totalUnits} units</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
