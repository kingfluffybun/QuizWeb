"use client";

import {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  type CPFileKey,
  type CPStep,
} from "@/lib/cp-constants";

interface StepCardProps {
  step: CPStep;
  index: number;
  totalSteps: number;
  activeTab: CPFileKey;
  onSelectTab: (tab: CPFileKey) => void;
  onUpdateStep: (updater: (step: CPStep) => CPStep) => void;
  onRemoveStep: () => void;
  onCopyPreviousExpected: () => void;
  onInsertWildcard: (tab: CPFileKey) => void;
}

export default function StepCard({
  step,
  index,
  totalSteps,
  activeTab,
  onSelectTab,
  onUpdateStep,
  onRemoveStep,
  onCopyPreviousExpected,
  onInsertWildcard,
}: StepCardProps) {
  const activeExpected = step.expectedTemplate[activeTab] ?? "";
  const activeStarter = step.starterCode[activeTab] ?? "";
  const wildcardCount = (activeExpected.match(/####/g) ?? []).length;

  return (
    <div
      className="assessment-step assessment-step-card"
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
                  onUpdateStep((s) => ({
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
              onClick={onCopyPreviousExpected}
              title={`Copy Step ${index} expected templates into Step ${index + 1}`}
              style={{ fontSize: "0.78rem", padding: "4px 10px" }}
            >
              Copy Step {index} Expected
            </button>
          )}
          {totalSteps > 1 && (
            <button
              type="button"
              className="assessment-remove"
              onClick={onRemoveStep}
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
            onUpdateStep((s) => ({
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
                (step.expectedTemplate[fileKey] ?? "").trim().length > 0;
              return (
                <button
                  key={fileKey}
                  type="button"
                  role="tab"
                  className="assessment-step-file-tab"
                  aria-selected={isSelected}
                  onClick={() => onSelectTab(fileKey)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: isSelected
                      ? "1px solid #7c3aed"
                      : "1px solid #cbd5e1",
                    background: isSelected ? "#f5f3ff" : "#f8fafc",
                    color: isSelected ? "#6d28d9" : "#475569",
                    fontWeight: isSelected ? 700 : 600,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {CP_FILE_LABELS[fileKey]} {hasExpected ? "●" : "(blank)"}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="assessment-step-wildcard"
            onClick={() => onInsertWildcard(activeTab)}
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
              Starter Code ({CP_FILE_LABELS[activeTab]}) — optional initial code shown to student
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
                onUpdateStep((s) => ({
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
              onUpdateStep((s) => ({
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
}
