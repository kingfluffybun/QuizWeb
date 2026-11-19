"use client";

import { useState } from "react";
import {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  createEmptyFileBuffers,
  type CPFileBuffers,
  type CPFileKey,
  type CPStep,
} from "@/lib/cp-constants";
import {
  validateCodeProblemStep,
  type StepValidationResult,
} from "@/lib/cp-validator";

export interface AssessmentLivePreviewProps {
  assessmentTitle: string;
  assessmentDescription: string;
  cpSteps: CPStep[];
  expectedOutcome: string;
}

/**
 * Interactive Live Step Tester displayed inside the right-hand Preview Card
 * when `previewTab === "assessment"`.
 */
export default function AssessmentLivePreview({
  assessmentTitle,
  assessmentDescription,
  cpSteps,
  expectedOutcome,
}: AssessmentLivePreviewProps) {
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
          className="assessment-preview-sandbox"
          style={{
            marginTop: "18px",
            paddingTop: "14px",
            borderTop: "1px solid var(--border-main, #e2e8f0)",
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
              {cpSteps.map((_, idx) => (
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
                  className={`assessment-preview-file-tab${activeTab === key ? " active" : ""}`}
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    border:
                      activeTab === key
                        ? "1px solid var(--primary-color)"
                        : "1px solid #cbd5e1",
                    background:
                      activeTab === key
                        ? "var(--selected-background-color)"
                        : "#f8fafc",
                    color:
                      activeTab === key
                        ? "var(--selected-color)"
                        : "#64748b",
                    cursor: "pointer",
                  }}
                >
                  {CP_FILE_LABELS[key]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="assessment-preview-fill-sample"
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
