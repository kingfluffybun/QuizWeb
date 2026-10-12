"use client";

import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

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
  const cleanupFrameObservers = useRef<(() => void) | null>(null);
  const editorResizeFrame = useRef<number | null>(null);
  const [view, setView] = useState<"code" | "result">("result");
  const [editorHeight, setEditorHeight] = useState(180);

  const cancelEditorResize = () => {
    if (editorResizeFrame.current !== null) {
      window.cancelAnimationFrame(editorResizeFrame.current);
      editorResizeFrame.current = null;
    }
  };

  const resizeFrame = () => {
    const frame = frameRef.current;
    const frameWindow = frame?.contentWindow;
    const document = frameWindow?.document;
    if (!frame || !frameWindow || !document) {
      return;
    }

    cleanupFrameObservers.current?.();

    const updateHeight = () => {
      if (frame.contentDocument !== document) return;

      const contentHeight = Math.max(
        180,
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      if (frame.offsetHeight !== contentHeight) {
        frame.style.height = `${contentHeight}px`;
      }
    };

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(document.body);
    const mutationObserver = new MutationObserver(updateHeight);
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    frameWindow.addEventListener("resize", updateHeight);
    cleanupFrameObservers.current = () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      frameWindow.removeEventListener("resize", updateHeight);
    };

    updateHeight();
    void document.fonts?.ready.then(updateHeight);
  };

  useEffect(() => () => {
    cleanupFrameObservers.current?.();
    cancelEditorResize();
  }, []);

  return (
    <div className="lesson-code-frame">
      {toggleable && (
        <div className="lesson-code-frame-controls" aria-label="Code preview view">
          <button
            type="button"
            className={`lesson-code-frame-tab${view === "code" ? " active" : ""}`}
            aria-pressed={view === "code"}
            onClick={() => {
              cancelEditorResize();
              setView("code");
            }}
          >
            Code
          </button>
          <button
            type="button"
            className={`lesson-code-frame-tab${view === "result" ? " active" : ""}`}
            aria-pressed={view === "result"}
            onClick={() => {
              cancelEditorResize();
              setView("result");
            }}
          >
            Result
          </button>
        </div>
      )}
      {toggleable && view === "code" ? (
        <Editor
          className="lesson-code-editor"
          height={`${editorHeight}px`}
          width="100%"
          language="html"
          value={source}
          theme="vs"
          onMount={(editor) => {
            const updateHeight = () => {
              cancelEditorResize();
              editorResizeFrame.current = window.requestAnimationFrame(() => {
                editorResizeFrame.current = window.requestAnimationFrame(() => {
                  editorResizeFrame.current = null;
                  if (!editor.getDomNode()?.isConnected || editor.getLayoutInfo().width === 0) return;
                  setEditorHeight(Math.max(0, editor.getContentHeight()));
                });
              });
            };

            updateHeight();
            editor.onDidContentSizeChange(updateHeight);
          }}
          options={{
            readOnly: true,
            fontSize: 18,
            padding: { top: 16, bottom: 16 },
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
        />
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
      {title && <h1>{title}</h1>}
      {slide.lesson_code && (
        <LessonCodeFrame
          className="lesson-code-preview"
          title={`Lesson code result, slide ${safeSlideIndex + 1}`}
          source={slide.lesson_code}
        />
      )}
      <div className="lesson-text-container">
        {slide.lesson_title && <h1 className="lesson-slide-title">{slide.lesson_title}</h1>}
        {slide.lesson_text && <p className="lesson-card-text">{slide.lesson_text}</p>}
      </div>
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
