import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";

export default function QuizLoading() {
  return (
    <div className="quiz-page quiz-no-footer-page skeleton-quiz-page" aria-busy="true" aria-label="Loading quiz">
      <SkeletonSidebar />

      <main style={{ display: "flex", flexDirection: "column", gap: 24, padding: "32px 48px", flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {/* 1. Header with Title and Segmented Progress Bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
              <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 180, margin: 0 }} />
            </div>
            <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
          </div>

          {/* Segmented Progress Track */}
          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="skeleton-shimmer" style={{ flex: 1, height: 8, borderRadius: 999 }} />
            ))}
          </div>
        </div>

        {/* 2. Question Container */}
        <div style={{ maxWidth: "1080px", width: "100%", display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          <div className="skeleton-card" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Question Prompt */}
            <div className="skeleton-shimmer skeleton-line title" style={{ width: "70%", height: 30, margin: 0 }} />
            <div className="skeleton-shimmer skeleton-line medium" style={{ height: 16 }} />

            {/* Code / Context Snippet Box Placeholder */}
            <div className="skeleton-shimmer" style={{ width: "100%", height: 140, borderRadius: 12, margin: "8px 0" }} />

            {/* Answer Choices Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
              {[1, 2, 3, 4].map((opt) => (
                <div
                  key={opt}
                  className="skeleton-card"
                  style={{
                    padding: "18px 24px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    borderRadius: 14,
                    background: "rgba(153, 102, 255, 0.02)",
                  }}
                >
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 24, height: 24 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "70%", height: 16, margin: 0 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Bottom Action Controls Footer */}
        <div style={{ maxWidth: "1080px", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16 }}>
          <div className="skeleton-shimmer skeleton-btn" style={{ width: 120, height: 46 }} />
          <div className="skeleton-shimmer skeleton-btn" style={{ width: 140, height: 46 }} />
        </div>
      </main>
    </div>
  );
}
