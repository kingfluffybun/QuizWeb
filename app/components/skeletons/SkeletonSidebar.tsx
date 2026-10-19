import React from "react";

export interface SkeletonSidebarProps {
  isStaff?: boolean;
}

export default function SkeletonSidebar({ isStaff = false }: SkeletonSidebarProps) {
  return (
    <aside className="skeleton-sidebar" aria-label="Loading navigation">
      <div className="skeleton-sidebar-brand">
        <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
        <div className="skeleton-shimmer skeleton-line title" style={{ width: 110, height: 22, margin: 0 }} />
      </div>

      <div className="skeleton-sidebar-menu">
        {/* Main Nav Items */}
        <div className="skeleton-sidebar-item">
          <div className="skeleton-shimmer skeleton-circle" style={{ width: 20, height: 20 }} />
          <div className="skeleton-shimmer skeleton-line" style={{ width: 90, height: 16, margin: 0 }} />
        </div>
        <div className="skeleton-sidebar-item">
          <div className="skeleton-shimmer skeleton-circle" style={{ width: 20, height: 20 }} />
          <div className="skeleton-shimmer skeleton-line" style={{ width: 75, height: 16, margin: 0 }} />
        </div>
        <div className="skeleton-sidebar-item">
          <div className="skeleton-shimmer skeleton-circle" style={{ width: 20, height: 20 }} />
          <div className="skeleton-shimmer skeleton-line" style={{ width: 85, height: 16, margin: 0 }} />
        </div>

        {/* Staff Nav Items (Optional) */}
        {isStaff && (
          <>
            <div style={{ height: 1, background: "var(--border-main, #e0e0e0)", margin: "8px 0" }} />
            <div className="skeleton-sidebar-item">
              <div className="skeleton-shimmer skeleton-circle" style={{ width: 20, height: 20 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 100, height: 16, margin: 0 }} />
            </div>
            <div className="skeleton-sidebar-item">
              <div className="skeleton-shimmer skeleton-circle" style={{ width: 20, height: 20 }} />
              <div className="skeleton-shimmer skeleton-line" style={{ width: 110, height: 16, margin: 0 }} />
            </div>
          </>
        )}
      </div>

      <div className="skeleton-sidebar-user">
        <div className="skeleton-shimmer skeleton-circle" style={{ width: 36, height: 36 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <div className="skeleton-shimmer skeleton-line" style={{ width: 80, height: 14, margin: 0 }} />
          <div className="skeleton-shimmer skeleton-line" style={{ width: 50, height: 10, margin: 0 }} />
        </div>
      </div>
    </aside>
  );
}
