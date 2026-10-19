import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/sidebar.css";
import "#css/admin.css";

export default function AdminLoading() {
  return (
    <div className="admin-app-layout skeleton-admin-layout" aria-busy="true" aria-label="Loading admin dashboard">
      <SkeletonSidebar isStaff />

      <main className="admin-main">
        <div className="admin-container">
          {/* 1. Admin Header */}
          <header className="admin-header">
            <div>
              <div className="admin-header-title-row" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="skeleton-shimmer skeleton-line title" style={{ width: 240, margin: 0 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 140, height: 26 }} />
              </div>
              <div className="skeleton-shimmer skeleton-line medium" style={{ height: 16, marginTop: 8 }} />
            </div>
          </header>

          {/* 2. Admin 4 Stats Cards */}
          <div className="admin-stats-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="admin-stat-card">
                <div className="skeleton-shimmer skeleton-circle" style={{ width: 44, height: 44 }} />
                <div className="admin-stat-details" style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 40, height: 24, margin: 0 }} />
                  <div className="skeleton-shimmer skeleton-line" style={{ width: 110, height: 12, margin: 0 }} />
                </div>
              </div>
            ))}
          </div>

          {/* 3. Admin Navigation Tabs */}
          <nav className="admin-tabs" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 150, height: 42 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 150, height: 42 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 150, height: 42 }} />
          </nav>

          {/* 4. Table Controls Skeleton */}
          <div className="skeleton-card" style={{ marginBottom: 24, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
              <div className="skeleton-shimmer" style={{ width: 260, height: 38, borderRadius: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-shimmer" style={{ width: 130, height: 38, borderRadius: 10 }} />
                <div className="skeleton-shimmer" style={{ width: 140, height: 38, borderRadius: 10 }} />
              </div>
            </div>
          </div>

          {/* 5. User Table Skeleton */}
          <div className="skeleton-table-card" style={{ marginBottom: 32 }}>
            <div className="skeleton-table-header">
              <div className="skeleton-shimmer skeleton-line" style={{ width: 120, height: 14, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 80, height: 14, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 14, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 90, height: 14, margin: 0 }} />
            </div>
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="skeleton-table-row">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="skeleton-shimmer skeleton-circle" style={{ width: 34, height: 34 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 14, margin: 0 }} />
                    <div className="skeleton-shimmer skeleton-line" style={{ width: 140, height: 11, margin: 0 }} />
                  </div>
                </div>
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 70, height: 24 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 85, height: 24 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="skeleton-shimmer skeleton-btn" style={{ width: 80, height: 32 }} />
                  <div className="skeleton-shimmer skeleton-btn" style={{ width: 80, height: 32 }} />
                </div>
              </div>
            ))}
          </div>

          {/* 6. Embedded Staff Workspace Skeleton */}
          <div className="skeleton-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 200, margin: 0 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 110, height: 32 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 110, height: 32 }} />
              </div>
            </div>
            <div className="skeleton-shimmer" style={{ width: "100%", height: 180, borderRadius: 12 }} />
          </div>
        </div>
      </main>
    </div>
  );
}
