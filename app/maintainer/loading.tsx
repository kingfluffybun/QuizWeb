import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/sidebar.css";
import "#css/dashboard.css";
import "#css/maintainer.css";

export default function MaintainerLoading() {
  return (
    <div className="dashboard-page maintainer-page skeleton-maintainer-layout" aria-busy="true" aria-label="Loading maintainer studio">
      <SkeletonSidebar isStaff />

      <main className="maintainer-main">
        <div className="maintainer-container">
          {/* 1. Header with Title & Action Buttons */}
          <header className="maintainer-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="skeleton-shimmer skeleton-line title" style={{ width: 260, margin: 0 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 100, height: 26 }} />
              </div>
              <div className="skeleton-shimmer skeleton-line medium" style={{ height: 16 }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="skeleton-shimmer skeleton-btn" style={{ width: 90, height: 40 }} />
              <div className="skeleton-shimmer skeleton-btn" style={{ width: 160, height: 40 }} />
            </div>
          </header>

          {/* 2. Stats Ribbon (4 Cards) */}
          <section className="maintainer-stats-ribbon" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, margin: "24px 0" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card" style={{ padding: 18, background: "var(--bg-card, #fff)", border: "1px solid var(--border-main, #e0e0e0)", display: "flex", alignItems: "center", gap: 14 }}>
                <div className="skeleton-shimmer skeleton-circle" style={{ width: 44, height: 44 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "70%", height: 12, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "40%", height: 22, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "50%", height: 10, margin: 0 }} />
                </div>
              </div>
            ))}
          </section>

          {/* 3. Studio Creation Hub (4 Cards) */}
          <section style={{ margin: "24px 0" }}>
            <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 180, marginBottom: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
                    <div className="skeleton-shimmer skeleton-pill" style={{ width: 80, height: 22 }} />
                  </div>
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "80%", height: 18, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "100%", height: 12, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: "65%", height: 12, margin: 0 }} />
                </div>
              ))}
            </div>
          </section>

          {/* 4. Submissions Filter Toolbar */}
          <div className="skeleton-card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 60, height: 34 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 85, height: 34 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 85, height: 34 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 85, height: 34 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="skeleton-shimmer" style={{ width: 220, height: 36, borderRadius: 10 }} />
                <div className="skeleton-shimmer" style={{ width: 120, height: 36, borderRadius: 10 }} />
              </div>
            </div>
          </div>

          {/* 5. Submissions List Skeleton */}
          <div className="skeleton-table-card" style={{ marginBottom: 32 }}>
            <div className="skeleton-table-header">
              <div className="skeleton-shimmer skeleton-line" style={{ width: 140, height: 14, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 90, height: 14, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 110, height: 14, margin: 0 }} />
            </div>
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton-table-row">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 220, height: 16, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 130, height: 12, margin: 0 }} />
                </div>
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 90, height: 26 }} />
                <div className="skeleton-shimmer skeleton-btn" style={{ width: 90, height: 32 }} />
              </div>
            ))}
          </div>

          {/* 6. Embedded Workspace Skeleton */}
          <div className="skeleton-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 220, margin: 0 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 110, height: 32 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 110, height: 32 }} />
              </div>
            </div>
            <div className="skeleton-shimmer" style={{ width: "100%", height: 160, borderRadius: 12 }} />
          </div>
        </div>
      </main>
    </div>
  );
}
