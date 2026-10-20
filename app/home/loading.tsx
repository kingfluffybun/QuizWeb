import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/dashboard.css";
import "#css/sidebar.css";

export default function HomeLoading() {
  return (
    <div className="dashboard-page skeleton-dashboard-page" aria-busy="true" aria-label="Loading dashboard">
      <SkeletonSidebar />

      <main>
        <div className="dashboard-content">
          {/* 1. Welcome Banner Skeleton */}
          <div className="welcome-banner">
            <div>
              <h1 className="skeleton-welcome-title" aria-hidden="true" />
              <p className="skeleton-welcome-description" aria-hidden="true" />
              <span className="cloud-right skeleton-shimmer skeleton-welcome-art" aria-hidden="true" />
            </div>
          </div>

          {/* 2. Main Dashboard Cards Grid */}
          <div className="dashboard">
            <div className="two-col-card">
              {/* Lesson Progress Card */}
              <div className="card">
                <div className="card-title">
                  <h2 className="skeleton-shimmer skeleton-lesson-title" aria-hidden="true" />
                  <h2 className="quick-action skeleton-shimmer skeleton-lesson-action" aria-hidden="true" />
                </div>
                <div className="lesson-progress col">
                  <div className="lesson-progress-header">
                    <div className="lesson-progress-details">
                      <div className="current-lesson">
                        <div className="language-icon col">
                          <div className="skeleton-shimmer skeleton-language-mark" />
                        </div>
                        <div className="skeleton-lesson-copy">
                          <h2 className="skeleton-shimmer skeleton-section-title" aria-hidden="true" />
                          <p className="skeleton-shimmer skeleton-section-subtitle" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="row">
                        <h1 className="skeleton-shimmer skeleton-lesson-percent" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="lesson-progress-bar">
                      <div className="skeleton-shimmer skeleton-progress-fill" />
                    </div>
                  </div>
                  <hr />
                  <div className="unit-list-dashboard">
                    {[1, 2].map((unit) => (
                      <div className="unit row" key={unit}>
                        <div className="unit-no row">
                          <p className="skeleton-shimmer skeleton-unit-number" aria-hidden="true" />
                        </div>
                        <div className="unit-info">
                          <div className="unit-description">
                            <p className="skeleton-shimmer skeleton-unit-title" aria-hidden="true" />
                            <p className="skeleton-shimmer skeleton-unit-count" aria-hidden="true" />
                          </div>
                          <div className="unit-progress-bar">
                            <div className="skeleton-shimmer skeleton-progress-fill" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Daily Goal Card */}
              <div className="card">
                <div className="card-title">
                  <h2 className="skeleton-shimmer skeleton-daily-title" aria-hidden="true" />
                  <h2 className="quick-action skeleton-shimmer skeleton-daily-action" aria-hidden="true" />
                </div>
                <div className="daily-goal-xp">
                  <p className="skeleton-shimmer skeleton-xp-label" aria-hidden="true" />
                  <div className="daily-progress-bar-container row">
                    <div className="daily-progress-bar">
                      <div className="skeleton-shimmer skeleton-daily-progress-fill" />
                    </div>
                    <div>
                      <p className="skeleton-shimmer skeleton-xp-value" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="daily-prograss-graph">
                    <div className="graph-x-axis-container">
                      {[40, 30, 20, 10, 0].map((value) => (
                        <div className="graph-x-axis" key={value}>
                          <p className="skeleton-shimmer skeleton-graph-value" aria-hidden="true" />
                          <div className="x-axis-line" />
                        </div>
                      ))}
                    </div>
                    <div className="graph-y-axis">
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                        <div key={day}>
                          <div className="graph-y-bar skeleton-shimmer" />
                          <p className="skeleton-shimmer skeleton-graph-day" aria-hidden="true" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak Calendar Card */}
            <div className="card" id="streak-calendar">
              <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 150 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: 80, height: 14 }} />
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div className="skeleton-shimmer skeleton-circle" style={{ width: 48, height: 48 }} />
                    <div className="skeleton-shimmer skeleton-line title" style={{ width: 80, height: 32, margin: 0 }} />
                  </div>
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "90%", height: 14 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <div key={d} className="skeleton-shimmer skeleton-circle" style={{ width: 28, height: 28 }} />
                    ))}
                  </div>
                </div>
                {/* Calendar Days Matrix */}
                <div style={{ flex: 1.2, minWidth: 220, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} className="skeleton-shimmer" style={{ height: 28, borderRadius: 6 }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Continue Where You Left Off */}
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 220, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-btn" style={{ width: 120, height: 36 }} />
            </div>
          </div>

          {/* 3. Leaderboard Skeleton */}
          <div className="leaderboard" style={{ marginTop: 24 }}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div className="skeleton-shimmer skeleton-line title" style={{ width: 140, margin: 0 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="skeleton-shimmer skeleton-pill" style={{ width: 60, height: 30 }} />
                  <div className="skeleton-shimmer skeleton-pill" style={{ width: 60, height: 30 }} />
                  <div className="skeleton-shimmer skeleton-pill" style={{ width: 60, height: 30 }} />
                </div>
              </div>
              {/* Podium */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 20, height: 180, paddingBottom: 12 }}>
                {/* 2nd Place */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 90 }}>
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 44, height: 44 }} />
                  <div className="skeleton-shimmer" style={{ width: "100%", height: 70, borderRadius: "12px 12px 0 0" }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 60, height: 12 }} />
                </div>
                {/* 1st Place */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 100 }}>
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 52, height: 52 }} />
                  <div className="skeleton-shimmer" style={{ width: "100%", height: 110, borderRadius: "12px 12px 0 0" }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 70, height: 12 }} />
                </div>
                {/* 3rd Place */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 90 }}>
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 44, height: 44 }} />
                  <div className="skeleton-shimmer" style={{ width: "100%", height: 50, borderRadius: "12px 12px 0 0" }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 60, height: 12 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
