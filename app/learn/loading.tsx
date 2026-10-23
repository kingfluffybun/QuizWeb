import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";

export default function LearnLoading() {
  return (
    <div className="quiz-page quiz-no-footer-page learn-page skeleton-learn-page" aria-busy="true" aria-label="Loading curriculum units">
      <SkeletonSidebar />

      <main>
        <section className="available-units" aria-label="Loading available units">
          <div className="available-units-heading">
            <div>
              <div className="skeleton-shimmer learn-skeleton-title" />
              <div className="skeleton-shimmer learn-skeleton-description" />
            </div>
            <div className="learn-filters-bar">
              <div className="skeleton-shimmer learn-skeleton-search" />
              <div className="learn-section-chips" aria-hidden="true">
                {[74, 90, 90, 90, 90, 90].map((width, index) => (
                  <div
                    key={index}
                    className="skeleton-shimmer learn-skeleton-chip"
                    style={{ width }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="available-units-list">
            {[1, 2, 3, 4, 5, 6].map((unit) => (
              <article key={unit} className="available-unit-card">
                <div className="available-unit-info">
                  <div className="skeleton-shimmer learn-skeleton-unit-title" />
                  <div className="available-unit-badges" aria-hidden="true">
                    <div className="skeleton-shimmer learn-skeleton-badge" style={{ width: 68 }} />
                    <div className="skeleton-shimmer learn-skeleton-badge" style={{ width: 88 }} />
                    <div className="skeleton-shimmer learn-skeleton-badge" style={{ width: 148 }} />
                  </div>
                </div>
                <div className="available-unit-actions" aria-hidden="true">
                  <div className="skeleton-shimmer learn-skeleton-action" />
                  <div className="skeleton-shimmer learn-skeleton-action" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
