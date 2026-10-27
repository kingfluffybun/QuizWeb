"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  clearLearnCache,
  isLearnCacheWarmed,
  preloadLearnSections,
} from "@/lib/learn-cache";

export default function LearnPreloadSync() {
  const { data: session, status } = useSession();
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const currentUserId = String(session.user.id ?? session.user.email ?? "");
      if (prevUserIdRef.current && prevUserIdRef.current !== currentUserId) {
        clearLearnCache();
      }
      prevUserIdRef.current = currentUserId;

      if (!isLearnCacheWarmed()) {
        preloadLearnSections().catch(() => {
          // Silently ignore background preload errors
        });
      }
    } else if (status === "unauthenticated") {
      if (prevUserIdRef.current !== null) {
        clearLearnCache();
        prevUserIdRef.current = null;
      }
    }
  }, [status, session]);

  return null;
}
