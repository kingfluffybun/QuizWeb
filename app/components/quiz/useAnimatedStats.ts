"use client";

import { useEffect, useState } from "react";

export interface AnimatedStats {
  xp: number;
  accuracy: number;
  seconds: number;
}

export function useAnimatedStats(
  active: boolean,
  targetXp: number,
  targetAccuracy: number,
  targetSeconds: number,
): AnimatedStats {
  const [animatedStats, setAnimatedStats] = useState<AnimatedStats>({
    xp: 0,
    accuracy: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!active) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const rafId = requestAnimationFrame(() => {
        setAnimatedStats({
          xp: targetXp,
          accuracy: targetAccuracy,
          seconds: targetSeconds,
        });
      });
      return () => cancelAnimationFrame(rafId);
    }

    const duration = 1000;
    const delay = 150;
    const startTime = performance.now();
    let animationFrameId = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      if (elapsed < delay) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(1, (elapsed - delay) / duration);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setAnimatedStats({
        xp: Math.round(targetXp * easeOut),
        accuracy: Math.round(targetAccuracy * easeOut),
        seconds: Math.round(targetSeconds * easeOut),
      });

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [active, targetXp, targetAccuracy, targetSeconds]);

  return animatedStats;
}
