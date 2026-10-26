"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: "100%", width: "100%", background: "#1e1e1e" }}
      className="monaco-code-editor animate-pulse flex items-center justify-center text-neutral-400 text-sm"
    >
      Loading editor...
    </div>
  ),
});
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getPublicCodeProblem,
  verifyCodeProblemStep,
} from "@/app/actions/cp-engine";
import { recordUserActivity } from "@/app/actions/streak";
import { getClientLocalDate } from "@/lib/timezone";
import Sidebar from "@/app/components/Sidebar";
import { useQuizSounds } from "@/app/quiz/useQuizSounds";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";
import type { CPFileBuffers, PublicCodeProblem } from "@/lib/cp-schema";
import "#css/quiz.css";
import "#css/sidebar.css";

const defaultFiles: CPFileBuffers = {
  html: "",
  css: "",
  js: "",
};

const fileOrder = ["html", "css", "js"] as const;
type FileKey = (typeof fileOrder)[number];

type ConsoleMessage = {
  level: "log" | "warn" | "error";
  text: string;
};

type StepFeedback = {
  passed: boolean;
  message: string;
  failedTab?: FileKey;
  lineNumber?: number;
};

type PersistedCPSession = {
  currentStepIndex: number;
  code: CPFileBuffers;
  stepSnapshots: Record<number, CPFileBuffers>;
  lives: number;
};

type MobileTab = "task" | "code" | "preview";

const MOBILE_QUERY = "(max-width: 768px)";

function subscribeMobileViewport(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getMobileViewportServerSnapshot() {
  return false;
}

function updatePreviewDocument(
  frame: HTMLIFrameElement | null,
  html: string,
  css: string,
) {
  const previewDocument = frame?.contentDocument;
  const previewRoot = previewDocument?.getElementById("quiz-preview-root");
  const previewStyles = previewDocument?.getElementById("quiz-preview-styles");
  if (!previewRoot || !previewStyles) return;

  previewRoot.innerHTML = html;
  previewStyles.textContent = css;
}

function getEditorThemeSnapshot(): "vs" | "vs-dark" {
  const selectedTheme = document.documentElement.getAttribute("data-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return selectedTheme === "dark" ||
    (selectedTheme === "system" && prefersDark)
    ? "vs-dark"
    : "vs";
}

function getEditorThemeServerSnapshot(): "vs" | "vs-dark" {
  return "vs";
}

function subscribeEditorTheme(onChange: () => void) {
  const root = document.documentElement;
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(onChange);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  colorScheme.addEventListener("change", onChange);

  return () => {
    observer.disconnect();
    colorScheme.removeEventListener("change", onChange);
  };
}

// Quick-symbol bar shown above the soft keyboard on phones.
const QUICK_SYMBOLS = [
  "<", ">", "/", "=", '"', "'", "{", "}", "(", ")", ";", ":", "#", ".",
] as const;
const TAB_INDENT = "    ";

function getSessionStorageKey(unitId: number): string {
  return `quizweb:cp-session:v2:${unitId}`;
}

function CodeProblemRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playQuizSound = useQuizSounds();

  const unitIdParam = searchParams.get("unitId");
  const requestedUnitId =
    unitIdParam && Number.isFinite(Number(unitIdParam))
      ? Number(unitIdParam)
      : undefined;

  const [problem, setProblem] = useState<PublicCodeProblem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const editorTheme = useSyncExternalStore(
    subscribeEditorTheme,
    getEditorThemeSnapshot,
    getEditorThemeServerSnapshot,
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeFile, setActiveFile] = useState<FileKey>("html");
  const [code, setCode] = useState<CPFileBuffers>(defaultFiles);
  const [stepSnapshots, setStepSnapshots] = useState<
    Record<number, CPFileBuffers>
  >({});

  const [lives, setLives] = useState(5);
  const [status, setStatus] = useState<"active" | "completed" | "gameover">(
    "active",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepFeedback, setStepFeedback] = useState<StepFeedback | null>(null);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>(
    {},
  );
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  // Phone layout: tabbed Task | Code | Preview workspace (desktop is unchanged).
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    getMobileViewportServerSnapshot,
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("task");
  const [isTyping, setIsTyping] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLPreElement>(null);

  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const initializedPreviewDocumentRef = useRef<Document | null>(null);

  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);

  const openAccessibility = () => {
    setAccessibilityClosing(false);
    setAccessibilityOpen(true);
  };

  const closeAccessibility = () => setAccessibilityClosing(true);

  const finishClosingAccessibility = () => {
    setAccessibilityOpen(false);
    setAccessibilityClosing(false);
  };

  // Track the *visual* viewport so the action bar stays above the iOS Safari
  // soft keyboard / bottom URL bar instead of hiding behind them.
  useEffect(() => {
    if (!isMobileViewport) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--cp-vh", `${viewport.height}px`);
      if (viewport.offsetTop > 0) window.scrollTo(0, 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--cp-vh");
    };
  }, [isMobileViewport]);

  const [prevUnitId, setPrevUnitId] = useState(requestedUnitId);
  if (requestedUnitId !== prevUnitId) {
    setPrevUnitId(requestedUnitId);
    setIsLoading(true);
    setLoadError(null);
  }

  // Fetch public problem definition (with expectedTemplate stripped on server)
  useEffect(() => {
    let isActive = true;

    getPublicCodeProblem(requestedUnitId)
      .then((loadedProblem) => {
        if (!isActive) return;
        if (!loadedProblem || loadedProblem.steps.length === 0) {
          setProblem(null);
          setLoadError("No coding problem is available for this unit yet.");
          return;
        }

        setProblem(loadedProblem);
        const firstStepStarter = loadedProblem.steps[0]?.starterCode ?? defaultFiles;

        // Restore in-progress session from sessionStorage if present
        if (typeof window !== "undefined") {
          try {
            const rawSaved = window.sessionStorage.getItem(
              getSessionStorageKey(loadedProblem.unit_id),
            );
            if (rawSaved) {
              const parsed = JSON.parse(rawSaved) as PersistedCPSession;
              if (
                typeof parsed.currentStepIndex === "number" &&
                parsed.currentStepIndex >= 0 &&
                parsed.currentStepIndex < loadedProblem.steps.length &&
                parsed.code &&
                typeof parsed.lives === "number" &&
                parsed.lives > 0
              ) {
                setCurrentStepIndex(parsed.currentStepIndex);
                setCode(parsed.code);
                setStepSnapshots(parsed.stepSnapshots ?? {});
                setLives(parsed.lives);
                return;
              }
            }
          } catch {
            // Fall through to fresh initialization
          }
        }

        setCurrentStepIndex(0);
        setCode({ ...firstStepStarter });
        setStepSnapshots({});
        setLives(5);
        setStatus("active");
        setStepFeedback(null);
      })
      .catch(() => {
        if (isActive) {
          setLoadError("Unable to load the coding assessment.");
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [requestedUnitId]);

  // Persist active progress in sessionStorage so refreshes don't lose student code
  useEffect(() => {
    if (!problem || status !== "active" || typeof window === "undefined") {
      return;
    }
    try {
      const payload: PersistedCPSession = {
        currentStepIndex,
        code,
        stepSnapshots,
        lives,
      };
      window.sessionStorage.setItem(
        getSessionStorageKey(problem.unit_id),
        JSON.stringify(payload),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [problem, status, currentStepIndex, code, stepSnapshots, lives]);

  useEffect(() => {
    updatePreviewDocument(previewFrameRef.current, code.html, code.css);
  }, [code.css, code.html]);

  const initializePreview = () => {
    const previewWindow = previewFrameRef.current?.contentWindow;
    const previewDocument = previewFrameRef.current?.contentDocument;
    if (
      !previewWindow ||
      !previewDocument ||
      initializedPreviewDocumentRef.current === previewDocument
    ) {
      return;
    }

    initializedPreviewDocumentRef.current = previewDocument;
    const consoleBridge = previewDocument.createElement("script");
    if (consoleBridge) {
      consoleBridge.textContent = `(() => {
        const formatValue = (value) => {
          if (typeof value === "string") return value;
          try {
            const serialized = JSON.stringify(value);
            return serialized === undefined ? String(value) : serialized;
          } catch {
            return String(value);
          }
        };
        ["log", "warn", "error"].forEach((level) => {
          const original = console[level].bind(console);
          console[level] = (...args) => {
            parent.postMessage({
              source: "quiz-preview-console",
              level,
              text: args.map(formatValue).join(" ")
            }, "*");
            original(...args);
          };
        });
        window.addEventListener("error", (event) => {
          parent.postMessage({
            source: "quiz-preview-console",
            level: "error",
            text: event.message
          }, "*");
        });
      })();`;
      previewDocument.body.appendChild(consoleBridge);
    }
    updatePreviewDocument(previewFrameRef.current, code.html, code.css);
  };

  useEffect(() => {
    const handlePreviewMessage = (event: MessageEvent) => {
      if (event.source !== previewFrameRef.current?.contentWindow) return;

      const data = event.data;
      if (
        !data ||
        data.source !== "quiz-preview-console" ||
        !["log", "warn", "error"].includes(data.level) ||
        typeof data.text !== "string"
      ) {
        return;
      }

      setConsoleMessages((messages) => [
        ...messages,
        { level: data.level as ConsoleMessage["level"], text: data.text },
      ]);
    };

    window.addEventListener("message", handlePreviewMessage);
    return () => window.removeEventListener("message", handlePreviewMessage);
  }, []);

  const fileMeta: Record<
    FileKey,
    { label: string; language: "html" | "css" | "javascript" }
  > = {
    html: { label: "index.html", language: "html" },
    css: { label: "style.css", language: "css" },
    js: { label: "script.js", language: "javascript" },
  };

  // Free Run Code action (0 heart loss)
  const handleRunCode = () => {
    if (activeFile !== "js") return;
    setConsoleMessages([]);
    updatePreviewDocument(previewFrameRef.current, code.html, code.css);
    const previewDocument = previewFrameRef.current?.contentDocument;
    if (previewDocument && code.js.trim()) {
      const script = previewDocument.createElement("script");
      script.textContent = `(() => {\n${code.js}\n})();`;
      previewDocument.body.appendChild(script);
    }
    if (isMobileViewport) {
      editorRef.current?.blur();
      setMobileTab("preview");
    }
  };

  // Insert text at the caret of the mobile editor (quick-symbol bar / Tab key)
  const insertAtCursor = (token: string) => {
    const element = editorRef.current;
    const current = code[activeFile];
    const start = element?.selectionStart ?? current.length;
    const end = element?.selectionEnd ?? start;
    const next = current.slice(0, start) + token + current.slice(end);
    setCode((previous) => ({ ...previous, [activeFile]: next }));
    const caret = start + token.length;
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      element.setSelectionRange(caret, caret);
    });
  };

  // Reset current step back to its starting snapshot
  const handleResetStep = () => {
    if (!problem) return;
    const currentStep = problem.steps[currentStepIndex];
    if (!currentStep) return;

    const previousSnapshot = stepSnapshots[currentStepIndex - 1];
    const baseline: CPFileBuffers =
      currentStep.inheritPreviousCode &&
      currentStepIndex > 0 &&
      previousSnapshot
        ? { ...previousSnapshot }
        : { ...currentStep.starterCode };

    setConsoleMessages([]);
    setCode(baseline);
    setStepFeedback(null);
  };

  // Restart entire assessment after completion or Game Over
  const handleRestartAssessment = () => {
    if (!problem) return;
    const firstStepStarter = problem.steps[0]?.starterCode ?? defaultFiles;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(getSessionStorageKey(problem.unit_id));
    }
    setCurrentStepIndex(0);
    setCode({ ...firstStepStarter });
    setStepSnapshots({});
    setLives(5);
    setStatus("active");
    setStepFeedback(null);
    setConsoleMessages([]);
  };

  // Submit current step for server-side structural & wildcard validation
  const handleSubmitStep = async () => {
    if (!problem || isSubmitting || status !== "active") return;

    setIsSubmitting(true);
    setStepFeedback(null);
    setConsoleMessages([]);

    try {
      const result = await verifyCodeProblemStep({
        unitId: problem.unit_id,
        stepIndex: currentStepIndex,
        studentCode: code,
      });

      if (result.passed) {
        const updatedSnapshots = {
          ...stepSnapshots,
          [currentStepIndex]: { ...code },
        };
        setStepSnapshots(updatedSnapshots);

        if (result.isFinalStep) {
          playQuizSound("lesson-complete");
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(
              getSessionStorageKey(problem.unit_id),
            );
          }
          setStatus("completed");
          recordUserActivity({
            type: "quiz",
            xp: 50,
            date: getClientLocalDate(),
          }).catch((err) => {
            console.error("Failed to record CP assessment XP:", err);
          });
        } else {
          playQuizSound("correct-answer1");
          const nextIdx = result.nextStepIndex ?? currentStepIndex + 1;
          const nextStep = problem.steps[nextIdx];
          setCurrentStepIndex(nextIdx);
          setStepFeedback({
            passed: true,
            message: `Step ${currentStepIndex + 1} passed! Now complete Step ${nextIdx + 1}.`,
          });

          if (nextStep && !nextStep.inheritPreviousCode) {
            const nextStarter = { ...nextStep.starterCode };
            setCode(nextStarter);
          }
        }
      } else {
        playQuizSound("wrong-answer");
        const nextLives = Math.max(0, lives - 1);
        setLives(nextLives);
        setStepFeedback({
          passed: false,
          message: result.message,
          failedTab: result.failedTab,
          lineNumber: result.failedLine,
        });
        if (result.failedTab) {
          setActiveFile(result.failedTab);
        }
        if (isMobileViewport) setMobileTab("code");
        if (nextLives <= 0) {
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem(
              getSessionStorageKey(problem.unit_id),
            );
          }
          setStatus("gameover");
        }
      }
    } catch {
      setStepFeedback({
        passed: false,
        message: "Unable to verify your code right now. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const submitStepRef = useRef(handleSubmitStep);
  useEffect(() => {
    submitStepRef.current = handleSubmitStep;
  });

  if (status === "completed" || status === "gameover") {
    const isVictory = status === "completed";
    return (
      <div className="quiz-page quiz-no-footer-page">
        <Sidebar />
        <main className="quiz-completion-main">
          <div className="quiz-complete-card">
            <h1>{isVictory ? "Assessment Complete!" : "Game Over"}</h1>
            <h2>
              {isVictory
                ? `${problem?.steps.length ?? 0} / ${problem?.steps.length ?? 0} Steps Passed (+50 XP)`
                : `Step ${currentStepIndex + 1} of ${problem?.steps.length ?? 1}`}
            </h2>
            <p className="quiz-completion-message">
              {isVictory
                ? problem?.expected_outcome ||
                  "Outstanding work! You built and verified every step of the coding assessment."
                : stepFeedback?.message ||
                  "You ran out of hearts. Review the step instructions and try again!"}
            </p>
            <button
              className="options"
              id="submit"
              type="button"
              onClick={handleRestartAssessment}
            >
              {isVictory ? "Practice Again" : "Try Again"}
            </button>
            <Link href="/learn" className="options back-to-input-btn">
              Back to Curriculum
            </Link>
            <Link href="/home" className="options back-to-input-btn">
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const totalSteps = problem?.steps.length ?? 1;

  return (
    <div className="quiz-page" id="code-problem">
      <Sidebar />
      <main>
        <div className="quiz-header" style={{ maxWidth: "100%" }}>
          <div className="quiz-navigation">
            <button
              type="button"
              className="quiz-settings-button"
              data-accessibility-trigger
              aria-label={
                accessibilityOpen
                  ? "Close accessibility options"
                  : "Open accessibility options"
              }
              onClick={
                accessibilityOpen ? closeAccessibility : openAccessibility
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button
              type="button"
              className="quiz-close-button"
              aria-label="Exit coding assessment"
              onClick={() => router.push("/learn")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <div className="progress-container" aria-label="Assessment step progress">
              {Array.from({ length: totalSteps }, (_, idx) => (
                <div
                  key={idx}
                  className={idx <= currentStepIndex ? "active" : undefined}
                />
              ))}
            </div>
            <div
              className="heart-container"
              data-lives={lives}
              title={`${lives} of 5 hearts remaining`}
              aria-label={`${lives} of 5 hearts remaining`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
            </div>
          </div>
        </div>

        {(accessibilityOpen || accessibilityClosing) && (
          <div
            className={`accessibility-dialog${accessibilityClosing ? " is-closing" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="Accessibility settings"
          >
            <div
              className="accessibility-dialog-card"
              onAnimationEnd={() => {
                if (accessibilityClosing) finishClosingAccessibility();
              }}
            >
              <AccessibilityPanel onClose={closeAccessibility} />
            </div>
          </div>
        )}

        <div
          className="cp-workspace"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            flexDirection: "column",
            gap: "20px",
            flex: "1",
            minHeight: "0",
          }}
        >
          {problem && problem.steps[currentStepIndex] && (
            <div
              className={`cp-mobile-banner${
                stepFeedback && !stepFeedback.passed ? " is-error" : ""
              }${isTyping ? " is-typing" : ""}`}
              role="status"
              aria-live="polite"
            >
              <span className="cp-mobile-banner-step">
                Step {currentStepIndex + 1}/{totalSteps}
              </span>
              <div className="cp-mobile-banner-body">
                <div className="cp-mobile-banner-text">
                  {problem.steps[currentStepIndex].instruction}
                </div>
                {revealedHints[currentStepIndex] &&
                  problem.steps[currentStepIndex].hint && (
                    <div className="cp-mobile-banner-note">
                      <strong>Hint:</strong> {problem.steps[currentStepIndex].hint}
                    </div>
                  )}
                {stepFeedback && (
                  <div
                    className={`cp-mobile-banner-note ${
                      stepFeedback.passed ? "is-success" : "is-fail"
                    }`}
                  >
                    {stepFeedback.passed
                      ? ""
                      : `Check failed (-1 heart)${
                          stepFeedback.lineNumber
                            ? ` • near line ${stepFeedback.lineNumber}`
                            : ""
                        }: `}
                    {stepFeedback.message}
                  </div>
                )}
              </div>
              {problem.steps[currentStepIndex].hint && (
                <button
                  type="button"
                  className="cp-mobile-banner-hint"
                  aria-label={
                    revealedHints[currentStepIndex] ? "Hide hint" : "Show hint"
                  }
                  onClick={() =>
                    setRevealedHints((prev) => ({
                      ...prev,
                      [currentStepIndex]: !prev[currentStepIndex],
                    }))
                  }
                >
                  💡
                </button>
              )}
            </div>
          )}

          <div className="cp-mobile-tabs" role="tablist" aria-label="Workspace view">
            {(
              [
                ["task", "Task"],
                ["code", "Code"],
                ["preview", "Preview"],
              ] as const
            ).map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={mobileTab === tabKey}
                className={`cp-mobile-tab${mobileTab === tabKey ? " active" : ""}`}
                onClick={() => {
                  editorRef.current?.blur();
                  setMobileTab(tabKey);
                }}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          <div className="code-problem-layout" data-mobile-tab={mobileTab}>
            <div id="instructions">
              <div className="header">
                <div>
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
                    className="lucide lucide-list-ordered"
                  >
                    <path d="M11 5h10" />
                    <path d="M11 12h10" />
                    <path d="M11 19h10" />
                    <path d="M4 4h1v5" />
                    <path d="M4 9h2" />
                    <path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />
                  </svg>
                  <div style={{display: "flex", width: "100%", justifyContent: "space-between"}}>
                    <h2>{problem?.title ? problem.title : "Instructions"}{" "}</h2>
                    {/* <h2>{problem ? `Step ${currentStepIndex + 1}/${problem.steps.length}` : ""}</h2> */}
                  </div>
                </div>
              </div>
              <div className="instruction-container col" style={{ gap: "12px" }}>
                {isLoading ? (
                  <p>Loading instructions...</p>
                ) : loadError ? (
                  <p>{loadError}</p>
                ) : (
                  <>
                    {problem?.description && (
                      <div
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: "12px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-main)",
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {problem.description}
                      </div>
                    )}

                    {problem?.steps.map((step, index) => {
                      const isCompleted = index < currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      const isUpcoming = index > currentStepIndex;
                      const stepStateClass = isCompleted
                        ? " correct"
                        : isUpcoming
                          ? " disabled"
                          : "";

                      return (
                        <div
                          className={`instruction${stepStateClass}`}
                          key={`${problem.unit_id}-step-${step.stepNumber}-${index}`}
                          style={{
                            flexDirection: "column",
                            alignItems: "stretch",
                            border: isCurrent
                              ? "2px solid var(--selected-color, #7c3aed)"
                              : undefined,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-center",
                              gap: "12px",
                              width: "100%",
                            }}
                          >
                            <div
                              className="check-circle row"
                              style={{
                                background: isCurrent
                                  ? "var(--selected-color, #7c3aed)"
                                  : undefined,
                                borderColor: isCurrent
                                  ? "var(--selected-color, #7c3aed)"
                                  : undefined,
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: "0.78rem",
                              }}
                            >
                              {isCompleted ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              ) : (
                                <span>{index + 1}</span>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: "4px",
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: "0.78rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    color: isCurrent
                                      ? "var(--selected-color, #7c3aed)"
                                      : isCompleted
                                        ? "#16a34a"
                                        : "var(--text-muted)",
                                  }}
                                >
                                  Step {index + 1}{" "}
                                  {isCompleted
                                    ? "• Completed"
                                    : isCurrent
                                      ? "• Current"
                                      : "• Locked"}
                                </strong>
                                {isCurrent && step.hint && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRevealedHints((prev) => ({
                                        ...prev,
                                        [index]: !prev[index],
                                      }))
                                    }
                                    style={{
                                      padding: "2px 8px",
                                      fontSize: "0.74rem",
                                      fontWeight: 600,
                                      borderRadius: "6px",
                                      border: "1px solid var(--border-main)",
                                      background: "var(--bg-card)",
                                      color: "var(--text-main)",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {revealedHints[index] ? "Hide Hint" : "Hint"}
                                  </button>
                                )}
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "0.9rem",
                                  lineHeight: 1.5,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {step.instruction}
                              </p>
                            </div>
                          </div>

                          {isCurrent && step.hint && revealedHints[index] && (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "8px 10px",
                                borderRadius: "10px",
                                background: "rgba(124, 58, 237, 0.08)",
                                border: "1px solid rgba(124, 58, 237, 0.25)",
                                fontSize: "0.82rem",
                                color: "var(--text-main)",
                              }}
                            >
                              <strong>Hint:</strong> {step.hint}
                            </div>
                          )}

                          {isCurrent &&
                            stepFeedback &&
                            !stepFeedback.passed && (
                              <div
                                role="alert"
                                style={{
                                  marginTop: "10px",
                                  padding: "10px 12px",
                                  borderRadius: "10px",
                                  background: "rgba(239, 68, 68, 0.1)",
                                  border: "1px solid #ef4444",
                                  color: "#b91c1c",
                                  fontSize: "0.82rem",
                                  lineHeight: 1.45,
                                }}
                              >
                                <div style={{ fontWeight: 700, marginBottom: "2px" }}>
                                  Step {index + 1} Check Failed (-1 Heart)
                                  {stepFeedback.lineNumber
                                    ? ` • Near Line ${stepFeedback.lineNumber}`
                                    : ""}
                                </div>
                                <div>{stepFeedback.message}</div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div id="tab">
              <div className="header">
                {fileOrder.map((fileKey) => {
                  const { label, language } = fileMeta[fileKey];
                  const isActive = activeFile === fileKey;
                  const icon =
                    language === "html" ? (
                      <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>HTML5</title><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>
                    ) : language === "css" ? (
                      <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>CSS</title><path d="M0 0v20.16A3.84 3.84 0 0 0 3.84 24h16.32A3.84 3.84 0 0 0 24 20.16V3.84A3.84 3.84 0 0 0 20.16 0Zm14.256 13.08c1.56 0 2.28 1.08 2.304 2.64h-1.608c.024-.288-.048-.6-.144-.84-.096-.192-.288-.264-.552-.264-.456 0-.696.264-.696.84-.024.576.288.888.768 1.08.72.288 1.608.744 1.92 1.296q.432.648.432 1.656c0 1.608-.912 2.592-2.496 2.592-1.656 0-2.4-1.032-2.424-2.688h1.68c0 .792.264 1.176.792 1.176.264 0 .456-.072.552-.24.192-.312.24-1.176-.048-1.512-.312-.408-.912-.6-1.32-.816q-.828-.396-1.224-.936c-.24-.36-.36-.888-.36-1.536 0-1.44.936-2.472 2.424-2.448m5.4 0c1.584 0 2.304 1.08 2.328 2.64h-1.608c0-.288-.048-.6-.168-.84-.096-.192-.264-.264-.528-.264-.48 0-.72.264-.72.84s.288.888.792 1.08c.696.288 1.608.744 1.92 1.296.264.432.408.984.408 1.656.024 1.608-.888 2.592-2.472 2.592-1.68 0-2.424-1.056-2.448-2.688h1.68c0 .744.264 1.176.792 1.176.264 0 .456-.072.552-.24.216-.312.264-1.176-.048-1.512-.288-.408-.888-.6-1.32-.816-.552-.264-.96-.576-1.2-.936s-.36-.888-.36-1.536c-.024-1.44.912-2.472 2.4-2.448m-11.031.018c.711-.006 1.419.198 1.839.63.432.432.672 1.128.648 1.992H9.336c.024-.456-.096-.792-.432-.96-.312-.144-.768-.048-.888.24-.12.264-.192.576-.168.864v3.504c0 .744.264 1.128.768 1.128a.65.65 0 0 0 .552-.264c.168-.24.192-.552.168-.84h1.776c.096 1.632-.984 2.712-2.568 2.688-1.536 0-2.496-.864-2.472-2.472v-4.032c0-.816.24-1.44.696-1.848.432-.408 1.146-.624 1.857-.63"/></svg>
                    ) : (
                      <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>JavaScript</title><path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z"/></svg>
                    );

                  const hasContent = code[fileKey].trim().length > 0;

                  return (
                    <button
                      key={fileKey}
                      type="button"
                      className={`file-tab${isActive ? " active" : ""}`}
                      onClick={() => setActiveFile(fileKey)}
                      aria-label={`Open ${label}`}
                      aria-pressed={isActive}
                    >
                      {icon}
                      <h2>{label}</h2>
                      {hasContent && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: isActive ? "#7c3aed" : "#94a3b8",
                            marginLeft: "auto",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="code-editor-container monaco-editor-shell row">
                {isMobileViewport ? (
                  <div className="cp-mobile-editor">
                    <div className="cp-mobile-editor-area">
                      <pre className="cp-mobile-gutter" ref={gutterRef} aria-hidden="true">
                        {Array.from(
                          { length: Math.max(1, code[activeFile].split("\n").length) },
                          (_, lineIndex) => lineIndex + 1,
                        ).join("\n")}
                      </pre>
                      <textarea
                        ref={editorRef}
                        className="cp-mobile-textarea"
                        aria-label={`Edit ${fileMeta[activeFile].label}`}
                        value={code[activeFile]}
                        wrap="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        data-gramm="false"
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setCode((previous) => ({
                            ...previous,
                            [activeFile]: nextValue,
                          }));
                        }}
                        onScroll={(event) => {
                          if (gutterRef.current) {
                            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
                          }
                        }}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            (event.ctrlKey || event.metaKey)
                          ) {
                            event.preventDefault();
                            void submitStepRef.current();
                            return;
                          }
                          if (event.key === "Tab") {
                            event.preventDefault();
                            insertAtCursor(TAB_INDENT);
                          }
                        }}
                      />
                    </div>
                    <div className="cp-quick-symbols" role="toolbar" aria-label="Quick symbols">
                      <button
                        type="button"
                        className="cp-quick-symbol cp-quick-symbol-tab"
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => insertAtCursor(TAB_INDENT)}
                      >
                        Tab
                      </button>
                      {QUICK_SYMBOLS.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          className="cp-quick-symbol"
                          aria-label={`Insert ${symbol}`}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => insertAtCursor(symbol)}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                <Editor
                  className="monaco-code-editor"
                  height="100%"
                  width="100%"
                  language={fileMeta[activeFile].language}
                  theme={editorTheme}
                  value={code[activeFile]}
                  onChange={(value) => {
                    const nextValue = value ?? "";
                    setCode((previous) => ({
                      ...previous,
                      [activeFile]: nextValue,
                    }));
                  }}
                  onMount={(editor, monaco) => {
                    editor.addCommand(
                      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                      () => {
                        void submitStepRef.current();
                      },
                    );
                  }}
                  options={{
                    automaticLayout: true,
                    contextmenu: false,
                    fontFamily: "JetBrains Mono, 'Fira Code', monospace",
                    fontSize: 14,
                    glyphMargin: false,
                    minimap: { enabled: false },
                    padding: { top: 16, bottom: 84 },
                    renderLineHighlight: "all",
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    tabSize: 4,
                    wordWrap: "off",
                  }}
                />
                )}
                <div className="code-options">
                  <button
                    type="button"
                    className="run-code-btn"
                    onClick={handleResetStep}
                    disabled={!problem || isLoading || isSubmitting}
                    title="Restore this step's starting code"
                    style={{ cursor: "pointer" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-ccw preview-icon"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  </button>
                  {activeFile === "js" && (
                    <button
                      type="button"
                      className="run-code-btn"
                      onClick={handleRunCode}
                      disabled={!problem || isLoading}
                      title="Run JavaScript in the preview without losing hearts"
                      style={{ cursor: "pointer" }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-play preview-icon"
                      >
                        <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={handleSubmitStep}
                    disabled={!problem || isLoading || isSubmitting}
                    style={{ cursor: "pointer" }}
                  >
                    <p>
                      {isSubmitting
                        ? "Checking..."
                        : `Submit Step ${currentStepIndex + 1}`}
                    </p>
                  </button>
                </div>
              </div>
            </div>

            <div id="preview">
              <div className="header">
                <div>
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
                    className="lucide lucide-eye"
                  >
                    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <h2>Preview</h2>
                </div>
                <div className="toggle-device-container row">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    id="desktop-toggle"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-monitor"
                  >
                    <rect width="20" height="14" x="2" y="3" rx="2" />
                    <line x1="8" x2="16" y1="21" y2="21" />
                    <line x1="12" x2="12" y1="17" y2="21" />
                  </svg>
                  <label className="toggle-device">
                    <input
                      type="checkbox"
                      checked={isMobilePreview}
                      onChange={(e) => setIsMobilePreview(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    id="mobile-toggle"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-smartphone"
                  >
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                    <path d="M12 18h.01" />
                  </svg>
                </div>
              </div>
              <div className="canvas-container col">
                <iframe
                  title="code preview"
                  className="preview-frame"
                  ref={previewFrameRef}
                  srcDoc='<!doctype html><html><head><style id="quiz-preview-styles"></style></head><body><div id="quiz-preview-root"></div></body></html>'
                  onLoad={initializePreview}
                  style={{
                    maxWidth: isMobilePreview ? "375px" : "100%",
                    margin: isMobilePreview ? "0 auto" : undefined,
                    borderLeft: isMobilePreview
                      ? "1px solid var(--border-main)"
                      : undefined,
                    borderRight: isMobilePreview
                      ? "1px solid var(--border-main)"
                      : undefined,
                  }}
                />
                <div
                  className={`console${isConsoleOpen ? " console-open" : ""}`}
                >
                  <div className="header">
                    <div>
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
                        className="lucide lucide-square-terminal"
                      >
                        <path d="m7 11 2-2-2-2" />
                        <path d="M11 13h4" />
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      </svg>
                      <h2>Console</h2>
                      <button
                        className="console-maximize"
                        type="button"
                        aria-label={
                          isConsoleOpen
                            ? "Collapse console output"
                            : "Expand console output"
                        }
                        aria-expanded={isConsoleOpen}
                        onClick={() => setIsConsoleOpen((isOpen) => !isOpen)}
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
                          className="lucide lucide-chevron-up"
                        >
                          <path d="m18 15-6-6-6 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div
                    className="console-output"
                    aria-live="polite"
                    aria-hidden={!isConsoleOpen}
                  >
                    {consoleMessages.length === 0 ? (
                      <p className="console-empty">No console output yet.</p>
                    ) : (
                      consoleMessages.map((message, index) => (
                        <div
                          className={`console-line console-${message.level}`}
                          key={`${index}-${message.text}`}
                        >
                          <span className="console-level">{message.level}</span>
                          <code>{message.text}</code>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cp-mobile-actionbar">
            <button
              type="button"
              className="cp-mobile-action-btn"
              onClick={handleResetStep}
              disabled={!problem || isLoading || isSubmitting}
            >
              Reset
            </button>
            {activeFile === "js" && (
              <button
                type="button"
                className="cp-mobile-action-btn"
                onClick={handleRunCode}
                disabled={!problem || isLoading}
              >
                ▶ Run
              </button>
            )}
            <button
              type="button"
              className="cp-mobile-action-btn primary"
              onClick={handleSubmitStep}
              disabled={!problem || isLoading || isSubmitting}
            >
              {isSubmitting ? "Checking..." : `Check Step ${currentStepIndex + 1}`}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function QuizCPPage() {
  return (
    <Suspense
      fallback={
        <div className="quiz-page" id="code-problem">
          <Sidebar />
          <main style={{ justifyContent: "center", alignItems: "center" }}>
            <p>Loading coding assessment...</p>
          </main>
        </div>
      }
    >
      <CodeProblemRunner />
    </Suspense>
  );
}