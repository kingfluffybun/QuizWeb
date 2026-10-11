"use client";

import { useRef, useState } from "react";

export type LessonSlide = {
  lesson_title?: string;
  lesson_text?: string;
  lesson_code?: string;
};

type LessonCardProps = {
  title?: string;
  slides?: LessonSlide[];
  className?: string;
  interactive?: boolean;
  slideIndex?: number;
  onSlideIndexChange?: (index: number) => void;
  showControls?: boolean;
};

type LessonCodeFrameProps = {
  className: string;
  title: string;
  source: string;
  toggleable?: boolean;
};

export function LessonCodeFrame({
  className,
  title,
  source,
  toggleable = true,
}: LessonCodeFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [view, setView] = useState<"code" | "result">("result");

  const resizeFrame = () => {
    const frame = frameRef.current;
    const frameWindow = frame?.contentWindow;
    const document = frameWindow?.document;
    if (!frame || !frameWindow || !document) {
      return;
    }

    const body = document.body;
    const lastContent = body?.lastElementChild;
    const bodyStyle = body ? frameWindow.getComputedStyle(body) : null;
    const contentHeight = Math.max(
      180,
      lastContent && bodyStyle
        ? lastContent.getBoundingClientRect().bottom +
            frameWindow.scrollY +
            parseFloat(bodyStyle.marginBottom || "0")
        : document.documentElement.scrollHeight,
    );
    frame.style.height = `${contentHeight}px`;
  };

  return (
    <div className="lesson-code-frame">
      {toggleable && (
        <div className="lesson-code-frame-controls" aria-label="Code preview view">
          <button
            type="button"
            className={`lesson-code-frame-tab${view === "code" ? " active" : ""}`}
            aria-pressed={view === "code"}
            onClick={() => setView("code")}
          >
            Code
          </button>
          <button
            type="button"
            className={`lesson-code-frame-tab${view === "result" ? " active" : ""}`}
            aria-pressed={view === "result"}
            onClick={() => setView("result")}
          >
            Result
          </button>
        </div>
      )}
      {toggleable && view === "code" ? (
        <pre className="lesson-code-source">
          <code>{source}</code>
        </pre>
      ) : (
        <iframe
          ref={frameRef}
          className={className}
          title={title}
          sandbox="allow-same-origin"
          srcDoc={source}
          onLoad={resizeFrame}
        />
      )}
    </div>
  );
}

export default function LessonCard({
  title = "",
  slides = [],
  className = "",
  interactive = true,
  slideIndex,
  onSlideIndexChange,
  showControls = true,
}: LessonCardProps) {
  const visibleSlides = slides.length > 0 ? slides : [{ lesson_text: "", lesson_code: "" }];
  const [internalSlideIndex, setInternalSlideIndex] = useState(0);
  const activeSlideIndex = slideIndex ?? internalSlideIndex;
  const setSlideIndex = (nextIndex: number) => {
    if (onSlideIndexChange) {
      onSlideIndexChange(nextIndex);
    } else {
      setInternalSlideIndex(nextIndex);
    }
  };

  const safeSlideIndex = Math.min(activeSlideIndex, visibleSlides.length - 1);
  const slide = visibleSlides[safeSlideIndex] ?? visibleSlides[0];
  const hasContent = Boolean(
    title || slide.lesson_title || slide.lesson_text || slide.lesson_code,
  );

  if (!hasContent) {
    return (
      <div className={`lesson-card lesson-card-empty ${className}`.trim()}>
        <p>Start typing to preview your lesson card.</p>
      </div>
    );
  }

  return (
    <div className={`lesson-card ${className}`.trim()}>
      {title && <h2>{title}</h2>}
      {slide.lesson_title && <h3 className="lesson-slide-title">{slide.lesson_title}</h3>}
      {slide.lesson_code && (
        <LessonCodeFrame
          className="lesson-code-preview"
          title={`Lesson code result, slide ${safeSlideIndex + 1}`}
          source={slide.lesson_code}
        />
      )}
      {slide.lesson_text && <div className="lesson-card-text">{slide.lesson_text}</div>}
      {showControls && visibleSlides.length > 1 && (
        <div className="lesson-slide-controls">
          <button
            type="button"
            className="lesson-slide-button"
            onClick={() => setSlideIndex(Math.max(0, safeSlideIndex - 1))}
            disabled={!interactive || safeSlideIndex === 0}
            aria-label="Previous lesson slide"
          >
            Previous
          </button>
          <span aria-live="polite">
            {safeSlideIndex + 1} / {visibleSlides.length}
          </span>
          <button
            type="button"
            className="lesson-slide-button"
            onClick={() => setSlideIndex(Math.min(visibleSlides.length - 1, safeSlideIndex + 1))}
            disabled={!interactive || safeSlideIndex === visibleSlides.length - 1}
            aria-label="Next lesson slide"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
