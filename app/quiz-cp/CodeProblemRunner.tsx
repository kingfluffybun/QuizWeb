"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import Sidebar from "@/app/components/Sidebar";
import CompletionScreen from "@/app/components/quiz/CompletionScreen";
import QuizTutorialOverlay from "@/app/components/quiz/QuizTutorialOverlay";
import { useAnimatedStats } from "@/app/components/quiz/useAnimatedStats";
import { useQuizSounds } from "@/app/quiz/useQuizSounds";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";
import { useIsHydrated, useQuizHintsPrefs } from "@/lib/quiz-hints-store";
import {
  isOnboardingTutorialUnit,
  type QuizTutorialStep,
} from "@/lib/quiz-ui-hints";
import CpEditorPane from "./components/CpEditorPane";
import CpHeader from "./components/CpHeader";
import CpInstructionsPane from "./components/CpInstructionsPane";
import { CpMobileActionBar, CpMobileTopChrome } from "./components/CpMobileChrome";
import CpPreviewPane from "./components/CpPreviewPane";
import { useCpSession } from "./hooks/useCpSession";
import { useEditorTheme } from "./hooks/useEditorTheme";
import { useMobileViewport } from "./hooks/useMobileViewport";
import { usePreviewIframe } from "./hooks/usePreviewIframe";
import type { CodeProblemRunnerProps, MobileTab } from "./types";
import "#css/quiz.css";
import "#css/sidebar.css";

export function CodeProblemRunner({
  unitId: propUnitId,
  skipTargetSecId: propSkipTargetSecId,
  initialProblem,
  initialDailyGoal,
  initialNextUnit,
  isTutorialUnit,
}: CodeProblemRunnerProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playQuizSound = useQuizSounds();

  const unitIdParam = searchParams.get("unitId");
  const requestedUnitId =
    propUnitId ??
    (unitIdParam && Number.isFinite(Number(unitIdParam))
      ? Number(unitIdParam)
      : undefined);

  const skipParam =
    searchParams.get("skipTargetSecId") || searchParams.get("to");
  const requestedSkipTargetSecId =
    propSkipTargetSecId ??
    (skipParam && Number.isFinite(Number(skipParam))
      ? Number(skipParam)
      : undefined);

  const editorTheme = useEditorTheme();
  const isMobileViewport = useMobileViewport();

  const [mobileTab, setMobileTab] = useState<MobileTab>("task");
  const [isTyping, setIsTyping] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const isHydrated = useIsHydrated();
  const {
    prefs: hintPrefs,
    hasSeenTutorial,
    markTutorialSeen,
  } = useQuizHintsPrefs();
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);

  const clearConsoleRef = useRef<() => void>(() => {});
  const onFocusCodeTab = useCallback(() => setMobileTab("code"), []);
  const onClearConsole = useCallback(() => clearConsoleRef.current(), []);

  const session = useCpSession({
    requestedUnitId,
    requestedSkipTargetSecId,
    initialProblem,
    initialDailyGoal,
    initialNextUnit,
    playQuizSound,
    isMobileViewport,
    onFocusCodeTabOnError: onFocusCodeTab,
    onClearConsole,
  });

  const preview = usePreviewIframe(session.code);
  useEffect(() => {
    clearConsoleRef.current = preview.clearConsole;
  }, [preview.clearConsole]);

  const isFinished =
    session.status === "completed" || session.status === "gameover";
  const resolvedIsTutorialUnit =
    isTutorialUnit ??
    isOnboardingTutorialUnit({
      secId: session.problem?.sec_id,
      unitOrder: session.problem?.unit_order,
      unitId: session.problem?.unit_id ?? requestedUnitId,
      isSkipMode: Boolean(requestedSkipTargetSecId),
    });
  const isTutorialReady = !session.isLoading && Boolean(session.problem);
  const shouldAutoOpenTutorial =
    resolvedIsTutorialUnit &&
    isHydrated &&
    !isFinished &&
    !accessibilityOpen &&
    isTutorialReady &&
    hintPrefs.autoShowTutorials &&
    !hasSeenTutorial("CP");
  const isTutorialOpen =
    resolvedIsTutorialUnit && (helpOpen || shouldAutoOpenTutorial);

  const handlePrepareTutorialStep = useCallback(
    (step: QuizTutorialStep) => {
      if (isMobileViewport && step.cpMobileTab) {
        setMobileTab(step.cpMobileTab);
      }
    },
    [isMobileViewport],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !resolvedIsTutorialUnit ||
        isFinished ||
        isTyping ||
        event.key !== "?" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(target.closest("textarea, input, select, .monaco-editor")))
      ) {
        return;
      }

      event.preventDefault();
      if (isTutorialOpen) {
        markTutorialSeen("CP");
        setHelpOpen(false);
      } else {
        if (accessibilityOpen) {
          setAccessibilityClosing(true);
        }
        setHelpOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    resolvedIsTutorialUnit,
    isFinished,
    isTyping,
    isTutorialOpen,
    accessibilityOpen,
    markTutorialSeen,
  ]);
  const animatedStats = useAnimatedStats(
    isFinished,
    session.totalCpXp,
    session.accuracy,
    session.finalElapsedSeconds,
  );

  const handleRunCode = useCallback(() => {
    if (session.activeFile !== "js") return;
    preview.runPreviewCode(session.code);
    if (isMobileViewport) {
      editorRef.current?.getDomNode()?.querySelector("textarea")?.blur();
      setMobileTab("preview");
    }
  }, [session.activeFile, session.code, preview, isMobileViewport]);

  const handleToggleHint = (index: number) => {
    session.setRevealedHints((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  if (isFinished) {
    const isVictory = session.status === "completed";
    const title = isVictory
      ? session.isSkipMode
        ? "🎉 Section Skip Complete!"
        : "Assessment Complete!"
      : session.isSkipMode
        ? "💔 Skip Challenge Failed"
        : "Game Over";

    return (
      <CompletionScreen
        isPassed={isVictory}
        title={title}
        submessage={session.completionSubmessage}
        animatedStats={animatedStats}
        dailyGoalStats={session.dailyGoalStats}
        nextLevelSlot={
          isVictory && !session.isSkipMode && session.nextUnit ? (
            <div className="next-level-container">
              <Link
                href={`/quiz/${session.nextUnit.unit_id}`}
                className="next-level-card"
                style={{ textDecoration: "none" }}
              >
                <div className="next-level-content">
                  <div className="next-level-type">
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
                      className="lucide lucide-book-open preview-icon"
                    >
                      <path d="M12 5v16" />
                      <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" />
                    </svg>
                  </div>
                  <div className="next-level-title">
                    <p>
                      {session.nextUnit.sec_num != null
                        ? `Section ${session.nextUnit.sec_num}`
                        : session.nextUnit.cat_name ?? "Next"}
                    </p>
                    <h2>{session.nextUnit.unit_title}</h2>
                  </div>
                </div>
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
                  className="lucide lucide-chevron-right preview-icon"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
          ) : undefined
        }
        actionsSlot={
          <>
            {isVictory ? (
              session.isSkipMode ? (
                <Link href="/learn" className="options" id="submit">
                  <p>Continue to Roadmap</p>
                </Link>
              ) : (
                <button
                  className="options"
                  id="submit"
                  type="button"
                  onClick={() => router.push("/learn")}
                >
                  <p>Continue</p>
                </button>
              )
            ) : (
              <button
                className="options"
                id="submit"
                type="button"
                onClick={session.handleRestartAssessment}
              >
                <p>{session.isSkipMode ? "Retry Skip Challenge" : "Try Again"}</p>
              </button>
            )}
            {session.isSkipMode ? (
              <Link href="/learn" className="options" id="back">
                <p>Back to Roadmap</p>
              </Link>
            ) : (
              <button
                className="options"
                id="back"
                type="button"
                onClick={() => router.push("/home")}
              >
                <p>Back to Home</p>
              </button>
            )}
          </>
        }
      />
    );
  }

  return (
    <div className="quiz-page" id="code-problem">
      <Sidebar />
      <main>
        <CpHeader
          totalSteps={session.totalSteps}
          currentStepIndex={session.currentStepIndex}
          lives={session.lives}
          isSkipMode={Boolean(requestedSkipTargetSecId)}
          timerSeconds={session.timerSeconds}
          accessibilityOpen={accessibilityOpen}
          onToggleAccessibility={() => {
            if (accessibilityOpen) {
              setAccessibilityClosing(true);
            } else {
              if (isTutorialOpen) {
                markTutorialSeen("CP");
                setHelpOpen(false);
              }
              setAccessibilityClosing(false);
              setAccessibilityOpen(true);
            }
          }}
          showHelpButton={resolvedIsTutorialUnit}
          helpOpen={isTutorialOpen}
          onToggleHelp={() => {
            if (isTutorialOpen) {
              markTutorialSeen("CP");
              setHelpOpen(false);
            } else {
              if (accessibilityOpen) setAccessibilityClosing(true);
              setHelpOpen(true);
            }
          }}
        />

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
                if (accessibilityClosing) {
                  setAccessibilityOpen(false);
                  setAccessibilityClosing(false);
                }
              }}
            >
              <AccessibilityPanel
                onClose={() => setAccessibilityClosing(true)}
              />
            </div>
          </div>
        )}

        {isTutorialOpen && (
          <QuizTutorialOverlay
            key="CP"
            isOpen
            mode="CP"
            onClose={() => {
              markTutorialSeen("CP");
              setHelpOpen(false);
            }}
            onPrepareStep={handlePrepareTutorialStep}
            onKeepOpen={() => setHelpOpen(true)}
          />
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
          <CpMobileTopChrome
            problem={session.problem}
            currentStepIndex={session.currentStepIndex}
            totalSteps={session.totalSteps}
            stepFeedback={session.stepFeedback}
            isTyping={isTyping}
            revealedHints={session.revealedHints}
            onToggleHint={handleToggleHint}
            mobileTab={mobileTab}
            onSelectMobileTab={(tab) => {
              editorRef.current?.getDomNode()?.querySelector("textarea")?.blur();
              setMobileTab(tab);
            }}
            timeWarning={session.timeWarning}
            milestoneMessage={session.milestoneMessage}
          />

          <div className="code-problem-layout" data-mobile-tab={mobileTab}>
            <CpInstructionsPane
              problem={session.problem}
              isLoading={session.isLoading}
              loadError={session.loadError}
              currentStepIndex={session.currentStepIndex}
              revealedHints={session.revealedHints}
              onToggleHint={handleToggleHint}
              stepFeedback={session.stepFeedback}
              skipPayload={session.skipPayload}
              queueIndex={session.queueIndex}
              isSkipMode={Boolean(requestedSkipTargetSecId && session.skipPayload)}
              showHintBar={resolvedIsTutorialUnit && !isTutorialOpen}
              onOpenHelp={() => {
                if (accessibilityOpen) setAccessibilityClosing(true);
                setHelpOpen(true);
              }}
            />

            <CpEditorPane
              activeFile={session.activeFile}
              onSelectFile={session.setActiveFile}
              code={session.code}
              onCodeChange={session.setCode}
              editorTheme={editorTheme}
              isMobileViewport={isMobileViewport}
              editorRef={editorRef}
              onTypingChange={setIsTyping}
              onResetStep={session.handleResetStep}
              onRunCode={handleRunCode}
              onSubmitStep={() => void session.handleSubmitStep()}
              problem={session.problem}
              isLoading={session.isLoading}
              isSubmitting={session.isSubmitting}
              currentStepIndex={session.currentStepIndex}
            />

            <CpPreviewPane
              previewFrameRef={preview.previewFrameRef}
              srcDoc={preview.srcDoc}
              isMobilePreview={isMobilePreview}
              onToggleMobilePreview={setIsMobilePreview}
              isConsoleOpen={isConsoleOpen}
              onToggleConsole={() => setIsConsoleOpen((open) => !open)}
              consoleMessages={preview.consoleMessages}
            />
          </div>

          <CpMobileActionBar
            activeFile={session.activeFile}
            problem={session.problem}
            isLoading={session.isLoading}
            isSubmitting={session.isSubmitting}
            currentStepIndex={session.currentStepIndex}
            onResetStep={session.handleResetStep}
            onRunCode={handleRunCode}
            onSubmitStep={() => void session.handleSubmitStep()}
          />
        </div>
      </main>
    </div>
  );
}
