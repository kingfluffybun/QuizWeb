"use client";

import { useRouter } from "next/navigation";
import HeartsDisplay from "@/app/components/quiz/HeartsDisplay";

interface CpHeaderProps {
  totalSteps: number;
  currentStepIndex: number;
  lives: number;
  isSkipMode: boolean;
  timerSeconds: number;
  accessibilityOpen: boolean;
  onToggleAccessibility: () => void;
  helpOpen: boolean;
  onToggleHelp: () => void;
}

export default function CpHeader({
  totalSteps,
  currentStepIndex,
  lives,
  isSkipMode,
  timerSeconds,
  accessibilityOpen,
  onToggleAccessibility,
  helpOpen,
  onToggleHelp,
}: CpHeaderProps) {
  const router = useRouter();
  const formattedTime = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(
    timerSeconds % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="quiz-header" style={{ maxWidth: "100%" }}>
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
            width="32"
            height="32"
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

        <button
          type="button"
          className="quiz-help-button"
          data-quiz-help-trigger
          aria-label={
            helpOpen
              ? "Close interactive tutorial"
              : "Start interactive tutorial (?)"
          }
          aria-expanded={helpOpen}
          title="Start interactive tutorial (?)"
          onClick={onToggleHelp}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="lucide lucide-circle-help"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>

        <button
          type="button"
          className="quiz-close-button"
          aria-label="Exit coding assessment"
          onClick={() => router.push("/learn")}
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
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="progress-container" aria-label="Assessment step progress">
          {Array.from({ length: totalSteps }, (_, idx) => (
            <div
              key={idx}
              className={idx <= currentStepIndex ? "active" : undefined}
            />
          ))}
        </div>

        {isSkipMode && (
          <div
            className={`cp-skip-timer ${
              timerSeconds < 20
                ? "urgent"
                : timerSeconds < 60
                  ? "warning"
                  : ""
            }`}
            title="5 minutes per coding problem"
            aria-label={`Time remaining: ${formattedTime}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formattedTime}</span>
          </div>
        )}

        <HeartsDisplay
          lives={lives}
          title={`${lives} of 5 hearts remaining`}
        />
      </div>
    </div>
  );
}
