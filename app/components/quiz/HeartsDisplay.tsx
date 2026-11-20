"use client";

interface HeartsDisplayProps {
  lives: number;
  total?: number;
  title?: string;
  ariaLabel?: string;
}

export default function HeartsDisplay({
  lives,
  total = 5,
  title,
  ariaLabel,
}: HeartsDisplayProps) {
  return (
    <div
      className="heart-container"
      data-tutorial="quiz-hearts"
      data-lives={lives}
      title={title}
      aria-label={ariaLabel ?? `${lives} of ${total} hearts remaining`}
    >
      {Array.from({ length: total }, (_, idx) => (
        <svg
          key={idx}
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
          aria-hidden="true"
        >
          <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
        </svg>
      ))}
    </div>
  );
}
