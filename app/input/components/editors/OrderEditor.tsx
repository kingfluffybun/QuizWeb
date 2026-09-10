"use client";

import React from "react";

interface OrderEditorProps {
  optionCount: number;
  onAddOption: () => void;
  defaultItems?: string[];
}

export const OrderEditor: React.FC<OrderEditorProps> = ({
  optionCount,
  onAddOption,
  defaultItems = [],
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
        <span>Items to Order (Enter in the CORRECT sequence)</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            className={`completeness-badge ${optionCount >= 4 ? "ready" : "pending"}`}
          >
            {optionCount >= 4
              ? `✓ ${optionCount} items (Ready)`
              : `${optionCount}/4 items (Min 4)`}
          </span>
          <button
            type="button"
            className="btn-add-option"
            onClick={onAddOption}
            title="Add item"
            aria-label="Add item"
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
          <div key={idx} className="option-row">
            <span
              style={{
                minWidth: "30px",
                fontWeight: "bold",
              }}
            >
              {idx + 1}.
            </span>
            <input
              type="text"
              name={`order_${idx}`}
              placeholder={`Sequence Item ${idx + 1}`}
              className="form-input"
              defaultValue={defaultItems[idx] ?? ""}
              required
            />
          </div>
        ))}
      </div>
    </div>
  );
};
