import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/dashboard.css";
import "#css/sidebar.css";

export default function HomeLoading() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStartDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="dashboard-page skeleton-dashboard-page" aria-busy="true" aria-label="Loading dashboard">
      <SkeletonSidebar />

      <main>
        <div className="dashboard-content">
          {/* 1. Welcome Banner Skeleton */}
          <div className="welcome-banner">
            <div>
              <h1 className="skeleton-shimmer skeleton-welcome-title" aria-hidden="true" />
              <p className="skeleton-shimmer skeleton-welcome-description" aria-hidden="true" />
              <span className="cloud-right skeleton-shimmer skeleton-welcome-art" aria-hidden="true" />
            </div>
          </div>
          <nav className="dashboard-mobile-jumpbar" aria-hidden="true">
            {["Overview", "Streak", "Leaderboard"].map((section) => (
              <span className="dashboard-jump-pill skeleton-shimmer" key={section} />
            ))}
          </nav>

          {/* 2. Main Dashboard Cards Grid */}
          <div className="dashboard">
            <div className="two-col-card">
              {/* Lesson Progress Card */}
              <div className="card skeleton-lesson-progress-card">
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
                          <div className="graph-y-bar skeleton-shimmer skeleton-graph-bar" />
                          <p className="skeleton-shimmer skeleton-graph-day" aria-hidden="true" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Streak Calendar Card */}
            <div className="card skeleton-streak-calendar-card" id="streak-calendar">
              <div className="card-title">
                <h2 className="skeleton-shimmer skeleton-streak-title" aria-hidden="true" />
                <span className="quick-action skeleton-shimmer skeleton-streak-action" aria-hidden="true" />
              </div>
              <div className="calendar-container">
                <div className="streak">
                  <div className="streak-status row">
                    <div className="streak-progress-bar col inactive">
                      <div className="skeleton-shimmer skeleton-streak-flame" aria-hidden="true" />
                    </div>
                    <div className="streak-no-of-days col skeleton-streak-no-of-days">
                      <h1 className="skeleton-shimmer skeleton-streak-count" aria-hidden="true">0</h1>
                      <p className="skeleton-shimmer skeleton-streak-count-label" aria-hidden="true">day streak!</p>
                    </div>
                  </div>
                  <p className="skeleton-shimmer skeleton-streak-message" aria-hidden="true">
                    Complete a lesson or quiz today to start your streak!
                  </p>
                  <div className="streak-week">
                    {weekLabels.map((day, index) => (
                      <div key={index} className="streak-day-container col">
                        <div className="streak-day row skeleton-shimmer skeleton-week-day" />
                        <p className="skeleton-shimmer skeleton-week-label" aria-hidden="true">{day}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="calendar" aria-hidden="true">
                  <div className="calendar-month">
                    <div className="calendar-month-header">
                      <p className="skeleton-shimmer skeleton-calendar-month" aria-hidden="true">{monthLabel}</p>
                    </div>
                    <div className="calendar-month-nav">
                      <span className="skeleton-shimmer skeleton-calendar-nav" />
                      <span className="skeleton-shimmer skeleton-calendar-nav" />
                    </div>
                  </div>
                  {dayLabels.map((day) => (
                    <div key={day} className="day-label">
                      <p className="skeleton-shimmer skeleton-calendar-weekday" aria-hidden="true">{day}</p>
                    </div>
                  ))}
                  {Array.from({ length: monthStartDay }).map((_, index) => (
                    <div key={`empty-${index}`} className="day-empty" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
                    <div key={day} className="day col skeleton-calendar-day">
                      <p className="skeleton-shimmer">{day}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Continue Where You Left Off */}
            <div className="card">
              <div className="card-title">
                <h2 className="skeleton-shimmer skeleton-continue-title" aria-hidden="true" />
                <span className="quick-action skeleton-shimmer skeleton-continue-action" aria-hidden="true" />
              </div>
              <p className="skeleton-shimmer skeleton-continue-description" aria-hidden="true" />
            </div>
          </div>

          {/* 3. Leaderboard Skeleton */}
          <div className="leaderboard">
            <div className="card">
              <div>
                <div className="card-title">
                  <h2 className="skeleton-shimmer skeleton-leaderboard-title" aria-hidden="true" />
                </div>
                <div className="sort-by-time skeleton-leaderboard-filters">
                  {[1, 2, 3, 4].map((filter) => (
                    <label key={filter} aria-hidden="true">
                      <p className="skeleton-shimmer skeleton-leaderboard-filter" />
                    </label>
                  ))}
                </div>
              </div>
              <div className="podium-stage">
                <div className="podium">
                  {[
                    { place: "second-place", width: "60px" },
                    { place: "first-place", width: "70px" },
                    { place: "third-place", width: "60px" },
                  ].map(({ place, width }) => (
                    <div className={`podium-place-container ${place}`} key={place}>
                      <div className="player-icon skeleton-podium-avatar">
                        <span
                          className={`skeleton-shimmer skeleton-podium-emblem ${place === "first-place" ? "skeleton-podium-crown" : "skeleton-podium-medal"}`}
                          aria-hidden="true"
                        />
                        <div className="podium-player-xp">
                          <span className="skeleton-shimmer skeleton-podium-xp" style={{ width }} />
                        </div>
                      </div>
                      <p className="skeleton-shimmer skeleton-podium-name" aria-hidden="true" />
                      <div className="podium-place skeleton-shimmer skeleton-podium-base" id={place}>
                        <h1 className="skeleton-shimmer skeleton-podium-rank" aria-hidden="true" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="leaderboard-placement">
                {Array.from({ length: 5 }, (_, index) => index + 4).map((place) => (
                  <div className="leaderboard-player row" key={place}>
                    <div className="player-details row">
                      <p className="skeleton-shimmer skeleton-leaderboard-rank" aria-hidden="true" />
                      <div className="player-icon skeleton-shimmer skeleton-leaderboard-avatar" />
                      <p className="skeleton-shimmer skeleton-leaderboard-name" aria-hidden="true" />
                    </div>
                    <p className="skeleton-shimmer skeleton-leaderboard-xp" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
