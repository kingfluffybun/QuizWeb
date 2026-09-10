"use client";

import React from "react";
import type { QuizItem } from "@/app/actions/quiz";

interface CpEditorProps {
  cpPromptCount: number;
  onAddStep: () => void;
  onRemoveStep: () => void;
  editingQuiz: QuizItem | null;
}

export const CpEditor: React.FC<CpEditorProps> = ({
  cpPromptCount,
  onAddStep,
  onRemoveStep,
  editingQuiz,
}) => {
  return (
    <>
      <div className="form-group">
        <label htmlFor="cp_title">Coding Problem Title</label>
        <input
          id="cp_title"
          name="cp_title"
          type="text"
          className="form-input"
          placeholder="Enter coding problem title..."
          defaultValue={editingQuiz?.quiz_payload?.title ?? ""}
          required
        />
      </div>

      <div className="form-group form-group-flex">
        <label
          style={{
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          Problem Steps (Instruction, Initial Code Template & Expected Output)
          <button
            type="button"
            className="btn-add-option"
            onClick={onAddStep}
            title="Add step"
            aria-label="Add step"
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
        </label>
        <input type="hidden" name="cp_prompt_count" value={cpPromptCount} />
        <div
          className="options-grid options-grid-scrollable"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {Array.from({ length: cpPromptCount }, (_, idx) => idx).map((idx) => (
            <div
              key={idx}
              className="option-row"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                alignItems: "stretch",
                padding: "16px",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                backgroundColor: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontWeight: "700",
                    fontSize: "1rem",
                    color: "#1e293b",
                  }}
                >
                  Step {idx + 1}
                </span>
                {cpPromptCount > 1 && (
                  <button
                    type="button"
                    className="btn-delete"
                    style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                    onClick={onRemoveStep}
                    title="Remove last step"
                  >
                    Remove Step
                  </button>
                )}
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Instruction
                </label>
                <textarea
                  name={`cp_prompt_${idx}`}
                  className="form-textarea"
                  placeholder="Enter instruction..."
                  defaultValue={
                    editingQuiz?.quiz_payload?.steps?.[idx]?.prompt ??
                    editingQuiz?.quiz_payload?.prompts?.[idx] ??
                    (idx === 0 ? (editingQuiz?.question_text ?? "") : "")
                  }
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Initial Code Template
                </label>
                <textarea
                  name={`cp_template_${idx}`}
                  className="form-textarea"
                  style={{ fontFamily: "monospace" }}
                  placeholder="e.g. function test() {\n  // your code here\n}"
                  defaultValue={
                    editingQuiz?.quiz_payload?.steps?.[idx]?.template ??
                    (idx === 0
                      ? (editingQuiz?.quiz_payload?.template ?? "")
                      : "")
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Expected Output
                </label>
                <textarea
                  name={`cp_expected_${idx}`}
                  className="form-textarea"
                  style={{ fontFamily: "monospace" }}
                  placeholder="e.g. return true;"
                  defaultValue={
                    editingQuiz?.quiz_payload?.steps?.[idx]?.expected ??
                    (idx === 0
                      ? (editingQuiz?.quiz_payload?.expected ?? "")
                      : "")
                  }
                  required
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
