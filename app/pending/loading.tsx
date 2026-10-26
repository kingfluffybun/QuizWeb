import React from "react";
import "#css/input.css";
import "#css/pending.css";

export default function PendingLoading() {
  return (
    <div className="skeleton-pending-page pending-review-page" aria-busy="true" aria-label="Loading pending review queue">
      {/* 1. Header */}
      <header className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px" }}>
        <div className="skeleton-shimmer skeleton-line title" style={{ width: 240, margin: 0 }} />
        <div className="skeleton-shimmer skeleton-pill" style={{ width: 140, height: 36 }} />
      </header>

      {/* 2. Main 2-column layout */}
      <main className="pending-container" style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
        <div className="pending-layout" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
          {/* Left: Pending Review Queue */}
          <div className="skeleton-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 180, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 80, height: 26 }} />
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 80, height: 32 }} />
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 90, height: 32 }} />
              <div className="skeleton-shimmer skeleton-pill" style={{ width: 90, height: 32 }} />
            </div>

            {/* Pending Item Cards */}
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                style={{
                  padding: 20,
                  borderRadius: 14,
                  border: "1px solid var(--border-main, #e0e0e0)",
                  background: "rgba(153, 102, 255, 0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="skeleton-shimmer skeleton-pill" style={{ width: 90, height: 22 }} />
                    <div className="skeleton-shimmer skeleton-line" style={{ width: 120, height: 14, margin: 0 }} />
                  </div>
                  <div className="skeleton-shimmer skeleton-pill" style={{ width: 75, height: 22 }} />
                </div>
                <div className="skeleton-shimmer skeleton-line" style={{ width: "85%", height: 18, margin: 0 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: "60%", height: 13, margin: 0 }} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
                  <div className="skeleton-shimmer skeleton-btn" style={{ width: 85, height: 34 }} />
                  <div className="skeleton-shimmer skeleton-btn" style={{ width: 95, height: 34 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Right: Recent Quizzes Card */}
          <div className="skeleton-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 160, margin: 0 }} />
            {[1, 2, 3, 4, 5].map((recent) => (
              <div
                key={recent}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border-main, #e0e0e0)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "70%", height: 14, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "40%", height: 11, margin: 0 }} />
                </div>
                <div className="skeleton-shimmer skeleton-circle" style={{ width: 28, height: 28 }} />
              </div>
            ))}
            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <div className="skeleton-shimmer skeleton-btn" style={{ width: 80, height: 32 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 60, height: 12, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-btn" style={{ width: 80, height: 32 }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
