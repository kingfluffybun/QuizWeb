"use client";

import type { QuizData } from "@/app/quiz/types";
import type { AnswerResult } from "../evaluate";

interface QuizFooterProps {
  isShowingLesson: boolean;
  lessonProgressError: string | null;
  lessonSlideIndex: number;
  lessonSlideCount: number;
  isLessonOnlyUnit: boolean;
  isSavingLesson: boolean;
  onPreviousSlide: () => void;
  onNextSlide: () => void;
  onCompleteLesson: () => void;
  quiz?: QuizData;
  currentIndex: number;
  result: AnswerResult | null;
  isAnswerIncomplete: boolean;
  onSkipQuestion: () => void;
  onSubmitAnswer: () => void;
  onContinueQuiz: () => void;
}

export default function QuizFooter({
  isShowingLesson,
  lessonProgressError,
  lessonSlideIndex,
  lessonSlideCount,
  isLessonOnlyUnit,
  isSavingLesson,
  onPreviousSlide,
  onNextSlide,
  onCompleteLesson,
  quiz,
  currentIndex,
  result,
  isAnswerIncomplete,
  onSkipQuestion,
  onSubmitAnswer,
  onContinueQuiz,
}: QuizFooterProps) {
  return (
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
        {lessonProgressError && <p role="alert">{lessonProgressError}</p>}

        {isShowingLesson ? (
          <div className="lesson-footer-controls" data-tutorial="lesson-nav">
            <button
              type="button"
              className="options"
              id="skip"
              onClick={onPreviousSlide}
              disabled={lessonSlideIndex === 0}
              aria-label="Previous lesson slide"
            >
              Previous
            </button>
            {lessonSlideIndex === lessonSlideCount - 1 ? (
              <button
                type="button"
                className="options"
                id="submit"
                onClick={onCompleteLesson}
                disabled={isLessonOnlyUnit && isSavingLesson}
              >
                {isLessonOnlyUnit && isSavingLesson
                  ? "Saving..."
                  : isLessonOnlyUnit
                    ? "Finish Lesson"
                    : "Start Quiz"}
              </button>
            ) : (
              <button
                type="button"
                className="options"
                id="submit"
                onClick={onNextSlide}
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
                key={result ? `${currentIndex}-${result.correct}` : "answer-pending"}
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
              data-tutorial="quiz-skip"
              type="button"
              onClick={onSkipQuestion}
              disabled={!quiz || Boolean(result)}
            >
              Skip
            </button>
            <button
              className="options"
              id="submit"
              data-tutorial="quiz-submit"
              type="button"
              onClick={result ? onContinueQuiz : onSubmitAnswer}
              disabled={!quiz || (!result && isAnswerIncomplete)}
            >
              {result ? "Continue" : "Submit"}
            </button>
          </>
        )}
      </div>
    </footer>
  );
}
