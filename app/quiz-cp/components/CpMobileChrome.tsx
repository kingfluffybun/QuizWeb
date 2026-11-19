"use client";

import type { CPFileKey, PublicCodeProblem } from "@/lib/cp-constants";
import type { MobileTab, StepFeedback } from "../types";

interface CpMobileChromeProps {
  problem: PublicCodeProblem | null;
  currentStepIndex: number;
  totalSteps: number;
  stepFeedback: StepFeedback | null;
  isTyping: boolean;
  revealedHints: Record<number, boolean>;
  onToggleHint: (stepIndex: number) => void;
  mobileTab: MobileTab;
  onSelectMobileTab: (tab: MobileTab) => void;
  timeWarning: string | null;
  milestoneMessage: string | null;
}

export function CpMobileTopChrome({
  problem,
  currentStepIndex,
  totalSteps,
  stepFeedback,
  isTyping,
  revealedHints,
  onToggleHint,
  mobileTab,
  onSelectMobileTab,
  timeWarning,
  milestoneMessage,
}: CpMobileChromeProps) {
  return (
    <>
      {timeWarning && (
        <div className="cp-timeout-banner" role="alert">
          {timeWarning}
        </div>
      )}
      {milestoneMessage && (
        <div className="cp-milestone-banner" role="status">
          {milestoneMessage}
        </div>
      )}
      {problem && problem.steps[currentStepIndex] && (
        <div
          className={`cp-mobile-banner${
            stepFeedback && !stepFeedback.passed ? " is-error" : ""
          }${isTyping ? " is-typing" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="cp-mobile-banner-step">
            Step {currentStepIndex + 1}/{totalSteps}
          </span>
          <div className="cp-mobile-banner-body">
            <div className="cp-mobile-banner-text">
              {problem.steps[currentStepIndex].instruction}
            </div>
            {revealedHints[currentStepIndex] &&
              problem.steps[currentStepIndex].hint && (
                <div className="cp-mobile-banner-note">
                  <strong>Hint:</strong> {problem.steps[currentStepIndex].hint}
                </div>
              )}
            {stepFeedback && (
              <div
                className={`cp-mobile-banner-note ${
                  stepFeedback.passed ? "is-success" : "is-fail"
                }`}
              >
                {stepFeedback.passed
                  ? ""
                  : `Check failed (-1 heart)${
                      stepFeedback.lineNumber
                        ? ` • near line ${stepFeedback.lineNumber}`
                        : ""
                    }: `}
                {stepFeedback.message}
              </div>
            )}
          </div>
          {problem.steps[currentStepIndex].hint && (
            <button
              type="button"
              className="cp-mobile-banner-hint"
              aria-label={
                revealedHints[currentStepIndex] ? "Hide hint" : "Show hint"
              }
              onClick={() => onToggleHint(currentStepIndex)}
            >
              💡
            </button>
          )}
        </div>
      )}

      <div className="cp-mobile-tabs" role="tablist" aria-label="Workspace view">
        {(
          [
            ["task", "Task"],
            ["code", "Code"],
            ["preview", "Preview"],
          ] as const
        ).map(([tabKey, tabLabel]) => (
          <button
            key={tabKey}
            type="button"
            role="tab"
            aria-selected={mobileTab === tabKey}
            className={`cp-mobile-tab${mobileTab === tabKey ? " active" : ""}`}
            onClick={() => onSelectMobileTab(tabKey)}
          >
            {tabLabel}
          </button>
        ))}
      </div>
    </>
  );
}

interface CpMobileActionBarProps {
  activeFile: CPFileKey;
  problem: PublicCodeProblem | null;
  isLoading: boolean;
  isSubmitting: boolean;
  currentStepIndex: number;
  onResetStep: () => void;
  onRunCode: () => void;
  onSubmitStep: () => void;
}

export function CpMobileActionBar({
  activeFile,
  problem,
  isLoading,
  isSubmitting,
  currentStepIndex,
  onResetStep,
  onRunCode,
  onSubmitStep,
}: CpMobileActionBarProps) {
  return (
    <div className={`cp-mobile-actionbar${activeFile === "js" ? "" : " no-run"}`}>
      <button
        type="button"
        className="cp-mobile-action-btn"
        onClick={onResetStep}
        disabled={!problem || isLoading || isSubmitting}
      >
        Reset
      </button>
      {activeFile === "js" && (
        <button
          type="button"
          className="cp-mobile-action-btn"
          onClick={onRunCode}
          disabled={!problem || isLoading}
        >
          ▶ Run
        </button>
      )}
      <button
        type="button"
        className="cp-mobile-action-btn primary"
        onClick={onSubmitStep}
        disabled={!problem || isLoading || isSubmitting}
      >
        {isSubmitting ? "Checking..." : `Check Step ${currentStepIndex + 1}`}
      </button>
    </div>
  );
}
