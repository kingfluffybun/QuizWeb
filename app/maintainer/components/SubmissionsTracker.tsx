"use client";

import Link from "next/link";
import type {
  MaintainerStats,
  MaintainerSubmission,
  SubmissionFilterStatus,
  SubmissionSortOption,
} from "../MaintainerStudioClient";

interface SubmissionsTrackerProps {
  stats: MaintainerStats;
  totalSubmissionsCount: number;
  filteredSubmissions: MaintainerSubmission[];
  statusFilter: SubmissionFilterStatus;
  searchQuery: string;
  sortOption: SubmissionSortOption;
  copiedId: number | null;
  hidden: boolean;
  onStatusFilterChange: (status: SubmissionFilterStatus) => void;
  onSearchChange: (q: string) => void;
  onSortChange: (sort: SubmissionSortOption) => void;
  onClearFilters: () => void;
  onCopyId: (id: number) => void;
  onEditSubmission: (pendingId: number) => void;
}

export default function SubmissionsTracker({
  stats,
  totalSubmissionsCount,
  filteredSubmissions,
  statusFilter,
  searchQuery,
  sortOption,
  copiedId,
  hidden,
  onStatusFilterChange,
  onSearchChange,
  onSortChange,
  onClearFilters,
  onCopyId,
  onEditSubmission,
}: SubmissionsTrackerProps) {
  return (
    <section
      id="my-submissions-section"
      className="submissions-tracker-section"
      hidden={hidden}
    >
      <div className="section-title-wrap">
        <h2>My Submissions</h2>
        <p>
          Live ledger of authored units and questions, administrative review notes, and in-place
          resubmission controls.
        </p>
      </div>

      <div className="tracker-toolbar">
        <div className="filter-tabs-group" role="tablist" aria-label="Filter submissions by status">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "all"}
            className={`filter-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => onStatusFilterChange("all")}
          >
            <span>All</span>
            <span className="tab-count">{totalSubmissionsCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "approved"}
            className={`filter-tab-btn ${statusFilter === "approved" ? "active" : ""}`}
            onClick={() => onStatusFilterChange("approved")}
          >
            <span className="tab-dot dot-approved" />
            <span>Approved</span>
            <span className="tab-count">{stats.approved}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "pending"}
            className={`filter-tab-btn ${statusFilter === "pending" ? "active" : ""}`}
            onClick={() => onStatusFilterChange("pending")}
          >
            <span className="tab-dot dot-pending" />
            <span>Pending</span>
            <span className="tab-count">{stats.pending}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === "rejected"}
            className={`filter-tab-btn ${statusFilter === "rejected" ? "active" : ""}`}
            onClick={() => onStatusFilterChange("rejected")}
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
              onChange={(e) => onSearchChange(e.target.value)}
              className="tracker-search-input"
              aria-label="Search submissions"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SubmissionSortOption)}
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
              <button type="button" className="btn-clear-filters" onClick={onClearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="submissions-list">
            {filteredSubmissions.map((item) => {
              const statusLower = item.pending_status.toLowerCase();
              const isRejected = statusLower === "rejected";
              const isApproved = statusLower === "approved";
              const isPendingReview = statusLower === "pending";

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
                          onClick={() => onCopyId(item.pending_id)}
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

                    {item.pending_note && (
                      <div
                        className={`admin-feedback-box ${
                          isRejected
                            ? "feedback-rejected"
                            : isApproved
                              ? "feedback-approved"
                              : "feedback-pending"
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
                        <span className="curriculum-live-indicator">Live in courseware</span>
                      )}
                    </div>

                    <div className="submission-footer-actions">
                      {isRejected && (
                        <button
                          type="button"
                          className="btn-action-resubmit"
                          onClick={() => onEditSubmission(item.pending_id)}
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
                          onClick={() => onEditSubmission(item.pending_id)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                          <span>Update Draft</span>
                        </button>
                      )}

                      {isApproved && (
                        <Link href={`/quiz/${item.pending_id}`} className="btn-action-view">
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
  );
}
