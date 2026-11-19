"use client";

import type { PublicCodeProblem } from "@/lib/cp-constants";
import type { SequentialSkipQueuePayload } from "@/app/actions/section-skip";
import type { StepFeedback } from "../types";

interface CpInstructionsPaneProps {
  problem: PublicCodeProblem | null;
  isLoading: boolean;
  loadError: string | null;
  currentStepIndex: number;
  revealedHints: Record<number, boolean>;
  onToggleHint: (stepIndex: number) => void;
  stepFeedback: StepFeedback | null;
  skipPayload: SequentialSkipQueuePayload | null;
  queueIndex: number;
  isSkipMode: boolean;
}

export default function CpInstructionsPane({
  problem,
  isLoading,
  loadError,
  currentStepIndex,
  revealedHints,
  onToggleHint,
  stepFeedback,
  skipPayload,
  queueIndex,
  isSkipMode,
}: CpInstructionsPaneProps) {
  return (
    <div id="instructions">
      <div className="header">
        <div>
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
            className="lucide lucide-list-ordered"
          >
            <path d="M11 5h10" />
            <path d="M11 12h10" />
            <path d="M11 19h10" />
            <path d="M4 4h1v5" />
            <path d="M4 9h2" />
            <path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />
          </svg>
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              flexDirection: "column",
            }}
          >
            {isSkipMode && skipPayload && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                  flexWrap: "wrap",
                }}
              >
                <span className="cp-skip-badge">
                  ⚡ Problem {queueIndex + 1} of {skipPayload.totalCodingProblems}
                </span>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  Target: Section {skipPayload.targetSectionNum} ({skipPayload.targetSectionTitle})
                </span>
              </div>
            )}
            <h2>{problem?.title ? problem.title : "Instructions"} </h2>
          </div>
        </div>
      </div>

      <div className="instruction-container col" style={{ gap: "12px" }}>
        {isLoading ? (
          <p>Loading instructions...</p>
        ) : loadError ? (
          <p>{loadError}</p>
        ) : (
          <>
            {problem?.description && (
              <div
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-main)",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {problem.description}
              </div>
            )}

            {problem?.steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isUpcoming = index > currentStepIndex;
              const stepStateClass = isCompleted
                ? " correct"
                : isUpcoming
                  ? " disabled"
                  : "";

              return (
                <div
                  className={`instruction${stepStateClass}`}
                  key={`${problem.unit_id}-step-${step.stepNumber}-${index}`}
                  style={{
                    flexDirection: "column",
                    alignItems: "stretch",
                    border: isCurrent
                      ? "2px solid var(--selected-color, #7c3aed)"
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-center",
                      gap: "12px",
                      width: "100%",
                    }}
                  >
                    <div
                      className="check-circle row"
                      style={{
                        background: isCurrent
                          ? "var(--selected-color, #7c3aed)"
                          : undefined,
                        borderColor: isCurrent
                          ? "var(--selected-color, #7c3aed)"
                          : undefined,
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                      }}
                    >
                      {isCompleted ? (
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
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "4px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "0.78rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: isCurrent
                              ? "var(--selected-color, #7c3aed)"
                              : isCompleted
                                ? "#16a34a"
                                : "var(--text-muted)",
                          }}
                        >
                          Step {index + 1}{" "}
                          {isCompleted
                            ? "• Completed"
                            : isCurrent
                              ? "• Current"
                              : "• Locked"}
                        </strong>
                        {isCurrent && step.hint && (
                          <button
                            type="button"
                            onClick={() => onToggleHint(index)}
                            style={{
                              padding: "2px 8px",
                              fontSize: "0.74rem",
                              fontWeight: 600,
                              borderRadius: "6px",
                              border: "1px solid var(--border-main)",
                              background: "var(--bg-card)",
                              color: "var(--text-main)",
                              cursor: "pointer",
                            }}
                          >
                            {revealedHints[index] ? "Hide Hint" : "Hint"}
                          </button>
                        )}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {step.instruction}
                      </p>
                    </div>
                  </div>

                  {isCurrent && step.hint && revealedHints[index] && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: "rgba(124, 58, 237, 0.08)",
                        border: "1px solid rgba(124, 58, 237, 0.25)",
                        fontSize: "0.82rem",
                        color: "var(--text-main)",
                      }}
                    >
                      <strong>Hint:</strong> {step.hint}
                    </div>
                  )}

                  {isCurrent && stepFeedback && !stepFeedback.passed && (
                    <div
                      role="alert"
                      style={{
                        marginTop: "10px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        background: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid #ef4444",
                        color: "#b91c1c",
                        fontSize: "0.82rem",
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: "2px" }}>
                        Step {index + 1} Check Failed (-1 Heart)
                        {stepFeedback.lineNumber
                          ? ` • Near Line ${stepFeedback.lineNumber}`
                          : ""}
                      </div>
                      <div>{stepFeedback.message}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
