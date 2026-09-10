"use client";

import { useState, useTransition } from "react";
import { getPendingQuizzes, reviewPendingQuiz } from "@/app/actions/quiz";

type PendingQuiz = {
  pending_id: number;
  question_text: string;
  pending_name: string;
  pending_status: string;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: {
    options?: string[];
    correct_index?: number;
    answer?: string;
    items?: string[];
    pairs?: { left: string; right: string }[];
    title?: string;
    steps?: { prompt: string; expected: string }[];
  };
};

function formatPayload(quiz: PendingQuiz) {
  const payload = quiz.quiz_payload;
  if (quiz.type_name === "MCQ" && payload.options) {
    return payload.options
      .map(
        (option, index) =>
          `${index === payload.correct_index ? "Correct: " : ""}${option}`,
      )
      .join(" | ");
  }
  if (quiz.type_name === "FITB") return `Answer: ${payload.answer ?? ""}`;
  if (quiz.type_name === "Order") return payload.items?.join(" -> ") ?? "";
  if (quiz.type_name === "Pair") {
    return (
      payload.pairs
        ?.map((pair) => `${pair.left} = ${pair.right}`)
        .join(" | ") ?? ""
    );
  }
  return (
    payload.steps
      ?.map((step) => `${step.prompt}: ${step.expected}`)
      .join(" | ") ??
    payload.title ??
    ""
  );
}

export default function PendingReview({
  initialQuizzes,
}: {
  initialQuizzes: PendingQuiz[];
}) {
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [filter, setFilter] = useState("pending");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const loadQuizzes = (nextFilter: string) => {
    setFilter(nextFilter);
    startTransition(async () => {
      setQuizzes(await getPendingQuizzes(nextFilter));
    });
  };

  const review = (pendingId: number, decision: "approve" | "reject") => {
    startTransition(async () => {
      const result = await reviewPendingQuiz(pendingId, decision);
      setMessage(result.error ?? result.message ?? null);
      if (result.success) setQuizzes(await getPendingQuizzes(filter));
    });
  };

  return (
    <section className="pending-card">
      <div className="pending-heading">
        <div>
          <p className="pending-eyebrow">Content moderation</p>
          <h2>Quiz submissions</h2>
          <p>
            Approve a submission to publish it to the quiz bank, or reject it
            while keeping its history.
          </p>
        </div>
        <div className="pending-filters" aria-label="Review filter">
          {["pending", "all", "approved", "rejected"].map((status) => (
            <button
              key={status}
              type="button"
              className={
                filter === status ? "pending-filter active" : "pending-filter"
              }
              onClick={() => loadQuizzes(status)}
              disabled={isPending}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="status-message status-success">{message}</div>
      )}
      {quizzes.length === 0 ? (
        <div className="pending-empty">
          No {filter === "all" ? "quiz submissions" : `${filter} submissions`}{" "}
          found.
        </div>
      ) : (
        <div className="pending-list">
          {quizzes.map((quiz) => (
            <article className="pending-item" key={quiz.pending_id}>
              <div className="pending-item-header">
                <span className="pending-id">
                  Submission #{quiz.pending_id}
                </span>
                <span className={`pending-status ${quiz.pending_status}`}>
                  {quiz.pending_status}
                </span>
              </div>
              <h3>{quiz.question_text}</h3>
              <p className="pending-meta">
                {quiz.cat_name} / {quiz.difficulty_name} / {quiz.type_name}
                {quiz.sec_num ? ` / Section ${quiz.sec_num}` : ""} / By{" "}
                {quiz.pending_name}
              </p>
              <p className="pending-payload">{formatPayload(quiz)}</p>
              {quiz.pending_status === "pending" && (
                <div className="pending-actions">
                  <button
                    type="button"
                    className="pending-approve"
                    onClick={() => review(quiz.pending_id, "approve")}
                    disabled={isPending}
                  >
                    Approve and publish
                  </button>
                  <button
                    type="button"
                    className="pending-reject"
                    onClick={() => review(quiz.pending_id, "reject")}
                    disabled={isPending}
                  >
                    Reject
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
