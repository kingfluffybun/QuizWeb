import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";
import "#css/profile.css";

const profileStats = [1, 2, 3, 4];
const profileDetails = [1, 2, 3];
const activityDays = [1, 2, 3, 4, 5, 6, 7];

export default function ProfileSkeleton() {
  return (
    <div className="quiz-page profile-page profile-skeleton" aria-busy="true" aria-label="Loading profile">
      <SkeletonSidebar />
      <main>
        <div className="profile-content">
          <header className="profile-page-heading">
            <div>
              <h1 className="skeleton-shimmer profile-skeleton-heading" />
              <p className="skeleton-shimmer profile-skeleton-subheading" />
            </div>
          </header>

          <section className="profile-hero" aria-hidden="true">
            <div className="profile-avatar skeleton-shimmer profile-skeleton-avatar" />
            <div className="profile-identity">
              <div className="skeleton-shimmer profile-skeleton-name" />
              <div className="skeleton-shimmer profile-skeleton-handle" />
              <div className="profile-meta">
                <span className="skeleton-shimmer profile-skeleton-joined" />
              </div>
            </div>
          </section>

          <section className="profile-statistics" aria-hidden="true">
            <h2 className="profile-statistics-title">
              <span className="skeleton-shimmer profile-skeleton-stat-heading-icon" />
              <span className="skeleton-shimmer profile-skeleton-stat-heading" />
            </h2>
            <div className="profile-stats">
              {profileStats.map((stat) => (
                <article className="profile-stat-card" key={stat}>
                  <div className="profile-stat-main">
                    <span className="skeleton-shimmer profile-stat-icon profile-skeleton-stat-icon" />
                    <div>
                      <span className="skeleton-shimmer profile-skeleton-stat-value" />
                      <span className="skeleton-shimmer profile-skeleton-stat-label" />
                    </div>
                  </div>
                  <span className="skeleton-shimmer profile-skeleton-stat-note" />
                </article>
              ))}
            </div>
          </section>

          <div className="profile-details-grid" aria-hidden="true">
            <section className="profile-panel profile-activity-panel">
              <div className="activity-heading">
                <span className="skeleton-shimmer activity-heading-icon profile-skeleton-activity-icon" />
                <span className="skeleton-shimmer profile-skeleton-activity-title" />
              </div>
              <div className="activity-streak-status">
                <span className="skeleton-shimmer profile-skeleton-flame" />
                <div className="activity-streak-copy profile-skeleton-streak-copy">
                  <span className="skeleton-shimmer profile-skeleton-streak-count" />
                  <span className="skeleton-shimmer profile-skeleton-streak-label" />
                  <span className="skeleton-shimmer profile-skeleton-streak-description" />
                </div>
              </div>
              <div className="activity-week">
                {activityDays.map((day) => (
                  <div className="activity-day-container" key={day}>
                    <span className="skeleton-shimmer activity-day-marker profile-skeleton-day" />
                    <span className="skeleton-shimmer profile-skeleton-day-name" />
                  </div>
                ))}
              </div>
              <div className="activity-goal">
                <div className="activity-goal-labels">
                  <span className="skeleton-shimmer profile-skeleton-goal-label" />
                  <span className="skeleton-shimmer profile-skeleton-goal-percent" />
                </div>
                <div className="activity-goal-track">
                  <span className="profile-skeleton-goal-fill" />
                </div>
                <span className="skeleton-shimmer profile-skeleton-goal-caption" />
              </div>
            </section>

            <section className="profile-panel profile-about-panel">
              <div className="profile-panel-heading">
                <span className="profile-section-title">
                  <span className="skeleton-shimmer profile-section-title-icon profile-skeleton-panel-icon" />
                  <span className="skeleton-shimmer profile-skeleton-panel-title" />
                </span>
                <span className="skeleton-shimmer profile-icon-button profile-skeleton-edit" />
              </div>
              <dl className="profile-details-list profile-skeleton-details">
                {profileDetails.map((detail) => (
                  <div key={detail}>
                    <dt><span className="skeleton-shimmer" /></dt>
                    <dd><span className="skeleton-shimmer" /></dd>
                  </div>
                ))}
              </dl>
              <span className="skeleton-shimmer profile-skeleton-link" />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
