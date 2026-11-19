"use client";

import type { ReactNode } from "react";
import { LessonCodeFrame } from "@/app/components/LessonCard";
import type { LessonSlideState, StatusMessage } from "../types";

export interface SlideCodeEditorRenderProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

interface LessonSlidesTabProps {
  renderCodeEditor: (props: SlideCodeEditorRenderProps) => ReactNode;
  lessonSlides: LessonSlideState[];
  setLessonSlides: React.Dispatch<React.SetStateAction<LessonSlideState[]>>;
  currentLessonSlide: number;
  setCurrentLessonSlide: React.Dispatch<React.SetStateAction<number>>;
  lessonEditorView: "code" | "result";
  setLessonEditorView: React.Dispatch<React.SetStateAction<"code" | "result">>;
  onMessage: (message: StatusMessage) => void;
}

export default function LessonSlidesTab({
  renderCodeEditor,
  lessonSlides,
  setLessonSlides,
  currentLessonSlide,
  setCurrentLessonSlide,
  lessonEditorView,
  setLessonEditorView,
  onMessage,
}: LessonSlidesTabProps) {
  const handleAddSlide = () => {
    setLessonSlides((slides) => [...slides, { text: "" }]);
    setCurrentLessonSlide((idx) => idx + 1);
  };

  const handleRemoveSlide = (indexToRemove: number) => {
    if (lessonSlides.length <= 1) {
      onMessage({
        type: "error",
        text: "A unit must have at least one lesson slide.",
      });
      return;
    }
    setLessonSlides((slides) => slides.filter((_, idx) => idx !== indexToRemove));
    setCurrentLessonSlide((prev) =>
      Math.max(0, Math.min(prev, lessonSlides.length - 2)),
    );
    onMessage({ type: "success", text: "Lesson slide removed." });
  };

  const slide = lessonSlides[currentLessonSlide];
  const index = currentLessonSlide;

  return (
    <div className="lesson-slide-section">
      <div className="lesson-slide-heading">
        <h3>Lesson slide</h3>
        <button
          type="button"
          className="authoring-action-button authoring-action-button-primary lesson-slide-add"
          onClick={handleAddSlide}
          title="Add lesson slide"
          aria-label="Add lesson slide"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          <span className="lesson-slide-add-tooltip" role="tooltip">
            Add new slide
          </span>
        </button>
      </div>

      {slide && (
        <div className="lesson-slide-group">
          <div className="lesson-slide-fields">
            <div className="lesson-slide-number">Slide {index + 1}</div>
            {slide.code === undefined ? (
              <button
                type="button"
                className="lesson-code-toggle"
                onClick={() => {
                  setLessonEditorView("code");
                  setLessonSlides((slides) =>
                    slides.map((currentSlide, slideIndex) =>
                      slideIndex === index
                        ? { ...currentSlide, code: "" }
                        : currentSlide,
                    ),
                  );
                }}
              >
                Add code feature
              </button>
            ) : (
              <div className="lesson-code-editor">
                <div className="lesson-code-header">
                  <button
                    type="button"
                    className="lesson-code-remove"
                    onClick={() => {
                      setLessonSlides((slides) =>
                        slides.map((currentSlide, slideIndex) => {
                          if (slideIndex !== index) return currentSlide;
                          const { code: _removed, ...rest } = currentSlide;
                          void _removed;
                          return rest;
                        }),
                      );
                    }}
                  >
                    Remove code
                  </button>
                  <div
                    className="lesson-code-tabs"
                    role="tablist"
                    aria-label={`Slide ${index + 1} code and result`}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={lessonEditorView === "code"}
                      className={`lesson-code-tab${lessonEditorView === "code" ? " active" : ""}`}
                      onClick={() => setLessonEditorView("code")}
                    >
                      Code
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={lessonEditorView === "result"}
                      className={`lesson-code-tab${lessonEditorView === "result" ? " active" : ""}`}
                      onClick={() => setLessonEditorView("result")}
                    >
                      Result
                    </button>
                  </div>
                </div>
                <div className="lesson-code-panel">
                  {lessonEditorView === "code" ? (
                    renderCodeEditor({
                      value: slide.code ?? "",
                      onChange: (code) => {
                        setLessonSlides((slides) =>
                          slides.map((currentSlide, slideIndex) =>
                            slideIndex === index
                              ? { ...currentSlide, code }
                              : currentSlide,
                          ),
                        );
                      },
                      ariaLabel: `HTML code for slide ${index + 1}`,
                    })
                  ) : (
                    <LessonCodeFrame
                      className="lesson-code-result"
                      title={`Slide ${index + 1} code result`}
                      source={slide.code}
                      toggleable={false}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor={`lesson_title_${index}`}>Slide Title</label>
              <input
                id={`lesson_title_${index}`}
                name={`lesson_title_${index}`}
                className="form-input"
                placeholder="Enter a title for this slide..."
                value={slide.title ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setLessonSlides((slides) =>
                    slides.map((currentSlide, slideIndex) =>
                      slideIndex === index
                        ? { ...currentSlide, title: value }
                        : currentSlide,
                    ),
                  );
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor={`lesson_text_${index}`}>Lesson Text</label>
              <textarea
                id={`lesson_text_${index}`}
                name={`lesson_text_${index}`}
                className="form-textarea"
                placeholder="Enter the lesson text content here..."
                rows={8}
                value={slide.text}
                onChange={(event) => {
                  const value = event.target.value;
                  setLessonSlides((slides) =>
                    slides.map((currentSlide, slideIndex) =>
                      slideIndex === index
                        ? { ...currentSlide, text: value }
                        : currentSlide,
                    ),
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Slides:</span>
        {lessonSlides.map((_, idx) => (
          <button
            key={idx}
            type="button"
            className={`btn-secondary${idx === currentLessonSlide ? " active" : ""}`}
            style={{
              padding: "4px 10px",
              fontSize: "0.82rem",
              borderRadius: "6px",
              border:
                idx === currentLessonSlide
                  ? "2px solid var(--primary-color, #9966ff)"
                  : undefined,
              fontWeight: 500,
            }}
            onClick={() => setCurrentLessonSlide(idx)}
          >
            Slide {idx + 1}
          </button>
        ))}
      </div>

      <div
        className="lesson-slide-navigation"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            className="authoring-action-button authoring-action-button-primary lesson-slide-nav-button"
            onClick={() => setCurrentLessonSlide((idx) => Math.max(0, idx - 1))}
            disabled={currentLessonSlide === 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="authoring-action-button authoring-action-button-primary lesson-slide-nav-button"
            onClick={() =>
              setCurrentLessonSlide((idx) =>
                Math.min(lessonSlides.length - 1, idx + 1),
              )
            }
            disabled={currentLessonSlide >= lessonSlides.length - 1}
          >
            Next
          </button>
          <span className="lesson-slide-counter">
            Slide {currentLessonSlide + 1} of {lessonSlides.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lessonSlides.length > 1 && (
            <button
              type="button"
              className="authoring-action-button authoring-action-button-danger"
              onClick={() => handleRemoveSlide(currentLessonSlide)}
            >
              Remove Slide
            </button>
          )}
          <button
            type="button"
            className="authoring-action-button authoring-action-button-primary"
            onClick={handleAddSlide}
          >
            + Add Slide
          </button>
        </div>
      </div>
    </div>
  );
}
