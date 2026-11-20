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
  easeOutCubic,
  lerp,
  lerpRect,
  type RectBox,
} from "@/lib/quiz-tutorial-geometry";
import {
  getQuizUiHint,
  type QuizHintMode,
  type QuizTutorialStep,
  type TutorialPlacement,
} from "@/lib/quiz-ui-hints";

interface QuizTutorialOverlayProps {
  isOpen: boolean;
  mode: QuizHintMode;
  onClose: () => void;
  onPrepareStep?: (step: QuizTutorialStep) => void;
  onKeepOpen?: () => void;
}

interface TutorialVisualFrame {
  ready: boolean;
  viewportWidth: number;
  viewportHeight: number;
  spotlight: RectBox | null;
  cardLeft: number;
  cardTop: number;
  cardWidth: number;
  cardHeight: number;
  placement: TutorialPlacement;
}

const TRANSITION_DURATION_MS = 360;
const INITIAL_SETTLE_MAX_MS = 350;

const INITIAL_VISUAL_FRAME: TutorialVisualFrame = {
  ready: false,
  viewportWidth: 1280,
  viewportHeight: 720,
  spotlight: null,
  cardLeft: 445,
  cardTop: 210,
  cardWidth: 390,
  cardHeight: 300,
  placement: "bottom",
};

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

function findStepIndexSkippingMissing(
  steps: QuizTutorialStep[],
  startIndex: number,
  delta: 1 | -1,
): number {
  let idx = startIndex;
  while (idx >= 0 && idx < steps.length) {
    const candidate = steps[idx];
    if (
      candidate.optionalIfMissing &&
      !candidate.cpMobileTab &&
      !findVisibleTarget(candidate.targetSelectors)
    ) {
      idx += delta;
      continue;
    }
    return idx;
  }
  return delta > 0 ? steps.length : -1;
}

function hasRunningAncestorAnimation(el: HTMLElement | null): boolean {
  if (!el || typeof el.getAnimations !== "function") return false;
  let current: HTMLElement | null = el;
  while (current) {
    const animations = current.getAnimations();
    if (animations.some((anim) => anim.playState === "running")) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function measureTargetFrame(
  targetEl: HTMLElement | null,
  preferredPlacement: TutorialPlacement | undefined,
  cardHeight: number,
): TutorialVisualFrame {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetCardWidth = Math.min(390, Math.max(260, vw - 24));
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

  const popover = spotlight
    ? computePopoverLayout(
        spotlight,
        targetCardWidth,
        cardHeight,
        vw,
        vh,
        preferredPlacement,
      )
    : {
        left: Math.max(12, Math.round((vw - targetCardWidth) / 2)),
        top: Math.max(16, Math.round((vh - cardHeight) / 2)),
        width: targetCardWidth,
        placement: preferredPlacement ?? ("bottom" as const),
      };

  return {
    ready: true,
    viewportWidth: vw,
    viewportHeight: vh,
    spotlight,
    cardLeft: popover.left,
    cardTop: popover.top,
    cardWidth: popover.width,
    cardHeight,
    placement: popover.placement,
  };
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
  const [visual, setVisual] =
    useState<TutorialVisualFrame>(INITIAL_VISUAL_FRAME);

  const cardRef = useRef<HTMLElement | null>(null);
  const visualRef = useRef<TutorialVisualFrame>(INITIAL_VISUAL_FRAME);
  const lastAnimatedStepIdRef = useRef<string | null>(null);
  const targetFrameRef = useRef<TutorialVisualFrame>(INITIAL_VISUAL_FRAME);
  const isTweeningRef = useRef(false);
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
    const prevIndex = findStepIndexSkippingMissing(
      config.steps,
      resolvedIndex - 1,
      -1,
    );
    if (prevIndex < 0) return;
    setStepState({
      forMode: mode,
      index: prevIndex,
    });
  }, [config.steps, mode, resolvedIndex]);

  const goNext = useCallback(() => {
    const nextIndex = findStepIndexSkippingMissing(
      config.steps,
      resolvedIndex + 1,
      1,
    );
    if (nextIndex >= totalSteps) {
      handleClose();
      return;
    }
    setStepState({
      forMode: mode,
      index: nextIndex,
    });
  }, [config.steps, handleClose, mode, resolvedIndex, totalSteps]);

  useEffect(() => {
    let rafPrepare = 0;
    let rafMeasure = 0;
    let rafSettle = 0;
    let rafTween = 0;
    let resizeObserver: ResizeObserver | null = null;
    let observedTarget: HTMLElement | null = null;
    let observedCard: HTMLElement | null = null;
    let hasScrolledForStep = false;
    let missingTargetRetries = 0;

    const applyVisual = (next: TutorialVisualFrame) => {
      visualRef.current = next;
      setVisual(next);
    };

    if (!isOpen || !activeStep) {
      rafMeasure = window.requestAnimationFrame(() => {
        lastAnimatedStepIdRef.current = null;
        isTweeningRef.current = false;
        if (visualRef.current.ready) {
          applyVisual(INITIAL_VISUAL_FRAME);
        }
      });
      return () => {
        window.cancelAnimationFrame(rafMeasure);
      };
    }

    const startTweenFromCurrent = (toFrame: TutorialVisualFrame) => {
      window.cancelAnimationFrame(rafTween);
      const fromFrame = visualRef.current;
      targetFrameRef.current = toFrame;

      if (reducedMotion) {
        isTweeningRef.current = false;
        applyVisual(toFrame);
        return;
      }

      isTweeningRef.current = true;
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawProgress = Math.min(
          1,
          Math.max(0, elapsed / TRANSITION_DURATION_MS),
        );
        const eased = easeOutCubic(rawProgress);
        const target = targetFrameRef.current;

        const nextSpotlight =
          fromFrame.spotlight && target.spotlight
            ? lerpRect(fromFrame.spotlight, target.spotlight, eased)
            : target.spotlight;

        applyVisual({
          ready: true,
          viewportWidth: target.viewportWidth,
          viewportHeight: target.viewportHeight,
          spotlight: nextSpotlight,
          cardLeft: lerp(fromFrame.cardLeft, target.cardLeft, eased),
          cardTop: lerp(fromFrame.cardTop, target.cardTop, eased),
          cardWidth: lerp(fromFrame.cardWidth, target.cardWidth, eased),
          cardHeight: lerp(fromFrame.cardHeight, target.cardHeight, eased),
          placement: target.placement,
        });

        if (rawProgress < 1) {
          rafTween = window.requestAnimationFrame(tick);
        } else {
          rafTween = 0;
          isTweeningRef.current = false;
          applyVisual(target);
        }
      };

      rafTween = window.requestAnimationFrame(tick);
    };

    const ensureObservers = (targetEl: HTMLElement | null) => {
      if (targetEl === observedTarget && cardRef.current === observedCard) {
        return;
      }
      resizeObserver?.disconnect();
      observedTarget = targetEl;
      observedCard = cardRef.current;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          window.cancelAnimationFrame(rafMeasure);
          rafMeasure = window.requestAnimationFrame(measureNow);
        });
        if (targetEl) resizeObserver.observe(targetEl);
        if (cardRef.current) resizeObserver.observe(cardRef.current);
      }
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(rafMeasure);
      rafMeasure = window.requestAnimationFrame(measureNow);
    };

    const measureNow = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targetEl = findVisibleTarget(activeStep.targetSelectors);

      if (targetEl) {
        missingTargetRetries = 0;
      } else if (
        activeStep.optionalIfMissing &&
        resolvedIndex < totalSteps - 1
      ) {
        setStepState({ forMode: mode, index: resolvedIndex + 1 });
        return;
      } else if (!activeStep.optionalIfMissing && missingTargetRetries < 6) {
        missingTargetRetries += 1;
        scheduleMeasure();
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

      ensureObservers(targetEl);

      const measuredCardHeight = cardRef.current?.offsetHeight ?? 320;
      const nextFrame = measureTargetFrame(
        targetEl,
        activeStep.preferredPlacement,
        measuredCardHeight,
      );

      // Initial open: wait for quiz-container's quiz-elevate-in settle (~350ms max)
      // while overlay remains invisible (opacity: 0), then fade in once over Step 0.
      if (!visualRef.current.ready) {
        targetFrameRef.current = nextFrame;
        return;
      }

      const previousStepId = lastAnimatedStepIdRef.current;
      if (previousStepId !== null && previousStepId !== activeStep.id) {
        lastAnimatedStepIdRef.current = activeStep.id;
        startTweenFromCurrent(nextFrame);
        return;
      }

      lastAnimatedStepIdRef.current = activeStep.id;
      if (isTweeningRef.current) {
        targetFrameRef.current = nextFrame;
      } else {
        applyVisual(nextFrame);
      }
    };

    const settleAndRevealInitial = () => {
      const settleStart = performance.now();
      let prevRect: DOMRect | null = null;
      let stableFrames = 0;

      const waitFrame = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const targetCardWidth = Math.min(390, Math.max(260, vw - 24));
        if (Math.abs(visualRef.current.cardWidth - targetCardWidth) > 1) {
          applyVisual({
            ...visualRef.current,
            ready: false,
            viewportWidth: vw,
            viewportHeight: vh,
            cardWidth: targetCardWidth,
          });
          rafSettle = window.requestAnimationFrame(waitFrame);
          return;
        }

        const targetEl = findVisibleTarget(activeStep.targetSelectors);

        if (
          !targetEl &&
          activeStep.optionalIfMissing &&
          resolvedIndex < totalSteps - 1
        ) {
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

        const currentRect = targetEl?.getBoundingClientRect() ?? null;
        const rectStable =
          currentRect !== null &&
          prevRect !== null &&
          Math.abs(currentRect.left - prevRect.left) < 0.5 &&
          Math.abs(currentRect.top - prevRect.top) < 0.5 &&
          Math.abs(currentRect.width - prevRect.width) < 0.5 &&
          Math.abs(currentRect.height - prevRect.height) < 0.5;

        const ancestorsBusy =
          !reducedMotion && hasRunningAncestorAnimation(targetEl);

        if (!ancestorsBusy && (rectStable || !targetEl || reducedMotion)) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        prevRect = currentRect;

        const elapsed = performance.now() - settleStart;
        const readyToReveal =
          reducedMotion ||
          stableFrames >= 2 ||
          elapsed >= INITIAL_SETTLE_MAX_MS;

        if (!readyToReveal) {
          rafSettle = window.requestAnimationFrame(waitFrame);
          return;
        }

        ensureObservers(targetEl);
        const measuredCardHeight = cardRef.current?.offsetHeight ?? 320;
        const initialFrame = measureTargetFrame(
          targetEl,
          activeStep.preferredPlacement,
          measuredCardHeight,
        );
        lastAnimatedStepIdRef.current = activeStep.id;
        targetFrameRef.current = initialFrame;
        applyVisual(initialFrame);
      };

      rafSettle = window.requestAnimationFrame(waitFrame);
    };

    rafPrepare = window.requestAnimationFrame(() => {
      onPrepareStepRef.current?.(activeStep);
      if (!visualRef.current.ready) {
        settleAndRevealInitial();
      } else {
        scheduleMeasure();
      }
    });

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      window.cancelAnimationFrame(rafPrepare);
      window.cancelAnimationFrame(rafMeasure);
      window.cancelAnimationFrame(rafSettle);
      window.cancelAnimationFrame(rafTween);
      isTweeningRef.current = false;
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

  const arrow = visual.spotlight
    ? computeArrowPath(
        {
          left: visual.cardLeft,
          top: visual.cardTop,
          width: visual.cardWidth,
          height: visual.cardHeight,
        },
        visual.spotlight,
        visual.placement,
      )
    : null;

  const backdropPath = buildBackdropCutoutPath(
    visual.viewportWidth,
    visual.viewportHeight,
    visual.spotlight,
  );

  return (
    <div
      className={`quiz-tutorial-overlay${visual.ready ? " is-ready" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-tutorial-title"
    >
      <svg
        className="quiz-tutorial-backdrop-svg"
        viewBox={`0 0 ${visual.viewportWidth} ${visual.viewportHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={backdropPath} fillRule="evenodd" />
      </svg>

      {visual.spotlight && (
        <div
          className="quiz-tutorial-spotlight-ring"
          aria-hidden="true"
          style={{
            left: `${visual.spotlight.left}px`,
            top: `${visual.spotlight.top}px`,
            width: `${visual.spotlight.width}px`,
            height: `${visual.spotlight.height}px`,
          }}
        />
      )}

      {arrow && (
        <svg
          className="quiz-tutorial-arrow-svg"
          viewBox={`0 0 ${visual.viewportWidth} ${visual.viewportHeight}`}
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
          left: `${visual.cardLeft}px`,
          top: `${visual.cardTop}px`,
          width: `${visual.cardWidth}px`,
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
                    <kbd
                      key={`${shortcut.label}-${idx}`}
                      className="quiz-ui-hint-kbd"
                    >
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

        <div
          className="quiz-tutorial-dots"
          role="tablist"
          aria-label="Tutorial steps"
        >
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
