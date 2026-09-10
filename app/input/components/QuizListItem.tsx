"use client";

import React from "react";
import type { QuizItem } from "@/app/actions/quiz";

interface QuizListItemProps {
  quiz: QuizItem;
  idFilter: string;
  copiedQuizId: number | null;
  onPreview: (quizId: number) => void;
  onEdit: (quiz: QuizItem) => void;
  onDelete: (quizId: number) => void;
  onCopyId: (quizId: number) => void;
  onToggleIdFilter: (quizId: number) => void;
}

export const QuizListItem: React.FC<QuizListItemProps> = ({
  quiz,
  idFilter,
  copiedQuizId,
  onPreview,
  onEdit,
  onDelete,
  onCopyId,
  onToggleIdFilter,
}) => {
  const payload = quiz.quiz_payload;
  const cleanFilter = idFilter.replace(/^[#\s]+/, "").trim();
  const isThisIdFiltered =
    cleanFilter !== "" && cleanFilter === quiz.quiz_id.toString();

  return (
    <div className="quiz-list-item">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <div className="quiz-list-question" style={{ marginBottom: 0 }}>
          {quiz.type_name === "CP" && quiz.quiz_payload?.title
            ? quiz.quiz_payload.title
            : quiz.question_text}
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn-preview"
            onClick={() => onPreview(quiz.quiz_id)}
            title={`Preview Question (ID: #${quiz.quiz_id})`}
            aria-label={`Preview Question (ID: #${quiz.quiz_id})`}
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
            onClick={() => onEdit(quiz)}
            title={`Edit Question (ID: #${quiz.quiz_id})`}
            aria-label={`Edit Question (ID: #${quiz.quiz_id})`}
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
            onClick={() => onDelete(quiz.quiz_id)}
            title={`Delete Question (ID: #${quiz.quiz_id})`}
            aria-label={`Delete Question (ID: #${quiz.quiz_id})`}
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
        >
          <button
            type="button"
            className={`badge badge-id ${copiedQuizId === quiz.quiz_id ? "copied" : ""}`}
            onClick={() => onCopyId(quiz.quiz_id)}
            title="Click to copy Question ID"
            aria-label={`Copy Question ID ${quiz.quiz_id}`}
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
              {copiedQuizId === quiz.quiz_id ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </>
              )}
            </svg>
            <span>
              {copiedQuizId === quiz.quiz_id
                ? "Copied!"
                : `ID: #${quiz.quiz_id}`}
            </span>
          </button>
          <button
            type="button"
            className={`badge-id-filter-btn ${isThisIdFiltered ? "filtered" : ""}`}
            onClick={() => onToggleIdFilter(quiz.quiz_id)}
            title={
              isThisIdFiltered
                ? "Clear ID filter"
                : "Filter by this Question ID"
            }
            aria-label={
              isThisIdFiltered
                ? "Clear ID filter"
                : `Filter by Question ID ${quiz.quiz_id}`
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

        <span className="badge badge-cat">{quiz.cat_name}</span>
        {quiz.sec_num && (
          <span className="badge badge-type">Section {quiz.sec_num}</span>
        )}
        <span className="badge badge-diff">{quiz.difficulty_name}</span>
        <span className="badge badge-type">{quiz.type_name}</span>

        {quiz.type_name === "MCQ" && payload?.options && (
          <span className="badge badge-metric-tag" title="Number of options">
            {payload.options.length} options
          </span>
        )}
        {quiz.type_name === "Order" && payload?.items && (
          <span className="badge badge-metric-tag" title="Sequence items">
            {payload.items.length} items
          </span>
        )}
        {quiz.type_name === "Pair" && payload?.pairs && (
          <span className="badge badge-metric-tag" title="Matching pairs">
            {payload.pairs.length} pairs
          </span>
        )}
        {quiz.type_name === "CP" && (
          <span className="badge badge-metric-tag" title="Problem steps">
            {payload?.steps?.length || payload?.prompts?.length || 1} step
            {(payload?.steps?.length || 1) > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {payload && (
        <div className="quiz-payload-preview">
          {/* MCQ Rendering */}
          {quiz.type_name === "MCQ" && payload.options && (
            <div>
              <strong>Options:</strong>
              {payload.options.map((opt: string, i: number) => {
                const isCorrect = payload.correct_index === i;
                return (
                  <div key={i} className="quiz-payload-option">
                    <span>
                      {i + 1}. {opt}
                    </span>
                    {isCorrect && (
                      <span className="correct-text">(Correct)</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* FITB Rendering */}
          {quiz.type_name === "FITB" && (
            <div>
              <strong>Correct Answer:</strong>{" "}
              <span className="correct-text">{payload.answer}</span>
            </div>
          )}

          {/* Order Rendering */}
          {quiz.type_name === "Order" && payload.items && (
            <div>
              <strong>Correct Order:</strong>
              {payload.items.map((item: string, i: number) => (
                <div key={i} style={{ margin: "4px 0" }}>
                  {i + 1}. {item}
                </div>
              ))}
            </div>
          )}

          {/* Pair Rendering */}
          {quiz.type_name === "Pair" && payload.pairs && (
            <div>
              <strong>Matching Pairs:</strong>
              {payload.pairs.map(
                (pair: { left: string; right: string }, i: number) => (
                  <div key={i} style={{ margin: "4px 0" }}>
                    <code>{pair.left}</code> &harr; <code>{pair.right}</code>
                  </div>
                ),
              )}
            </div>
          )}

          {/* CP Rendering */}
          {quiz.type_name === "CP" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {payload.steps && payload.steps.length > 0 ? (
                payload.steps.map(
                  (
                    step: {
                      prompt: string;
                      template?: string;
                      expected?: string;
                    },
                    sIdx: number,
                  ) => (
                    <div
                      key={sIdx}
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        margin: "2px 0",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "700",
                          marginBottom: "4px",
                          color: "#1e293b",
                        }}
                      >
                        Step {sIdx + 1}
                      </div>
                      <div>
                        <strong>Instruction:</strong> {step.prompt}
                      </div>
                      {step.template && (
                        <div style={{ marginTop: "6px" }}>
                          <strong>Initial Code Template:</strong>
                          <pre
                            style={{
                              margin: "2px 0 0 0",
                              backgroundColor: "#f1f5f9",
                              padding: "6px",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                              overflowX: "auto",
                            }}
                          >
                            {step.template}
                          </pre>
                        </div>
                      )}
                      <div style={{ marginTop: "6px" }}>
                        <strong>Expected Output:</strong>
                        <pre
                          style={{
                            margin: "2px 0 0 0",
                            backgroundColor: "#e2f0d9",
                            padding: "6px",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            overflowX: "auto",
                          }}
                        >
                          {step.expected}
                        </pre>
                      </div>
                    </div>
                  ),
                )
              ) : (
                <div>
                  <div>
                    <strong>Template:</strong>
                    <pre
                      style={{
                        margin: "4px 0",
                        backgroundColor: "#eee",
                        padding: "6px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        overflowX: "auto",
                      }}
                    >
                      {payload.template}
                    </pre>
                  </div>
                  <div>
                    <strong>Expected Output:</strong>
                    <pre
                      style={{
                        margin: "4px 0",
                        backgroundColor: "#e2f0d9",
                        padding: "6px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        overflowX: "auto",
                      }}
                    >
                      {payload.expected}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
