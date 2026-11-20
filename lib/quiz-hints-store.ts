"use client";

import { useSyncExternalStore } from "react";
import {
  ALL_TUTORIAL_MODE_ORDER,
  type QuizHintMode,
} from "@/lib/quiz-ui-hints";

export interface QuizHintsPrefs {
  autoShowTutorials: boolean;
  seenTutorialModes: QuizHintMode[];
  welcomeTourCompleted: boolean;
}

export interface QuizHintsStoreState {
  prefs: QuizHintsPrefs;
  activeUserId: string | null;
  isOnboardingReady: boolean;
  manualOpenMode: QuizHintMode | null;
}

export interface ClientOnboardingPayload {
  userId?: number | string;
  tutorialEnabled: boolean;
  welcomeTourCompleted: boolean;
  seenModes: QuizHintMode[];
  isFirstLogin?: boolean;
  source?: "db" | "fallback";
}

export const QUIZ_HINTS_STORAGE_KEY = "quizweb-ui-hints-prefs";

export const DEFAULT_QUIZ_HINTS_PREFS: QuizHintsPrefs = {
  autoShowTutorials: true,
  seenTutorialModes: [],
  welcomeTourCompleted: false,
};

const SERVER_STORE_STATE: QuizHintsStoreState = {
  prefs: DEFAULT_QUIZ_HINTS_PREFS,
  activeUserId: null,
  isOnboardingReady: false,
  manualOpenMode: null,
};

const VALID_HINT_MODES = new Set<string>(ALL_TUTORIAL_MODE_ORDER);

let clientState: QuizHintsStoreState | null = null;
const listeners = new Set<() => void>();
let storageListenerAttached = false;

export function getQuizHintsStorageKey(userId?: string | null): string {
  const normalized =
    typeof userId === "string" && userId.trim() !== "" ? userId.trim() : null;
  return normalized
    ? `${QUIZ_HINTS_STORAGE_KEY}:u:${normalized}`
    : `${QUIZ_HINTS_STORAGE_KEY}:guest`;
}

function normalizeModeList(input: unknown): QuizHintMode[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter(
        (mode): mode is QuizHintMode =>
          typeof mode === "string" && VALID_HINT_MODES.has(mode),
      ),
    ),
  );
}

function normalizePrefs(
  raw: Partial<QuizHintsPrefs> | null | undefined,
): QuizHintsPrefs {
  return {
    autoShowTutorials:
      typeof raw?.autoShowTutorials === "boolean"
        ? raw.autoShowTutorials
        : DEFAULT_QUIZ_HINTS_PREFS.autoShowTutorials,
    seenTutorialModes: normalizeModeList(raw?.seenTutorialModes),
    welcomeTourCompleted:
      typeof raw?.welcomeTourCompleted === "boolean"
        ? raw.welcomeTourCompleted
        : DEFAULT_QUIZ_HINTS_PREFS.welcomeTourCompleted,
  };
}

function readScopedEntry(userId?: string | null): {
  exists: boolean;
  prefs: QuizHintsPrefs;
} {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return { exists: false, prefs: DEFAULT_QUIZ_HINTS_PREFS };
  }
  try {
    const key = getQuizHintsStorageKey(userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return { exists: false, prefs: DEFAULT_QUIZ_HINTS_PREFS };
    }
    return {
      exists: true,
      prefs: normalizePrefs(JSON.parse(raw) as Partial<QuizHintsPrefs>),
    };
  } catch {
    return { exists: false, prefs: DEFAULT_QUIZ_HINTS_PREFS };
  }
}

function writeScopedPrefs(userId: string | null, prefs: QuizHintsPrefs): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getQuizHintsStorageKey(userId),
      JSON.stringify(prefs),
    );
  } catch {
    // Ignore storage quota / private browsing errors
  }
}

function getClientState(): QuizHintsStoreState {
  if (typeof window === "undefined") {
    return SERVER_STORE_STATE;
  }
  if (!clientState) {
    clientState = {
      prefs: readScopedEntry(null).prefs,
      activeUserId: null,
      isOnboardingReady: true,
      manualOpenMode: null,
    };
  }
  return clientState;
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function setClientState(next: QuizHintsStoreState): void {
  clientState = next;
  emitChange();
}

function ensureStorageListener(): void {
  if (typeof window === "undefined" || storageListenerAttached) return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event) => {
    const current = getClientState();
    const expectedKey = getQuizHintsStorageKey(current.activeUserId);
    if (event.key !== expectedKey && event.key !== null) return;
    const { prefs } = readScopedEntry(current.activeUserId);
    setClientState({
      ...current,
      prefs,
    });
  });
}

function syncRemoteOnboarding(payload: Record<string, unknown>): void {
  const current = getClientState();
  if (
    !current.activeUserId ||
    typeof window === "undefined" ||
    typeof fetch !== "function"
  ) {
    return;
  }
  void fetch("/api/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {
    // Non-fatal: local scoped prefs remain updated
  });
}

export function getQuizHintsSnapshot(): QuizHintsPrefs {
  return getClientState().prefs;
}

export function getQuizHintsServerSnapshot(): QuizHintsPrefs {
  return DEFAULT_QUIZ_HINTS_PREFS;
}

export function getQuizHintsStoreSnapshot(): QuizHintsStoreState {
  return getClientState();
}

export function getQuizHintsStoreServerSnapshot(): QuizHintsStoreState {
  return SERVER_STORE_STATE;
}

export function subscribeQuizHints(listener: () => void): () => void {
  ensureStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function beginOnboardingUserSync(userId: string): void {
  const normalized = userId.trim();
  if (!normalized) return;
  const current = getClientState();
  const { prefs } = readScopedEntry(normalized);
  setClientState({
    ...current,
    activeUserId: normalized,
    isOnboardingReady: false,
    prefs,
  });
}

export function hydrateUserOnboarding(
  userId: string,
  serverState: ClientOnboardingPayload,
): void {
  const normalized = userId.trim();
  if (!normalized) return;
  const current = getClientState();
  if (current.activeUserId && current.activeUserId !== normalized) {
    return;
  }

  const scoped = readScopedEntry(normalized);
  const serverSeen = normalizeModeList(serverState.seenModes);

  const mergedPrefs: QuizHintsPrefs =
    serverState.source === "db"
      ? {
          ...scoped.prefs,
          autoShowTutorials: serverState.tutorialEnabled,
          welcomeTourCompleted: serverState.welcomeTourCompleted,
          seenTutorialModes: serverSeen,
        }
      : scoped.exists
        ? {
            ...scoped.prefs,
            welcomeTourCompleted:
              scoped.prefs.welcomeTourCompleted ||
              serverState.welcomeTourCompleted,
            seenTutorialModes: Array.from(
              new Set([...scoped.prefs.seenTutorialModes, ...serverSeen]),
            ),
          }
        : {
            ...DEFAULT_QUIZ_HINTS_PREFS,
            autoShowTutorials: serverState.tutorialEnabled,
            welcomeTourCompleted: serverState.welcomeTourCompleted,
            seenTutorialModes: serverSeen,
          };

  writeScopedPrefs(normalized, mergedPrefs);
  setClientState({
    ...current,
    activeUserId: normalized,
    isOnboardingReady: true,
    prefs: mergedPrefs,
  });
}

export function markOnboardingSyncFailed(userId: string): void {
  const normalized = userId.trim();
  const current = getClientState();
  if (current.activeUserId && normalized && current.activeUserId !== normalized) {
    return;
  }
  const { prefs } = readScopedEntry(normalized || current.activeUserId);
  setClientState({
    ...current,
    activeUserId: normalized || current.activeUserId,
    isOnboardingReady: true,
    prefs,
  });
}

export function clearActiveOnboardingUser(): void {
  const current = getClientState();
  const { prefs } = readScopedEntry(null);
  setClientState({
    prefs,
    activeUserId: null,
    isOnboardingReady: true,
    manualOpenMode:
      current.manualOpenMode === "Home" || current.manualOpenMode === "Learn"
        ? null
        : current.manualOpenMode,
  });
}

export function updateQuizHintsPrefs(
  updater:
    | Partial<QuizHintsPrefs>
    | ((prev: QuizHintsPrefs) => QuizHintsPrefs),
): void {
  const current = getClientState();
  const nextPrefs = normalizePrefs(
    typeof updater === "function"
      ? updater(current.prefs)
      : { ...current.prefs, ...updater },
  );
  writeScopedPrefs(current.activeUserId, nextPrefs);
  setClientState({
    ...current,
    prefs: nextPrefs,
  });
}

export function requestOpenTutorialMode(mode: QuizHintMode): void {
  const current = getClientState();
  setClientState({
    ...current,
    manualOpenMode: mode,
  });
}

export function clearManualOpenMode(): void {
  const current = getClientState();
  if (current.manualOpenMode === null) return;
  setClientState({
    ...current,
    manualOpenMode: null,
  });
}

export function markTutorialSeenPref(
  mode: QuizHintMode,
  options?: { completeWelcome?: boolean },
): void {
  const completeWelcome =
    mode === "Home" || Boolean(options?.completeWelcome);
  updateQuizHintsPrefs((prev) => ({
    ...prev,
    seenTutorialModes: prev.seenTutorialModes.includes(mode)
      ? prev.seenTutorialModes
      : [...prev.seenTutorialModes, mode],
    welcomeTourCompleted: prev.welcomeTourCompleted || completeWelcome,
  }));
  syncRemoteOnboarding({
    action: completeWelcome ? "complete_welcome" : "mark_seen",
    mode,
    completeWelcome,
  });
}

export function setAutoShowTutorialsPref(autoShowTutorials: boolean): void {
  updateQuizHintsPrefs({ autoShowTutorials });
  syncRemoteOnboarding({
    action: "set_enabled",
    enabled: autoShowTutorials,
  });
}

export function replaySystemTutorial(openMode?: QuizHintMode): void {
  const current = getClientState();
  const resetPrefs: QuizHintsPrefs = {
    autoShowTutorials: true,
    seenTutorialModes: [],
    welcomeTourCompleted: false,
  };
  writeScopedPrefs(current.activeUserId, resetPrefs);
  setClientState({
    ...current,
    prefs: resetPrefs,
    isOnboardingReady: true,
    manualOpenMode: openMode ?? null,
  });
  syncRemoteOnboarding({ action: "reset" });
}

const subscribeNoop = () => () => {};

export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function useQuizHintsPrefs() {
  const state = useSyncExternalStore(
    subscribeQuizHints,
    getQuizHintsStoreSnapshot,
    getQuizHintsStoreServerSnapshot,
  );
  const { prefs } = state;

  return {
    prefs,
    activeUserId: state.activeUserId,
    isOnboardingReady: state.isOnboardingReady,
    manualOpenMode: state.manualOpenMode,
    requestOpenTutorialMode,
    clearManualOpenMode,
    replaySystemTutorial,
    hasSeenTutorial: (mode: QuizHintMode) =>
      prefs.seenTutorialModes.includes(mode),
    markTutorialSeen: markTutorialSeenPref,
    setAutoShowTutorials: setAutoShowTutorialsPref,
    resetAllTutorials: () => replaySystemTutorial(),
  };
}
