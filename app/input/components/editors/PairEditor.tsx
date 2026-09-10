"use client";

import React from "react";

interface PairEditorProps {
  optionCount: number;
  onAddOption: () => void;
  defaultPairs?: Array<{ left: string; right: string }>;
}

export const PairEditor: React.FC<PairEditorProps> = ({
  optionCount,
  onAddOption,
  defaultPairs = [],
}) => {
  return (
    <div className="form-group">
      <label
        style={{
          marginBottom: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Matching Pairs (Enter Left and matching Right values)</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className={`completeness-badge ${optionCount >= 4 ? "ready" : "pending"}`}
          >
            {optionCount >= 4
              ? `✓ ${optionCount} pairs (Ready)`
              : `${optionCount}/4 pairs (Min 4)`}
          </span>
          <button
            type="button"
            className="btn-add-option"
            onClick={onAddOption}
            title="Add pair"
            aria-label="Add pair"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-plus-icon lucide-plus"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>
      </label>
      <div className="options-grid options-grid-scrollable">
        {Array.from({ length: optionCount }, (_, idx) => idx).map((idx) => (
          <div key={idx} className="option-row" style={{ gap: "10px" }}>
            <span style={{ fontWeight: "bold" }}>{idx + 1}.</span>
            <input
              type="text"
              name={`pair_left_${idx}`}
              placeholder="Left Key"
              className="form-input"
              defaultValue={defaultPairs[idx]?.left ?? ""}
              required
            />
            <span style={{ color: "#aaa" }}>&harr;</span>
            <input
              type="text"
              name={`pair_right_${idx}`}
              placeholder="Right Value"
              className="form-input"
              defaultValue={defaultPairs[idx]?.right ?? ""}
              required
            />
          </div>
        ))}
      </div>
    </div>
  );
};
