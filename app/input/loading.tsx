import React from "react";
import "#css/input.css";

export default function InputLoading() {
  return (
    <div className="skeleton-input-page" aria-busy="true" aria-label="Loading question studio">
      {/* 1. Header */}
      <header className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 32px" }}>
        <div className="skeleton-shimmer skeleton-line title" style={{ width: 220, margin: 0 }} />
        <div className="admin-header-links" style={{ display: "flex", gap: 16 }}>
          <div className="skeleton-shimmer skeleton-pill" style={{ width: 130, height: 36 }} />
          <div className="skeleton-shimmer skeleton-pill" style={{ width: 160, height: 36 }} />
        </div>
      </header>

      {/* 2. Main Studio Workspace */}
      <main className="admin-container" style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
        <div className="skeleton-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Metadata Selectors Row */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div className="skeleton-shimmer" style={{ width: 200, height: 42, borderRadius: 10 }} />
            <div className="skeleton-shimmer" style={{ width: 160, height: 42, borderRadius: 10 }} />
            <div className="skeleton-shimmer" style={{ width: 160, height: 42, borderRadius: 10 }} />
          </div>

          {/* Question Type Tabs */}
          <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border-main, #e0e0e0)", paddingBottom: 16 }}>
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 140, height: 38 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 140, height: 38 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 140, height: 38 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 140, height: 38 }} />
          </div>

          {/* Form Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="skeleton-shimmer skeleton-line" style={{ width: 130, height: 14, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "100%", height: 44, borderRadius: 10 }} />
            </div>

            <div>
              <div className="skeleton-shimmer skeleton-line" style={{ width: 160, height: 14, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "100%", height: 100, borderRadius: 10 }} />
            </div>

            {/* Answer Options Box */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <div className="skeleton-shimmer skeleton-line" style={{ width: 120, height: 14 }} />
              {[1, 2, 3, 4].map((opt) => (
                <div key={opt} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 22, height: 22 }} />
                  <div className="skeleton-shimmer" style={{ flex: 1, height: 40, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
            <div className="skeleton-shimmer skeleton-btn" style={{ width: 120, height: 44 }} />
            <div className="skeleton-shimmer skeleton-btn" style={{ width: 180, height: 44 }} />
          </div>
        </div>
      </main>
    </div>
  );
}
