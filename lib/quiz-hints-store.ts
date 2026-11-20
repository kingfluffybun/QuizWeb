"use client";

import { useSyncExternalStore } from "react";
import { QUIZ_UI_HINT_ORDER, type QuizHintMode } from "@/lib/quiz-ui-hints";

export interface QuizHintsPrefs {
  showInlineHints: boolean;
  dismissedModes: QuizHintMode[];
}

export const QUIZ_HINTS_STORAGE_KEY = "quizweb-ui-hints-prefs";

export const DEFAULT_QUIZ_HINTS_PREFS: QuizHintsPrefs = {
  showInlineHints: true,
  dismissedModes: [],
};

const VALID_HINT_MODES = new Set<string>(QUIZ_UI_HINT_ORDER);

let cachedRaw: string | null | undefined;
let cachedSnapshot: QuizHintsPrefs = DEFAULT_QUIZ_HINTS_PREFS;
const listeners = new Set<() => void>();
let storageListenerAttached = false;

function normalizePrefs(
  raw: Partial<QuizHintsPrefs> | null | undefined,
): QuizHintsPrefs {
  const dismissedModes = Array.isArray(raw?.dismissedModes)
    ? Array.from(
        new Set(
          raw.dismissedModes.filter(
            (mode): mode is QuizHintMode =>
              typeof mode === "string" && VALID_HINT_MODES.has(mode),
          ),
        ),
      )
    : [];

  return {
    showInlineHints:
      typeof raw?.showInlineHints === "boolean"
        ? raw.showInlineHints
        : DEFAULT_QUIZ_HINTS_PREFS.showInlineHints,
    dismissedModes,
  };
}

function readFromStorage(): QuizHintsPrefs {
  if (typeof window === "undefined") return DEFAULT_QUIZ_HINTS_PREFS;
  try {
    const raw = window.localStorage.getItem(QUIZ_HINTS_STORAGE_KEY);
    if (!raw) return DEFAULT_QUIZ_HINTS_PREFS;
    return normalizePrefs(JSON.parse(raw) as Partial<QuizHintsPrefs>);
  } catch {
    return DEFAULT_QUIZ_HINTS_PREFS;
  }
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function ensureStorageListener(): void {
  if (typeof window === "undefined" || storageListenerAttached) return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== QUIZ_HINTS_STORAGE_KEY && event.key !== null) return;
    cachedRaw = undefined;
    cachedSnapshot = readFromStorage();
    emitChange();
  });
}

export function getQuizHintsSnapshot(): QuizHintsPrefs {
  if (typeof window === "undefined") return DEFAULT_QUIZ_HINTS_PREFS;
  try {
    const raw = window.localStorage.getItem(QUIZ_HINTS_STORAGE_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    if (!raw) {
      cachedSnapshot = DEFAULT_QUIZ_HINTS_PREFS;
      return cachedSnapshot;
    }
    cachedSnapshot = normalizePrefs(JSON.parse(raw) as Partial<QuizHintsPrefs>);
    return cachedSnapshot;
  } catch {
    return cachedSnapshot;
  }
}

export function getQuizHintsServerSnapshot(): QuizHintsPrefs {
  return DEFAULT_QUIZ_HINTS_PREFS;
}

export function subscribeQuizHints(listener: () => void): () => void {
  ensureStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateQuizHintsPrefs(
  updater:
    | Partial<QuizHintsPrefs>
    | ((prev: QuizHintsPrefs) => QuizHintsPrefs),
): void {
  const prev = getQuizHintsSnapshot();
  const next = normalizePrefs(
    typeof updater === "function" ? updater(prev) : { ...prev, ...updater },
  );
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedSnapshot = next;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(QUIZ_HINTS_STORAGE_KEY, serialized);
    } catch {
      // Ignore storage quota / private browsing errors
    }
  }
  emitChange();
}

export function useQuizHintsPrefs() {
  const prefs = useSyncExternalStore(
    subscribeQuizHints,
    getQuizHintsSnapshot,
    getQuizHintsServerSnapshot,
  );

  return {
    prefs,
    isInlineHintVisible: (mode: QuizHintMode) =>
      prefs.showInlineHints && !prefs.dismissedModes.includes(mode),
    setShowInlineHints: (showInlineHints: boolean) =>
      updateQuizHintsPrefs({ showInlineHints }),
    dismissModeHint: (mode: QuizHintMode) =>
      updateQuizHintsPrefs((prev) => ({
        ...prev,
        dismissedModes: prev.dismissedModes.includes(mode)
          ? prev.dismissedModes
          : [...prev.dismissedModes, mode],
      })),
    resetDismissedHints: () => updateQuizHintsPrefs({ dismissedModes: [] }),
  };
}
