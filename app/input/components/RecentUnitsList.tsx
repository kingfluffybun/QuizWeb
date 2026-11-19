"use client";

import { useRouter } from "next/navigation";
import type { Category, RecentUnitItem } from "@/app/actions/quiz";
import type { SectionOption } from "../types";

const SORT_LABELS: Record<string, string> = {
  id_desc: "ID: High to Low (Newest)",
  id_asc: "ID: Low to High (Oldest)",
  title_asc: "Title: A → Z",
  title_desc: "Title: Z → A",
  slides_desc: "Most Slides",
  quizzes_desc: "Most Questions",
};

interface RecentUnitsListProps {
  categories: Category[];
  sections: SectionOption[];
  recentUnits: RecentUnitItem[];
  filteredUnits: RecentUnitItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isBusy: boolean;
  isFilterOpen: boolean;
  setIsFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  idFilter: string;
  setIdFilter: (val: string) => void;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  sectionFilter: string;
  setSectionFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  copiedUnitId: number | null;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
  onCopyId: (unitId: number) => void;
  onToggleIdFilter: (unitId: number) => void;
  onLoadPage: (page: number) => Promise<void>;
  onEditUnit: (unit: RecentUnitItem) => Promise<void>;
  onDeleteUnit: (unitId: number) => Promise<void>;
}

export default function RecentUnitsList({
  categories,
  sections,
  recentUnits,
  filteredUnits,
  currentPage,
  totalPages,
  totalCount,
  isBusy,
  isFilterOpen,
  setIsFilterOpen,
  idFilter,
  setIdFilter,
  searchFilter,
  setSearchFilter,
  categoryFilter,
  setCategoryFilter,
  sectionFilter,
  setSectionFilter,
  statusFilter,
  setStatusFilter,
  sortBy,
  setSortBy,
  copiedUnitId,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
  onCopyId,
  onToggleIdFilter,
  onLoadPage,
  onEditUnit,
  onDeleteUnit,
}: RecentUnitsListProps) {
  const router = useRouter();
  const cleanIdFilter = idFilter.replace(/^[#\s]+/, "").trim();

  return (
    <div className="admin-card recent-units-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: "10px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <h2 style={{ margin: 0, borderBottom: "none", paddingBottom: 0 }}>
            Recently Added Units
          </h2>
          <div className="list-visibility-counter">
            Showing <strong>{filteredUnits.length}</strong> of{" "}
            <strong>{totalCount}</strong> units
          </div>
        </div>

        <div className="list-header-actions">
          <div className="sort-wrapper">
            <label htmlFor="sort-by-select" className="sort-label" title="Sort Units">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sort-icon"
                aria-hidden="true"
              >
                <path d="m3 16 4 4 4-4" />
                <path d="M7 20V4" />
                <path d="m21 8-4-4-4 4" />
                <path d="M17 4v16" />
              </svg>
              <span className="sort-label-text">Sort:</span>
            </label>
            <span className="sort-select-visible-value" aria-hidden="true">
              {SORT_LABELS[sortBy] ?? SORT_LABELS.id_desc}
            </span>
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
              aria-label="Sort units"
            >
              <option value="id_desc">ID: High to Low (Newest)</option>
              <option value="id_asc">ID: Low to High (Oldest)</option>
              <option value="title_asc">Title: A → Z</option>
              <option value="title_desc">Title: Z → A</option>
              <option value="slides_desc">Most Slides</option>
              <option value="quizzes_desc">Most Questions</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen((open) => !open)}
            className={`filter-toggle-btn ${isFilterOpen || hasActiveFilters ? "active" : ""}`}
            aria-expanded={isFilterOpen}
            title="Toggle Filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-funnel-icon lucide-funnel"
            >
              <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="filter-badge">{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="active-filters-bar" aria-label="Active filters">
          <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#666" }}>
            Active:
          </span>
          {idFilter.trim() !== "" && (
            <span className="active-filter-tag">
              ID: #{cleanIdFilter}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setIdFilter("")}
                title="Remove ID filter"
                aria-label="Remove ID filter"
              >
                ×
              </button>
            </span>
          )}
          {searchFilter.trim() !== "" && (
            <span className="active-filter-tag">
              Search: &ldquo;{searchFilter}&rdquo;
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setSearchFilter("")}
                title="Remove search query"
                aria-label="Remove search query"
              >
                ×
              </button>
            </span>
          )}
          {categoryFilter !== "" && (
            <span className="active-filter-tag">
              Cat: {categoryFilter}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setCategoryFilter("")}
                title="Remove category filter"
                aria-label="Remove category filter"
              >
                ×
              </button>
            </span>
          )}
          {sectionFilter !== "" && (
            <span className="active-filter-tag">
              Sec: {sectionFilter}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setSectionFilter("")}
                title="Remove section filter"
                aria-label="Remove section filter"
              >
                ×
              </button>
            </span>
          )}
          {statusFilter !== "" && (
            <span className="active-filter-tag">
              Status: {statusFilter}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setStatusFilter("")}
                title="Remove status filter"
                aria-label="Remove status filter"
              >
                ×
              </button>
            </span>
          )}
          {sortBy !== "id_desc" && (
            <span className="active-filter-tag">
              Sort: {SORT_LABELS[sortBy] ?? sortBy}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setSortBy("id_desc")}
                title="Reset to default sort"
                aria-label="Reset to default sort"
              >
                ×
              </button>
            </span>
          )}
          <button
            type="button"
            className="filter-clear-btn"
            onClick={onClearFilters}
            style={{ marginLeft: "auto", fontSize: "0.78rem" }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Collapsible Filter Panel */}
      {isFilterOpen && (
        <div className="filter-panel">
          <div className="filter-panel-header">
            <span className="filter-label-container">
              <span>Filter &amp; Search Options</span>
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="filter-clear-btn"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="filter-grid">
            <div className="filter-group">
              <span className="filter-group-title">Unit ID</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type="text"
                  value={idFilter}
                  onChange={(e) => setIdFilter(e.target.value)}
                  placeholder="e.g. 98 or #98"
                  className="filter-input"
                  aria-label="Filter by Unit ID"
                />
                {idFilter && (
                  <button
                    type="button"
                    onClick={() => setIdFilter("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      background: "none",
                      border: "none",
                      color: "#999",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold",
                      padding: 0,
                    }}
                    title="Clear ID filter"
                    aria-label="Clear ID filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group-title">Search Unit Title</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search unit title or author..."
                  className="filter-input"
                  aria-label="Search by unit title"
                />
                {searchFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchFilter("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      background: "none",
                      border: "none",
                      color: "#999",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold",
                      padding: 0,
                    }}
                    title="Clear search text"
                    aria-label="Clear search text"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-group-title">Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="filter-select"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.cat_id} value={cat.cat_name}>
                    {cat.cat_name}
                  </option>
                ))}
              </select>
            </div>

            {sections.length > 0 && (
              <div className="filter-group">
                <span className="filter-group-title">Section</span>
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="filter-select"
                  aria-label="Filter by section"
                >
                  <option value="">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec.sec_id} value={sec.sec_num.toString()}>
                      Section {sec.sec_num}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="filter-group">
              <span className="filter-group-title">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
                aria-label="Filter by unit status"
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Unit List */}
      {recentUnits.length === 0 ? (
        <div className="empty-state">
          No units submitted yet. Use the form on the left to add one!
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="empty-state">
          <p style={{ margin: "0 0 12px 0" }}>
            No units found matching the selected filters.
          </p>
          <button
            type="button"
            className="filter-clear-btn"
            style={{
              backgroundColor: "#fee2e2",
              color: "#ef4444",
              border: "1px solid #fca5a5",
              padding: "6px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "inline-block",
            }}
            onClick={onClearFilters}
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div
          style={{
            maxHeight: "1144px",
            overflowY: "auto",
            paddingRight: "10px",
          }}
        >
          {filteredUnits.map((unit) => {
            const isThisIdFiltered =
              cleanIdFilter !== "" && cleanIdFilter === unit.unit_id.toString();

            return (
              <div
                key={unit.unit_id}
                className="quiz-list-item unit-list-item"
                onClick={() => void onEditUnit(unit)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void onEditUnit(unit);
                  }
                }}
                role="button"
                tabIndex={0}
                title="Select this unit to edit"
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                  }}
                >
                  <div
                    className="quiz-list-question unit-title-text"
                    style={{ marginBottom: 0, fontWeight: 600, fontSize: "1.05rem" }}
                  >
                    {unit.unit_title}
                  </div>
                  <div
                    style={{ display: "flex", gap: "8px", flexShrink: 0 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn-preview"
                      onClick={(event) => {
                        event.stopPropagation();
                        router.push(`/quiz/${unit.unit_id}`);
                      }}
                      title={`Preview Unit (ID: #${unit.unit_id})`}
                      aria-label={`Preview Unit (ID: #${unit.unit_id})`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-eye"
                      >
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onEditUnit(unit);
                      }}
                      title={`Edit Unit (ID: #${unit.unit_id})`}
                      aria-label={`Edit Unit (ID: #${unit.unit_id})`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-pencil"
                      >
                        <path d="M21.174 6.812a1 1 0 0 0-1.986-.212L3.5 20.5l-.5 3 3-.5L20.888 8.8a1 1 0 0 0 .286-1.988Z" />
                        <path d="m16 5 3 3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeleteUnit(unit.unit_id);
                      }}
                      title={`Delete Unit (ID: #${unit.unit_id})`}
                      aria-label={`Delete Unit (ID: #${unit.unit_id})`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-trash-2"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" x2="10" y1="11" y2="17" />
                        <line x1="14" x2="14" y1="11" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="quiz-badge-row">
                  <div
                    className={`badge-id-container ${isThisIdFiltered ? "active-filter" : ""}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`badge badge-id ${copiedUnitId === unit.unit_id ? "copied" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCopyId(unit.unit_id);
                      }}
                      title="Click to copy Unit ID"
                      aria-label={`Copy Unit ID ${unit.unit_id}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {copiedUnitId === unit.unit_id ? (
                          <polyline points="20 6 9 17 4 12" />
                        ) : (
                          <>
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </>
                        )}
                      </svg>
                      <span>
                        {copiedUnitId === unit.unit_id ? "Copied!" : `ID: #${unit.unit_id}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`badge-id-filter-btn ${isThisIdFiltered ? "filtered" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleIdFilter(unit.unit_id);
                      }}
                      title={isThisIdFiltered ? "Clear ID filter" : "Filter by this Unit ID"}
                      aria-label={
                        isThisIdFiltered
                          ? "Clear ID filter"
                          : `Filter by Unit ID ${unit.unit_id}`
                      }
                    >
                      {isThisIdFiltered ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <span className="badge badge-cat">{unit.cat_name}</span>
                  {unit.sec_num != null && (
                    <span className="badge badge-type">Section {unit.sec_num}</span>
                  )}
                  <span className="badge badge-type">Unit {unit.unit_order}</span>
                  <span className={`badge badge-status badge-status-${unit.status}`}>
                    {unit.status.toUpperCase()}
                  </span>
                  <span className="badge badge-metric-tag" title="Lesson Slides count">
                    {unit.slide_count} {unit.slide_count === 1 ? "slide" : "slides"}
                  </span>
                  <span className="badge badge-metric-tag" title="Quizzes count">
                    {unit.question_count} {unit.question_count === 1 ? "question" : "questions"}
                  </span>
                  {unit.author_name && (
                    <span className="badge badge-author" title={`Author: ${unit.author_name}`}>
                      by {unit.author_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalCount > 0 && (
        <div className="pagination-controls" aria-label="Pagination controls">
          <button
            type="button"
            className="pagination-button"
            onClick={() => void onLoadPage(currentPage - 1)}
            disabled={isBusy || currentPage === 1}
          >
            Previous
          </button>
          <span className="pagination-status">
            Page {currentPage} of {totalPages} ({totalCount} units)
          </span>
          <button
            type="button"
            className="pagination-button"
            onClick={() => void onLoadPage(currentPage + 1)}
            disabled={isBusy || currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
