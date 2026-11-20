"use client";

import { CloseIcon } from "@/app/components/icons/NavIcons";
import { useQuizHintsPrefs } from "@/lib/quiz-hints-store";
import { getQuizUiHint, type QuizHintMode } from "@/lib/quiz-ui-hints";

interface QuizUiHintBarProps {
  mode: QuizHintMode;
  onOpenGuide: () => void;
  compact?: boolean;
}

export default function QuizUiHintBar({
  mode,
  onOpenGuide,
  compact = false,
}: QuizUiHintBarProps) {
  const { isInlineHintVisible, dismissModeHint } = useQuizHintsPrefs();

  if (!isInlineHintVisible(mode)) return null;

  const hint = getQuizUiHint(mode);

  return (
    <aside
      className={`quiz-ui-hint-bar${compact ? " is-compact" : ""}`}
      aria-label={`${hint.badge} interaction tip`}
    >
      <span className="quiz-ui-hint-badge">{hint.badge}</span>
      <p className="quiz-ui-hint-text">{hint.shortHint}</p>
      <div className="quiz-ui-hint-actions">
        <button
          type="button"
          className="quiz-ui-hint-guide-btn"
          data-quiz-help-trigger
          onClick={onOpenGuide}
        >
          How to use
        </button>
        <button
          type="button"
          className="quiz-ui-hint-dismiss-btn"
          aria-label={`Hide quick tip for ${hint.badge}`}
          title="Hide tip for this quiz type"
          onClick={() => dismissModeHint(mode)}
        >
          <CloseIcon size={15} />
        </button>
      </div>
    </aside>
  );
}
