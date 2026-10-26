"use client";

import React, { useState } from "react";
import {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  createEmptyFileBuffers,
  type CPFileBuffers,
  type CPFileKey,
  type CPStep,
} from "@/lib/cp-schema";
import {
  validateCodeProblemStep,
  type StepValidationResult,
} from "@/lib/cp-validator";

export function createDefaultCPStep(
  stepNumber: number,
  previousExpected?: CPFileBuffers,
): CPStep {
  return {
    stepNumber,
    instruction: "",
    starterCode: createEmptyFileBuffers(),
    expectedTemplate: previousExpected
      ? {
          html: previousExpected.html,
          css: previousExpected.css,
          js: previousExpected.js,
        }
      : createEmptyFileBuffers(),
    inheritPreviousCode: stepNumber > 1,
  };
}

interface AssessmentStepBuilderProps {
  assessmentTitle: string;
  setAssessmentTitle: (val: string) => void;
  assessmentDescription: string;
  setAssessmentDescription: (val: string) => void;
  cpSteps: CPStep[];
  setCpSteps: React.Dispatch<React.SetStateAction<CPStep[]>>;
  expectedOutcome: string;
  setExpectedOutcome: (val: string) => void;
}

export default function AssessmentStepBuilder({
  assessmentTitle,
  setAssessmentTitle,
  assessmentDescription,
  setAssessmentDescription,
  cpSteps,
  setCpSteps,
  expectedOutcome,
  setExpectedOutcome,
}: AssessmentStepBuilderProps) {
  const [activeFileTabByStep, setActiveFileTabByStep] = useState<
    Record<number, CPFileKey>
  >({});

  const plainSteps = cpSteps.map((s) => s.instruction);
  const joinedAssessment = plainSteps
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n");

  const getActiveTab = (stepIndex: number): CPFileKey =>
    activeFileTabByStep[stepIndex] ?? "html";

  const setActiveTab = (stepIndex: number, tab: CPFileKey) => {
    setActiveFileTabByStep((prev) => ({ ...prev, [stepIndex]: tab }));
  };

  const handleUpdateStep = (
    stepIndex: number,
    updater: (step: CPStep) => CPStep,
  ) => {
    setCpSteps((prev) =>
      prev.map((step, idx) => (idx === stepIndex ? updater(step) : step)),
    );
  };

  const handleAddProgressiveStep = () => {
    setCpSteps((prev) => {
      const lastStep = prev[prev.length - 1];
      const nextStep = createDefaultCPStep(
        prev.length + 1,
        lastStep?.expectedTemplate,
      );
      return [...prev, nextStep];
    });
  };

  const handleRemoveStep = (stepIndex: number) => {
    setCpSteps((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((_, idx) => idx !== stepIndex)
        .map((step, idx) => ({
          ...step,
          stepNumber: idx + 1,
          inheritPreviousCode: idx === 0 ? false : step.inheritPreviousCode,
        }));
    });
  };

  const handleInsertWildcard = (stepIndex: number, tab: CPFileKey) => {
    const textareaId = `cp-expected-${stepIndex}-${tab}`;
    const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const currentVal = el.value;
      const nextVal =
        currentVal.slice(0, start) + "####" + currentVal.slice(end);
      handleUpdateStep(stepIndex, (step) => ({
        ...step,
        expectedTemplate: {
          ...step.expectedTemplate,
          [tab]: nextVal,
        },
      }));
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + 4, start + 4);
      });
    } else {
      handleUpdateStep(stepIndex, (step) => ({
        ...step,
        expectedTemplate: {
          ...step.expectedTemplate,
          [tab]: (step.expectedTemplate[tab] ?? "") + "####",
        },
      }));
    }
  };

  const handleCopyPreviousExpected = (stepIndex: number) => {
    if (stepIndex <= 0) return;
    setCpSteps((prev) => {
      const prevExpected = prev[stepIndex - 1]?.expectedTemplate;
      if (!prevExpected) return prev;
      return prev.map((step, idx) =>
        idx === stepIndex
          ? {
              ...step,
              expectedTemplate: {
                html: prevExpected.html,
                css: prevExpected.css,
                js: prevExpected.js,
              },
            }
          : step,
      );
    });
  };

  return (
    <>
      <section
        className="form-group assessment-editor"
        aria-labelledby="assessment-heading"
      >
        <div
          className="assessment-heading"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <h3 id="assessment-heading" style={{ margin: 0 }}>
            Multi-Step Code Problem Assessment
          </h3>
        </div>

        <div className="assessment-details">
              <div className="form-group">
                <label htmlFor="assessment-title">Assessment Title</label>
                <input
                  id="assessment-title"
                  name="assessment_title"
                  className="form-input"
                  placeholder="e.g. Check the Website Skeleton"
                  value={assessmentTitle}
                  onChange={(event) => setAssessmentTitle(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="assessment-description">
                  Assessment Description
                </label>
                <textarea
                  id="assessment-description"
                  name="assessment_description"
                  className="assessment-step-input"
                  rows={2}
                  placeholder="Describe what learners will build across these steps."
                  value={assessmentDescription}
                  onChange={(event) =>
                    setAssessmentDescription(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="assessment-step-list">
              {cpSteps.map((step, index) => {
                const activeTab = getActiveTab(index);
                const activeExpected = step.expectedTemplate[activeTab] ?? "";
                const activeStarter = step.starterCode[activeTab] ?? "";
                const wildcardCount = (activeExpected.match(/####/g) ?? [])
                  .length;

                return (
                  <div
                    className="assessment-step assessment-step-card"
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      padding: "16px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "12px",
                      marginBottom: "14px",
                      background: "rgba(248, 250, 252, 0.7)",
                    }}
                  >
                    <div
                      className="assessment-step-heading"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <label
                          htmlFor={`assessment-step-${index}`}
                          style={{ fontWeight: 700, fontSize: "1rem" }}
                        >
                          Step {index + 1}
                        </label>
                        {index > 0 && (
                          <label
                            className="assessment-step-carryover-label"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "0.82rem",
                              fontWeight: 500,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={step.inheritPreviousCode}
                              onChange={(e) =>
                                handleUpdateStep(index, (s) => ({
                                  ...s,
                                  inheritPreviousCode: e.target.checked,
                                }))
                              }
                            />
                            Carry over student&apos;s code from Step {index}
                          </label>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {index > 0 && (
                          <button
                            type="button"
                            className="btn-metrics-action"
                            onClick={() => handleCopyPreviousExpected(index)}
                            title={`Copy Step ${index} expected templates into Step ${index + 1}`}
                            style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                          >
                            Copy Step {index} Expected
                          </button>
                        )}
                        {cpSteps.length > 1 && (
                          <button
                            type="button"
                            className="assessment-remove"
                            onClick={() => handleRemoveStep(index)}
                            title={`Remove step ${index + 1}`}
                            aria-label={`Remove assessment step ${index + 1}`}
                          >
                            -
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Instruction */}
                    <div>
                      <label
                        htmlFor={`assessment-step-${index}`}
                        className="assessment-step-instruction-label"
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#334155",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Step {index + 1} Instruction
                      </label>
                      <textarea
                        id={`assessment-step-${index}`}
                        aria-label={`Assessment step ${index + 1}`}
                        className="assessment-step-input"
                        rows={2}
                        placeholder={`e.g. Add the opening and closing <HTML> tags below <!DOCTYPE HTML>.`}
                        value={step.instruction}
                        onChange={(event) => {
                          const text = event.target.value;
                          handleUpdateStep(index, (s) => ({
                            ...s,
                            instruction: text,
                          }));
                        }}
                      />
                    </div>

                    {/* File Sub-Tabs: index.html | style.css | script.js */}
                    <div
                      className="assessment-step-file-editor"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "12px",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        className="assessment-step-file-header"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px",
                          borderBottom: "1px solid #e2e8f0",
                          paddingBottom: "8px",
                        }}
                      >
                        <div
                          className="assessment-step-file-tabs"
                          style={{ display: "flex", gap: "6px" }}
                          role="tablist"
                        >
                          {CP_FILE_KEYS.map((fileKey) => {
                            const isSelected = activeTab === fileKey;
                            const hasExpected =
                              (step.expectedTemplate[fileKey] ?? "").trim()
                                .length > 0;
                            return (
                              <button
                                key={fileKey}
                                type="button"
                                role="tab"
                                className="assessment-step-file-tab"
                                aria-selected={isSelected}
                                onClick={() => setActiveTab(index, fileKey)}
                                style={{
                                  padding: "5px 12px",
                                  borderRadius: "6px",
                                  border: isSelected
                                    ? "1px solid #7c3aed"
                                    : "1px solid #cbd5e1",
                                  background: isSelected
                                    ? "#f5f3ff"
                                    : "#f8fafc",
                                  color: isSelected ? "#6d28d9" : "#475569",
                                  fontWeight: isSelected ? 700 : 600,
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                }}
                              >
                                {CP_FILE_LABELS[fileKey]}{" "}
                                {hasExpected ? "●" : "(blank)"}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          className="assessment-step-wildcard"
                          onClick={() => handleInsertWildcard(index, activeTab)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid #059669",
                            background: "#ecfdf5",
                            color: "#047857",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            cursor: "pointer",
                          }}
                          title="Insert #### loose wildcard placeholder at cursor"
                        >
                          + Insert #### Wildcard
                        </button>
                      </div>

                      {/* Starter Code for Active Tab */}
                      {(!step.inheritPreviousCode || index === 0) && (
                        <div>
                          <label
                            htmlFor={`cp-starter-${index}-${activeTab}`}
                            className="assessment-step-starter-label"
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "#64748b",
                              display: "block",
                              marginBottom: "4px",
                            }}
                          >
                            Starter Code ({CP_FILE_LABELS[activeTab]}) — optional
                            initial code shown to student
                          </label>
                          <textarea
                            id={`cp-starter-${index}-${activeTab}`}
                            className="form-textarea"
                            rows={3}
                            style={{
                              fontFamily: "JetBrains Mono, monospace",
                              fontSize: "0.84rem",
                            }}
                            placeholder={`Optional starter ${CP_FILE_LABELS[activeTab]} for Step ${index + 1}...`}
                            value={activeStarter}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateStep(index, (s) => ({
                                ...s,
                                starterCode: {
                                  ...s.starterCode,
                                  [activeTab]: val,
                                },
                              }));
                            }}
                          />
                        </div>
                      )}

                      {/* Expected Template for Active Tab */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "4px",
                          }}
                        >
                          <label
                            htmlFor={`cp-expected-${index}-${activeTab}`}
                            className="assessment-step-expected-label"
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 700,
                              color: "#1e293b",
                            }}
                          >
                            Expected Template ({CP_FILE_LABELS[activeTab]})
                          </label>
                          <span
                            className="assessment-step-expected-hint"
                            style={{ fontSize: "0.75rem", color: "#64748b" }}
                          >
                            {activeExpected.trim().length === 0
                              ? "Blank = Student's tab must remain empty"
                              : wildcardCount > 0
                                ? `${wildcardCount} wildcard (####) slot(s) active`
                                : "Strict structure match (whitespace/indent flexible)"}
                          </span>
                        </div>
                        <textarea
                          id={`cp-expected-${index}-${activeTab}`}
                          className="form-textarea"
                          rows={6}
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "0.85rem",
                          }}
                          placeholder={
                            activeTab === "html"
                              ? "<!DOCTYPE HTML>\n<HTML>\n    <HEAD>\n        <TITLE>####</TITLE>\n    </HEAD>\n    <BODY>\n    </BODY>\n</HTML>"
                              : `Leave blank if ${CP_FILE_LABELS[activeTab]} should remain empty on Step ${index + 1}...`
                          }
                          value={activeExpected}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleUpdateStep(index, (s) => ({
                              ...s,
                              expectedTemplate: {
                                ...s.expectedTemplate,
                                [activeTab]: val,
                              },
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                className="assessment-add"
                onClick={handleAddProgressiveStep}
                title="Add progressive assessment step (carries forward current step's expected template)"
                aria-label="Add assessment step"
                style={{ width: "auto", padding: "8px 16px", fontSize: "0.88rem" }}
              >
                + Add Step {cpSteps.length + 1} (Carry Forward Template)
              </button>
            </div>

        {/* Hidden inputs for form submission compatibility */}
        <input type="hidden" name="assessment" value={joinedAssessment} />
        <input
          type="hidden"
          name="assessment_steps"
          value={JSON.stringify(plainSteps)}
        />
        <input
          type="hidden"
          name="assessment_cp_steps"
          value={JSON.stringify(cpSteps)}
        />
      </section>

      <div className="form-group assessment-outcome">
        <label htmlFor="expected-outcome">
          Expected Outcome Summary (Optional)
        </label>
        <textarea
          id="expected-outcome"
          name="expected_outcome"
          className="assessment-step-input"
          rows={2}
          placeholder="Optional summary or final outcome note."
          value={expectedOutcome}
          onChange={(event) => setExpectedOutcome(event.target.value)}
        />
      </div>
    </>
  );
}

/**
 * Interactive Live Step Tester displayed inside the right-hand Preview Card
 * when `previewTab === "assessment"`.
 */
export function AssessmentLivePreview({
  assessmentTitle,
  assessmentDescription,
  cpSteps,
  expectedOutcome,
}: {
  assessmentTitle: string;
  assessmentDescription: string;
  cpSteps: CPStep[];
  expectedOutcome: string;
}) {
  const [selectedStepIdx, setSelectedStepIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<CPFileKey>("html");
  const [testBuffers, setTestBuffers] = useState<CPFileBuffers>(
    createEmptyFileBuffers(),
  );
  const [testResult, setTestResult] = useState<StepValidationResult | null>(
    null,
  );

  const safeStepIdx = Math.min(selectedStepIdx, Math.max(0, cpSteps.length - 1));
  const activeStep = cpSteps[safeStepIdx];

  const handleFillPassingSample = () => {
    if (!activeStep) return;
    setTestBuffers({
      html: activeStep.expectedTemplate.html.replace(/####/g, "SampleValue"),
      css: activeStep.expectedTemplate.css.replace(/####/g, "red"),
      js: activeStep.expectedTemplate.js.replace(/####/g, "sampleVar"),
    });
    setTestResult(null);
  };

  const handleRunCheck = () => {
    if (!activeStep) return;
    const res = validateCodeProblemStep(
      testBuffers,
      activeStep.expectedTemplate,
    );
    setTestResult(res);
  };

  return (
    <div className="assessment-preview lesson-preview-surface">
      {assessmentTitle.trim() ? (
        <h2>{assessmentTitle}</h2>
      ) : (
        <p className="assessment-preview-placeholder">Assessment title</p>
      )}
      {assessmentDescription.trim() && (
        <p className="assessment-preview-description">
          {assessmentDescription}
        </p>
      )}
      {cpSteps.some((s) => s.instruction.trim()) ? (
        <ol className="assessment-preview-steps">
          {cpSteps
            .filter((s) => s.instruction.trim())
            .map((step, index) => (
              <li key={index}>{step.instruction}</li>
            ))}
        </ol>
      ) : (
        <p className="assessment-preview-placeholder">
          Assessment instructions will appear here.
        </p>
      )}

      {expectedOutcome.trim() && (
        <div className="assessment-preview-outcome">
          <strong>Expected outcome</strong>
          <p>{expectedOutcome}</p>
        </div>
      )}

      {/* Interactive Maintainer Step Verification Sandbox */}
      {activeStep && (
        <div
          style={{
            marginTop: "18px",
            paddingTop: "14px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <strong style={{ fontSize: "0.88rem", color: "#1e293b" }}>
              Live Step Checker Sandbox
            </strong>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {cpSteps.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedStepIdx(idx);
                    setTestResult(null);
                  }}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    border:
                      idx === safeStepIdx
                        ? "1px solid #7c3aed"
                        : "1px solid #cbd5e1",
                    background: idx === safeStepIdx ? "#7c3aed" : "#ffffff",
                    color: idx === safeStepIdx ? "#ffffff" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  Step {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "4px" }}>
              {CP_FILE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    border:
                      activeTab === key
                        ? "1px solid #3b82f6"
                        : "1px solid #cbd5e1",
                    background: activeTab === key ? "#eff6ff" : "#f8fafc",
                    color: activeTab === key ? "#1d4ed8" : "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {CP_FILE_LABELS[key]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleFillPassingSample}
              style={{
                fontSize: "0.75rem",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              Fill Sample Answer
            </button>
          </div>

          <textarea
            aria-label={`Test student ${CP_FILE_LABELS[activeTab]} for Step ${safeStepIdx + 1}`}
            className="form-textarea"
            rows={4}
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.82rem",
            }}
            placeholder={`Type sample student ${CP_FILE_LABELS[activeTab]} to test Step ${safeStepIdx + 1}...`}
            value={testBuffers[activeTab]}
            onChange={(e) => {
              const val = e.target.value;
              setTestBuffers((prev) => ({ ...prev, [activeTab]: val }));
              setTestResult(null);
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRunCheck}
            >
              Test Step {safeStepIdx + 1} Validation
            </button>

            {testResult && (
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: testResult.passed ? "#15803d" : "#b91c1c",
                }}
              >
                {testResult.passed ? "✓ PASS: " : "✗ FAIL: "}
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
