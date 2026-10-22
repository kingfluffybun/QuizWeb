"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useEffectEvent } from "react";
import type { AnimationEvent, ReactNode } from "react";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css";
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue, QuizData } from "@/app/quiz/types";
import QuizRender from "@/app/components/quiz/quizRender";
import LessonCard from "@/app/components/LessonCard";
import Sidebar from "@/app/components/Sidebar";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";
import { useQuizSounds } from "@/app/quiz/useQuizSounds";
import { recordUserActivity } from "@/app/actions/streak";
import { calculateEarnedXp } from "@/lib/xp-calculation";
import { unwrapCodeProblemAssessment } from "@/lib/cp-schema";

type AnswerResult = {
  correct: boolean;
  message: string;
  correctAnswer: string;
  skipped?: boolean;
};

type SavedQuestionProgress = {
  value: AnswerValue;
  result: AnswerResult;
};

type UnitQuizData = QuizData & {
  unit_title?: string;
  unit_assessment?: unknown;
  unit_lesson_card?: {
    lesson_slide?: Array<{
      lesson_title?: string;
      lesson_text?: string;
      lesson_code?: string;
    }>;
    lesson_slides?: Array<{
      lesson_title?: string;
      lesson_text?: string;
      lesson_code?: string;
    }>;
    lesson_card?: { lesson_text?: string };
    lesson_text?: string;
  };
};

const correctMessages = ["That's correct!", "Excellent job!", "Well done!"];
const incorrectMessages = [
  "Hard luck!",
  "That’s incorrect.",
  "Not quite right.",
];

function LessonSlideTransition({
  slideIndex,
  slideCount,
  slideHasCode,
  renderSlide,
}: {
  slideIndex: number;
  slideCount: number;
  slideHasCode: (index: number) => boolean;
  renderSlide: (index: number) => ReactNode;
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(slideIndex);
  const incomingSlideIndex =
    activeSlideIndex === slideIndex ? null : slideIndex;
  const isMovingBackward =
    incomingSlideIndex !== null && incomingSlideIndex < activeSlideIndex;

  const finishTransition = (
    index: number,
    event: AnimationEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget) return;
    if (incomingSlideIndex === index) {
      setActiveSlideIndex(index);
    }
  };

  return (
    <div className="lesson-slide-transition">
      {Array.from({ length: slideCount }, (_, index) => {
        const isEntering = incomingSlideIndex === index;
        const isExiting =
          incomingSlideIndex !== null && activeSlideIndex === index;
        const isExitingToText =
          isExiting &&
          incomingSlideIndex !== null &&
          !slideHasCode(incomingSlideIndex);
        const isHidden =
          !isEntering && !isExiting && index !== activeSlideIndex;

        return (
          <div
            key={`slide-${index}`}
            className={`lesson-slide-layer${isEntering ? " is-entering" : ""}${isExiting ? " is-exiting" : ""}${isExitingToText ? " is-exiting-to-text" : ""}${isMovingBackward && (isEntering || isExiting) ? " is-backward" : ""}${isHidden ? " is-hidden" : ""}`}
            aria-hidden={isHidden || isExiting}
            onAnimationEnd={
              isEntering ? (event) => finishTransition(index, event) : undefined
            }
          >
            {renderSlide(index)}
          </div>
        );
      })}
    </div>
  );
}

function getAnswer(quiz: QuizData) {
  const payload = quiz.quiz_payload;

  switch (quiz.type_name) {
    case "MCQ":
      return typeof payload.correct_index === "number"
        ? (payload.options?.[payload.correct_index] ?? "No answer available")
        : "No answer available";
    case "FITB":
      return payload.answer?.trim() || "No answer available";
    case "Order":
      return (
        payload.items?.reduce((answer, item, index, items) => {
          if (index === 0) return item;
          const touchesSymbol =
            item === ">" ||
            item === "<" ||
            items[index - 1] === ">" ||
            items[index - 1] === "<";
          return `${answer}${touchesSymbol ? "" : " "}${item}`;
        }, "") || "No answer available"
      );
    case "Pair":
      return (
        payload.pairs
          ?.map(({ left, right }) => `${left} - ${right}`)
          .join(", ") || "No answer available"
      );
    default:
      return "No answer available";
  }
}

function getCorrectValue(quiz: QuizData): AnswerValue {
  switch (quiz.type_name) {
    case "MCQ":
      return quiz.quiz_payload.correct_index;
    case "FITB":
      return quiz.quiz_payload.answer ?? "";
    case "Order":
      return quiz.quiz_payload.items ?? [];
    case "Pair":
      return quiz.quiz_payload.pairs?.length ?? 0;
    default:
      return undefined;
  }
}

function evaluate(quiz: QuizData, value: AnswerValue): AnswerResult {
  const payload = quiz.quiz_payload;
  let correct = false;

  switch (quiz.type_name) {
    case "MCQ":
      correct = typeof value === "number" && value === payload.correct_index;
      break;
    case "FITB":
      const expected = payload.answer?.trim().toLowerCase();
      correct =
        typeof value === "string" && value.trim().toLowerCase() === expected;
      break;
    case "Order":
      correct = JSON.stringify(value) === JSON.stringify(payload.items);
      break;
    case "Pair":
      correct = value === (payload.pairs?.length ?? 0);
      break;
  }

  const messages = correct ? correctMessages : incorrectMessages;
  return {
    correct,
    message: messages[Math.floor(Math.random() * messages.length)],
    correctAnswer: getAnswer(quiz),
  };
}

export default function QuizLandingClient({
  initialQuizzes,
  completionDestination = "input",
  unitId,
}: {
  initialQuizzes?: QuizData[];
  completionDestination?: "home" | "input";
  unitId?: number;
}) {
  const router = useRouter();
  const playQuizSound = useQuizSounds();
  const { quizzes: allQuizzes } = useQuizData();
  const quizzes = initialQuizzes ?? allQuizzes;
  const selectedQuizzes = quizzes as UnitQuizData[];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [value, setValue] = useState<AnswerValue>(undefined);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [lives, setLives] = useState(5);
  const [score, setScore] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [hasStartedQuiz, setHasStartedQuiz] = useState(
    initialQuizzes === undefined,
  );
  const [lessonSlideIndex, setLessonSlideIndex] = useState(0);
  const [questionProgress, setQuestionProgress] = useState<
    Record<number, SavedQuestionProgress>
  >({});
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);

  useEffect(() => {
    if (isFinished) {
      console.log("Total XP accumulated:", Math.round(earnedXp));
      recordUserActivity({
        type: "quiz",
        xp: Math.round(earnedXp),
      }).catch((e) => {
        console.error("Failed to record activity:", e);
      });
    }
  }, [isFinished, earnedXp]);

  const openAccessibility = () => {
    setAccessibilityClosing(false);
    setAccessibilityOpen(true);
  };

  const closeAccessibility = () => setAccessibilityClosing(true);

  const finishClosingAccessibility = () => {
    setAccessibilityOpen(false);
    setAccessibilityClosing(false);
  };

  const quiz = quizzes[currentIndex];
  const selectedQuiz = selectedQuizzes[currentIndex];
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
  const hasLesson = lessonSlides.some(
    (slide) => slide.lesson_title || slide.lesson_text || slide.lesson_code,
  );
  const isShowingLesson = hasLesson && !hasStartedQuiz;
  const totalProgressItems =
    (hasLesson ? lessonSlides.length : 0) +
    (isLessonOnlyUnit ? 0 : quizzes.length);
  const activeProgressIndex = isShowingLesson
    ? lessonSlideIndex
    : (hasLesson ? lessonSlides.length : 0) + currentIndex;

  const nextQuiz = () => {
    if (lives <= 0 || currentIndex >= quizzes.length - 1) {
      setIsFinished(true);
      return;
    }

    const nextIndex = currentIndex + 1;
    const savedProgress = questionProgress[nextIndex];
    setCurrentIndex(nextIndex);
    setValue(savedProgress?.value);
    setResult(savedProgress?.result ?? null);
  };

  const handleBack = () => {
    if (isShowingLesson) {
      setLessonSlideIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (currentIndex === 0) {
      if (hasLesson) {
        setHasStartedQuiz(false);
        setLessonSlideIndex(lessonSlides.length - 1);
      }
      return;
    }

    const previousIndex = currentIndex - 1;
    const savedProgress = questionProgress[previousIndex];
    setCurrentIndex(previousIndex);
    setValue(savedProgress?.value);
    setResult(savedProgress?.result ?? null);
  };

  const continueQuiz = () => {
    if (hasLesson && lives > 0 && currentIndex >= quizzes.length - 1) {
      playQuizSound("lesson-complete");
    }
    nextQuiz();
  };

  const skipQuestion = () => {
    if (!quiz || result || questionProgress[currentIndex]) return;

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
      [currentIndex]: { value: skippedValue, result: skippedResult },
    }));
    setResult(skippedResult);
    setCorrectStreak(0);
    playQuizSound("skipped-answer");
  };

  const submitAnswer = () => {
    if (!quiz || questionProgress[currentIndex]) return;
    const nextResult = evaluate(quiz, value);
    setQuestionProgress((progress) => ({
      ...progress,
      [currentIndex]: { value, result: nextResult },
    }));
    setResult(nextResult);
    if (nextResult.correct) {
      if (quiz.type_name === "MCQ" || quiz.type_name === "FITB") {
        playQuizSound("correct-answer1");
      } else if (quiz.type_name === "Order") {
        playQuizSound("correct-answer3");
      } else if (quiz.type_name === "Pair") {
        playQuizSound("correct-answer2");
      }
      setScore((currentScore) => currentScore + 1);
      const nextStreak = correctStreak + 1;
      setCorrectStreak(nextStreak);
      setEarnedXp(
        (total) =>
          total + calculateEarnedXp(true, quiz.difficulty_id, nextStreak),
      );
    } else {
      playQuizSound("wrong-answer");
      setLives((currentLives) => Math.max(0, currentLives - 1));
      setCorrectStreak(0);
    }
  };

  const handleAnswerChange = (nextValue: AnswerValue) => {
    if (result) return;

    setValue(nextValue);

    const pairCount = quiz?.quiz_payload.pairs?.length ?? 0;
    if (
      quiz?.type_name === "Pair" &&
      nextValue === pairCount &&
      !questionProgress[currentIndex]
    ) {
      const nextResult = evaluate(quiz, nextValue);
      setQuestionProgress((progress) => ({
        ...progress,
        [currentIndex]: { value: nextValue, result: nextResult },
      }));
      setResult(nextResult);
      if (nextResult.correct) {
        playQuizSound("correct-answer2");
        setScore((currentScore) => currentScore + 1);
        const nextStreak = correctStreak + 1;
        setCorrectStreak(nextStreak);
        setEarnedXp(
          (total) =>
            total + calculateEarnedXp(true, quiz.difficulty_id, nextStreak),
        );
      } else {
        playQuizSound("wrong-answer");
        setLives((currentLives) => Math.max(0, currentLives - 1));
        setCorrectStreak(0);
      }
    }
  };

  const handleEnter = useEffectEvent(() => {
    if (result) {
      continueQuiz();
    } else {
      submitAnswer();
    }
  });

  useEffect(() => {
    const handleMcqKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const target = event.target;
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

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("textarea, select, input:not([type='radio'])"))
      ) {
        return;
      }

      event.preventDefault();
      setValue(Number(event.key) - 1);
    };

    window.addEventListener("keydown", handleMcqKeyDown);
    return () => window.removeEventListener("keydown", handleMcqKeyDown);
  }, [quiz, result]);

  const isPairIncomplete =
    quiz?.type_name === "Pair" &&
    value !== (quiz.quiz_payload.pairs?.length ?? 0);

  const isAnswerIncomplete = (() => {
    if (!quiz) return true;

    switch (quiz.type_name) {
      case "MCQ":
        return typeof value !== "number";
      case "FITB":
        return typeof value !== "string" || value.trim() === "";
      case "Pair":
        return isPairIncomplete;
      default:
        return false;
    }
  })();
  const areChoicesLocked = Boolean(result);

  if (isFinished) {
    const backHref = completionDestination === "home" ? "/home" : "/input";
    const backLabel =
      completionDestination === "home" ? "Back to Home" : "Back to Quiz Input";
    const hasCodingAssessment = Boolean(
      unwrapCodeProblemAssessment(selectedQuizzes[0]?.unit_assessment),
    );
    const codingAssessmentHref = unitId
      ? `/quiz-cp?unitId=${unitId}`
      : "/quiz-cp";

    return (
      <div className="quiz-page quiz-no-footer-page">
        <Sidebar />
        <main className="quiz-completion-main">
          <div className="quiz-complete-card">
            <h1>{lives === 0 ? "Game Over" : "Quiz Complete!"}</h1>
            <h2>
              Score: {score} / {quizzes.length}
            </h2>
            <p className="quiz-completion-xp">
              XP Earned: {Math.round(earnedXp)}
            </p>
            <p className="quiz-completion-message">
              {lives === 0
                ? "You ran out of lives. Try again to sharpen your skills!"
                : hasCodingAssessment
                  ? "Outstanding performance! Ready to tackle the Unit Coding Assessment?"
                  : "Outstanding performance!"}
            </p>
            {lives > 0 && hasCodingAssessment && (
              <Link
                href={codingAssessmentHref}
                className="options"
                id="submit"
                style={{ textDecoration: "none" }}
              >
                Start Coding Assessment
              </Link>
            )}
            <button
              className="options"
              id={lives > 0 && hasCodingAssessment ? undefined : "submit"}
              type="button"
              onClick={() => window.location.reload()}
              style={
                lives > 0 && hasCodingAssessment
                  ? {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "14px auto 0",
                      minHeight: "54px",
                      width: "240px",
                      borderRadius: "16px",
                      fontSize: "1.1rem",
                    }
                  : undefined
              }
            >
              Play Again
            </button>
            <Link href={backHref} className="options back-to-input-btn">
              {backLabel}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <Sidebar />
      <main>
        <div className="quiz-header">
          <div className="quiz-navigation">
            <button
              type="button"
              className="quiz-settings-button"
              data-accessibility-trigger
              aria-label={
                accessibilityOpen
                  ? "Close accessibility options"
                  : "Open accessibility options"
              }
              onClick={
                accessibilityOpen ? closeAccessibility : openAccessibility
              }
            >
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
                aria-hidden="true"
              >
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-settings-icon lucide-settings"
            >
              <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <button
              type="button"
              className="quiz-close-button"
              aria-label="Close quiz"
              onClick={() => router.push("/home")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            {hasLesson && selectedQuiz?.unit_title && (
              <h1 className="quiz-unit-title">{selectedQuiz.unit_title}</h1>
            )}
            <div className="heart-container" data-lives={lives}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="#EE5555"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-heart-icon lucide-heart"
              >
                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="#EE5555"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-heart-icon lucide-heart"
              >
                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="#EE5555"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-heart-icon lucide-heart"
              >
                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="#EE5555"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-heart-icon lucide-heart"
              >
                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="#EE5555"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-heart-icon lucide-heart"
              >
                <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
              </svg>
            </div>
          </div>
          <div className="quiz-progress-row">
            <button
              type="button"
              className="quiz-progress-back"
              onClick={handleBack}
              disabled={
                isShowingLesson
                  ? lessonSlideIndex === 0
                  : currentIndex === 0 && !hasLesson
              }
              aria-label={
                isShowingLesson
                  ? "Back to previous lesson slide"
                  : currentIndex === 0 && hasLesson
                    ? "Back to lesson"
                    : "Back to previous question"
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-chevron-left preview-icon"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div
              className="progress-container quiz-progress-bar"
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={0}
              aria-valuemax={Math.max(totalProgressItems, 1)}
              aria-valuenow={Math.min(
                activeProgressIndex + 1,
                totalProgressItems,
              )}
              aria-valuetext={
                totalProgressItems > 0
                  ? `Item ${Math.min(activeProgressIndex + 1, totalProgressItems)} of ${totalProgressItems}`
                  : "No progress items"
              }
            >
              <span
                className="quiz-progress-bar-fill"
                style={{
                  width: `${
                    totalProgressItems > 0
                      ? Math.min(
                          100,
                          ((activeProgressIndex + 1) / totalProgressItems) *
                            100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
          {accessibilityOpen && (
            <AccessibilityPanel
              isClosing={accessibilityClosing}
              onClose={closeAccessibility}
              onClosed={finishClosingAccessibility}
            />
          )}
        </div>

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
          {hasLesson && !hasStartedQuiz ? (
            <LessonSlideTransition
              slideIndex={lessonSlideIndex}
              slideCount={lessonSlides.length}
              slideHasCode={(index) =>
                Boolean(lessonSlides[index]?.lesson_code)
              }
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
          ) : (
            <div
              className="quiz-container"
              key={`${quiz?.quiz_id ?? "quiz"}-${currentIndex}`}
            >
              <h1>{quiz?.question_text ?? "Loading question..."}</h1>
              {quiz && (
                <QuizRender
                  quiz={quiz}
                  value={value}
                  onChange={handleAnswerChange}
                  disabled={areChoicesLocked}
                  onPairMatched={() => playQuizSound("correct-answer1")}
                  onIncorrectPair={() => playQuizSound("wrong-answer")}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <footer
        className={
          !isShowingLesson && result
            ? result.correct
              ? "correct"
              : "incorrect"
            : ""
        }
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1080px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {/* dito sa div yung message */}
          {hasLesson && !hasStartedQuiz ? (
            <div className="lesson-footer-controls">
              <button
                type="button"
                className="options"
                id="skip"
                onClick={() =>
                  setLessonSlideIndex((index) => Math.max(0, index - 1))
                }
                disabled={lessonSlideIndex === 0}
                aria-label="Previous lesson slide"
              >
                Previous
              </button>
              {lessonSlideIndex === lessonSlides.length - 1 ? (
                <button
                  type="button"
                  className="options"
                  id="submit"
                  onClick={() => {
                    if (isLessonOnlyUnit) {
                      playQuizSound("lesson-complete");
                      router.push("/learn");
                    } else {
                      setHasStartedQuiz(true);
                    }
                  }}
                >
                  {isLessonOnlyUnit ? "Finish Lesson" : "Start Quiz"}
                </button>
              ) : (
                <button
                  type="button"
                  className="options"
                  id="submit"
                  onClick={() =>
                    setLessonSlideIndex((index) =>
                      Math.min(lessonSlides.length - 1, index + 1),
                    )
                  }
                  aria-label="Next lesson slide"
                >
                  Next
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="answer-message row">
                <div
                  key={
                    result
                      ? `${currentIndex}-${result.correct}`
                      : "answer-pending"
                  }
                  className="answer-message-icon col"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    id="wrong"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-x"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    id="correct"
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-check"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div id="answer-message-text">
                  <h2>{result?.message}</h2>
                  {(!result?.correct || result.skipped) && result && (
                    <p>
                      <b>Correct Answer:</b> {result.correctAnswer}
                    </p>
                  )}
                </div>
              </div>
              <button
                className="options"
                id="skip"
                onClick={skipQuestion}
                disabled={!quiz || Boolean(result)}
              >
                {" "}
                Skip{" "}
              </button>
              <button
                className="options"
                id="submit"
                onClick={result ? continueQuiz : submitAnswer}
                disabled={!quiz || (!result && isAnswerIncomplete)}
              >
                {" "}
                {result ? "Continue" : "Submit"}{" "}
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
