"use client";

import React from "react";
import type { Category, Difficulty, QuizType } from "@/app/actions/quiz";

interface QuizFilterBarProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections: { sec_id: number; sec_num: string }[];
  isFilterOpen: boolean;
  hasActiveFilters: boolean;
  idFilter: string;
  setIdFilter: (val: string) => void;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  sectionFilter: string;
  setSectionFilter: (val: string) => void;
  difficultyFilter: string;
  setDifficultyFilter: (val: string) => void;
  typeFilter: string;
  setTypeFilter: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  onClearFilters: () => void;
}

export const QuizFilterBar: React.FC<QuizFilterBarProps> = ({
  categories,
  difficulties,
  types,
  sections,
  isFilterOpen,
  hasActiveFilters,
  idFilter,
  setIdFilter,
  searchFilter,
  setSearchFilter,
  categoryFilter,
  setCategoryFilter,
  sectionFilter,
  setSectionFilter,
  difficultyFilter,
  setDifficultyFilter,
  typeFilter,
  setTypeFilter,
  sortBy,
  setSortBy,
  onClearFilters,
}) => {
  return (
    <>
      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="active-filters-bar" aria-label="Active filters">
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: "600",
              color: "#666",
            }}
          >
            Active:
          </span>
          {idFilter.trim() !== "" && (
            <span className="active-filter-tag">
              ID: #{idFilter.replace(/^[#\s]+/, "")}
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
          {difficultyFilter !== "" && (
            <span className="active-filter-tag">
              Diff: {difficultyFilter}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setDifficultyFilter("")}
                title="Remove difficulty filter"
                aria-label="Remove difficulty filter"
              >
                ×
              </button>
            </span>
          )}
          {typeFilter !== "" && (
            <span className="active-filter-tag">
              Type: {typeFilter}
              <button
                type="button"
                className="active-filter-tag-close"
                onClick={() => setTypeFilter("")}
                title="Remove type filter"
                aria-label="Remove type filter"
              >
                ×
              </button>
            </span>
          )}
          {sortBy !== "id_desc" && (
            <span className="active-filter-tag">
              Sort:{" "}
              {sortBy === "id_asc"
                ? "Oldest First"
                : sortBy === "text_asc"
                  ? "A → Z"
                  : sortBy === "text_desc"
                    ? "Z → A"
                    : sortBy === "diff_asc"
                      ? "Easy → Hard"
                      : sortBy === "diff_desc"
                        ? "Hard → Easy"
                        : sortBy}
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
              <span>Filter & Search Options</span>
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
            {/* Question ID Filter */}
            <div className="filter-group">
              <span className="filter-group-title">Question ID</span>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={idFilter}
                  onChange={(e) => setIdFilter(e.target.value)}
                  placeholder="e.g. 42 or #42"
                  className="filter-input"
                  aria-label="Filter by Question ID"
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

            {/* Search Prompt Text Filter */}
            <div className="filter-group">
              <span className="filter-group-title">Search Prompt / Text</span>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search question text..."
                  className="filter-input"
                  aria-label="Search by prompt text"
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

            {/* Category Filter */}
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

            {/* Section Filter */}
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

            {/* Difficulty Filter */}
            <div className="filter-group">
              <span className="filter-group-title">Difficulty</span>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="filter-select"
                aria-label="Filter by difficulty"
              >
                <option value="">All Difficulties</option>
                {difficulties.map((diff) => (
                  <option
                    key={diff.difficulty_id}
                    value={diff.difficulty_name}
                  >
                    {diff.difficulty_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="filter-group">
              <span className="filter-group-title">Quiz Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="filter-select"
                aria-label="Filter by quiz type"
              >
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t.quiz_type_id} value={t.type_name}>
                    {t.type_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
