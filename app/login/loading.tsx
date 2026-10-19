import React from "react";
import "#css/login.css";
import "#css/nav.css";

export default function LoginLoading() {
  return (
    <div className="auth-page skeleton-auth-page" aria-busy="true" aria-label="Loading authentication">
      <main className="auth-card">
        {/* 1. Left: Brand & Info Panel */}
        <section className="info" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 40 }}>
          <div className="brand" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="skeleton-shimmer skeleton-circle" style={{ width: 44, height: 44 }} />
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 110, height: 26, margin: 0 }} />
          </div>

          <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 14, margin: "40px 0" }}>
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 200, height: 32 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "80%", height: 16 }} />
            <div className="skeleton-shimmer skeleton-pill" style={{ width: 130, height: 34, marginTop: 10 }} />
          </div>

          {/* Mini quiz preview skeleton */}
          <div className="skeleton-card" style={{ padding: 20, borderRadius: 16, background: "rgba(255, 255, 255, 0.1)" }}>
            <div className="skeleton-shimmer skeleton-line" style={{ width: "70%", height: 16, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <div className="skeleton-shimmer" style={{ flex: 1, height: 34, borderRadius: 8 }} />
              <div className="skeleton-shimmer" style={{ flex: 1, height: 34, borderRadius: 8 }} />
            </div>
          </div>
        </section>

        {/* 2. Right: Form Panel */}
        <section className="formPanel" style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="formCard" style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Header */}
            <header className="formHead">
              <div className="skeleton-shimmer skeleton-line" style={{ width: 80, height: 12, marginBottom: 8 }} />
              <div className="skeleton-shimmer skeleton-line title" style={{ width: 160, height: 30, marginBottom: 8 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: "85%", height: 14 }} />
            </header>

            {/* Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="skeleton-shimmer" style={{ width: "100%", height: 50, borderRadius: 12 }} />
              <div className="skeleton-shimmer" style={{ width: "100%", height: 50, borderRadius: 12 }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 14, margin: 0 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: 110, height: 14, margin: 0 }} />
              </div>

              <div className="skeleton-shimmer skeleton-btn" style={{ width: "100%", height: 48, borderRadius: 12, marginTop: 4 }} />
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border-main, #e0e0e0)" }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 90, height: 12, margin: 0 }} />
              <div style={{ flex: 1, height: 1, background: "var(--border-main, #e0e0e0)" }} />
            </div>

            {/* Social Buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="skeleton-shimmer skeleton-btn" style={{ height: 44, borderRadius: 10 }} />
              <div className="skeleton-shimmer skeleton-btn" style={{ height: 44, borderRadius: 10 }} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
