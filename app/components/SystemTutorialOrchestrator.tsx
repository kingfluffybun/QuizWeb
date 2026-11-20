"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import QuizTutorialOverlay from "@/app/components/quiz/QuizTutorialOverlay";
import {
  beginOnboardingUserSync,
  type ClientOnboardingPayload,
  clearActiveOnboardingUser,
  hydrateUserOnboarding,
  markOnboardingSyncFailed,
  useIsHydrated,
  useQuizHintsPrefs,
} from "@/lib/quiz-hints-store";

const EXCLUDED_TOUR_PREFIXES = [
  "/about",
  "/login",
  "/verify-email",
  "/post-login",
  "/quiz",
  "/quiz-cp",
] as const;

function isExcludedSystemTourPath(pathname: string | null): boolean {
  if (!pathname || pathname === "/") return true;
  return EXCLUDED_TOUR_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function SystemTutorialOrchestrator() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isHydrated = useIsHydrated();
  const {
    prefs,
    isOnboardingReady,
    manualOpenMode,
    requestOpenTutorialMode,
    clearManualOpenMode,
    hasSeenTutorial,
    markTutorialSeen,
  } = useQuizHintsPrefs();

  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      if (syncedUserIdRef.current !== null) {
        syncedUserIdRef.current = null;
        clearActiveOnboardingUser();
      }
      return;
    }

    if (status !== "authenticated") return;
    const rawId = session?.user?.id ?? session?.user?.email;
    const sessionUserId = rawId ? String(rawId).trim() : "";
    if (!sessionUserId || syncedUserIdRef.current === sessionUserId) {
      return;
    }

    syncedUserIdRef.current = sessionUserId;
    let settled = false;
    const controller = new AbortController();

    beginOnboardingUserSync(sessionUserId);

    fetch("/api/onboarding", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as ClientOnboardingPayload;
      })
      .then((payload) => {
        settled = true;
        hydrateUserOnboarding(sessionUserId, payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        settled = true;
        markOnboardingSyncFailed(sessionUserId);
      });

    return () => {
      controller.abort();
      if (!settled && syncedUserIdRef.current === sessionUserId) {
        syncedUserIdRef.current = null;
      }
    };
  }, [status, session?.user?.id, session?.user?.email]);

  let activeMode: "Home" | "Learn" | null = null;
  if (
    status === "authenticated" &&
    isHydrated &&
    isOnboardingReady &&
    !isExcludedSystemTourPath(pathname)
  ) {
    if (manualOpenMode === "Home" || manualOpenMode === "Learn") {
      activeMode = manualOpenMode;
    } else if (prefs.autoShowTutorials) {
      if (
        !prefs.welcomeTourCompleted ||
        (pathname === "/home" && !hasSeenTutorial("Home"))
      ) {
        activeMode = "Home";
      } else if (pathname === "/learn" && !hasSeenTutorial("Learn")) {
        activeMode = "Learn";
      }
    }
  }

  if (!activeMode) return null;

  const isHomeTour = activeMode === "Home";
  const isOnHomePage = pathname === "/home";

  return (
    <QuizTutorialOverlay
      key={`system-${activeMode}`}
      isOpen
      mode={activeMode}
      primaryFinishLabel={
        isHomeTour
          ? isOnHomePage
            ? "Go to Learn →"
            : "Finish Tour"
          : "Start Learning"
      }
      onPrimaryFinish={
        isHomeTour && isOnHomePage
          ? () => {
              markTutorialSeen("Home", { completeWelcome: true });
              clearManualOpenMode();
              router.push("/learn");
            }
          : undefined
      }
      onClose={() => {
        if (isHomeTour) {
          markTutorialSeen("Home", { completeWelcome: true });
        } else {
          markTutorialSeen(activeMode);
        }
        clearManualOpenMode();
      }}
      onKeepOpen={() => requestOpenTutorialMode(activeMode)}
    />
  );
}
