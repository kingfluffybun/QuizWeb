"use client";

import { useState } from "react";

export type LessonSlide = {
  lesson_text?: string;
  lesson_code?: string;
};

type LessonCardProps = {
  title?: string;
  slides?: LessonSlide[];
  className?: string;
  interactive?: boolean;
};

function centeredLessonDocument(source: string) {
  const centeringStyles = `
    <style>
      html, body {
        min-height: 100%;
        overflow: hidden !important;
      }
      body {
        min-height: 180px;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        overflow-x: hidden;
      }
      *, *::before, *::after {
        box-sizing: border-box;
        max-width: 100%;
      }
    </style>
  `;

  if (/<\/head\s*>/i.test(source)) {
    return source.replace(/<\/head\s*>/i, `${centeringStyles}</head>`);
  }

  return `${centeringStyles}${source}`;
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
  const hasContent = Boolean(title || slide.lesson_text || slide.lesson_code);

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
      {slide.lesson_code && (
        <iframe
          className="lesson-code-preview"
          title={`Lesson code result, slide ${safeSlideIndex + 1}`}
          sandbox=""
          scrolling="no"
          srcDoc={centeredLessonDocument(slide.lesson_code)}
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
