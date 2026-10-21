"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/rbac";
import "#css/sidebar.css";
import "#css/dashboard.css";
import "#css/maintainer.css";

// -----------------------------------------------------------------------------
// 1. Data Interfaces
// -----------------------------------------------------------------------------

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

export type SubmissionFilterStatus = "all" | "pending" | "approved" | "rejected";
export type SubmissionSortOption = "newest" | "oldest" | "title_asc" | "section";
export type StudioViewMode = "all" | "editor" | "submissions";

interface StudioLauncherTool {
  id: string;
  title: string;
  typeBadge: string;
  description: string;
  badgeClass: string;
  iconSvg: React.ReactNode;
}

// -----------------------------------------------------------------------------
// 2. Studio Launcher Tool Definitions (R5 Question Creation Studio)
// -----------------------------------------------------------------------------

const STUDIO_LAUNCHERS: StudioLauncherTool[] = [
  {
    id: "mcq",
    title: "Multiple Choice",
    typeBadge: "Quiz Question",
    badgeClass: "badge-blue",
    description: "Compose single or multi-select questions with syntax highlighting, hints, and explanations.",
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "fitb",
    title: "Fill in the Blank",
    typeBadge: "Quiz Question",
    badgeClass: "badge-purple",
    description: "Create code completion exercises testing keyword placement, syntax recall, and normalization.",
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M8 7h6" />
        <path d="M8 11h8" />
      </svg>
    ),
  },
  {
    id: "pair",
    title: "Matching Pairs",
    typeBadge: "Interactive",
    badgeClass: "badge-teal",
    description: "Design interactive term-and-definition or code-and-output matching challenge blocks.",
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: "order",
    title: "Order Sequencing",
    typeBadge: "Interactive",
    badgeClass: "badge-amber",
    description: "Structure code reordering puzzles challenging learners to sequence logical statement flow.",
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 16 4 4 4-4" />
        <path d="M7 20V4" />
        <path d="m21 8-4-4-4 4" />
        <path d="M17 4v16" />
      </svg>
    ),
  },
  {
    id: "cp",
    title: "Coding Problem Steps",
    typeBadge: "Assessment",
    badgeClass: "badge-rose",
    description: "Author multi-step coding challenges integrated with the in-browser Monaco IDE and test runner.",
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: "unit",
    title: "Full Lesson Unit",
    typeBadge: "Curriculum Bundle",
    badgeClass: "badge-indigo",
    description: "Bundle comprehensive lesson cards, inline practice checks, and terminal assessments into a unit.",
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
];

// -----------------------------------------------------------------------------
// 3. Main Component
// -----------------------------------------------------------------------------

export default function MaintainerStudioClient({
  initialStats,
  initialSubmissions,
  currentUser,
  children,
}: MaintainerStudioClientProps) {
  const router = useRouter();
  const [stats, setStats] = useState<MaintainerStats>(initialStats);
  const [submissions, setSubmissions] = useState<MaintainerSubmission[]>(initialSubmissions);
  const [studioView, setStudioView] = useState<StudioViewMode>("all");
  const [mobileNoticeDismissed, setMobileNoticeDismissed] = useState(false);
  const [activeLauncher, setActiveLauncher] = useState<string>("unit");

  // Client Filter & Sort State
  const [statusFilter, setStatusFilter] = useState<SubmissionFilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SubmissionSortOption>("newest");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // 1-Click ID Copy Helper
  const handleCopyId = (id: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(String(id));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Live Refresh from Server Actions
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

  // Automatically sync stats & submissions whenever QuizInputForm saves/updates/deletes a unit
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPendingUpdated = () => {
      handleRefresh();
    };
    window.addEventListener("quizweb-pending-updated", onPendingUpdated);
    return () => {
      window.removeEventListener("quizweb-pending-updated", onPendingUpdated);
    };
  }, [handleRefresh]);

  // Resubmit / Edit rejected or pending item directly inside the embedded Maintainer Studio
  const handleEditSubmission = (pendingId: number) => {
    const idStr = String(pendingId);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("quizweb-edit-pending-id", idStr);
      if (studioView === "submissions") {
        setStudioView("all");
      }
      window.dispatchEvent(
        new CustomEvent("quizweb-edit-pending", { detail: idStr })
      );
      const workspaceEl =
        document.getElementById("quiz-form") ||
        document.getElementById("quiz-workspace");
      if (workspaceEl) {
        workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    router.push(`/input?pending_id=${idStr}`);
  };

  // Launch new creation session for a specific Studio Tool directly in-place
  const handleLaunchNewCreation = (tool?: StudioLauncherTool) => {
    const targetToolId = tool?.id ?? "unit";
    const targetTitle = tool?.title ?? "Full Lesson Unit";
    setActiveLauncher(targetToolId);
    if (studioView === "submissions") {
      setStudioView("all");
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("quizweb-edit-pending-id");
      window.dispatchEvent(
        new CustomEvent("quizweb-studio-launch", {
          detail: { toolId: targetToolId, title: targetTitle },
        }),
      );
      window.setTimeout(() => {
        const workspaceEl = document.getElementById("quiz-workspace");
        if (workspaceEl) {
          workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 30);
      if (document.getElementById("quiz-workspace")) {
        return;
      }
    }
    router.push("/input");
  };

  const handleSelectStatFilter = (nextStatus: SubmissionFilterStatus) => {
    setStatusFilter(nextStatus);
    if (studioView === "editor") {
      setStudioView("all");
    }
  };

  // Filter & Sort Pipeline
  const filteredSubmissions = useMemo(() => {
    let list = [...submissions];

    // Filter by status tab
    if (statusFilter !== "all") {
      list = list.filter(
        (s) => s.pending_status.toLowerCase() === statusFilter
      );
    }

    // Filter by search query
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

    // Sort order
    list.sort((a, b) => {
      if (sortOption === "newest") return b.pending_id - a.pending_id;
      if (sortOption === "oldest") return a.pending_id - b.pending_id;
      if (sortOption === "title_asc") return a.unit_title.localeCompare(b.unit_title);
      if (sortOption === "section") return a.sec_id - b.sec_id;
      return 0;
    });

    return list;
  }, [submissions, statusFilter, searchQuery, sortOption]);

  return (
    <div className="maintainer-container">
      {!mobileNoticeDismissed && (
        <div className="staff-mobile-notice" role="status">
          <div className="staff-mobile-notice-body">
            <strong>Best experienced on Desktop</strong>
            <span>
              Multi-step code template authoring and side-by-side live previews are optimized for desktop screens.
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
      {/* ------------------------------------------------------------------- */}
      {/* 1. Header & Quick Actions                                           */}
      {/* ------------------------------------------------------------------- */}
      <header className="maintainer-header">
        <div className="maintainer-header-text">
          <div className="maintainer-title-row">
            <h1>Maintainer Studio</h1>
            <span className="maintainer-role-pill">
              {currentUser.role === "admin" ? "Admin Staff" : "Maintainer"}
            </span>
          </div>
        </div>
        <div className="maintainer-header-actions">
          <div className="maintainer-view-switcher" role="tablist" aria-label="Maintainer studio layout view">
            <button
              type="button"
              role="tab"
              aria-selected={studioView === "all"}
              className={`maintainer-view-pill ${studioView === "all" ? "active" : ""}`}
              onClick={() => setStudioView("all")}
            >
              Unified Studio
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studioView === "editor"}
              className={`maintainer-view-pill ${studioView === "editor" ? "active" : ""}`}
              onClick={() => {
                setStudioView("editor");
                if (typeof window !== "undefined") {
                  window.setTimeout(() => {
                    document
                      .getElementById("quiz-workspace")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 30);
                }
              }}
            >
              Focus Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studioView === "submissions"}
              className={`maintainer-view-pill ${studioView === "submissions" ? "active" : ""}`}
              onClick={() => setStudioView("submissions")}
            >
              My Submissions ({submissions.length})
            </button>
          </div>
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
          <button
            type="button"
            className="btn-studio-primary"
            onClick={() => handleLaunchNewCreation()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span>New Unit / Question</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Maintainer Stats Ribbon (Interactive Clickable Cards)             */}
      {/* ------------------------------------------------------------------- */}
      <section
        className="maintainer-stats-ribbon"
        aria-label="Author Submission Statistics"
        hidden={studioView === "editor"}
      >
        <div
          className={`stat-card stat-card-total ${statusFilter === "all" ? "active-stat-card" : ""}`}
          onClick={() => handleSelectStatFilter("all")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelectStatFilter("all");
            }
          }}
          aria-label="Filter all submissions"
        >
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Total Submissions</span>
            <span className="stat-card-value">{stats.total}</span>
            <span className="stat-card-hint">All authored items</span>
          </div>
        </div>

        <div
          className={`stat-card stat-card-approved ${statusFilter === "approved" ? "active-stat-card" : ""}`}
          onClick={() => handleSelectStatFilter("approved")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelectStatFilter("approved");
            }
          }}
          aria-label="Filter approved submissions"
        >
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Approved</span>
            <span className="stat-card-value">{stats.approved}</span>
            <span className="stat-card-hint">Published to learners</span>
          </div>
        </div>

        <div
          className={`stat-card stat-card-pending ${statusFilter === "pending" ? "active-stat-card" : ""}`}
          onClick={() => handleSelectStatFilter("pending")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelectStatFilter("pending");
            }
          }}
          aria-label="Filter pending submissions"
        >
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Pending Review</span>
            <span className="stat-card-value">{stats.pending}</span>
            <span className="stat-card-hint">In admin review queue</span>
          </div>
        </div>

        <div
          className={`stat-card stat-card-rejected ${statusFilter === "rejected" ? "active-stat-card" : ""}`}
          onClick={() => handleSelectStatFilter("rejected")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelectStatFilter("rejected");
            }
          }}
          aria-label="Filter rejected submissions needing action"
        >
          <div className="stat-card-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <div className="stat-card-body">
            <span className="stat-card-label">Action Needed</span>
            <span className="stat-card-value">{stats.rejected}</span>
            <span className="stat-card-hint">Revisions requested</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- */}
      {/* 3.5. Embedded Authoring Workspace (/input Integrated Studio)         */}
      {/* ------------------------------------------------------------------- */}
      {children && (
        <div
          className="maintainer-embedded-workspace"
          hidden={studioView === "submissions"}
        >
          {children}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 4. "My Submissions" Filterable Tracker                              */}
      {/* ------------------------------------------------------------------- */}
      <section
        id="my-submissions-section"
        className="submissions-tracker-section"
        hidden={studioView === "editor"}
      >
        <div className="section-title-wrap">
          <h2>My Submissions</h2>
          <p>Live ledger of authored units and questions, administrative review notes, and in-place resubmission controls.</p>
        </div>

        {/* Toolbar: Filter Tabs + Search + Sort */}
        <div className="tracker-toolbar">
          <div className="filter-tabs-group" role="tablist" aria-label="Filter submissions by status">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              className={`filter-tab-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              <span>All</span>
              <span className="tab-count">{submissions.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "pending"}
              className={`filter-tab-btn ${statusFilter === "pending" ? "active" : ""}`}
              onClick={() => setStatusFilter("pending")}
            >
              <span className="tab-dot dot-pending" />
              <span>Pending</span>
              <span className="tab-count">{stats.pending}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "approved"}
              className={`filter-tab-btn ${statusFilter === "approved" ? "active" : ""}`}
              onClick={() => setStatusFilter("approved")}
            >
              <span className="tab-dot dot-approved" />
              <span>Approved</span>
              <span className="tab-count">{stats.approved}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "rejected"}
              className={`filter-tab-btn ${statusFilter === "rejected" ? "active" : ""}`}
              onClick={() => setStatusFilter("rejected")}
            >
              <span className="tab-dot dot-rejected" />
              <span>Rejected</span>
              <span className="tab-count">{stats.rejected}</span>
            </button>
          </div>

          <div className="tracker-controls-right">
            <div className="search-box-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search title, section, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tracker-search-input"
                aria-label="Search submissions"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SubmissionSortOption)}
              className="tracker-sort-select"
              aria-label="Sort submissions"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title_asc">Title (A-Z)</option>
              <option value="section">Section</option>
            </select>
          </div>
        </div>

        {/* Submissions List / Data Table */}
        <div className="submissions-table-container">
          {filteredSubmissions.length === 0 ? (
            <div className="submissions-empty-state">
              <div className="empty-state-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h3>No Submissions Found</h3>
              <p>
                {searchQuery || statusFilter !== "all"
                  ? "No submissions match your active filter criteria. Try adjusting or clearing your filters."
                  : "You haven't submitted any questions or units yet. Use the launcher cards above to compose your first lesson!"}
              </p>
              {(searchQuery || statusFilter !== "all") && (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="submissions-list">
              {filteredSubmissions.map((item) => {
                const isRejected = item.pending_status.toLowerCase() === "rejected";
                const isApproved = item.pending_status.toLowerCase() === "approved";
                const isPendingReview = item.pending_status.toLowerCase() === "pending";

                return (
                  <article
                    key={item.pending_id}
                    className={`submission-card ${isRejected ? "card-rejected" : isApproved ? "card-approved" : "card-pending"}`}
                  >
                    <div className="submission-card-header">
                      <div className="submission-meta-left">
                        <span className="submission-id-pill" title="Submission ID">
                          #{item.pending_id}
                          <button
                            type="button"
                            className="btn-copy-id"
                            onClick={() => handleCopyId(item.pending_id)}
                            title="Copy ID to clipboard"
                            aria-label={`Copy ID ${item.pending_id}`}
                          >
                            {copiedId === item.pending_id ? "Copied!" : "Copy"}
                          </button>
                        </span>
                        <span className="section-badge">Section {item.sec_id}</span>
                      </div>

                      <div className="submission-meta-right">
                        <span
                          className={`status-badge ${
                            isApproved
                              ? "status-approved"
                              : isPendingReview
                              ? "status-pending"
                              : "status-rejected"
                          }`}
                        >
                          {isApproved && "Approved"}
                          {isPendingReview && "Pending Review"}
                          {isRejected && "Action Needed"}
                        </span>
                      </div>
                    </div>

                    <div className="submission-card-body">
                      <h3 className="submission-title">{item.unit_title}</h3>
                      <p className="submission-author-meta">
                        Authored by <strong>{item.pending_name}</strong>
                      </p>

                      {/* Admin Feedback Notes Callout Display (Feature F11) */}
                      {item.pending_note && (
                        <div
                          className={`admin-feedback-box ${
                            isRejected ? "feedback-rejected" : isApproved ? "feedback-approved" : "feedback-pending"
                          }`}
                          role="region"
                          aria-label="Admin Feedback Note"
                        >
                          <div className="feedback-header">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Admin Feedback Note:</span>
                          </div>
                          <p className="feedback-text">{item.pending_note}</p>
                          {isRejected && (
                            <div className="feedback-prompt">
                              <span className="feedback-prompt-dot" />
                              <span>Revisions required before item can be approved.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="submission-card-footer">
                      <div className="submission-footer-left">
                        {isPendingReview && (
                          <span className="review-status-indicator">
                            <span className="status-pulse-dot" />
                            Waiting in review queue
                          </span>
                        )}
                        {isApproved && (
                          <span className="curriculum-live-indicator">
                            Live in courseware
                          </span>
                        )}
                      </div>

                      <div className="submission-footer-actions">
                        {/* Edit & Resubmit Action (R5) */}
                        {isRejected && (
                          <button
                            type="button"
                            className="btn-action-resubmit"
                            onClick={() => handleEditSubmission(item.pending_id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                            <span>Edit &amp; Resubmit</span>
                          </button>
                        )}

                        {isPendingReview && (
                          <button
                            type="button"
                            className="btn-action-edit-pending"
                            onClick={() => handleEditSubmission(item.pending_id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                            <span>Update Draft</span>
                          </button>
                        )}

                        {isApproved && (
                          <Link href="/quiz" className="btn-action-view">
                            <span>View in Quiz</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
