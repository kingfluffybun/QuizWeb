"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/app/components/icons/NavIcons";
import { useIsReducedMotion } from "@/lib/accessibility-store";
import { useQuizHintsPrefs } from "@/lib/quiz-hints-store";
import {
  buildBackdropCutoutPath,
  computeArrowPath,
  computePopoverLayout,
  computeSpotlightRect,
  type RectBox,
} from "@/lib/quiz-tutorial-geometry";
import {
  getQuizUiHint,
  type QuizHintMode,
  type QuizTutorialStep,
} from "@/lib/quiz-ui-hints";

interface QuizTutorialOverlayProps {
  isOpen: boolean;
  mode: QuizHintMode;
  onClose: () => void;
  onPrepareStep?: (step: QuizTutorialStep) => void;
  onKeepOpen?: () => void;
}

interface MeasurementState {
  stepId: string;
  viewportWidth: number;
  viewportHeight: number;
  spotlight: RectBox | null;
  cardHeight: number;
}

function findVisibleTarget(selectors: string[]): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}

export default function QuizTutorialOverlay({
  isOpen,
  mode,
  onClose,
  onPrepareStep,
  onKeepOpen,
}: QuizTutorialOverlayProps) {
  const config = getQuizUiHint(mode);
  const totalSteps = config.steps.length;

  const [stepState, setStepState] = useState<{
    forMode: QuizHintMode;
    index: number;
  }>({ forMode: mode, index: 0 });
  const [measurement, setMeasurement] = useState<MeasurementState | null>(null);

  const cardRef = useRef<HTMLElement | null>(null);
  const onPrepareStepRef = useRef(onPrepareStep);
  useEffect(() => {
    onPrepareStepRef.current = onPrepareStep;
  }, [onPrepareStep]);

  const { prefs, markTutorialSeen, setAutoShowTutorials } = useQuizHintsPrefs();
  const reducedMotion = useIsReducedMotion();

  const resolvedIndex =
    stepState.forMode === mode
      ? Math.min(Math.max(0, stepState.index), Math.max(0, totalSteps - 1))
      : 0;
  const activeStep = config.steps[resolvedIndex];

  const handleClose = useCallback(() => {
    markTutorialSeen(mode);
    setStepState({ forMode: mode, index: 0 });
    onClose();
  }, [markTutorialSeen, mode, onClose]);

  const goBack = useCallback(() => {
    setStepState({
      forMode: mode,
      index: Math.max(0, resolvedIndex - 1),
    });
  }, [mode, resolvedIndex]);

  const goNext = useCallback(() => {
    if (resolvedIndex >= totalSteps - 1) {
      handleClose();
      return;
    }
    setStepState({
      forMode: mode,
      index: resolvedIndex + 1,
    });
  }, [handleClose, mode, resolvedIndex, totalSteps]);

  useEffect(() => {
    if (!isOpen || !activeStep) return;

    let rafPrepare = 0;
    let rafMeasure = 0;
    let resizeObserver: ResizeObserver | null = null;
    let observedTarget: HTMLElement | null = null;
    let hasScrolledForStep = false;

    const measureNow = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targetEl = findVisibleTarget(activeStep.targetSelectors);

      if (!targetEl && activeStep.optionalIfMissing && resolvedIndex < totalSteps - 1) {
        setStepState({ forMode: mode, index: resolvedIndex + 1 });
        return;
      }

      if (targetEl && !hasScrolledForStep) {
        hasScrolledForStep = true;
        const raw = targetEl.getBoundingClientRect();
        const isFullyVisible =
          raw.top >= 16 &&
          raw.bottom <= vh - 16 &&
          raw.left >= 8 &&
          raw.right <= vw - 8;
        if (!isFullyVisible && typeof targetEl.scrollIntoView === "function") {
          targetEl.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      }

      if (targetEl !== observedTarget) {
        resizeObserver?.disconnect();
        observedTarget = targetEl;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            window.cancelAnimationFrame(rafMeasure);
            rafMeasure = window.requestAnimationFrame(measureNow);
          });
          if (targetEl) resizeObserver.observe(targetEl);
          if (cardRef.current) resizeObserver.observe(cardRef.current);
        }
      }

      const rawRect = targetEl?.getBoundingClientRect() ?? null;
      const spotlight =
        rawRect && rawRect.width > 0 && rawRect.height > 0
          ? computeSpotlightRect(
              {
                left: rawRect.left,
                top: rawRect.top,
                width: rawRect.width,
                height: rawRect.height,
              },
              vw,
              vh,
            )
          : null;

      const measuredCardHeight = cardRef.current?.offsetHeight ?? 320;

      setMeasurement({
        stepId: activeStep.id,
        viewportWidth: vw,
        viewportHeight: vh,
        spotlight,
        cardHeight: measuredCardHeight,
      });
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(rafMeasure);
      rafMeasure = window.requestAnimationFrame(measureNow);
    };

    rafPrepare = window.requestAnimationFrame(() => {
      onPrepareStepRef.current?.(activeStep);
      scheduleMeasure();
    });

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      window.cancelAnimationFrame(rafPrepare);
      window.cancelAnimationFrame(rafMeasure);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [isOpen, activeStep, mode, resolvedIndex, totalSteps, reducedMotion]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose, goNext, goBack]);

  if (!isOpen || !activeStep) return null;

  const vw = measurement?.viewportWidth ?? 1280;
  const vh = measurement?.viewportHeight ?? 720;
  const targetCardWidth = Math.min(390, Math.max(260, vw - 24));
  const cardHeight = measurement?.cardHeight ?? 300;
  const isCurrentStepMeasured = measurement?.stepId === activeStep.id;
  const spotlight = isCurrentStepMeasured ? measurement.spotlight : null;

  const popover = spotlight
    ? computePopoverLayout(
        spotlight,
        targetCardWidth,
        cardHeight,
        vw,
        vh,
        activeStep.preferredPlacement,
      )
    : {
        left: Math.max(12, Math.round((vw - targetCardWidth) / 2)),
        top: Math.max(16, Math.round((vh - cardHeight) / 2)),
        width: targetCardWidth,
        placement: activeStep.preferredPlacement ?? ("bottom" as const),
      };

  const arrow = spotlight
    ? computeArrowPath(
        {
          left: popover.left,
          top: popover.top,
          width: popover.width,
          height: cardHeight,
        },
        spotlight,
        popover.placement,
      )
    : null;

  const backdropPath = buildBackdropCutoutPath(vw, vh, spotlight);

  return (
    <div
      className="quiz-tutorial-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-tutorial-title"
    >
      <svg
        className="quiz-tutorial-backdrop-svg"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={backdropPath} fillRule="evenodd" />
      </svg>

      {spotlight && (
        <div
          className="quiz-tutorial-spotlight-ring"
          aria-hidden="true"
          style={{
            left: `${spotlight.left}px`,
            top: `${spotlight.top}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
          }}
        />
      )}

      {arrow && (
        <svg
          className="quiz-tutorial-arrow-svg"
          viewBox={`0 0 ${vw} ${vh}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="quiz-tutorial-arrowhead"
              viewBox="0 0 14 14"
              refX="10"
              refY="7"
              markerWidth="9"
              markerHeight="9"
              orient="auto"
            >
              <path
                d="M 1 2 L 12 7 L 1 12 L 3.8 7 Z"
                fill="#7d3fff"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
          <path className="quiz-tutorial-arrow-halo" d={arrow.path} />
          <path
            className="quiz-tutorial-arrow-path"
            d={arrow.path}
            markerEnd="url(#quiz-tutorial-arrowhead)"
          />
          <circle
            className="quiz-tutorial-arrow-origin"
            cx={arrow.start.x}
            cy={arrow.start.y}
            r="5"
          />
        </svg>
      )}

      <section
        ref={cardRef}
        className="quiz-tutorial-card"
        style={{
          left: `${popover.left}px`,
          top: `${popover.top}px`,
          width: `${popover.width}px`,
        }}
      >
        <header className="quiz-tutorial-card-header">
          <div className="quiz-tutorial-badges">
            <span className="quiz-tutorial-mode-badge">{config.badge}</span>
            <span className="quiz-tutorial-step-counter">
              Step {resolvedIndex + 1} of {totalSteps}
            </span>
            {activeStep.device && activeStep.device !== "all" && (
              <span
                className={`quiz-ui-hint-device-badge is-${activeStep.device}`}
              >
                {activeStep.device === "desktop" ? "Desktop" : "Mobile"}
              </span>
            )}
          </div>
          <button
            type="button"
            className="quiz-tutorial-close"
            aria-label="Close tutorial"
            onClick={handleClose}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <h2 id="quiz-tutorial-title" className="quiz-tutorial-title">
          {activeStep.title}
        </h2>
        <p className="quiz-tutorial-what">{activeStep.whatToDo}</p>

        <div className="quiz-tutorial-action-callout">
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
            aria-hidden="true"
            className="quiz-tutorial-action-icon"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          <span>{activeStep.actionLabel}</span>
        </div>

        {activeStep.shortcuts && activeStep.shortcuts.length > 0 && (
          <div className="quiz-tutorial-shortcuts">
            {activeStep.shortcuts.map((shortcut) => (
              <div
                key={shortcut.label}
                className="quiz-ui-hint-shortcut-item"
              >
                <span className="quiz-ui-hint-keys">
                  {shortcut.keys.map((keyText, idx) => (
                    <kbd key={`${shortcut.label}-${idx}`} className="quiz-ui-hint-kbd">
                      {keyText}
                    </kbd>
                  ))}
                </span>
                <span className="quiz-ui-hint-shortcut-text">
                  {shortcut.label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="quiz-tutorial-dots" role="tablist" aria-label="Tutorial steps">
          {config.steps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={idx === resolvedIndex}
              aria-label={`Go to step ${idx + 1}: ${step.title}`}
              className={`quiz-tutorial-dot${idx === resolvedIndex ? " is-active" : idx < resolvedIndex ? " is-done" : ""}`}
              onClick={() => setStepState({ forMode: mode, index: idx })}
            />
          ))}
        </div>

        <div className="quiz-tutorial-nav">
          <button
            type="button"
            className="quiz-tutorial-skip-btn"
            onClick={handleClose}
          >
            Skip
          </button>
          <div className="quiz-tutorial-nav-buttons">
            <button
              type="button"
              className="quiz-tutorial-back-btn"
              disabled={resolvedIndex === 0}
              onClick={goBack}
            >
              Back
            </button>
            <button
              type="button"
              className="quiz-tutorial-next-btn"
              onClick={goNext}
            >
              {resolvedIndex === totalSteps - 1 ? "Finish Tutorial" : "Next →"}
            </button>
          </div>
        </div>

        <footer className="quiz-tutorial-footer">
          <label className="quiz-ui-hint-toggle-label">
            <input
              type="checkbox"
              checked={prefs.autoShowTutorials}
              onChange={(event) => {
                if (!event.target.checked) onKeepOpen?.();
                setAutoShowTutorials(event.target.checked);
              }}
            />
            <span>Auto-start tutorial on new quiz types</span>
          </label>
        </footer>
      </section>
    </div>
  );
}
