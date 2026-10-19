import React from "react";
import SkeletonPublicNav from "@/app/components/skeletons/SkeletonPublicNav";
import "#css/landing-page.css";
import "#css/nav.css";

export default function RootLoading() {
  return (
    <div className="skeleton-root-page" aria-busy="true" aria-label="Loading page">
      <SkeletonPublicNav />

      {/* Hero Section Skeleton */}
      <section className="hero" style={{ minHeight: "75vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, maxWidth: 800 }}>
          {/* Logo & Brand */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div className="skeleton-shimmer skeleton-circle" style={{ width: 88, height: 88 }} />
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 140, height: 32, margin: 0 }} />
          </div>

          {/* Hero Heading & Subtitle */}
          <div className="skeleton-shimmer skeleton-line title" style={{ width: "90%", height: 44, margin: "12px 0 6px" }} />
          <div className="skeleton-shimmer skeleton-line medium" style={{ width: "70%", height: 20 }} />

          {/* Call to Action Button */}
          <div className="skeleton-shimmer skeleton-btn" style={{ width: 220, height: 56, borderRadius: 28, marginTop: 16 }} />
        </div>
      </section>

      {/* Content Section Skeleton */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", gap: 48 }}>
        <div className="skeleton-card" style={{ padding: 40, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 220, height: 32 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "100%", height: 16 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "85%", height: 16 }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: "100%", height: 200, borderRadius: 16 }} />
        </div>
      </section>
    </div>
  );
}
