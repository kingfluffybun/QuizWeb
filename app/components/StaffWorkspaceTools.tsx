"use client";

import { useState, useEffect } from "react";
import QuizInputForm from "@/app/input/QuizInputForm";
import type { ComponentProps } from "react";
import type { Category, Difficulty, QuizMetricsData, QuizType, PendingUnit } from "@/app/actions/quiz";
import PendingReview from "@/app/pending/PendingReview";
import "#css/input.css";
import "#css/pending.css";
import "#css/staff-workspace.css";

type QuizInputProps = ComponentProps<typeof QuizInputForm>;
type PendingReviewQuiz = ComponentProps<typeof PendingReview>["initialQuizzes"][number];

function normalizeLessonCard(value: unknown): PendingReviewQuiz["unit_lesson_card_json"] {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const lesson = record.lesson_card;
  if (!lesson || typeof lesson !== "object") return {};
  const lessonRecord = lesson as Record<string, unknown>;
  return {
    lesson_card: {
      lesson_format:
        typeof lessonRecord.lesson_format === "string" ? lessonRecord.lesson_format : undefined,
      lesson_text:
        typeof lessonRecord.lesson_text === "string" ? lessonRecord.lesson_text : undefined,
    },
  };
}

export interface StaffWorkspaceToolsProps {
  categories: Category[];
  difficulties: Difficulty[];
  types: QuizType[];
  sections: QuizInputProps["sections"];
  recentQuizzes: QuizInputProps["initialRecentQuizzes"];
  recentPage: number;
  recentTotalPages: number;
  recentTotalCount: number;
  metrics: QuizMetricsData;
  pendingQuizzes: PendingUnit[];
  canReview: boolean;
}

export default function StaffWorkspaceTools({
  categories,
  difficulties,
  types,
  sections,
  recentQuizzes,
  recentPage,
  recentTotalPages,
  recentTotalCount,
  metrics,
  pendingQuizzes,
  canReview,
}: StaffWorkspaceToolsProps) {
  const [activeTool, setActiveTool] = useState<"input" | "pending">(() =>
    typeof window !== "undefined" && window.location.hash === "#pending-submissions"
      ? "pending"
      : "input",
  );
  const [livePendingQuizzes, setLivePendingQuizzes] = useState<PendingUnit[]>(pendingQuizzes);
  const [activeLaunchLabel, setActiveLaunchLabel] = useState<string | null>(null);

  useEffect(() => {
    setLivePendingQuizzes(pendingQuizzes);
  }, [pendingQuizzes]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === "#pending-submissions") {
        setActiveTool("pending");
      } else if (hash === "#quiz-workspace") {
        setActiveTool("input");
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);

    const handleEdit = () => {
      setActiveTool("input");
      setActiveLaunchLabel("Editing Submission");
      window.setTimeout(() => {
        const formEl =
          document.getElementById("quiz-form") ||
          document.getElementById("quiz-workspace");
        if (formEl) formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    };
    window.addEventListener("quizweb-edit-pending", handleEdit);

    const handleStudioLaunch = (event: Event) => {
      setActiveTool("input");
      const detail = (event as CustomEvent<{ toolId?: string; title?: string }>).detail;
      if (detail?.title) {
        setActiveLaunchLabel(detail.title);
      } else if (detail?.toolId) {
        setActiveLaunchLabel(detail.toolId.toUpperCase());
      } else {
        setActiveLaunchLabel(null);
      }
      window.setTimeout(() => {
        const workspaceEl = document.getElementById("quiz-workspace");
        if (workspaceEl) {
          workspaceEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 40);
    };
    window.addEventListener("quizweb-studio-launch", handleStudioLaunch);

    const handlePendingUpdated = () => {
      void import("@/app/actions/quiz")
        .then(({ getPendingQuizzes }) => getPendingQuizzes("pending"))
        .then((fresh) => {
          if (Array.isArray(fresh)) {
            setLivePendingQuizzes(fresh);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("quizweb-pending-updated", handlePendingUpdated);

    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("quizweb-edit-pending", handleEdit);
      window.removeEventListener("quizweb-studio-launch", handleStudioLaunch);
      window.removeEventListener("quizweb-pending-updated", handlePendingUpdated);
    };
  }, []);

  const reviewQuizzes: PendingReviewQuiz[] = livePendingQuizzes.map((quiz) => ({
    pending_id: quiz.pending_id,
    unit_title: quiz.unit_title,
    sec_num: quiz.sec_num,
    pending_name: quiz.pending_name,
    pending_status: quiz.pending_status,
    pending_note: quiz.pending_note,
    unit_lesson_card_json: normalizeLessonCard(quiz.unit_lesson_card_json),
    unit_quiz_json: quiz.unit_quiz_json,
  }));

  return (
    <section className="staff-workspace" id="quiz-workspace" aria-labelledby="staff-workspace-title">
      <div className="staff-workspace-heading">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <p className="staff-workspace-kicker" style={{ marginBottom: 0 }}>
              Integrated Authoring Studio
            </p>
            {activeLaunchLabel && (
              <span className="staff-workspace-mode-pill">
                Active Mode: {activeLaunchLabel}
              </span>
            )}
          </div>
          <h2 id="staff-workspace-title">Unit, Question &amp; Code Problem Workspace</h2>
          <p>
            Compose interactive lessons, inline quiz checks, and multi-step coding assessments with real-time side-by-side preview.
          </p>
        </div>
        <div className="staff-workspace-tabs" role="tablist" aria-label="Quiz workspace tools">
          <button
            type="button"
            role="tab"
            aria-selected={activeTool === "input"}
            className={`staff-workspace-tab${activeTool === "input" ? " active" : ""}`}
            onClick={() => setActiveTool("input")}
          >
            Create &amp; Edit Units
          </button>
          <button
            type="button"
            role="tab"
            id="pending-submissions"
            aria-selected={activeTool === "pending"}
            className={`staff-workspace-tab${activeTool === "pending" ? " active" : ""}`}
            onClick={() => setActiveTool("pending")}
          >
            Pending Submissions
            <span className="staff-workspace-count">
              {livePendingQuizzes.filter((quiz) => quiz.pending_status === "pending").length}
            </span>
          </button>
        </div>
      </div>

      <div className="staff-workspace-panel" role="tabpanel">
        <div
          className="staff-workspace-input-grid"
          hidden={activeTool !== "input"}
        >
          <QuizInputForm
            categories={categories}
            difficulties={difficulties}
            types={types}
            sections={sections}
            initialRecentQuizzes={recentQuizzes}
            initialPage={recentPage}
            initialTotalPages={recentTotalPages}
            initialTotalCount={recentTotalCount}
            initialMetrics={metrics}
          />
        </div>
        <div
          className={!canReview ? "staff-readonly-pending" : undefined}
          hidden={activeTool !== "pending"}
        >
          {!canReview && (
            <p className="staff-readonly-note">
              Pending submissions are visible here for status tracking. Only administrators can approve or reject submissions.
            </p>
          )}
          <PendingReview initialQuizzes={reviewQuizzes} />
        </div>
      </div>
    </section>
  );
}
