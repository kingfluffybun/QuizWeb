import React from "react";

export default function SkeletonPublicNav() {
  return (
    <nav className="public-nav skeleton-public-nav-wrapper" aria-label="Loading navigation" style={{ pointerEvents: "none" }}>
      <div className="col" id="logo-nav">
        <div className="logo col" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="skeleton-shimmer skeleton-circle" style={{ width: 44, height: 44 }} />
          <div className="skeleton-shimmer skeleton-line title" style={{ width: 110, height: 26, margin: 0 }} />
        </div>
      </div>

      <div className="nav-options" style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <div className="skeleton-shimmer skeleton-line" style={{ width: 60, height: 16, margin: 0 }} />
        <div className="skeleton-shimmer skeleton-line" style={{ width: 85, height: 16, margin: 0 }} />
        <div className="skeleton-shimmer skeleton-line" style={{ width: 60, height: 16, margin: 0 }} />
        <div className="skeleton-shimmer skeleton-pill" style={{ width: 110, height: 38 }} />
      </div>

      <div className="accessibility">
        <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
      </div>
    </nav>
  );
}
