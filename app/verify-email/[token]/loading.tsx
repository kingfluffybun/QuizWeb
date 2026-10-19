import React from "react";
import "#css/verify.css";

export default function VerifyEmailLoading() {
  return (
    <main className="main-email skeleton-verify-page" aria-busy="true" aria-label="Loading verification">
      <div className="email-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 32px" }}>
        {/* Logo */}
        <div className="logo" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div className="skeleton-shimmer skeleton-circle" style={{ width: 80, height: 80 }} />
          <div className="skeleton-shimmer skeleton-line title" style={{ width: 120, height: 26, margin: 0 }} />
        </div>

        {/* Header & Description */}
        <div className="skeleton-shimmer skeleton-line title" style={{ width: 240, height: 28, marginBottom: 16 }} />
        <div className="skeleton-shimmer skeleton-line medium" style={{ width: 320, height: 16, marginBottom: 8 }} />
        <div className="skeleton-shimmer skeleton-line" style={{ width: 260, height: 14, marginBottom: 28 }} />

        {/* Activation Action Button */}
        <div className="skeleton-shimmer skeleton-btn" style={{ width: 200, height: 48, borderRadius: 12 }} />
      </div>
    </main>
  );
}
