"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import {
  CP_FILE_KEYS,
  type CPFileBuffers,
  type CPFileKey,
  type PublicCodeProblem,
} from "@/lib/cp-constants";
import { CP_FILE_META } from "../types";

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

const QUICK_SYMBOLS = [
  "<", ">", "/", "=", '"', "'", "{", "}", "(", ")", ";", ":", "#", ".",
] as const;
const TAB_INDENT = "    ";

interface CpEditorPaneProps {
  activeFile: CPFileKey;
  onSelectFile: (fileKey: CPFileKey) => void;
  code: CPFileBuffers;
  onCodeChange: React.Dispatch<React.SetStateAction<CPFileBuffers>>;
  editorTheme: "vs" | "vs-dark";
  isMobileViewport: boolean;
  editorRef: React.MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  onTypingChange: (typing: boolean) => void;
  onResetStep: () => void;
  onRunCode: () => void;
  onSubmitStep: () => void;
  problem: PublicCodeProblem | null;
  isLoading: boolean;
  isSubmitting: boolean;
  currentStepIndex: number;
}

export default function CpEditorPane({
  activeFile,
  onSelectFile,
  code,
  onCodeChange,
  editorTheme,
  isMobileViewport,
  editorRef,
  onTypingChange,
  onResetStep,
  onRunCode,
  onSubmitStep,
  problem,
  isLoading,
  isSubmitting,
  currentStepIndex,
}: CpEditorPaneProps) {
  const submitStepRef = useRef(onSubmitStep);
  useEffect(() => {
    submitStepRef.current = onSubmitStep;
  });

  const insertAtCursor = (token: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    const selection = editor.getSelection() ?? model.getFullModelRange();
    const startOffset = model.getOffsetAt(selection.getStartPosition());
    editor.executeEdits("cp-quick-symbol", [
      { range: selection, text: token, forceMoveMarkers: true },
    ]);
    editor.setPosition(model.getPositionAt(startOffset + token.length));
    editor.focus();
  };

  return (
    <div id="tab">
      <div className="header">
        {CP_FILE_KEYS.map((fileKey) => {
          const { label, language } = CP_FILE_META[fileKey];
          const isActive = activeFile === fileKey;
          const hasContent = code[fileKey].trim().length > 0;
          const icon =
            language === "html" ? (
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <title>HTML5</title>
                <path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z" />
              </svg>
            ) : language === "css" ? (
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <title>CSS</title>
                <path d="M0 0v20.16A3.84 3.84 0 0 0 3.84 24h16.32A3.84 3.84 0 0 0 24 20.16V3.84A3.84 3.84 0 0 0 20.16 0Zm14.256 13.08c1.56 0 2.28 1.08 2.304 2.64h-1.608c.024-.288-.048-.6-.144-.84-.096-.192-.288-.264-.552-.264-.456 0-.696.264-.696.84-.024.576.288.888.768 1.08.72.288 1.608.744 1.92 1.296q.432.648.432 1.656c0 1.608-.912 2.592-2.496 2.592-1.656 0-2.4-1.032-2.424-2.688h1.68c0 .792.264 1.176.792 1.176.264 0 .456-.072.552-.24.192-.312.24-1.176-.048-1.512-.312-.408-.912-.6-1.32-.816q-.828-.396-1.224-.936c-.24-.36-.36-.888-.36-1.536 0-1.44.936-2.472 2.424-2.448m5.4 0c1.584 0 2.304 1.08 2.328 2.64h-1.608c0-.288-.048-.6-.168-.84-.096-.192-.264-.264-.528-.264-.48 0-.72.264-.72.84s.288.888.792 1.08c.696.288 1.608.744 1.92 1.296.264.432.408.984.408 1.656.024 1.608-.888 2.592-2.472 2.592-1.68 0-2.424-1.056-2.448-2.688h1.68c0 .744.264 1.176.792 1.176.264 0 .456-.072.552-.24.216-.312.264-1.176-.048-1.512-.288-.408-.888-.6-1.32-.816-.552-.264-.96-.576-1.2-.936s-.36-.888-.36-1.536c-.024-1.44.912-2.472 2.4-2.448m-11.031.018c.711-.006 1.419.198 1.839.63.432.432.672 1.128.648 1.992H9.336c.024-.456-.096-.792-.432-.96-.312-.144-.768-.048-.888.24-.12.264-.192.576-.168.864v3.504c0 .744.264 1.128.768 1.128a.65.65 0 0 0 .552-.264c.168-.24.192-.552.168-.84h1.776c.096 1.632-.984 2.712-2.568 2.688-1.536 0-2.496-.864-2.472-2.472v-4.032c0-.816.24-1.44.696-1.848.432-.408 1.146-.624 1.857-.63" />
              </svg>
            ) : (
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <title>JavaScript</title>
                <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.404-.601-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z" />
              </svg>
            );

          return (
            <button
              key={fileKey}
              type="button"
              className={`file-tab${isActive ? " active" : ""}`}
              onClick={() => onSelectFile(fileKey)}
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

      {/* Unified Monaco Editor wrapper shared across desktop and mobile viewports */}
      <div className="code-editor-container monaco-editor-shell row">
        <div
          className={isMobileViewport ? "cp-mobile-editor" : undefined}
          style={isMobileViewport ? undefined : { display: "contents" }}
        >
          <div
            className={isMobileViewport ? "cp-mobile-editor-area" : undefined}
            style={isMobileViewport ? undefined : { display: "contents" }}
          >
            <Editor
              className={
                isMobileViewport
                  ? "monaco-code-editor cp-mobile-monaco-editor"
                  : "monaco-code-editor"
              }
              height="100%"
              width="100%"
              language={CP_FILE_META[activeFile].language}
              theme={editorTheme}
              value={code[activeFile]}
              onChange={(value) => {
                const nextValue = value ?? "";
                onCodeChange((previous) => ({
                  ...previous,
                  [activeFile]: nextValue,
                }));
              }}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                editor.onDidFocusEditorText(() => onTypingChange(true));
                editor.onDidBlurEditorText(() => onTypingChange(false));
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
                lineHeight: isMobileViewport ? 21 : undefined,
                lineNumbers: "on",
                lineNumbersMinChars: isMobileViewport ? 2 : undefined,
                glyphMargin: false,
                minimap: { enabled: false },
                padding: isMobileViewport
                  ? { top: 12, bottom: 48 }
                  : { top: 16, bottom: 84 },
                renderLineHighlight: "all",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                tabSize: 4,
                wordWrap: "off",
              }}
            />
          </div>

          {isMobileViewport && (
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
          )}
        </div>

        <div className="code-options">
          <button
            type="button"
            className="run-code-btn"
            onClick={onResetStep}
            disabled={!problem || isLoading || isSubmitting}
            title="Restore this step's starting code"
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
              className="lucide lucide-rotate-ccw preview-icon"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          {activeFile === "js" && (
            <button
              type="button"
              className="run-code-btn"
              onClick={onRunCode}
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
            onClick={onSubmitStep}
            disabled={!problem || isLoading || isSubmitting}
            style={{ cursor: "pointer" }}
          >
            <p>
              {isSubmitting ? "Checking..." : `Submit Step ${currentStepIndex + 1}`}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
