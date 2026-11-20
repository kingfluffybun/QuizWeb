"use client";

import { useCallback, useEffect, useState } from "react";
import { CloseIcon } from "@/app/components/icons/NavIcons";
import { useQuizHintsPrefs } from "@/lib/quiz-hints-store";
import {
  getQuizUiHint,
  QUIZ_UI_HINT_ORDER,
  type QuizHintMode,
} from "@/lib/quiz-ui-hints";

interface QuizUiHintModalProps {
  isOpen: boolean;
  activeMode: QuizHintMode;
  onClose: () => void;
}

export default function QuizUiHintModal({
  isOpen,
  activeMode,
  onClose,
}: QuizUiHintModalProps) {
  const [manualTab, setManualTab] = useState<{
    forMode: QuizHintMode;
    tab: QuizHintMode;
  } | null>(null);
  const { prefs, setShowInlineHints, resetDismissedHints } =
    useQuizHintsPrefs();

  const displayMode =
    manualTab?.forMode === activeMode ? manualTab.tab : activeMode;

  const handleClose = useCallback(() => {
    setManualTab(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const activeConfig = getQuizUiHint(displayMode);

  return (
    <div
      className="quiz-ui-hint-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-ui-hint-modal-title"
    >
      <button
        className="quiz-ui-hint-backdrop"
        type="button"
        aria-label="Close UI guide"
        onClick={handleClose}
      />
      <section className="quiz-ui-hint-card">
        <header className="quiz-ui-hint-card-header">
          <div className="quiz-ui-hint-heading">
            <h2 id="quiz-ui-hint-modal-title">How to Interact</h2>
            <p>Quick UI guide for each quiz type</p>
          </div>
          <button
            type="button"
            className="quiz-ui-hint-close"
            aria-label="Close UI guide"
            onClick={handleClose}
          >
            <CloseIcon size={20} />
          </button>
        </header>

        <div
          className="quiz-ui-hint-tabs"
          role="tablist"
          aria-label="Quiz interaction types"
        >
          {QUIZ_UI_HINT_ORDER.map((mode) => {
            const config = getQuizUiHint(mode);
            const isSelected = displayMode === mode;
            const isCurrent = activeMode === mode;
            return (
              <button
                key={mode}
                id={`quiz-hint-tab-${mode}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`quiz-hint-panel-${mode}`}
                className={`quiz-ui-hint-tab${isSelected ? " is-active" : ""}`}
                onClick={() => setManualTab({ forMode: activeMode, tab: mode })}
              >
                <span>{config.badge}</span>
                {isCurrent && (
                  <span
                    className="quiz-ui-hint-current-dot"
                    title="Current activity"
                    aria-label="(current)"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div
          className="quiz-ui-hint-body"
          role="tabpanel"
          id={`quiz-hint-panel-${displayMode}`}
          aria-labelledby={`quiz-hint-tab-${displayMode}`}
        >
          <div className="quiz-ui-hint-mode-intro">
            <h3>{activeConfig.title}</h3>
            <p>{activeConfig.summary}</p>
          </div>

          <ol className="quiz-ui-hint-steps">
            {activeConfig.steps.map((step, index) => (
              <li key={step.title} className="quiz-ui-hint-step">
                <span className="quiz-ui-hint-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="quiz-ui-hint-step-copy">
                  <div className="quiz-ui-hint-step-title-row">
                    <strong>{step.title}</strong>
                    {step.device && step.device !== "all" && (
                      <span
                        className={`quiz-ui-hint-device-badge is-${step.device}`}
                      >
                        {step.device === "desktop" ? "Desktop" : "Mobile"}
                      </span>
                    )}
                  </div>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {activeConfig.shortcuts.length > 0 && (
            <div className="quiz-ui-hint-shortcuts">
              <span className="quiz-ui-hint-shortcuts-label">Shortcuts:</span>
              <div className="quiz-ui-hint-shortcuts-list">
                {activeConfig.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="quiz-ui-hint-shortcut-item"
                  >
                    <span className="quiz-ui-hint-keys">
                      {shortcut.keys.map((keyLabel, idx) => (
                        <kbd key={`${shortcut.label}-${idx}`} className="quiz-ui-hint-kbd">
                          {keyLabel}
                        </kbd>
                      ))}
                    </span>
                    <span className="quiz-ui-hint-shortcut-text">
                      {shortcut.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="quiz-ui-hint-footer">
          <div className="quiz-ui-hint-footer-prefs">
            <label className="quiz-ui-hint-toggle-label">
              <input
                type="checkbox"
                checked={prefs.showInlineHints}
                onChange={(event) => setShowInlineHints(event.target.checked)}
              />
              <span>Show quick tips above questions</span>
            </label>
            {prefs.dismissedModes.length > 0 && (
              <button
                type="button"
                className="quiz-ui-hint-reset-btn"
                onClick={resetDismissedHints}
              >
                Reset hidden tips
              </button>
            )}
          </div>
          <button
            type="button"
            className="quiz-ui-hint-confirm-btn"
            onClick={handleClose}
          >
            Got it
          </button>
        </footer>
      </section>
    </div>
  );
}
