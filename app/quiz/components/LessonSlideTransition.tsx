"use client";

import { useState, type AnimationEvent, type ReactNode } from "react";

interface LessonSlideTransitionProps {
  slideIndex: number;
  slideCount: number;
  slideHasCode: (index: number) => boolean;
  renderSlide: (index: number) => ReactNode;
}

export default function LessonSlideTransition({
  slideIndex,
  slideCount,
  slideHasCode,
  renderSlide,
}: LessonSlideTransitionProps) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(slideIndex);
  const incomingSlideIndex = activeSlideIndex === slideIndex ? null : slideIndex;
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

  // Mount only the active slide and the exiting slide during a transition
  const visibleIndexes: number[] = [];
  if (activeSlideIndex >= 0 && activeSlideIndex < slideCount) {
    visibleIndexes.push(activeSlideIndex);
  }
  if (
    incomingSlideIndex !== null &&
    incomingSlideIndex !== activeSlideIndex &&
    incomingSlideIndex >= 0 &&
    incomingSlideIndex < slideCount
  ) {
    visibleIndexes.push(incomingSlideIndex);
  }
  if (visibleIndexes.length === 0 && slideCount > 0) {
    visibleIndexes.push(Math.min(Math.max(0, slideIndex), slideCount - 1));
  }

  return (
    <div className="lesson-slide-transition">
      {visibleIndexes.map((index) => {
        const isEntering = incomingSlideIndex === index;
        const isExiting = incomingSlideIndex !== null && activeSlideIndex === index;
        const isExitingToText =
          isExiting &&
          incomingSlideIndex !== null &&
          !slideHasCode(incomingSlideIndex);

        return (
          <div
            key={`slide-${index}`}
            className={`lesson-slide-layer${isEntering ? " is-entering" : ""}${
              isExiting ? " is-exiting" : ""
            }${isExitingToText ? " is-exiting-to-text" : ""}${
              isMovingBackward && (isEntering || isExiting) ? " is-backward" : ""
            }`}
            aria-hidden={isExiting}
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
