"use client";

import React from "react";
import type {
  Category,
  Difficulty,
  QuizType,
  QuizMetricsData,
  QuizItem,
} from "@/app/actions/quiz";
import { QuizFilterBar } from "./QuizFilterBar";
import { QuizListItem } from "./QuizListItem";
import { QuizPagination } from "./QuizPagination";

interface QuizListSectionProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections: { sec_id: number; sec_num: string }[];
  recentQuizzes: QuizItem[];
  filteredQuizzes: QuizItem[];
  totalCount: number;
  metrics: QuizMetricsData;
  sortBy: string;
  setSortBy: (val: string) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  activeFilterCount: number;
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
  onClearFilters: () => void;
  copiedQuizId: number | null;
  onCopyId: (id: number) => void;
  onToggleIdFilter: (id: number) => void;
  onPreview: (id: number) => void;
  onEdit: (quiz: QuizItem) => void;
  onDelete: (id: number) => void;
  currentPage: number;
  totalPages: number;
  isPending: boolean;
  onPageChange: (page: number) => void;
}

export const QuizListSection: React.FC<QuizListSectionProps> = ({
  categories,
  difficulties,
  types,
  sections,
  recentQuizzes,
  filteredQuizzes,
  totalCount,
  metrics,
  sortBy,
  setSortBy,
  isFilterOpen,
  setIsFilterOpen,
  hasActiveFilters,
  activeFilterCount,
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
  onClearFilters,
  copiedQuizId,
  onCopyId,
  onToggleIdFilter,
  onPreview,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  isPending,
  onPageChange,
}) => {
  return (
    <div className="admin-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #e0e0e0",
          paddingBottom: "10px",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <h2 style={{ margin: 0, borderBottom: "none", paddingBottom: 0 }}>
            Recently Added Quizzes
          </h2>
          <div className="list-visibility-counter">
            Showing <strong>{filteredQuizzes.length}</strong> of{" "}
            <strong>{metrics.totalQuizzes || totalCount}</strong> questions
            {metrics.totalQuizzes > 0 && (
              <span className="visibility-ratio">
                (
                {Math.round(
                  (filteredQuizzes.length / metrics.totalQuizzes) * 100,
                )}
                % of bank)
              </span>
            )}
          </div>
        </div>
        <div className="list-header-actions">
          <div className="sort-wrapper">
            <label
              htmlFor="sort-by-select"
              className="sort-label"
              title="Sort Quizzes"
            >
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
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
              aria-label="Sort quizzes"
            >
              <option value="id_desc">ID: High to Low (Newest)</option>
              <option value="id_asc">ID: Low to High (Oldest)</option>
              <option value="text_asc">Question: A → Z</option>
              <option value="text_desc">Question: Z → A</option>
              <option value="diff_asc">Difficulty: Easy → Hard</option>
              <option value="diff_desc">Difficulty: Hard → Easy</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
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

      {/* Collapsible Filter Bar & Active Filter Pills */}
      <QuizFilterBar
        categories={categories}
        difficulties={difficulties}
        types={types}
        sections={sections}
        isFilterOpen={isFilterOpen}
        hasActiveFilters={hasActiveFilters}
        idFilter={idFilter}
        setIdFilter={setIdFilter}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        sectionFilter={sectionFilter}
        setSectionFilter={setSectionFilter}
        difficultyFilter={difficultyFilter}
        setDifficultyFilter={setDifficultyFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onClearFilters={onClearFilters}
      />

      {recentQuizzes.length === 0 ? (
        <div className="empty-state">
          No quiz questions created yet. Use the form on the left to add one!
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="empty-state">
          <p style={{ margin: "0 0 12px 0" }}>
            No quiz questions found matching the selected filters.
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
          {filteredQuizzes.map((quiz) => (
            <QuizListItem
              key={quiz.quiz_id}
              quiz={quiz}
              idFilter={idFilter}
              copiedQuizId={copiedQuizId}
              onPreview={onPreview}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopyId={onCopyId}
              onToggleIdFilter={onToggleIdFilter}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <QuizPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        isPending={isPending}
        onPageChange={onPageChange}
      />
    </div>
  );
};
