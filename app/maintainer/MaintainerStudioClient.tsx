"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/rbac";
import MaintainerStatsRibbon, { type SubmissionFilterStatus } from "./components/MaintainerStatsRibbon";
import SubmissionsTracker from "./components/SubmissionsTracker";

export interface MaintainerSubmission {
  pending_id: number;
  author_id: number | null;
  unit_title: string;
  sec_id: number;
  pending_status: "pending" | "approved" | "rejected" | string;
  pending_note: string | null;
  pending_name: string;
}

export interface MaintainerStats {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}

export interface MaintainerUserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface MaintainerStudioClientProps {
  initialStats: MaintainerStats;
  initialSubmissions: MaintainerSubmission[];
  currentUser: MaintainerUserProfile;
  children?: React.ReactNode;
}

export type { SubmissionFilterStatus };
export type SubmissionSortOption = "newest" | "oldest" | "title_asc" | "section";
export type StudioViewMode = "all" | "editor" | "submissions";

export default function MaintainerStudioClient({
  initialStats,
  initialSubmissions,
  children,
}: MaintainerStudioClientProps) {
  const router = useRouter();
  const [stats, setStats] = useState<MaintainerStats>(initialStats);
  const [submissions, setSubmissions] = useState<MaintainerSubmission[]>(initialSubmissions);
  const [studioView, setStudioView] = useState<StudioViewMode>("all");
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);

  const [statusFilter, setStatusFilter] = useState<SubmissionFilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SubmissionSortOption>("newest");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyId = (id: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(String(id));
      setCopiedId(id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleRefresh = useCallback(() => {
    startTransition(async () => {
      try {
        const { getMaintainerStats, getMaintainerSubmissions } = await import(
          "@/app/actions/maintainer"
        );
        const [freshStats, freshSubs] = await Promise.all([
          getMaintainerStats(),
          getMaintainerSubmissions(),
        ]);
        setStats(freshStats);
        setSubmissions(freshSubs.submissions);
      } catch (err) {
        console.error("Failed to refresh maintainer submissions:", err);
      }
    });
  }, []);

  useEffect(() => {
    const onPendingUpdated = () => handleRefresh();
    window.addEventListener("quizweb-pending-updated", onPendingUpdated);
    return () => window.removeEventListener("quizweb-pending-updated", onPendingUpdated);
  }, [handleRefresh]);

  const handleEditSubmission = (pendingId: number) => {
    const idStr = String(pendingId);
    window.sessionStorage.setItem("quizweb-edit-pending-id", idStr);
    if (studioView === "submissions") {
      setStudioView("all");
    }
    window.dispatchEvent(new CustomEvent("quizweb-edit-pending", { detail: idStr }));
    const workspaceEl =
      document.getElementById("quiz-form") || document.getElementById("quiz-workspace");
    if (workspaceEl) {
      workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push(`/input?pending_id=${idStr}`);
  };

  const handleLaunchNewCreation = () => {
    if (studioView === "submissions") {
      setStudioView("all");
    }
    window.sessionStorage.removeItem("quizweb-edit-pending-id");
    window.dispatchEvent(
      new CustomEvent("quizweb-studio-launch", {
        detail: { toolId: "unit", title: "Full Lesson Unit" },
      }),
    );
    window.setTimeout(() => {
      document
        .getElementById("quiz-workspace")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
    if (!document.getElementById("quiz-workspace")) {
      router.push("/input");
    }
  };

  const handleSelectStatFilter = (nextStatus: SubmissionFilterStatus) => {
    setStatusFilter(nextStatus);
    if (studioView === "editor") {
      setStudioView("all");
    }
  };

  const filteredSubmissions = useMemo(() => {
    let list = [...submissions];

    if (statusFilter !== "all") {
      list = list.filter((s) => s.pending_status.toLowerCase() === statusFilter);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const titleMatch = s.unit_title.toLowerCase().includes(q);
        const idMatch = String(s.pending_id).includes(q);
        const secMatch = `sec ${s.sec_id}`.toLowerCase().includes(q) || String(s.sec_id) === q;
        const noteMatch = (s.pending_note || "").toLowerCase().includes(q);
        return titleMatch || idMatch || secMatch || noteMatch;
      });
    }

    list.sort((a, b) => {
      if (sortOption === "newest") return b.pending_id - a.pending_id;
      if (sortOption === "oldest") return a.pending_id - b.pending_id;
      if (sortOption === "title_asc") return a.unit_title.localeCompare(b.unit_title);
      if (sortOption === "section") return a.sec_id - b.sec_id;
      return 0;
    });

    return list;
  }, [submissions, statusFilter, searchQuery, sortOption]);

  const renderViewSwitcher = (mobile = false) => (
    <div
      className={`maintainer-view-switcher${mobile ? " maintainer-view-switcher-mobile" : ""}`}
      role="tablist"
      aria-label="Maintainer studio layout view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={studioView === "all"}
        className={`maintainer-view-pill ${studioView === "all" ? "active" : ""}`}
        onClick={() => setStudioView("all")}
      >
        <span className="maintainer-view-pill-desktop-label">Unified Studio</span>
        <span className="maintainer-view-pill-mobile-label">Studio</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={studioView === "editor"}
        className={`maintainer-view-pill ${studioView === "editor" ? "active" : ""}`}
        onClick={() => {
          setStudioView("editor");
          window.setTimeout(() => {
            document
              .getElementById("quiz-workspace")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 30);
        }}
      >
        <span className="maintainer-view-pill-desktop-label">Focus Editor</span>
        <span className="maintainer-view-pill-mobile-label">Editor</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={studioView === "submissions"}
        className={`maintainer-view-pill ${studioView === "submissions" ? "active" : ""}`}
        onClick={() => setStudioView("submissions")}
      >
        <span className="maintainer-view-pill-desktop-label">
          My Submissions ({submissions.length})
        </span>
        <span className="maintainer-view-pill-mobile-label">
          Submissions ({submissions.length})
        </span>
      </button>
    </div>
  );

  return (
    <div className="maintainer-container">
      {!mobileNoticeDismissed && (
        <div className="staff-mobile-notice" role="status">
          <div className="staff-mobile-notice-body">
            <strong>Best experienced on Desktop</strong>
            <span>
              Multi-step code template authoring and side-by-side live previews are optimized for
              desktop screens.
            </span>
          </div>
          <button
            type="button"
            className="staff-mobile-notice-dismiss"
            onClick={() => setMobileNoticeDismissed(true)}
            aria-label="Dismiss desktop recommendation notice"
          >
            ✕
          </button>
        </div>
      )}

      <header className="maintainer-header">
        <div className="maintainer-header-text">
          <div className="maintainer-title-row">
            <h1>Maintainer Studio</h1>
          </div>
        </div>
        <div className="maintainer-header-actions">
          {renderViewSwitcher()}
          <button
            type="button"
            className="btn-studio-refresh"
            onClick={handleRefresh}
            disabled={isPending}
            title="Refresh submissions from server"
            aria-label="Refresh submissions"
          >
            <svg
              className={isPending ? "spin-icon" : ""}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{isPending ? "Updating..." : "Sync"}</span>
          </button>
          <button type="button" className="btn-studio-primary" onClick={handleLaunchNewCreation}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span style={{ whiteSpace: "nowrap" }}>New Unit</span>
          </button>
        </div>
        <Image
          src="/assets/landing-page/Clouds-right.svg"
          alt=""
          width={180}
          height={180}
          className="cloud-right"
          aria-hidden="true"
        />
      </header>

      <div className="maintainer-mobile-view-switcher">{renderViewSwitcher(true)}</div>

      <MaintainerStatsRibbon
        stats={stats}
        statusFilter={statusFilter}
        hidden={studioView === "editor"}
        onSelectFilter={handleSelectStatFilter}
      />

      <SubmissionsTracker
        stats={stats}
        totalSubmissionsCount={submissions.length}
        filteredSubmissions={filteredSubmissions}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        sortOption={sortOption}
        copiedId={copiedId}
        hidden={studioView === "editor"}
        onStatusFilterChange={setStatusFilter}
        onSearchChange={setSearchQuery}
        onSortChange={setSortOption}
        onClearFilters={() => {
          setStatusFilter("all");
          setSearchQuery("");
        }}
        onCopyId={handleCopyId}
        onEditSubmission={handleEditSubmission}
      />

      {children && (
        <div className="maintainer-embedded-workspace" hidden={studioView === "submissions"}>
          {children}
        </div>
      )}
    </div>
  );
}
