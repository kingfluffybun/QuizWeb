"use client";

import { useSyncExternalStore } from "react";

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

export function useEditorTheme(): "vs" | "vs-dark" {
  return useSyncExternalStore(
    subscribeEditorTheme,
    getEditorThemeSnapshot,
    getEditorThemeServerSnapshot,
  );
}
