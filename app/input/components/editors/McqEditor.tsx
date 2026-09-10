"use client";

import React from "react";

interface McqEditorProps {
  options: string[];
  correctIndex: number;
  onOptionChange: (index: number, value: string) => void;
  onCorrectIndexChange: (index: number) => void;
  hasDuplicateOptions: boolean;
  isCorrectAnswerNotablyLonger: boolean;
}

export const McqEditor: React.FC<McqEditorProps> = ({
  options,
  correctIndex,
  onOptionChange,
  onCorrectIndexChange,
  hasDuplicateOptions,
  isCorrectAnswerNotablyLonger,
}) => {
  return (
    <div className="form-group">
      <label style={{ marginBottom: "12px" }}>
        Answer Options (Select correct answer radio)
      </label>
      <div className="options-grid">
        {[0, 1, 2, 3].map((idx) => (
          <div key={idx} className="option-row">
            <input
              type="radio"
              name="correct_option_index"
              value={idx}
              id={`correct_${idx}`}
              className="radio-check"
              required
              checked={correctIndex === idx}
              onChange={() => onCorrectIndexChange(idx)}
            />
            <input
              type="text"
              name={`option_${idx}`}
              placeholder={`Option ${idx + 1}`}
              className="form-input"
              value={options[idx] ?? ""}
              onChange={(e) => onOptionChange(idx, e.target.value)}
              required
            />
          </div>
        ))}
      </div>

      {/* Duplicate choices warning */}
      {hasDuplicateOptions && (
        <div className="form-warning-alert" role="alert">
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
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
          <span>
            Warning: Duplicate choices detected! All 4 options should be
            distinct.
          </span>
        </div>
      )}

      {/* Distractor balance tip */}
      {isCorrectAnswerNotablyLonger && (
        <div className="form-tip-alert" role="status">
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
            <path d="M12 2v4" />
            <path d="m4.93 4.93 2.83 2.83" />
            <path d="M2 12h4" />
            <path d="m4.93 19.07 2.83-2.83" />
            <path d="M12 18v4" />
            <path d="m19.07 19.07-2.83-2.83" />
            <path d="M18 12h4" />
            <path d="m19.07 4.93-2.83 2.83" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>
            Distractor Tip: The correct answer is significantly longer than
            distractors. Test-takers often guess the longest option.
          </span>
        </div>
      )}
    </div>
  );
};
