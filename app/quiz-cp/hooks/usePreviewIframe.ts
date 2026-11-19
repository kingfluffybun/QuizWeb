"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CPFileBuffers } from "@/lib/cp-constants";
import type { ConsoleMessage } from "../types";

const CONSOLE_BRIDGE_SCRIPT = `(() => {
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

function escapeInlineTagEnd(content: string, tagName: string): string {
  return content.replace(new RegExp(`</${tagName}`, "gi"), `<\\/${tagName}`);
}

function buildSandboxedSrcDoc(
  html: string,
  css: string,
  executedJs: string | null,
  runNonce: number,
): string {
  const safeCss = escapeInlineTagEnd(css, "style");
  const safeBridge = escapeInlineTagEnd(CONSOLE_BRIDGE_SCRIPT, "script");
  const safeJsBlock =
    executedJs && executedJs.trim().length > 0 && runNonce > 0
      ? `<script>/* run:${runNonce} */\n(() => {\n${escapeInlineTagEnd(executedJs, "script")}\n})();<\/script>`
      : "";

  return `<!doctype html><html><head><style id="quiz-preview-styles">${safeCss}</style></head><body><div id="quiz-preview-root">${html}</div><script>${safeBridge}<\/script>${safeJsBlock}</body></html>`;
}

export function usePreviewIframe(code: CPFileBuffers) {
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    html: string;
    css: string;
    executedJs: string | null;
    runNonce: number;
  }>({
    html: code.html,
    css: code.css,
    executedJs: null,
    runNonce: 0,
  });

  // Debounce live HTML/CSS updates to avoid thrashing sandboxed iframe reloads per keystroke
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewSnapshot((prev) => ({
        ...prev,
        html: code.html,
        css: code.css,
        executedJs: null,
      }));
    }, 150);

    return () => window.clearTimeout(timer);
  }, [code.html, code.css]);

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

  const srcDoc = useMemo(
    () =>
      buildSandboxedSrcDoc(
        previewSnapshot.html,
        previewSnapshot.css,
        previewSnapshot.executedJs,
        previewSnapshot.runNonce,
      ),
    [previewSnapshot],
  );

  const runPreviewCode = useCallback((buffers: CPFileBuffers) => {
    setConsoleMessages([]);
    setPreviewSnapshot((prev) => ({
      html: buffers.html,
      css: buffers.css,
      executedJs: buffers.js,
      runNonce: prev.runNonce + 1,
    }));
  }, []);

  const clearConsole = useCallback(() => {
    setConsoleMessages([]);
  }, []);

  return {
    previewFrameRef,
    srcDoc,
    consoleMessages,
    runPreviewCode,
    clearConsole,
  };
}
