"use client";

import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";

export interface AccessibilitySettings {
  theme: ThemePreference;
  uiScale: number;
  reduceMotion: boolean;
}

export const ACCESSIBILITY_STORAGE_KEY = "app-accessibility-settings";

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  theme: "system",
  uiScale: 100,
  reduceMotion: false,
};

let cachedRaw: string | null | undefined;
let cachedSnapshot: AccessibilitySettings = DEFAULT_ACCESSIBILITY_SETTINGS;
const listeners = new Set<() => void>();
let storageListenerAttached = false;

function normalizeTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : DEFAULT_ACCESSIBILITY_SETTINGS.theme;
}

function clampScale(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_ACCESSIBILITY_SETTINGS.uiScale;
  return Math.min(125, Math.max(90, Math.round(num)));
}

function normalizeSettings(raw: Partial<AccessibilitySettings> | null | undefined): AccessibilitySettings {
  return {
    theme: normalizeTheme(raw?.theme),
    uiScale: clampScale(raw?.uiScale),
    reduceMotion: Boolean(raw?.reduceMotion),
  };
}

export function applyAccessibilityToDocument(settings: AccessibilitySettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", settings.theme);
  root.setAttribute("data-motion", settings.reduceMotion ? "reduce" : "normal");
  root.removeAttribute("data-contrast");
  root.style.setProperty("--base-scale", `${settings.uiScale}%`);
  root.style.setProperty("--settings-base-scale", `${settings.uiScale}%`);
}

function readFromStorage(): { raw: string | null; settings: AccessibilitySettings } {
  if (typeof window === "undefined") {
    return { raw: null, settings: DEFAULT_ACCESSIBILITY_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (!raw) {
      return { raw: null, settings: DEFAULT_ACCESSIBILITY_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return { raw, settings: normalizeSettings(parsed) };
  } catch {
    return { raw: null, settings: DEFAULT_ACCESSIBILITY_SETTINGS };
  }
}

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function ensureStorageListener(): void {
  if (typeof window === "undefined" || storageListenerAttached) return;
  storageListenerAttached = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== ACCESSIBILITY_STORAGE_KEY && event.key !== null) return;
    cachedRaw = undefined;
    const { settings } = readFromStorage();
    cachedSnapshot = settings;
    applyAccessibilityToDocument(settings);
    emitChange();
  });
}

export function getAccessibilitySnapshot(): AccessibilitySettings {
  if (typeof window === "undefined") return DEFAULT_ACCESSIBILITY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY);
    if (raw === cachedRaw) return cachedSnapshot;
    cachedRaw = raw;
    if (!raw) {
      cachedSnapshot = DEFAULT_ACCESSIBILITY_SETTINGS;
      return cachedSnapshot;
    }
    cachedSnapshot = normalizeSettings(JSON.parse(raw) as Partial<AccessibilitySettings>);
    return cachedSnapshot;
  } catch {
    return cachedSnapshot;
  }
}

export function getAccessibilityServerSnapshot(): AccessibilitySettings {
  return DEFAULT_ACCESSIBILITY_SETTINGS;
}

export function subscribeAccessibility(listener: () => void): () => void {
  ensureStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateAccessibilitySettings(
  updater:
    | Partial<AccessibilitySettings>
    | ((prev: AccessibilitySettings) => AccessibilitySettings),
): void {
  const prev = getAccessibilitySnapshot();
  const next = normalizeSettings(
    typeof updater === "function" ? updater(prev) : { ...prev, ...updater },
  );
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedSnapshot = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, serialized);
    } catch {
      // Ignore storage quota / private mode failures
    }
  }
  applyAccessibilityToDocument(next);
  emitChange();
}

export function useAccessibilitySettings() {
  const settings = useSyncExternalStore(
    subscribeAccessibility,
    getAccessibilitySnapshot,
    getAccessibilityServerSnapshot,
  );

  return {
    settings,
    setTheme: (theme: ThemePreference) => updateAccessibilitySettings({ theme }),
    setUiScale: (uiScale: number | string) =>
      updateAccessibilitySettings({ uiScale: clampScale(uiScale) }),
    setReduceMotion: (reduceMotion: boolean) =>
      updateAccessibilitySettings({ reduceMotion }),
  };
}

function getReducedMotionSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  const { reduceMotion } = getAccessibilitySnapshot();
  if (reduceMotion) return true;
  const attr = document.documentElement.getAttribute("data-motion");
  if (attr === "reduce") return true;
  if (attr === "normal") return false;
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(listener: () => void): () => void {
  const unsubStore = subscribeAccessibility(listener);
  if (typeof window === "undefined") return unsubStore;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener?.("change", listener);
  return () => {
    unsubStore();
    media.removeEventListener?.("change", listener);
  };
}

export function useIsReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}
