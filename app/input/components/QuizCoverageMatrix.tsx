"use client";

import React from "react";
import type { Difficulty, QuizMetricsData } from "@/app/actions/quiz";

interface QuizCoverageMatrixProps {
  metrics: QuizMetricsData;
  difficulties: Difficulty[];
}

export default function QuizCoverageMatrix({
  metrics,
  difficulties,
}: QuizCoverageMatrixProps) {
  return (
    <div className="coverage-matrix-panel">
      <div className="coverage-matrix-header">
        <h3 className="coverage-matrix-title">
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
          >
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          Track × Difficulty Heatmap Matrix
        </h3>
        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
          Identifies curriculum gaps across skill levels
        </span>
      </div>

      <div className="coverage-table-wrapper">
        <table className="coverage-table">
          <thead>
            <tr>
              <th>Curriculum Track</th>
              {difficulties.map((d) => (
                <th key={d.difficulty_id}>{d.difficulty_name}</th>
              ))}
              <th>Total Track Questions</th>
              <th>Coverage Status</th>
            </tr>
          </thead>
          <tbody>
            {metrics.matrix && metrics.matrix.length > 0 ? (
              metrics.matrix.map((row) => {
                const hasEmpty = difficulties.some(
                  (d) => (row.difficulties?.[d.difficulty_name] ?? 0) === 0,
                );
                return (
                  <tr key={row.cat_name}>
                    <td>
                      <strong>{row.cat_name}</strong>
                    </td>
                    {difficulties.map((d) => {
                      const count = row.difficulties?.[d.difficulty_name] ?? 0;
                      return (
                        <td key={d.difficulty_id}>
                          <span
                            className={`coverage-cell-count ${
                              count === 0
                                ? "empty"
                                : count < 4
                                  ? "low"
                                  : "good"
                            }`}
                          >
                            {count} {count === 0 ? "⚠️ Empty" : ""}
                          </span>
                        </td>
                      );
                    })}
                    <td>
                      <strong>{row.total}</strong>
                    </td>
                    <td>
                      {hasEmpty ? (
                        <span
                          style={{
                            color: "#ef4444",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                          }}
                        >
                          Needs Questions
                        </span>
                      ) : (
                        <span
                          style={{
                            color: "#059669",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                          }}
                        >
                          ✓ Balanced
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={difficulties.length + 3}
                  style={{ textAlign: "center", padding: "16px" }}
                >
                  No coverage data available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section Breakdown Audit */}
      {metrics.bySection && metrics.bySection.length > 0 && (
        <div className="sections-audit-wrap">
          <div className="sections-audit-title">
            Section Distribution Audit
          </div>
          <div className="sections-audit-chips">
            {metrics.bySection.map((sec) => {
              const isLow = sec.count < 3;
              return (
                <div
                  key={sec.sec_id}
                  className={`section-audit-chip ${isLow ? "alert-low" : ""}`}
                  title={
                    isLow
                      ? "Under-populated section (< 3 questions)"
                      : `Section ${sec.sec_num}`
                  }
                >
                  <span>Section {sec.sec_num}:</span>
                  <strong>{sec.count} qs</strong>
                  {isLow && <span>⚠️</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
