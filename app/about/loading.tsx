import React from "react";
import SkeletonPublicNav from "@/app/components/skeletons/SkeletonPublicNav";
import "#css/about.css";
import "#css/nav.css";

export default function AboutLoading() {
  return (
    <div className="skeleton-about-page" aria-busy="true" aria-label="Loading about page">
      <SkeletonPublicNav />

      <section className="about" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        {/* 1. Hero */}
        <header className="about-hero" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 60 }}>
          <div className="skeleton-shimmer skeleton-line title" style={{ width: 220, height: 42 }} />
          <div className="skeleton-shimmer skeleton-line medium" style={{ width: 320, height: 20 }} />
          <div className="skeleton-shimmer skeleton-line" style={{ width: 240, height: 14 }} />
        </header>

        {/* 2. Mission & Vision */}
        <div className="about-description" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 60 }}>
          <div className="skeleton-card" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 160, height: 28 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "100%", height: 14 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "90%", height: 14 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "70%", height: 14 }} />
          </div>
          <div className="skeleton-card" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="skeleton-shimmer skeleton-line title" style={{ width: 160, height: 28 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "100%", height: 14 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "85%", height: 14 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: "75%", height: 14 }} />
          </div>
        </div>

        {/* 3. Core Values */}
        <div className="about-values" style={{ marginBottom: 60 }}>
          <div className="skeleton-shimmer skeleton-line title" style={{ width: 240, height: 32, margin: "0 auto 28px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <div key={v} className="skeleton-card" style={{ padding: 20, textAlign: "center", display: "flex", justifyContent: "center" }}>
                <div className="skeleton-shimmer skeleton-line" style={{ width: 110, height: 16, margin: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* 4. Team Section */}
        <div className="about-team" style={{ marginBottom: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="skeleton-shimmer skeleton-line title" style={{ width: 220, height: 32, marginBottom: 28 }} />
          {/* Team Leader */}
          <div className="skeleton-card" style={{ padding: 24, width: 220, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <div className="skeleton-shimmer skeleton-circle" style={{ width: 64, height: 64 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: 120, height: 16, margin: 0 }} />
            <div className="skeleton-shimmer skeleton-line" style={{ width: 90, height: 12, margin: 0 }} />
          </div>

          {/* Members Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20, width: "100%" }}>
            {[1, 2, 3, 4, 5, 6].map((m) => (
              <div key={m} className="skeleton-card" style={{ padding: 20, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div className="skeleton-shimmer skeleton-circle" style={{ width: 50, height: 50 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 14, margin: 0 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: 70, height: 12, margin: 0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* 5. Tech Stack */}
        <div className="about-tech" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div className="skeleton-shimmer skeleton-line title" style={{ width: 280, height: 28 }} />
          <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5, 6].map((t) => (
              <div key={t} className="skeleton-card" style={{ padding: 18, width: 90, height: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
                <div className="skeleton-shimmer skeleton-line" style={{ width: 45, height: 10, margin: 0 }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
