"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  createEmptyFileBuffers,
  type CPFileBuffers,
  type CPFileKey,
  type PublicCodeProblem,
} from "@/lib/cp-constants";
import type { DailyGoalData } from "@/lib/daily-goal";
import { getClientLocalDate } from "@/lib/timezone";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import {
  getNextCurriculumUnit,
  recordCodeProblemCompletionProgress,
} from "@/app/actions/progress";
import { getPublicCodeProblem, verifyCodeProblemStep } from "@/app/actions/cp-engine";
import {
  completeSequentialSkip,
  getSequentialSkipQueue,
  type SequentialSkipQueuePayload,
} from "@/app/actions/section-skip";
import { recordUserActivity } from "@/app/actions/streak";
import type { QuizSound } from "@/app/quiz/useQuizSounds";
import type { CpStatus, NextUnitInfo, PersistedCPSession, StepFeedback } from "../types";

const COMPLETION_MESSAGES = {
  perfect: [
    "Perfect score! You completed every single step correctly, so keep that momentum going.",
    "Flawless run! You didn’t miss a single step, and that’s exactly how mastery is built.",
  ],
  good: [
    "Nice work! You’re getting the hang of this, and a little more practice will get you to a perfect score.",
    "Almost there! You got most of the steps right, so review the ones you missed and try for 100%.",
  ],
  low: [
    "Keep practicing! Every mistake is a chance to learn, so review your code and give it another try.",
    "Don’t give up! You’re still building your skills, and each attempt gets you closer to mastering this lesson.",
  ],
};

function getSessionStorageKey(unitId: number): string {
  return `quizweb:cp-session:v2:${unitId}`;
}

function readSavedSession(
  unitId: number,
  stepCount: number,
): PersistedCPSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionStorageKey(unitId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCPSession;
    if (
      typeof parsed.currentStepIndex === "number" &&
      parsed.currentStepIndex >= 0 &&
      parsed.currentStepIndex < stepCount &&
      parsed.code &&
      typeof parsed.lives === "number" &&
      parsed.lives > 0
    ) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

interface UseCpSessionOptions {
  requestedUnitId?: number;
  requestedSkipTargetSecId?: number;
  initialProblem?: PublicCodeProblem | null;
  initialDailyGoal?: DailyGoalData | null;
  initialNextUnit?: NextUnitInfo | null;
  playQuizSound: (sound: QuizSound) => void;
  isMobileViewport: boolean;
  onFocusCodeTabOnError: () => void;
  onClearConsole: () => void;
}

export function useCpSession({
  requestedUnitId,
  requestedSkipTargetSecId,
  initialProblem,
  initialDailyGoal,
  initialNextUnit,
  playQuizSound,
  isMobileViewport,
  onFocusCodeTabOnError,
  onClearConsole,
}: UseCpSessionOptions) {
  const hasSsrProblem =
    !requestedSkipTargetSecId &&
    initialProblem !== undefined &&
    (requestedUnitId === undefined || initialProblem?.unit_id === requestedUnitId);

  const [skipPayload, setSkipPayload] =
    useState<SequentialSkipQueuePayload | null>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);

  const [problem, setProblem] = useState<PublicCodeProblem | null>(
    hasSsrProblem ? (initialProblem ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(!hasSsrProblem);
  const [loadError, setLoadError] = useState<string | null>(
    hasSsrProblem && (!initialProblem || initialProblem.steps.length === 0)
      ? "No coding problem is available for this unit yet."
      : null,
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeFile, setActiveFile] = useState<CPFileKey>("html");
  const [code, setCode] = useState<CPFileBuffers>(() =>
    hasSsrProblem && initialProblem?.steps[0]?.starterCode
      ? { ...initialProblem.steps[0].starterCode }
      : createEmptyFileBuffers(),
  );
  const [stepSnapshots, setStepSnapshots] = useState<Record<number, CPFileBuffers>>({});
  const [lives, setLives] = useState(5);
  const [status, setStatus] = useState<CpStatus>("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepFeedback, setStepFeedback] = useState<StepFeedback | null>(null);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [nextUnit, setNextUnit] = useState<NextUnitInfo | null>(
    initialNextUnit ?? null,
  );
  const [missedStepIndexes, setMissedStepIndexes] = useState<Set<number>>(
    () => new Set(),
  );
  const [dailyGoalStats, setDailyGoalStats] = useState<DailyGoalData | null>(
    initialDailyGoal ?? null,
  );

  // Elapsed tracking via timestamp ref avoids 1Hz parent re-renders
  const startedAtRef = useRef<number>(0);
  const [finalElapsedSeconds, setFinalElapsedSeconds] = useState(0);
  const warningTimerRef = useRef<number | null>(null);
  const milestoneTimerRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
    return () => {
      if (warningTimerRef.current !== null) window.clearTimeout(warningTimerRef.current);
      if (milestoneTimerRef.current !== null) window.clearTimeout(milestoneTimerRef.current);
    };
  }, []);

  const finalizeElapsedSeconds = useCallback(() => {
    const baseTime = startedAtRef.current || Date.now();
    const elapsed = Math.max(0, Math.round((Date.now() - baseTime) / 1000));
    setFinalElapsedSeconds(elapsed);
  }, []);

  const refreshDailyGoalStats = useCallback(async () => {
    try {
      const data = await getDailyGoalData(getClientLocalDate());
      setDailyGoalStats(data);
    } catch (error) {
      console.error("Failed to refresh daily XP progress after coding assessment:", error);
    }
  }, []);

  useEffect(() => {
    if (initialDailyGoal !== undefined) return;
    let isActive = true;
    getDailyGoalData(getClientLocalDate())
      .then((data) => {
        if (isActive) setDailyGoalStats(data);
      })
      .catch((error) => {
        console.error("Failed to load daily XP progress for coding assessment:", error);
      });
    return () => {
      isActive = false;
    };
  }, [initialDailyGoal]);

  // Restore saved sessionStorage when hydrated from SSR initialProblem
  useEffect(() => {
    if (!hasSsrProblem || !initialProblem || initialProblem.steps.length === 0) {
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const saved = readSavedSession(
        initialProblem.unit_id,
        initialProblem.steps.length,
      );
      if (saved) {
        setCurrentStepIndex(saved.currentStepIndex);
        setCode(saved.code);
        setStepSnapshots(saved.stepSnapshots ?? {});
        setLives(saved.lives);
      }
    });
    return () => {
      active = false;
    };
  }, [hasSsrProblem, initialProblem]);

  const [prevUnitId, setPrevUnitId] = useState(requestedUnitId);
  const [prevSkipSecId, setPrevSkipSecId] = useState(requestedSkipTargetSecId);
  if (
    requestedUnitId !== prevUnitId ||
    requestedSkipTargetSecId !== prevSkipSecId
  ) {
    setPrevUnitId(requestedUnitId);
    setPrevSkipSecId(requestedSkipTargetSecId);
    setIsLoading(true);
    setLoadError(null);
  }

  // Fetch problem or sequential skip queue when not hydrated from SSR
  useEffect(() => {
    if (hasSsrProblem && requestedUnitId === prevUnitId && !requestedSkipTargetSecId) {
      return;
    }

    let isActive = true;

    if (requestedSkipTargetSecId) {
      getSequentialSkipQueue(requestedSkipTargetSecId)
        .then((payload) => {
          if (!isActive) return;
          if (!payload) {
            setSkipPayload(null);
            setProblem(null);
            setLoadError("Unable to load the sequential skip challenge for this section.");
            return;
          }

          if (payload.unitsQueue.length === 0) {
            setSkipPayload(payload);
            finalizeElapsedSeconds();
            setStatus("completed");
            completeSequentialSkip({
              targetSectionId: requestedSkipTargetSecId,
            })
              .then(async (response) => {
                if (response.success) await refreshDailyGoalStats();
              })
              .catch((err) => {
                console.error("Failed to complete sequential skip:", err);
              });
            return;
          }

          setSkipPayload(payload);
          setQueueIndex(0);
          const firstItem = payload.unitsQueue[0];
          setProblem(firstItem.problem);
          setCurrentStepIndex(0);
          setCode({
            ...(firstItem.problem.steps[0]?.starterCode ?? createEmptyFileBuffers()),
          });
          setStepSnapshots({});
          setLives(5);
          setTimerSeconds(300);
          setIsTimerActive(true);
          startedAtRef.current = Date.now();
          setStatus("active");
          setStepFeedback(null);
        })
        .catch(() => {
          if (isActive) {
            setLoadError("Unable to load the sequential skip challenge.");
          }
        })
        .finally(() => {
          if (isActive) setIsLoading(false);
        });

      return () => {
        isActive = false;
      };
    }

    getPublicCodeProblem(requestedUnitId)
      .then((loadedProblem) => {
        if (!isActive) return;
        if (!loadedProblem || loadedProblem.steps.length === 0) {
          setProblem(null);
          setLoadError("No coding problem is available for this unit yet.");
          return;
        }

        setProblem(loadedProblem);
        if (initialNextUnit === undefined) {
          getNextCurriculumUnit(loadedProblem.unit_id)
            .then((next) => {
              if (isActive) setNextUnit(next);
            })
            .catch((err) => {
              console.error("Failed to load next unit:", err);
            });
        }

        const saved = readSavedSession(
          loadedProblem.unit_id,
          loadedProblem.steps.length,
        );
        if (saved) {
          setCurrentStepIndex(saved.currentStepIndex);
          setCode(saved.code);
          setStepSnapshots(saved.stepSnapshots ?? {});
          setLives(saved.lives);
          return;
        }

        setCurrentStepIndex(0);
        setCode({
          ...(loadedProblem.steps[0]?.starterCode ?? createEmptyFileBuffers()),
        });
        setStepSnapshots({});
        setLives(5);
        startedAtRef.current = Date.now();
        setStatus("active");
        setStepFeedback(null);
      })
      .catch(() => {
        if (isActive) setLoadError("Unable to load the coding assessment.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    hasSsrProblem,
    requestedUnitId,
    requestedSkipTargetSecId,
    prevUnitId,
    initialNextUnit,
    finalizeElapsedSeconds,
    refreshDailyGoalStats,
  ]);

  const handleTimerExpired = useEffectEvent(() => {
    playQuizSound("wrong-answer");
    const nextLives = Math.max(0, lives - 1);
    setLives(nextLives);
    if (nextLives <= 0) {
      setIsTimerActive(false);
      finalizeElapsedSeconds();
      setStatus("gameover");
      return;
    }
    setTimerSeconds(300);
    setTimeWarning("Time's up for this problem! -1 Heart. Timer reset.");
    if (warningTimerRef.current !== null) window.clearTimeout(warningTimerRef.current);
    warningTimerRef.current = window.setTimeout(() => setTimeWarning(null), 4000);
  });

  const tickCountdown = useEffectEvent(() => {
    if (timerSeconds <= 1) {
      handleTimerExpired();
    } else {
      setTimerSeconds(timerSeconds - 1);
    }
  });

  // Countdown tick for sequential skip mode (interval callback keeps state updates pure)
  useEffect(() => {
    if (!requestedSkipTargetSecId || !isTimerActive || status !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      tickCountdown();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [requestedSkipTargetSecId, isTimerActive, status]);

  // Persist active progress in sessionStorage
  useEffect(() => {
    if (!problem || status !== "active" || typeof window === "undefined") {
      return;
    }
    try {
      const payload: PersistedCPSession = {
        currentStepIndex,
        code,
        stepSnapshots,
        lives,
      };
      window.sessionStorage.setItem(
        getSessionStorageKey(problem.unit_id),
        JSON.stringify(payload),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [problem, status, currentStepIndex, code, stepSnapshots, lives]);

  const handleResetStep = useCallback(() => {
    if (!problem) return;
    const currentStep = problem.steps[currentStepIndex];
    if (!currentStep) return;

    const previousSnapshot = stepSnapshots[currentStepIndex - 1];
    const baseline: CPFileBuffers =
      currentStep.inheritPreviousCode &&
      currentStepIndex > 0 &&
      previousSnapshot
        ? { ...previousSnapshot }
        : { ...currentStep.starterCode };

    onClearConsole();
    setCode(baseline);
    setStepFeedback(null);
  }, [problem, currentStepIndex, stepSnapshots, onClearConsole]);

  const handleRestartAssessment = useCallback(() => {
    if (requestedSkipTargetSecId && skipPayload && skipPayload.unitsQueue.length > 0) {
      setQueueIndex(0);
      const firstItem = skipPayload.unitsQueue[0];
      setProblem(firstItem.problem);
      setCurrentStepIndex(0);
      setCode({
        ...(firstItem.problem.steps[0]?.starterCode ?? createEmptyFileBuffers()),
      });
      setStepSnapshots({});
      setLives(5);
      setTimerSeconds(300);
      setIsTimerActive(true);
      startedAtRef.current = Date.now();
      setFinalElapsedSeconds(0);
      setStatus("active");
      setStepFeedback(null);
      onClearConsole();
      setMissedStepIndexes(new Set());
      return;
    }

    if (!problem) return;
    const firstStepStarter =
      problem.steps[0]?.starterCode ?? createEmptyFileBuffers();
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(getSessionStorageKey(problem.unit_id));
    }
    setCurrentStepIndex(0);
    setCode({ ...firstStepStarter });
    setStepSnapshots({});
    setLives(5);
    startedAtRef.current = Date.now();
    setFinalElapsedSeconds(0);
    setStatus("active");
    setStepFeedback(null);
    onClearConsole();
    setMissedStepIndexes(new Set());
  }, [requestedSkipTargetSecId, skipPayload, problem, onClearConsole]);

  const handleSubmitStep = useCallback(async () => {
    if (!problem || isSubmitting || status !== "active") return;

    setIsSubmitting(true);
    setStepFeedback(null);
    onClearConsole();

    try {
      const result = await verifyCodeProblemStep({
        unitId: problem.unit_id,
        stepIndex: currentStepIndex,
        studentCode: code,
      });

      if (result.passed) {
        const updatedSnapshots = {
          ...stepSnapshots,
          [currentStepIndex]: { ...code },
        };
        setStepSnapshots(updatedSnapshots);

        if (result.isFinalStep) {
          if (requestedSkipTargetSecId && skipPayload) {
            if (queueIndex < skipPayload.unitsQueue.length - 1) {
              playQuizSound("lesson-complete");
              const nextQueueIndex = queueIndex + 1;
              const nextItem = skipPayload.unitsQueue[nextQueueIndex];

              setMilestoneMessage(
                `Problem ${queueIndex + 1} of ${skipPayload.totalCodingProblems} completed! Starting ${nextItem.unitTitle}...`,
              );
              if (milestoneTimerRef.current !== null) {
                window.clearTimeout(milestoneTimerRef.current);
              }
              milestoneTimerRef.current = window.setTimeout(
                () => setMilestoneMessage(null),
                3500,
              );

              setQueueIndex(nextQueueIndex);
              setProblem(nextItem.problem);
              setCurrentStepIndex(0);
              setCode({
                ...(nextItem.problem.steps[0]?.starterCode ??
                  createEmptyFileBuffers()),
              });
              setStepSnapshots({});
              setStepFeedback(null);
              setTimerSeconds(300);
              return;
            }

            playQuizSound("lesson-complete");
            setIsTimerActive(false);
            finalizeElapsedSeconds();
            setStatus("completed");

            completeSequentialSkip({
              targetSectionId: requestedSkipTargetSecId,
            })
              .then(async (response) => {
                if (response.success) await refreshDailyGoalStats();
              })
              .catch((err) => {
                console.error("Failed to complete sequential skip:", err);
              });
            return;
          }

          playQuizSound("lesson-complete");
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(getSessionStorageKey(problem.unit_id));
          }
          finalizeElapsedSeconds();
          setStatus("completed");

          recordCodeProblemCompletionProgress(problem.unit_id)
            .then((cpRes) => {
              if (cpRes.success && cpRes.nextUnit) {
                setNextUnit(cpRes.nextUnit);
              }
            })
            .catch((err) => {
              console.error("Failed to record CP completion progress:", err);
            });

          recordUserActivity({
            type: "quiz",
            xp: 50,
            date: getClientLocalDate(),
          })
            .then(async (response) => {
              if (response.success) await refreshDailyGoalStats();
            })
            .catch((err) => {
              console.error("Failed to record CP assessment XP:", err);
            });
        } else {
          playQuizSound("correct-answer1");
          const nextIdx = result.nextStepIndex ?? currentStepIndex + 1;
          const nextStep = problem.steps[nextIdx];
          setCurrentStepIndex(nextIdx);
          setStepFeedback({
            passed: true,
            message: `Step ${currentStepIndex + 1} passed! Now complete Step ${nextIdx + 1}.`,
          });

          if (nextStep && !nextStep.inheritPreviousCode) {
            setCode({ ...nextStep.starterCode });
          }
        }
      } else {
        playQuizSound("wrong-answer");
        setMissedStepIndexes((prev) => new Set(prev).add(currentStepIndex));
        const nextLives = Math.max(0, lives - 1);
        setLives(nextLives);
        setStepFeedback({
          passed: false,
          message: result.message,
          failedTab: result.failedTab,
          lineNumber: result.failedLine,
        });
        if (result.failedTab) {
          setActiveFile(result.failedTab);
        }
        if (isMobileViewport) onFocusCodeTabOnError();
        if (nextLives <= 0) {
          if (typeof window !== "undefined" && !requestedSkipTargetSecId) {
            window.sessionStorage.removeItem(getSessionStorageKey(problem.unit_id));
          }
          setIsTimerActive(false);
          finalizeElapsedSeconds();
          setStatus("gameover");
        }
      }
    } catch {
      setStepFeedback({
        passed: false,
        message: "Unable to verify your code right now. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    problem,
    isSubmitting,
    status,
    onClearConsole,
    currentStepIndex,
    code,
    stepSnapshots,
    requestedSkipTargetSecId,
    skipPayload,
    queueIndex,
    finalizeElapsedSeconds,
    refreshDailyGoalStats,
    playQuizSound,
    lives,
    isMobileViewport,
    onFocusCodeTabOnError,
  ]);

  const isSkipMode = Boolean(requestedSkipTargetSecId && skipPayload);
  const totalSteps = problem?.steps.length ?? 0;
  const firstTryPassedSteps =
    status === "completed"
      ? Math.max(0, totalSteps - missedStepIndexes.size)
      : Array.from({ length: currentStepIndex }).filter(
          (_, idx) => !missedStepIndexes.has(idx),
        ).length;
  const accuracy =
    totalSteps > 0 ? Math.round((firstTryPassedSteps / totalSteps) * 100) : 0;
  const totalCpXp =
    status === "completed"
      ? isSkipMode
        ? (skipPayload?.totalCodingProblems ?? 0) * 50 + 50
        : 50
      : 0;

  const completionSubmessage = useMemo(() => {
    if (status !== "completed" && status !== "gameover") return "";
    if (isSkipMode) {
      if (status === "gameover") {
        return "You ran out of hearts during the skip challenge. Don't worry, your existing roadmap progress is completely preserved!";
      }
      return (skipPayload?.totalCodingProblems ?? 0) > 0
        ? `Outstanding achievement! You mastered all ${skipPayload?.totalCodingProblems} coding challenges within the time limit. Section ${skipPayload?.targetSectionNum} is now unlocked on your roadmap!`
        : `All preceding units are completed! Section ${skipPayload?.targetSectionNum} is unlocked on your roadmap!`;
    }
    if (status === "gameover") {
      return (
        stepFeedback?.message ||
        "You ran out of hearts. Review the step instructions and try again!"
      );
    }
    const options =
      accuracy === 100
        ? COMPLETION_MESSAGES.perfect
        : accuracy >= 70
          ? COMPLETION_MESSAGES.good
          : COMPLETION_MESSAGES.low;
    const messageIndex = (accuracy + finalElapsedSeconds) % options.length;
    return options[messageIndex];
  }, [
    status,
    isSkipMode,
    skipPayload,
    accuracy,
    finalElapsedSeconds,
    stepFeedback?.message,
  ]);

  return {
    skipPayload,
    queueIndex,
    timerSeconds,
    timeWarning,
    milestoneMessage,
    problem,
    isLoading,
    loadError,
    currentStepIndex,
    activeFile,
    setActiveFile,
    code,
    setCode,
    lives,
    status,
    isSubmitting,
    stepFeedback,
    revealedHints,
    setRevealedHints,
    nextUnit,
    dailyGoalStats,
    isSkipMode,
    totalSteps,
    accuracy,
    totalCpXp,
    finalElapsedSeconds,
    completionSubmessage,
    handleResetStep,
    handleRestartAssessment,
    handleSubmitStep,
  };
}
