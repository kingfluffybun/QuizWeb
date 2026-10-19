import React from "react";
import SkeletonSidebar from "@/app/components/skeletons/SkeletonSidebar";
import "#css/sidebar.css";
import "#css/nav.css";
import "@/public/css/settings.css";

export default function SettingsLoading() {
  return (
    <div className="settings-app-layout skeleton-settings-layout" aria-busy="true" aria-label="Loading settings">
      <SkeletonSidebar />

      <main className="settings-main">
        <div className="settings-card">
          {/* 1. Header */}
          <div className="settings-header">
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 260, margin: 0 }} />
            <div className="skeleton-shimmer skeleton-line medium" style={{ height: 16, marginTop: 8 }} />
          </div>

          {/* 2. User Profile Summary Banner */}
          <div className="settings-user-summary" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24, padding: 20, borderRadius: 16, border: "1px solid var(--border-main, #e0e0e0)" }}>
            <div className="skeleton-shimmer skeleton-circle" style={{ width: 56, height: 56 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="skeleton-shimmer skeleton-line" style={{ width: 140, height: 22, margin: 0 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 70, height: 22 }} />
                <div className="skeleton-shimmer skeleton-pill" style={{ width: 95, height: 22 }} />
              </div>
              <div className="skeleton-shimmer skeleton-line" style={{ width: 180, height: 14, margin: 0 }} />
            </div>
          </div>

          {/* 3. Settings Navigation Tabs */}
          <nav className="settings-tabs" style={{ display: "flex", gap: 8, margin: "24px 0" }}>
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 110, height: 40 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 160, height: 40 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 120, height: 40 }} />
          </nav>

          {/* 4. Active Section Form Skeleton */}
          <section className="settings-section" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div className="skeleton-shimmer skeleton-line sub-title" style={{ width: 180, margin: 0 }} />
              <div className="skeleton-shimmer skeleton-line medium" style={{ height: 14, marginTop: 6 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 540 }}>
              <div>
                <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 14, marginBottom: 8 }} />
                <div className="skeleton-shimmer" style={{ width: "100%", height: 46, borderRadius: 12 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: "60%", height: 11, marginTop: 6 }} />
              </div>

              <div className="skeleton-shimmer skeleton-btn" style={{ width: 160, height: 44, marginTop: 8 }} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
