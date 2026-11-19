"use client";

import { useEffect, useEffectEvent } from "react";
import { getPendingQuizById } from "@/app/actions/quiz";
import type { EditingQuizItem, RecentQuizItem, StatusMessage } from "../types";

interface UseStudioEventsOptions {
  initialEditingQuiz?: EditingQuizItem | null;
  showRecentUnits: boolean;
  suppressNextPendingEventRef: React.MutableRefObject<boolean>;
  onReloadList: () => Promise<void>;
  onLoadedPendingUnit: (quiz: RecentQuizItem) => void;
  onStudioLaunch: (toolId: string) => void;
  onError: (msg: StatusMessage) => void;
}

export function useStudioEvents({
  initialEditingQuiz,
  showRecentUnits,
  suppressNextPendingEventRef,
  onReloadList,
  onLoadedPendingUnit,
  onStudioLaunch,
  onError,
}: UseStudioEventsOptions) {
  const handlePendingUpdated = useEffectEvent(() => {
    if (suppressNextPendingEventRef.current) {
      suppressNextPendingEventRef.current = false;
      return;
    }
    if (showRecentUnits) {
      void onReloadList();
    }
  });

  const handleEditLoaded = useEffectEvent((quiz: RecentQuizItem) => {
    onLoadedPendingUnit(quiz);
  });

  const handleLaunch = useEffectEvent((toolId: string) => {
    onStudioLaunch(toolId);
  });

  const handleError = useEffectEvent((msg: StatusMessage) => {
    onError(msg);
  });

  useEffect(() => {
    window.addEventListener("quizweb-pending-updated", handlePendingUpdated);
    return () => {
      window.removeEventListener("quizweb-pending-updated", handlePendingUpdated);
    };
  }, []);

  useEffect(() => {
    if (initialEditingQuiz || typeof window === "undefined") return;

    const loadPendingQuiz = (pendingId: string | null) => {
      if (!pendingId) return;
      const parsedPendingId = Number(pendingId);
      if (!Number.isInteger(parsedPendingId) || parsedPendingId < 1) {
        window.sessionStorage.removeItem("quizweb-edit-pending-id");
        handleError({ type: "error", text: "The pending unit ID is invalid." });
        return;
      }

      void getPendingQuizById(parsedPendingId)
        .then((quiz) => {
          window.sessionStorage.removeItem("quizweb-edit-pending-id");
          if (!quiz || "error" in quiz) {
            handleError({
              type: "error",
              text:
                quiz && "error" in quiz
                  ? quiz.error ?? "The pending unit could not be loaded."
                  : `Could not load pending unit ${parsedPendingId}. It may have been deleted or is no longer available.`,
            });
            return;
          }
          handleEditLoaded(quiz as unknown as RecentQuizItem);
        })
        .catch((error: unknown) => {
          window.sessionStorage.removeItem("quizweb-edit-pending-id");
          console.error("Failed to load pending unit for editing:", error);
          handleError({
            type: "error",
            text:
              error instanceof Error
                ? `The pending unit could not be loaded: ${error.message}`
                : "The pending unit could not be loaded. Please try again.",
          });
        });
    };

    const onEditRequest = (event: Event) => {
      loadPendingQuiz((event as CustomEvent<string>).detail);
    };

    const onLaunchRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ toolId?: string }>).detail;
      handleLaunch((detail?.toolId ?? "unit").toLowerCase());
    };

    window.addEventListener("quizweb-edit-pending", onEditRequest);
    window.addEventListener("quizweb-studio-launch", onLaunchRequest);

    const urlPendingId = new URLSearchParams(window.location.search).get(
      "pending_id",
    );
    const sessionPendingId = window.sessionStorage.getItem(
      "quizweb-edit-pending-id",
    );
    loadPendingQuiz(urlPendingId || sessionPendingId);

    return () => {
      window.removeEventListener("quizweb-edit-pending", onEditRequest);
      window.removeEventListener("quizweb-studio-launch", onLaunchRequest);
    };
  }, [initialEditingQuiz]);
}
