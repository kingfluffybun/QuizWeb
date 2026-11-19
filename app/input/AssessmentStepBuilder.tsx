"use client";

import React, { useState } from "react";
import type { CPFileKey, CPStep } from "@/lib/cp-constants";
import StepCard from "./assessment/StepCard";
import AssessmentLivePreview from "./assessment/AssessmentLivePreview";
import { createProgressiveCPStep } from "./utils/assessmentExtractors";

export { createProgressiveCPStep as createDefaultCPStep, AssessmentLivePreview };

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
      return [
        ...prev,
        createProgressiveCPStep(prev.length + 1, lastStep?.expectedTemplate),
      ];
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
      const nextVal = el.value.slice(0, start) + "####" + el.value.slice(end);
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
              onChange={(event) => setAssessmentDescription(event.target.value)}
            />
          </div>
        </div>

        <div className="assessment-step-list">
          {cpSteps.map((step, index) => (
            <StepCard
              key={index}
              step={step}
              index={index}
              totalSteps={cpSteps.length}
              activeTab={getActiveTab(index)}
              onSelectTab={(tab) => setActiveTab(index, tab)}
              onUpdateStep={(updater) => handleUpdateStep(index, updater)}
              onRemoveStep={() => handleRemoveStep(index)}
              onCopyPreviousExpected={() => handleCopyPreviousExpected(index)}
              onInsertWildcard={(tab) => handleInsertWildcard(index, tab)}
            />
          ))}

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
