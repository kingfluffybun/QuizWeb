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
};

type LessonCodeFrameProps = {
  className: string;
  title: string;
  source: string;
};

export function LessonCodeFrame({
  className,
  title,
  source,
}: LessonCodeFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

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
    <iframe
      ref={frameRef}
      className={className}
      title={title}
      sandbox="allow-same-origin"
      srcDoc={source}
      onLoad={resizeFrame}
    />
  );
}

export default function LessonCard({
  title = "",
  slides = [],
  className = "",
  interactive = true,
}: LessonCardProps) {
  const visibleSlides = slides.length > 0 ? slides : [{ lesson_text: "", lesson_code: "" }];
  const [slideIndex, setSlideIndex] = useState(0);

  const safeSlideIndex = Math.min(slideIndex, visibleSlides.length - 1);
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
      {visibleSlides.length > 1 && (
        <div className="lesson-slide-controls">
          <button
            type="button"
            className="lesson-slide-button"
            onClick={() => setSlideIndex((index) => Math.max(0, index - 1))}
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
            onClick={() =>
              setSlideIndex((index) => Math.min(visibleSlides.length - 1, index + 1))
            }
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
