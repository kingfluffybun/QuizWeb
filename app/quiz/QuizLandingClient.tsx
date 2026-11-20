"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import "#css/quiz.css";
import "#css/sidebar.css";
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue, QuizData } from "@/app/quiz/types";
import LessonCard from "@/app/components/LessonCard";
import Sidebar from "@/app/components/Sidebar";
import CompletionScreen from "@/app/components/quiz/CompletionScreen";
import QuizUiHintBar from "@/app/components/quiz/QuizUiHintBar";
import QuizTutorialOverlay from "@/app/components/quiz/QuizTutorialOverlay";
import { useAnimatedStats } from "@/app/components/quiz/useAnimatedStats";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";
import { useIsHydrated, useQuizHintsPrefs } from "@/lib/quiz-hints-store";
import { resolveQuizHintMode } from "@/lib/quiz-ui-hints";
import { useQuizSounds } from "@/app/quiz/useQuizSounds";
import { recordQuizCompletion } from "@/app/actions/streak";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import {
  recordLessonSlideProgress,
  recordQuizCompletionProgress,
} from "@/app/actions/progress";
import { hasCodingAssessmentPayload } from "@/lib/cp-constants";
import { calculateEarnedXp, calculateQuizXp } from "@/lib/xp-calculation";
import { getClientLocalDate } from "@/lib/timezone";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
import {
  getCachedUnit,
  markUnitCompletedLocally,
  preloadLearnSections,
  toQuizLandingQuizzes,
  updateUnitSlideProgressLocally,
} from "@/lib/learn-cache";
import type { DailyGoalData } from "@/lib/daily-goal";
import LessonSlideTransition from "./components/LessonSlideTransition";
import QuizHeader from "./components/QuizHeader";
import QuizQuestionView from "./components/QuizQuestionView";
import QuizFooter from "./components/QuizFooter";
import {
  QUIZ_ACCURACY_MESSAGES,
  evaluateQuizAnswer,
  getAnswer,
  getCorrectValue,
  isQuizAnswerIncomplete,
  type AnswerResult,
  type SavedQuestionProgress,
  type UnitQuizData,
} from "./evaluate";

export default function QuizLandingClient({
  initialQuizzes,
  completionDestination = "input",
  unitId,
  initialSlideOrder,
  startAtQuiz = false,
  nextUnit,
  dailyGoalData,
}: {
  initialQuizzes?: QuizData[];
  completionDestination?: "home" | "input";
  unitId?: number;
  initialSlideOrder?: number;
  startAtQuiz?: boolean;
  dailyGoalData?: DailyGoalData | null;
  nextUnit?: {
    unit_id: number;
    unit_title: string;
    sec_id?: number;
    sec_num?: number;
    cat_name?: string;
  } | null;
}) {
  const router = useRouter();
  const playQuizSound = useQuizSounds();
  const { quizzes: allQuizzes } = useQuizData(!initialQuizzes?.length);
  const cachedUnit = unitId != null ? getCachedUnit(unitId) : null;
  const cachedQuizzes = useMemo(
    () =>
      initialQuizzes?.length || !cachedUnit
        ? undefined
        : toQuizLandingQuizzes(cachedUnit).map((quiz, index) =>
            shuffleQuizOptions(quiz, index !== 0),
          ),
    [initialQuizzes, cachedUnit],
  );
  const quizzes =
    initialQuizzes && initialQuizzes.length > 0
      ? initialQuizzes
      : cachedQuizzes ?? allQuizzes;
  const resolvedNextUnit =
    nextUnit !== undefined ? nextUnit : cachedUnit?.nextUnit ?? null;
  const selectedQuizzes = quizzes as UnitQuizData[];

  const [questionOrder, setQuestionOrder] = useState<number[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [value, setValue] = useState<AnswerValue>(undefined);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [baseXp, setBaseXp] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [dailyGoalStats, setDailyGoalStats] = useState(dailyGoalData);
  const [isFinished, setIsFinished] = useState(false);
  const [hasStartedQuiz, setHasStartedQuiz] = useState(
    initialQuizzes === undefined || startAtQuiz,
  );
  const [prevInitialSlideOrder, setPrevInitialSlideOrder] =
    useState(initialSlideOrder);
  const [lessonSlideIndex, setLessonSlideIndex] = useState(() =>
    typeof initialSlideOrder === "number" && initialSlideOrder > 0
      ? initialSlideOrder - 1
      : 0,
  );
  const [questionProgress, setQuestionProgress] = useState<
    Record<number, SavedQuestionProgress>
  >({});
  const [missedQuestionIndexes, setMissedQuestionIndexes] = useState<
    Set<number>
  >(() => new Set());
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const isHydrated = useIsHydrated();
  const {
    prefs: hintPrefs,
    hasSeenTutorial,
    markTutorialSeen,
  } = useQuizHintsPrefs();
  const startedAtRef = useRef<number>(0);
  const [finalElapsedSeconds, setFinalElapsedSeconds] = useState(0);
  const [lessonProgressState, setLessonProgressState] = useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [lessonProgressError, setLessonProgressError] = useState<string | null>(
    null,
  );
  const [completionRetryCount, setCompletionRetryCount] = useState(0);
  const completionRecorded = useRef(false);
  const quizXpRecorded = useRef(false);

  const firstTryCorrectCount = quizzes.filter(
    (_, index) =>
      !missedQuestionIndexes.has(index) &&
      questionProgress[index]?.result?.correct,
  ).length;
  const allQuestionsCorrect =
    quizzes.length > 0 && firstTryCorrectCount === quizzes.length;
  const totalQuizXp = calculateQuizXp(
    baseXp,
    allQuestionsCorrect,
    currentStreak,
  );
  const accuracy =
    quizzes.length > 0
      ? Math.round((firstTryCorrectCount / quizzes.length) * 100)
      : 0;
  const completionSubmessage = useMemo(() => {
    if (!isFinished) return "";
    const options =
      accuracy === 100
        ? QUIZ_ACCURACY_MESSAGES.perfect
        : accuracy >= 70
          ? QUIZ_ACCURACY_MESSAGES.good
          : QUIZ_ACCURACY_MESSAGES.low;
    const messageIndex = (accuracy + finalElapsedSeconds) % options.length;
    return options[messageIndex];
  }, [isFinished, accuracy, finalElapsedSeconds]);

  const animatedStats = useAnimatedStats(
    isFinished,
    totalQuizXp,
    accuracy,
    finalElapsedSeconds,
  );

  const orderedQuestionIndexes =
    questionOrder ?? Array.from({ length: quizzes.length }, (_, index) => index);
  const activeQuizIndex = orderedQuestionIndexes[currentIndex] ?? currentIndex;
  const quiz = quizzes[activeQuizIndex];
  const selectedQuiz = selectedQuizzes[activeQuizIndex];
  const isLessonOnlyUnit = Boolean(
    initialQuizzes &&
      initialQuizzes.length === 1 &&
      selectedQuiz?.type_name === "Unit",
  );
  const unitLessonCard = selectedQuiz?.unit_lesson_card ?? {};
  const lessonSlides = Array.isArray(unitLessonCard.lesson_slide)
    ? unitLessonCard.lesson_slide
    : Array.isArray(unitLessonCard.lesson_slides)
      ? unitLessonCard.lesson_slides
      : [
          {
            lesson_text:
              unitLessonCard.lesson_card?.lesson_text ??
              unitLessonCard.lesson_text ??
              "",
          },
        ];

  if (initialSlideOrder !== prevInitialSlideOrder) {
    setPrevInitialSlideOrder(initialSlideOrder);
    if (
      typeof initialSlideOrder === "number" &&
      initialSlideOrder > 0 &&
      lessonSlides.length > 0
    ) {
      setLessonSlideIndex(
        Math.min(lessonSlides.length - 1, Math.max(0, initialSlideOrder - 1)),
      );
    }
  } else if (lessonSlides.length > 0 && lessonSlideIndex >= lessonSlides.length) {
    setLessonSlideIndex(lessonSlides.length - 1);
  } else if (lessonSlideIndex < 0) {
    setLessonSlideIndex(0);
  }

  const hasLesson = lessonSlides.some(
    (slide) => slide.lesson_title || slide.lesson_text || slide.lesson_code,
  );
  const isShowingLesson = hasLesson && !hasStartedQuiz;
  const totalProgressItems =
    (hasLesson ? lessonSlides.length : 0) +
    (isLessonOnlyUnit ? 0 : quizzes.length);
  const correctQuestionCount = Object.values(questionProgress).filter(
    (entry) => entry?.result?.correct,
  ).length;
  const activeProgressIndex = isShowingLesson
    ? lessonSlideIndex
    : (hasLesson ? lessonSlides.length : 0) + correctQuestionCount;
  const progressValue = isShowingLesson
    ? Math.min(activeProgressIndex + 1, totalProgressItems)
    : Math.min(activeProgressIndex, totalProgressItems);

  const resolvedUnitId =
    unitId ?? selectedQuiz?.unit_id ?? (quizzes[0] as UnitQuizData)?.unit_id;

  const finishQuizSession = () => {
    const startMs = startedAtRef.current || Date.now();
    setFinalElapsedSeconds(
      Math.max(0, Math.round((Date.now() - startMs) / 1000)),
    );
    setIsFinished(true);
  };

  useEffect(() => {
    if (!hasStartedQuiz || isFinished) return;
    if (startedAtRef.current === 0) {
      startedAtRef.current = Date.now();
    }
  }, [hasStartedQuiz, isFinished]);

  useEffect(() => {
    if (!isFinished) return;

    if (quizXpRecorded.current) return;
    quizXpRecorded.current = true;
    const previousDailyGoalStats = dailyGoalStats;
    const clientToday = getClientLocalDate();
    setDailyGoalStats((current) => {
      if (!current) return current;

      const todayIndex = current.weekDates.indexOf(clientToday);
      return {
        ...current,
        todayXp: current.todayXp + totalQuizXp,
        weekXp: current.weekXp.map((xp, index) =>
          index === todayIndex ? xp + totalQuizXp : xp,
        ),
      };
    });

    recordQuizCompletion({
      xpEarned: totalQuizXp,
      currentStreak,
      bestStreak,
      date: clientToday,
    })
      .then((response) => {
        if (!response.success) {
          setDailyGoalStats(previousDailyGoalStats);
          console.error("Failed to record quiz completion:", response.error);
          return;
        }
        void getDailyGoalData()
          .then(setDailyGoalStats)
          .catch((error) => {
            console.error(
              "Failed to refresh daily XP progress after quiz completion:",
              error,
            );
          });
      })
      .catch((error) => {
        setDailyGoalStats(previousDailyGoalStats);
        console.error("Failed to record quiz completion:", error);
      });
  }, [isFinished, totalQuizXp, currentStreak, bestStreak, dailyGoalStats]);

  useEffect(() => {
    if (!isFinished) return;

    const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);
    if (!isPassed) return;

    if (completionRecorded.current) return;
    if (!resolvedUnitId) return;
    completionRecorded.current = true;

    recordQuizCompletionProgress(resolvedUnitId)
      .then((response) => {
        if (response.success && response.isQuizCompleted) {
          if (response.isUnitCompleted) {
            markUnitCompletedLocally(resolvedUnitId);
          }
          setLessonProgressState("saved");
          if (
            resolvedNextUnit?.sec_id &&
            selectedQuiz?.sec_id &&
            resolvedNextUnit.sec_id !== selectedQuiz.sec_id
          ) {
            preloadLearnSections(resolvedNextUnit.sec_id, true).catch(() => {});
          }
          return;
        }
        completionRecorded.current = false;
        setLessonProgressState("failed");
        setLessonProgressError(
          response.success
            ? "The server did not confirm quiz completion. Please retry."
            : response.error ?? "Quiz progress could not be saved.",
        );
      })
      .catch((err) => {
        completionRecorded.current = false;
        setLessonProgressState("failed");
        setLessonProgressError("Quiz progress could not be saved. Please retry.");
        console.error("Failed to record quiz completion progress:", err);
      });
  }, [
    isFinished,
    lives,
    score,
    quizzes.length,
    bestStreak,
    currentStreak,
    resolvedUnitId,
    lessonSlides.length,
    completionRetryCount,
    resolvedNextUnit,
    selectedQuiz,
  ]);

  useEffect(() => {
    if (!resolvedUnitId || !hasLesson || isFinished) return;
    const currentOrder = lessonSlideIndex + 1;
    const total = Math.max(1, lessonSlides.length);
    const isLessonDone = currentOrder >= total;
    updateUnitSlideProgressLocally(resolvedUnitId, currentOrder);
    recordLessonSlideProgress(
      resolvedUnitId,
      currentOrder,
      total,
      false,
      undefined,
      false,
      isLessonDone,
    )
      .then((response) => {
        if (!response.success) {
          console.error("Failed to record slide progress:", response.error);
        }
      })
      .catch((err) => {
        console.error("Failed to record slide progress:", err);
      });
  }, [resolvedUnitId, hasLesson, lessonSlideIndex, lessonSlides.length, isFinished]);

  const finishLessonOnlyUnit = async () => {
    if (!resolvedUnitId || lessonProgressState === "saving") return;

    setLessonProgressState("saving");
    setLessonProgressError(null);
    try {
      const response = await recordLessonSlideProgress(
        resolvedUnitId,
        Math.max(1, lessonSlides.length),
        Math.max(1, lessonSlides.length),
        true,
      );
      if (!response.success || !response.isCompleted) {
        setLessonProgressState("failed");
        setLessonProgressError(
          response.success
            ? "The server did not confirm lesson completion. Please retry."
            : response.error ?? "Lesson progress could not be saved.",
        );
        return;
      }

      setLessonProgressState("saved");
      playQuizSound("lesson-complete");
      router.push(completionDestination === "home" ? "/home" : "/learn");
    } catch (error) {
      console.error("Failed to record lesson completion progress:", error);
      setLessonProgressState("failed");
      setLessonProgressError("Lesson progress could not be saved. Please retry.");
    }
  };

  const isLessonProgressSaved =
    !resolvedUnitId || lessonProgressState === "saved";
  const isLessonProgressPending =
    Boolean(resolvedUnitId) &&
    lessonProgressState === "idle" &&
    isFinished &&
    lives > 0 &&
    (quizzes.length === 0 || score >= quizzes.length);

  const handleIncorrectPair = () => {
    playQuizSound("wrong-answer");
    setLives(Math.max(0, lives - 1));
    if (lives <= 1) finishQuizSession();
    setMissedQuestionIndexes((missed) => new Set(missed).add(activeQuizIndex));
    setCurrentStreak(0);
  };

  const findNextUnansweredQuestion = (
    order: number[],
    progress: Record<number, SavedQuestionProgress>,
    startIndex: number,
  ) => {
    for (let offset = 0; offset < order.length; offset += 1) {
      const index = (startIndex + offset) % order.length;
      if (!progress[order[index]]?.result.correct) return index;
    }
    return -1;
  };

  const nextQuiz = () => {
    if (lives <= 0) {
      finishQuizSession();
      return;
    }

    const currentQuizIndex = orderedQuestionIndexes[currentIndex];
    let nextOrder = orderedQuestionIndexes;
    let searchStartIndex = currentIndex + 1;
    let savedProgress = questionProgress;

    if (result && !result.correct && currentQuizIndex !== undefined) {
      nextOrder = [
        ...orderedQuestionIndexes.filter((index) => index !== currentQuizIndex),
        currentQuizIndex,
      ];
      searchStartIndex = currentIndex % nextOrder.length;
      savedProgress = { ...questionProgress };
      delete savedProgress[currentQuizIndex];
      setQuestionOrder(nextOrder);
      setQuestionProgress(savedProgress);
    }

    const nextIndex = findNextUnansweredQuestion(
      nextOrder,
      savedProgress,
      searchStartIndex,
    );
    if (nextIndex === -1) {
      finishQuizSession();
      return;
    }

    const nextQuizIndex = nextOrder[nextIndex];
    const nextProgress = savedProgress[nextQuizIndex];
    setCurrentIndex(nextIndex);
    setValue(nextProgress?.value);
    setResult(nextProgress?.result ?? null);
  };

  const handleBack = () => {
    if (isShowingLesson) {
      setLessonSlideIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (currentIndex === 0) return;

    const previousIndex = currentIndex - 1;
    const previousQuizIndex = orderedQuestionIndexes[previousIndex];
    const savedProgress = questionProgress[previousQuizIndex];
    setCurrentIndex(previousIndex);
    setValue(savedProgress?.value);
    setResult(savedProgress?.result ?? null);
  };

  const continueQuiz = () => {
    if (hasLesson && lives > 0 && score === quizzes.length) {
      playQuizSound("lesson-complete");
    }
    nextQuiz();
  };

  const skipQuestion = () => {
    if (!quiz || result) return;

    const skippedValue = getCorrectValue(quiz);
    const skippedResult: AnswerResult = {
      correct: false,
      skipped: true,
      message: "Skipped question",
      correctAnswer: getAnswer(quiz),
    };
    setValue(skippedValue);
    setQuestionProgress((progress) => ({
      ...progress,
      [activeQuizIndex]: { value: skippedValue, result: skippedResult },
    }));
    setMissedQuestionIndexes((missed) => new Set(missed).add(activeQuizIndex));
    setResult(skippedResult);
    setCurrentStreak(0);
    playQuizSound("skipped-answer");
  };

  const applyAnswer = (
    nextResult: AnswerResult,
    answerValue: AnswerValue,
    skipped = false,
  ) => {
    if (!quiz) return;
    const previousProgress = questionProgress[activeQuizIndex];
    setQuestionProgress((progress) => ({
      ...progress,
      [activeQuizIndex]: { value: answerValue, result: nextResult },
    }));
    setResult(nextResult);
    if (nextResult.correct) {
      if (!skipped) {
        if (quiz.type_name === "MCQ" || quiz.type_name === "FITB") {
          playQuizSound("correct-answer1");
        } else if (quiz.type_name === "Order") {
          playQuizSound("correct-answer3");
        } else if (quiz.type_name === "Pair") {
          playQuizSound("correct-answer2");
        }
      }
      if (!previousProgress?.result.correct) {
        setScore((currentScore) => currentScore + 1);
        if (!missedQuestionIndexes.has(activeQuizIndex)) {
          setBaseXp(
            (earnedXp) =>
              earnedXp + calculateEarnedXp(true, quiz.difficulty_id),
          );
        }
      }
      const nextStreak = currentStreak + 1;
      const nextBestStreak = Math.max(bestStreak, nextStreak);
      setCurrentStreak(nextStreak);
      setBestStreak(nextBestStreak);
    } else {
      setMissedQuestionIndexes((missed) => new Set(missed).add(activeQuizIndex));
      if (!skipped) {
        playQuizSound("wrong-answer");
        const nextLives = Math.max(0, lives - 1);
        setLives(nextLives);
        if (nextLives === 0) finishQuizSession();
      }
      setCurrentStreak(0);
    }
  };

  const isAnswerIncomplete = isQuizAnswerIncomplete(quiz, value);

  const submitAnswer = () => {
    if (!quiz || result || isAnswerIncomplete) return;
    const nextResult = evaluateQuizAnswer(quiz, value);
    applyAnswer(nextResult, value);
  };

  const handleAnswerChange = (nextValue: AnswerValue) => {
    setValue(nextValue);

    if (
      quiz?.type_name === "Pair" &&
      nextValue === (quiz.quiz_payload.pairs?.length ?? 0)
    ) {
      const nextResult = evaluateQuizAnswer(quiz, nextValue);
      applyAnswer(nextResult, nextValue);
    }
  };

  const handleEnter = useEffectEvent(() => {
    if (isFinished || isShowingLesson) return;
    if (result) {
      continueQuiz();
    } else if (!isAnswerIncomplete) {
      submitAnswer();
    }
  });

  const areChoicesLocked = Boolean(result);
  const activeHintMode = resolveQuizHintMode(quiz?.type_name, isShowingLesson);
  const isTutorialReady = isShowingLesson || Boolean(quiz);
  const shouldAutoOpenTutorial =
    isHydrated &&
    !isFinished &&
    !accessibilityOpen &&
    isTutorialReady &&
    hintPrefs.autoShowTutorials &&
    !hasSeenTutorial(activeHintMode);
  const isTutorialOpen = helpOpen || shouldAutoOpenTutorial;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFinished) return;

      const target = event.target;
      const isTextInputTarget =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("textarea, select, input:not([type='radio'])"),
          ));

      if (
        event.key === "?" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isTextInputTarget
      ) {
        event.preventDefault();
        if (isTutorialOpen) {
          markTutorialSeen(activeHintMode);
          setHelpOpen(false);
        } else {
          if (accessibilityOpen) {
            setAccessibilityClosing(true);
          }
          setHelpOpen(true);
        }
        return;
      }

      if (isShowingLesson || isTutorialOpen || accessibilityOpen) return;

      if (
        event.key === "Enter" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest("button, a, select, input:not([type='radio'])"))
        ) {
          return;
        }

        event.preventDefault();
        handleEnter();
        return;
      }

      if (
        quiz?.type_name !== "MCQ" ||
        result ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !/^[1-5]$/.test(event.key) ||
        Number(event.key) > (quiz.quiz_payload.options?.length ?? 0)
      ) {
        return;
      }

      if (isTextInputTarget) {
        return;
      }

      event.preventDefault();
      setValue(Number(event.key) - 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    quiz,
    result,
    isFinished,
    isShowingLesson,
    isTutorialOpen,
    accessibilityOpen,
    activeHintMode,
    markTutorialSeen,
  ]);

  if (isFinished) {
    const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);
    const backHref = completionDestination === "home" ? "/home" : "/input";
    const backLabel =
      completionDestination === "home" ? "Back to Home" : "Back to Quiz Input";
    const hasCodingAssessment = hasCodingAssessmentPayload(
      selectedQuizzes[0]?.unit_assessment,
    );
    const codingAssessmentHref = unitId ? `/quiz-cp/${unitId}` : "/quiz-cp";

    return (
      <CompletionScreen
        isPassed={isPassed}
        title={isPassed ? "Quiz Complete!" : "Game Over"}
        submessage={completionSubmessage}
        animatedStats={animatedStats}
        dailyGoalStats={dailyGoalStats}
        nextLevelSlot={
          <>
            {isPassed && hasCodingAssessment && (
              <div className="next-level-container">
                <Link
                  href={codingAssessmentHref}
                  className="next-level-card"
                  aria-disabled={!isLessonProgressSaved}
                  onClick={(event) => {
                    if (!isLessonProgressSaved) event.preventDefault();
                  }}
                  style={{ textDecoration: "none" }}
                >
                  <div className="next-level-content">
                    <div className="next-level-type">
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
                        className="lucide lucide-code preview-icon"
                      >
                        <path d="m16 18 6-6-6-6" />
                        <path d="m8 6-6 6 6 6" />
                      </svg>
                    </div>
                    <div className="next-level-title">
                      <p>Code Problem</p>
                      <h2>{selectedQuiz?.unit_title ?? "Code Assessment"}</h2>
                    </div>
                  </div>
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
                    className="lucide lucide-chevron-right preview-icon"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>
            )}
            {isPassed && !hasCodingAssessment && nextUnit && (
              <div className="next-level-container">
                <Link
                  href={
                    resolvedNextUnit
                      ? `/quiz/${resolvedNextUnit.unit_id}`
                      : `/quiz?unitId=${nextUnit.unit_id}&source=quiz`
                  }
                  className="next-level-card"
                  aria-disabled={!isLessonProgressSaved}
                  onClick={(event) => {
                    if (!isLessonProgressSaved) event.preventDefault();
                  }}
                  style={{ textDecoration: "none" }}
                >
                  <div className="next-level-content">
                    <div className="next-level-type">
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
                        className="lucide lucide-book-open preview-icon"
                      >
                        <path d="M12 5v16" />
                        <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
                      </svg>
                    </div>
                    <div className="next-level-title">
                      <p>
                        {nextUnit.sec_num != null
                          ? `Section ${nextUnit.sec_num}`
                          : nextUnit.cat_name ?? "Next"}
                      </p>
                      <h2>{nextUnit.unit_title}</h2>
                    </div>
                  </div>
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
                    className="lucide lucide-chevron-right preview-icon"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>
            )}
          </>
        }
        statusSlot={
          isPassed && resolvedUnitId ? (
            lessonProgressState === "saving" || isLessonProgressPending ? (
              <p role="status">Saving lesson progress...</p>
            ) : lessonProgressState === "failed" ? (
              <div role="alert" className="completion-retry-alert">
                <p>{lessonProgressError}</p>
                <button
                  className="options"
                  type="button"
                  onClick={() => {
                    setLessonProgressState("saving");
                    setLessonProgressError(null);
                    setCompletionRetryCount((count) => count + 1);
                  }}
                >
                  Retry saving progress
                </button>
              </div>
            ) : undefined
          ) : undefined
        }
        actionsSlot={
          <>
            {isPassed ? (
              <button
                className="options"
                id="submit"
                type="button"
                onClick={() => router.push("/learn")}
                disabled={!isLessonProgressSaved}
              >
                <p>Continue</p>
              </button>
            ) : (
              <button
                className="options"
                id="submit"
                type="button"
                onClick={() => window.location.reload()}
              >
                <p>Try Again</p>
              </button>
            )}
            <button
              className="options"
              id="back"
              type="button"
              onClick={() => router.push(backHref)}
            >
              <p>{backLabel}</p>
            </button>
          </>
        }
      />
    );
  }

  return (
    <div className="quiz-page">
      <Sidebar />
      <main>
        <QuizHeader
          unitTitle={selectedQuiz?.unit_title}
          showUnitTitle={hasLesson}
          lives={lives}
          accessibilityOpen={accessibilityOpen}
          onToggleAccessibility={() => {
            if (accessibilityOpen) {
              setAccessibilityClosing(true);
            } else {
              if (isTutorialOpen) {
                markTutorialSeen(activeHintMode);
                setHelpOpen(false);
              }
              setAccessibilityClosing(false);
              setAccessibilityOpen(true);
            }
          }}
          helpOpen={isTutorialOpen}
          onToggleHelp={() => {
            if (isTutorialOpen) {
              markTutorialSeen(activeHintMode);
              setHelpOpen(false);
            } else {
              if (accessibilityOpen) setAccessibilityClosing(true);
              setHelpOpen(true);
            }
          }}
          onBack={handleBack}
          canGoBack={isShowingLesson ? lessonSlideIndex > 0 : currentIndex > 0}
          isShowingLesson={isShowingLesson}
          totalProgressItems={totalProgressItems}
          progressValue={progressValue}
        />

        {accessibilityOpen && (
          <AccessibilityPanel
            isClosing={accessibilityClosing}
            onClose={() => setAccessibilityClosing(true)}
            onClosed={() => {
              setAccessibilityOpen(false);
              setAccessibilityClosing(false);
            }}
          />
        )}

        <QuizTutorialOverlay
          isOpen={isTutorialOpen}
          mode={activeHintMode}
          onClose={() => {
            markTutorialSeen(activeHintMode);
            setHelpOpen(false);
          }}
          onKeepOpen={() => setHelpOpen(true)}
        />

        <div
          className="quiz-content-region"
          style={{
            maxWidth: "1080px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            flex: "1",
            minHeight: "0",
          }}
        >
          {isShowingLesson ? (
            <>
              <QuizUiHintBar
                mode="Lesson"
                compact
                onOpenGuide={() => {
                  if (accessibilityOpen) setAccessibilityClosing(true);
                  setHelpOpen(true);
                }}
              />
              <LessonSlideTransition
                slideIndex={lessonSlideIndex}
                slideCount={lessonSlides.length}
                slideHasCode={(index) => Boolean(lessonSlides[index]?.lesson_code)}
                renderSlide={(slideIndex) => (
                  <LessonCard
                    key={`${selectedQuiz?.quiz_id ?? currentIndex}-${slideIndex}`}
                    slides={lessonSlides}
                    className="unit-meta"
                    slideIndex={slideIndex}
                    onSlideIndexChange={setLessonSlideIndex}
                    showControls={false}
                  />
                )}
              />
            </>
          ) : (
            <QuizQuestionView
              quiz={quiz}
              currentIndex={currentIndex}
              activeQuizIndex={activeQuizIndex}
              value={value}
              onChange={handleAnswerChange}
              disabled={areChoicesLocked}
              onPairMatched={() => playQuizSound("correct-answer1")}
              onIncorrectPair={handleIncorrectPair}
              onOpenHelp={() => {
                if (accessibilityOpen) setAccessibilityClosing(true);
                setHelpOpen(true);
              }}
            />
          )}
        </div>
      </main>

      <QuizFooter
        isShowingLesson={isShowingLesson}
        lessonProgressError={lessonProgressError}
        lessonSlideIndex={lessonSlideIndex}
        lessonSlideCount={lessonSlides.length}
        isLessonOnlyUnit={isLessonOnlyUnit}
        isSavingLesson={lessonProgressState === "saving"}
        onPreviousSlide={() =>
          setLessonSlideIndex((index) => Math.max(0, index - 1))
        }
        onNextSlide={() =>
          setLessonSlideIndex((index) =>
            Math.min(lessonSlides.length - 1, index + 1),
          )
        }
        onCompleteLesson={() => {
          if (isLessonOnlyUnit) {
            void finishLessonOnlyUnit();
          } else {
            if (resolvedUnitId) {
              void recordLessonSlideProgress(
                resolvedUnitId,
                Math.max(1, lessonSlides.length),
                Math.max(1, lessonSlides.length),
                false,
                undefined,
                false,
                true,
              );
            }
            setHasStartedQuiz(true);
          }
        }}
        quiz={quiz}
        currentIndex={currentIndex}
        result={result}
        isAnswerIncomplete={isAnswerIncomplete}
        onSkipQuestion={skipQuestion}
        onSubmitAnswer={submitAnswer}
        onContinueQuiz={continueQuiz}
      />
    </div>
  );
}
