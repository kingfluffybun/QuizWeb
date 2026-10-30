"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "180px",
        minHeight: "180px",
        maxHeight: "180px",
        width: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        background: "#1e1e1e",
      }}
      className="lesson-code-editor animate-pulse flex items-center justify-center text-neutral-500 text-xs"
    >
      Loading code editor...
    </div>
  ),
});

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
  language?: string;
  toggleable?: boolean;
  editorOnly?: boolean;
};

const previewSizeReporter = `<script>
(() => {
  const reportSize = () => {
    const height = Math.ceil(Math.max(
      document.documentElement?.scrollHeight ?? 0,
      document.body?.scrollHeight ?? 0,
    ));
    parent.postMessage({ type: "lesson-preview-size", height }, "*");
  };

  const resizeObserver = new ResizeObserver(reportSize);
  resizeObserver.observe(document.documentElement);
  if (document.body) resizeObserver.observe(document.body);

  new MutationObserver(reportSize).observe(document.documentElement, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  addEventListener("load", reportSize);
  addEventListener("resize", reportSize);
  addEventListener("message", (event) => {
    if (event.data?.type === "lesson-preview-request-size") reportSize();
  });
  document.fonts?.ready.then(reportSize);
  reportSize();
})();
</script>`;

function addPreviewSizeReporter(source: string) {
  const closingBodyTag = /<\/body\s*>/i;
  return closingBodyTag.test(source)
    ? source.replace(closingBodyTag, `${previewSizeReporter}$&`)
    : `${source}${previewSizeReporter}`;
}

function splitLessonSentences(text: string) {
  return text.split(/(?<=[.!?])\s+/u).map((sentence) => sentence.trim()).filter(Boolean);
}

function renderLessonText(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function LessonCodeFrame({
  className,
  title,
  source,
  language = "html",
  toggleable = true,
  editorOnly = false,
}: LessonCodeFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const editorResizeFrame = useRef<number | null>(null);
  const editorContentSizeListener = useRef<{ dispose: () => void } | null>(null);
  const editorWindowResizeListener = useRef<(() => void) | null>(null);
  const [view, setView] = useState<"code" | "result">("code");
  const [editorHeight, setEditorHeight] = useState(180);
  const [editorFontSize, setEditorFontSize] = useState(16);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const updateFontSize = () => setEditorFontSize(mobileQuery.matches ? 12 : 16);

    updateFontSize();
    mobileQuery.addEventListener("change", updateFontSize);
    return () => mobileQuery.removeEventListener("change", updateFontSize);
  }, []);

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent<unknown>) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      if (
        typeof event.data !== "object" ||
        event.data === null ||
        !("type" in event.data) ||
        event.data.type !== "lesson-preview-size" ||
        !("height" in event.data) ||
        typeof event.data.height !== "number" ||
        !Number.isFinite(event.data.height)
      ) {
        return;
      }

      const height = Math.max(180, Math.ceil(event.data.height));
      frame.style.height = `${height}px`;
    };

    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, []);

  const cancelEditorResize = () => {
    if (editorResizeFrame.current !== null) {
      window.cancelAnimationFrame(editorResizeFrame.current);
      editorResizeFrame.current = null;
    }
  };

  useEffect(() => () => {
    editorContentSizeListener.current?.dispose();
    if (editorWindowResizeListener.current) {
      window.removeEventListener("resize", editorWindowResizeListener.current);
    }
    cancelEditorResize();
  }, []);

  return (
    <div className="lesson-code-frame">
      {(toggleable || editorOnly) && (
        <div className="lesson-code-frame-controls" aria-label="Code preview view">
            <div className="window-controls">
                <div className="circle"></div>
                <div className="circle"></div>
                <div className="circle"></div>
            </div>
            {toggleable && !editorOnly && (
              <div className="lesson-code-frame-controls-pill">
                  <button type="button" className={`lesson-code-frame-tab${view === "code" ? " active" : ""}`} aria-pressed={view === "code"} onClick={() => { cancelEditorResize(); setView("code"); }} > <p>Code</p> </button>
                  <button type="button" className={`lesson-code-frame-tab${view === "result" ? " active" : ""}`} aria-pressed={view === "result"} onClick={() => { cancelEditorResize(); setView("result"); }} > <p>Result</p> </button>
              </div>
            )}
        </div>
      )}
      {editorOnly || (toggleable && view === "code") ? (
        <Editor
          className={`lesson-code-editor${className ? ` ${className}` : ""}`}
          height={`${editorHeight}px`}
          width="100%"
          language={language}
          value={source}
          theme="vs-dark"
          onMount={(editor) => {
            const updateHeight = () => {
              cancelEditorResize();
              editorResizeFrame.current = window.requestAnimationFrame(() => {
                editorResizeFrame.current = null;
                if (!editor.getDomNode()?.isConnected || editor.getLayoutInfo().width === 0) return;

                const isMobile = window.matchMedia("(max-width: 768px)").matches;
                if (editorOnly && isMobile) {
                  const maxMobileHeight = Math.max(180, window.innerHeight * 0.7);
                  setEditorHeight(Math.max(120, Math.min(editor.getContentHeight(), maxMobileHeight)));
                  return;
                }

                const maxHeight = Math.max(180, Math.min(360, window.innerHeight * 0.4));
                setEditorHeight(Math.max(180, Math.min(editor.getContentHeight(), maxHeight)));
              });
            };

            editorContentSizeListener.current = editor.onDidContentSizeChange(updateHeight);
            editorWindowResizeListener.current = updateHeight;
            window.addEventListener("resize", updateHeight);
            updateHeight();
          }}
          options={{
            readOnly: true,
            fontSize: editorFontSize,
            padding: { top: 24, bottom: 24 },
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "off",
            renderLineHighlight: 'none',
            showDeprecated: false,
          }}
        />
      ) : (
        <iframe
          ref={frameRef}
          className={className}
          title={title}
          sandbox="allow-scripts"
          srcDoc={addPreviewSizeReporter(source)}
          onLoad={() => {
            frameRef.current?.contentWindow?.postMessage(
              { type: "lesson-preview-request-size" },
              "*",
            );
          }}
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
        {slide.lesson_text && (
          <div className="lesson-card-text">
            {splitLessonSentences(slide.lesson_text).map((sentence, index) => (
              <p key={`${index}-${sentence}`}>
                {renderLessonText(sentence)}
              </p>
            ))}
          </div>
        )}
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
