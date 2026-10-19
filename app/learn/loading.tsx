import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";

export default function LearnLoading() {
  return (
    <div className="quiz-page learn-page skeleton-learn-page" aria-busy="true" aria-label="Loading curriculum units">
      <SkeletonSidebar />

      <main>
        <section className="available-units" aria-label="Loading available units">
          {/* 1. Heading */}
          <div className="available-units-heading" style={{ marginBottom: 28 }}>
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 220, margin: 0 }} />
            <div className="skeleton-shimmer skeleton-line medium" style={{ height: 16, marginTop: 8 }} />
          </div>

          {/* 2. Units Grid */}
          <div className="available-units-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {[1, 2, 3, 4, 5, 6].map((unit) => (
              <article
                key={unit}
                className="available-unit-card skeleton-card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 24,
                  borderRadius: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: "80%", margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "50%", height: 13, margin: 0 }} />
                </div>
                <div className="skeleton-shimmer skeleton-btn" style={{ width: 110, height: 38, borderRadius: 10 }} />
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
