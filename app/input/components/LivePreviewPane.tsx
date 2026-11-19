"use client";

import { useEffect, useRef, useState } from "react";
import type { CPStep } from "@/lib/cp-constants";
import LessonCard from "@/app/components/LessonCard";
import { AssessmentLivePreview } from "../AssessmentStepBuilder";
import type { LessonSlideState, PreviewTab } from "../types";

function PreviewHeightTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(content);
    setHeight(content.getBoundingClientRect().height);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="lesson-preview-height"
      style={{ height: height === null ? "auto" : `${height}px` }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

interface LivePreviewPaneProps {
  previewTab: PreviewTab;
  setPreviewTab: (tab: PreviewTab) => void;
  unitTitle: string;
  lessonSlides: LessonSlideState[];
  currentLessonSlide: number;
  setCurrentLessonSlide: React.Dispatch<React.SetStateAction<number>>;
  assessmentTitle: string;
  assessmentDescription: string;
  expectedOutcome: string;
  cpSteps: CPStep[];
}

export default function LivePreviewPane({
  previewTab,
  setPreviewTab,
  unitTitle,
  lessonSlides,
  currentLessonSlide,
  setCurrentLessonSlide,
  assessmentTitle,
  assessmentDescription,
  expectedOutcome,
  cpSteps,
}: LivePreviewPaneProps) {
  return (
    <div className="lesson-preview-card admin-card">
      <div className="lesson-preview-heading">
        <div>
          <p className="lesson-preview-kicker">Live preview</p>
          <h2>{previewTab === "lesson" ? "Lesson Card" : "Assessment"}</h2>
        </div>
        <div className="preview-tabs" role="group" aria-label="Live preview view">
          <button
            type="button"
            className={`preview-tab${previewTab === "lesson" ? " active" : ""}`}
            aria-pressed={previewTab === "lesson"}
            onClick={() => setPreviewTab("lesson")}
          >
            Lesson
          </button>
          <button
            type="button"
            className={`preview-tab${previewTab === "assessment" ? " active" : ""}`}
            aria-pressed={previewTab === "assessment"}
            onClick={() => setPreviewTab("assessment")}
          >
            Assessment
          </button>
        </div>
      </div>

      <PreviewHeightTransition>
        {previewTab === "lesson" ? (
          <div>
            <LessonCard
              title={unitTitle}
              slides={lessonSlides.map((slide) => ({
                ...(slide.title !== undefined ? { lesson_title: slide.title } : {}),
                lesson_text: slide.text,
                ...(slide.code !== undefined ? { lesson_code: slide.code } : {}),
              }))}
              slideIndex={currentLessonSlide}
              onSlideIndexChange={setCurrentLessonSlide}
              showControls={false}
              className="lesson-preview-surface"
            />
          </div>
        ) : (
          <AssessmentLivePreview
            assessmentTitle={assessmentTitle}
            assessmentDescription={assessmentDescription}
            expectedOutcome={expectedOutcome}
            cpSteps={cpSteps}
          />
        )}
      </PreviewHeightTransition>
    </div>
  );
}
