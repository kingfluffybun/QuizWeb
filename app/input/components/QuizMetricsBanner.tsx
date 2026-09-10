"use client";

import React from "react";
import type {
  Category,
  Difficulty,
  QuizType,
  QuizMetricsData,
} from "@/app/actions/quiz";
import QuizCoverageMatrix from "./QuizCoverageMatrix";

interface FacetedMetrics {
  catCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  diffCounts: Record<string, number>;
  filteredTotal: number;
  hasFacetFilter: boolean;
}

interface QuizMetricsBannerProps {
  metrics: QuizMetricsData;
  categories: Category[];
  types: QuizType[];
  difficulties: Difficulty[];
  categoryFilter: string;
  typeFilter: string;
  difficultyFilter: string;
  facetedMetrics: FacetedMetrics;
  isMatrixOpen: boolean;
  isMetricsExpanded: boolean;
  setIsMatrixOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMetricsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  onQuickFilterCategory: (catName: string) => void;
  onQuickFilterType: (typeName: string) => void;
  onQuickFilterDifficulty: (diffName: string) => void;
  onResetFacetFilters: () => void;
}

export function QuizMetricsBanner({
  metrics,
  categories,
  types,
  difficulties,
  categoryFilter,
  typeFilter,
  difficultyFilter,
  facetedMetrics,
  isMatrixOpen,
  isMetricsExpanded,
  setIsMatrixOpen,
  setIsMetricsExpanded,
  onQuickFilterCategory,
  onQuickFilterType,
  onQuickFilterDifficulty,
  onResetFacetFilters,
}: QuizMetricsBannerProps) {
  return (
    <section className="admin-metrics-banner" aria-label="Quiz Bank Analytics">
      <div className="metrics-banner-header">
        <div className="metrics-banner-title-wrap">
          <div className="metrics-banner-icon" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" x2="18" y1="20" y2="10" />
              <line x1="12" x2="12" y1="20" y2="4" />
              <line x1="6" x2="6" y1="20" y2="14" />
            </svg>
          </div>
          <div>
            <h2 className="metrics-banner-title">
              Quiz Bank Analytics
              <span className="metrics-banner-badge">
                {metrics.totalQuizzes} Questions
              </span>
            </h2>
            <p className="metrics-banner-subtitle">
              Real-time curriculum coverage, format breakdown, and difficulty
              distribution
            </p>
          </div>
        </div>

        <div className="metrics-banner-actions">
          <button
            type="button"
            className={`btn-metrics-action ${isMatrixOpen ? "active" : ""}`}
            onClick={() => setIsMatrixOpen((prev) => !prev)}
            title="Toggle Curriculum Coverage Heatmap"
            aria-expanded={isMatrixOpen}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
            <span>{isMatrixOpen ? "Hide Heatmap" : "Coverage Matrix"}</span>
          </button>

          <button
            type="button"
            className="btn-metrics-action"
            onClick={() => setIsMetricsExpanded((prev) => !prev)}
            title={
              isMetricsExpanded
                ? "Minimize Analytics Banner"
                : "Expand Analytics Banner"
            }
            aria-expanded={isMetricsExpanded}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isMetricsExpanded
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
            <span>{isMetricsExpanded ? "Minimize" : "Expand"}</span>
          </button>
        </div>
      </div>

      {/* Expandable Overview KPI Cards */}
      {isMetricsExpanded && (
        <div className="metrics-grid">
          {/* Card 1: Question Bank Volume */}
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-card-label">
                {facetedMetrics.hasFacetFilter
                  ? "Filtered Questions"
                  : "Total Questions"}
              </span>
              <span style={{ fontSize: "1.1rem" }}>📚</span>
            </div>
            <div className="metric-hero-num">
              {facetedMetrics.filteredTotal}
            </div>
            <div className="metric-hero-sub">
              {facetedMetrics.hasFacetFilter ? (
                <>
                  <span>
                    Filtered:{" "}
                    <strong>
                      {[categoryFilter, typeFilter, difficultyFilter]
                        .filter(Boolean)
                        .join(" • ")}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={onResetFacetFilters}
                    className="metric-reset-link"
                    title="Reset all banner filters"
                  >
                    Reset
                  </button>
                </>
              ) : (
                <>
                  <span>Active in database</span>
                  <span className="telemetry-separator">•</span>
                  <span>{categories.length} tracks</span>
                </>
              )}
            </div>
            <div className="metric-health-note good">
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
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>
                {facetedMetrics.hasFacetFilter
                  ? `Showing ${facetedMetrics.filteredTotal} of ${metrics.totalQuizzes} (${Math.round((facetedMetrics.filteredTotal / (metrics.totalQuizzes || 1)) * 100)}% of bank)`
                  : "Live authoring database ready"}
              </span>
            </div>
          </div>

          {/* Card 2: Curriculum Tracks (Categories) */}
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-card-label">
                {typeFilter || difficultyFilter
                  ? `Tracks in ${[typeFilter, difficultyFilter].filter(Boolean).join(" • ")}`
                  : "Curriculum Tracks"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {categoryFilter ? "Click to clear" : "Click to filter"}
              </span>
            </div>
            <div className="metric-pill-list">
              {categories.map((cat) => {
                const isFiltered =
                  categoryFilter.toLowerCase() === cat.cat_name.toLowerCase();
                const dotClass = cat.cat_name.toLowerCase().includes("html")
                  ? "html"
                  : cat.cat_name.toLowerCase().includes("css")
                    ? "css"
                    : "js";
                const count = facetedMetrics.catCounts[cat.cat_name] ?? 0;
                const totalForCategoryPct = facetedMetrics.hasFacetFilter
                  ? Object.values(facetedMetrics.catCounts).reduce(
                      (a, b) => a + b,
                      0,
                    ) || 1
                  : metrics.totalQuizzes || 1;
                const percentage = Math.round(
                  (count / totalForCategoryPct) * 100,
                );

                return (
                  <button
                    key={cat.cat_id}
                    type="button"
                    className={`metric-pill-item ${isFiltered ? "active" : ""}`}
                    onClick={() => onQuickFilterCategory(cat.cat_name)}
                    title={
                      isFiltered
                        ? `Clear ${cat.cat_name} filter`
                        : `Filter by ${cat.cat_name}`
                    }
                  >
                    <span className="metric-pill-name">
                      <span className={`metric-track-dot ${dotClass}`} />
                      {cat.cat_name}
                    </span>
                    <span className="metric-pill-stat">
                      <span>{count}</span>
                      <span className="metric-pill-pct">({percentage}%)</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3: Question Formats (Types) */}
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-card-label">
                {categoryFilter || difficultyFilter
                  ? `Formats in ${[categoryFilter, difficultyFilter].filter(Boolean).join(" • ")}`
                  : "Question Formats"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {typeFilter ? "Click to clear" : "Click to filter"}
              </span>
            </div>
            <div className="metric-chip-wrap">
              {types.map((t) => {
                const isFiltered =
                  typeFilter.toLowerCase() === t.type_name.toLowerCase();
                const count = facetedMetrics.typeCounts[t.type_name] ?? 0;
                return (
                  <button
                    key={t.quiz_type_id}
                    type="button"
                    className={`metric-chip ${isFiltered ? "active" : ""} ${count === 0 ? "dimmed" : ""}`}
                    onClick={() => onQuickFilterType(t.type_name)}
                    title={
                      isFiltered
                        ? `Clear ${t.type_name} filter`
                        : `Filter by ${t.type_name}`
                    }
                  >
                    <span>{t.type_name}</span>
                    <span className="metric-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 4: Difficulty Progression & Section Health */}
          <div className="metric-card">
            <div className="metric-card-header">
              <span className="metric-card-label">
                {categoryFilter || typeFilter
                  ? `Difficulty in ${[categoryFilter, typeFilter].filter(Boolean).join(" • ")}`
                  : "Difficulty Balance"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {difficultyFilter ? "Click to clear" : "Click to filter"}
              </span>
            </div>
            <div className="metric-chip-wrap">
              {difficulties.map((diff) => {
                const isFiltered =
                  difficultyFilter.toLowerCase() ===
                  diff.difficulty_name.toLowerCase();
                const count =
                  facetedMetrics.diffCounts[diff.difficulty_name] ?? 0;
                return (
                  <button
                    key={diff.difficulty_id}
                    type="button"
                    className={`metric-chip ${isFiltered ? "active" : ""} ${count === 0 ? "dimmed" : ""}`}
                    onClick={() =>
                      onQuickFilterDifficulty(diff.difficulty_name)
                    }
                    title={
                      isFiltered
                        ? `Clear ${diff.difficulty_name} filter`
                        : `Filter by ${diff.difficulty_name}`
                    }
                  >
                    <span>{diff.difficulty_name}</span>
                    <span className="metric-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
            {metrics.lowCoverageSections?.length > 0 ? (
              <div className="metric-health-note warn">
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
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" x2="12" y1="9" y2="13" />
                  <line x1="12" x2="12.01" y1="17" y2="17" />
                </svg>
                <span>
                  {metrics.lowCoverageSections.length} sections have &lt; 3
                  questions
                </span>
              </div>
            ) : (
              <div className="metric-health-note good">
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
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>All active sections well covered</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-Depth Curriculum Coverage Matrix & Section Audit */}
      {isMatrixOpen && (
        <QuizCoverageMatrix metrics={metrics} difficulties={difficulties} />
      )}
    </section>
  );
}

export default QuizMetricsBanner;
