"use client";

import { useEffect, useSyncExternalStore } from "react";

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

export function useMobileViewport(): boolean {
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    getMobileViewportServerSnapshot,
  );

  // Track visual viewport height on mobile so action bar stays above soft keyboard
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

  return isMobileViewport;
}
