import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/quiz.css";
import "#css/sidebar.css";

export default function QuizCPLoading() {
  return (
    <div className="quiz-page skeleton-quiz-cp-page" aria-busy="true" aria-label="Loading code challenge">
      <SkeletonSidebar />

      <main style={{ display: "flex", flexDirection: "column", gap: 20, padding: 24, flex: 1, minWidth: 0, height: "100vh", overflow: "hidden" }}>
        {/* 1. Header Toolbar */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="skeleton-shimmer skeleton-circle" style={{ width: 32, height: 32 }} />
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 220, height: 26, margin: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="skeleton-shimmer skeleton-btn" style={{ width: 100, height: 38 }} />
            <div className="skeleton-shimmer skeleton-btn" style={{ width: 120, height: 38 }} />
          </div>
        </header>

        {/* 2. Coding Workspace Split View */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr", gap: 20, flex: 1, minHeight: 0 }}>
          {/* Left: Problem Statement & Step Checklist */}
          <div className="skeleton-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, overflowY: "auto" }}>
            <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: "60%" }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "100%", height: 14 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "90%", height: 14 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "75%", height: 14 }} />

            <div style={{ height: 1, background: "var(--border-main, #e0e0e0)", margin: "8px 0" }} />

            {/* Checklist items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((step) => (
                <div key={step} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 20, height: 20, marginTop: 2 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <div className="skeleton-shimmer skeleton-line" style={{ width: "80%", height: 14, margin: 0 }} />
                    <div className="skeleton-shimmer skeleton-line" style={{ width: "50%", height: 11, margin: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Code Editor Frame & Output Drawer */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            {/* File Tabs */}
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 80, height: 32 }} />
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 70, height: 32 }} />
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 60, height: 32 }} />
            </div>

            {/* Monaco Editor Box */}
            <div className="skeleton-shimmer" style={{ flex: 1, borderRadius: 14, minHeight: 300 }} />

            {/* Console Output Drawer */}
            <div className="skeleton-card" style={{ height: 120, padding: 14 }}>
              <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 14, marginBottom: 8 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: "50%", height: 12 }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
