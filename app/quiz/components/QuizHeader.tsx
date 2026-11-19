"use client";

import { useRouter } from "next/navigation";
import HeartsDisplay from "@/app/components/quiz/HeartsDisplay";

interface QuizHeaderProps {
  unitTitle?: string;
  showUnitTitle: boolean;
  lives: number;
  accessibilityOpen: boolean;
  onToggleAccessibility: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isShowingLesson: boolean;
  totalProgressItems: number;
  progressValue: number;
}

export default function QuizHeader({
  unitTitle,
  showUnitTitle,
  lives,
  accessibilityOpen,
  onToggleAccessibility,
  onBack,
  canGoBack,
  isShowingLesson,
  totalProgressItems,
  progressValue,
}: QuizHeaderProps) {
  const router = useRouter();

  return (
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
          onClick={onToggleAccessibility}
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
            className="lucide lucide-settings-icon lucide-settings"
          >
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

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

        {showUnitTitle && unitTitle && (
          <h1 className="quiz-unit-title">{unitTitle}</h1>
        )}

        <HeartsDisplay lives={lives} />
      </div>

      <div className="quiz-progress-row">
        <button
          type="button"
          className="quiz-progress-back"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label={
            isShowingLesson
              ? "Back to previous lesson slide"
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
          aria-valuenow={progressValue}
          aria-valuetext={
            totalProgressItems > 0
              ? `Item ${progressValue} of ${totalProgressItems}`
              : "No progress items"
          }
        >
          <span
            className="quiz-progress-bar-fill"
            style={{
              width: `${
                totalProgressItems > 0
                  ? Math.min(100, (progressValue / totalProgressItems) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
