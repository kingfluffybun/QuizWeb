"use client";

import { useState, useTransition } from "react";
import {
  getPendingQuizzes,
  reviewPendingQuiz,
  updatePendingNote,
} from "@/app/actions/quiz";

type PendingQuiz = {
  pending_id: number;
  question_text: string;
  pending_name: string;
  pending_status: string;
  pending_note?: string | null;
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
  const [noteQuiz, setNoteQuiz] = useState<PendingQuiz | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const loadQuizzes = (nextFilter: string) => {
    setFilter(nextFilter);
    startTransition(async () => {
      setQuizzes(await getPendingQuizzes(nextFilter));
    });
  };

  const review = (pendingId: number, decision: "approve" | "reject") => {
    const rejectionNotes =
      decision === "reject"
        ? window.prompt(
            "Add a note explaining what needs to be changed before resubmission:",
          )
        : "";
    if (decision === "reject" && !rejectionNotes?.trim()) return;

    startTransition(async () => {
      const result = await reviewPendingQuiz(
        pendingId,
        decision,
        rejectionNotes ?? "",
      );
      setMessage(result.error ?? result.message ?? null);
      if (result.success) {
        setQuizzes(await getPendingQuizzes(filter));
        window.dispatchEvent(new Event("quizweb-pending-updated"));
      }
    });
  };

  const editNote = (quiz: PendingQuiz) => {
    setNoteQuiz(quiz);
    setNoteDraft(quiz.pending_note ?? "");
  };

  const saveNote = () => {
    if (!noteQuiz || !noteDraft.trim()) return;
    startTransition(async () => {
      const result = await updatePendingNote(noteQuiz.pending_id, noteDraft);
      setMessage(result.error ?? "Note saved.");
      if (result.success) {
        setQuizzes(await getPendingQuizzes(filter));
        setNoteQuiz(null);
        setNoteDraft("");
      }
    });
  };

  return (
    <div className="pending-review-stack">
      <section className="pending-card">
      <div className="pending-heading">
        <div>
          <div className="pending-title-row">
            <h2>Quiz submissions</h2>
          </div>
          <p>
            Approve a submission to publish it to the quiz bank, or reject it
            while keeping its history.
          </p>
        </div>
        <div className="pending-filters" aria-label="Review filter">
          <label className="pending-status-select-wrap">
            <span>Status</span>
            <select
              className={`pending-status-select ${filter}`}
              value={filter}
              onChange={(event) => loadQuizzes(event.target.value)}
              disabled={isPending}
              aria-label="Filter submissions by status"
            >
              <option value="pending">Pending</option>
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
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
              {quiz.pending_status === "rejected" && quiz.pending_note && (
                <div className="rejection-notes" role="note">
                  <strong>Reviewer notes:</strong> {quiz.pending_note}
                </div>
              )}
              {quiz.pending_status === "rejected" && (
                <div className="pending-actions">
                  <button
                    type="button"
                    className="pending-note-button"
                    onClick={() => editNote(quiz)}
                    disabled={isPending}
                  >
                    {quiz.pending_note ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              )}
              {quiz.pending_status === "pending" && (
                <div className="pending-actions">
                  <button
                    type="button"
                    className="pending-approve"
                    onClick={() => review(quiz.pending_id, "approve")}
                    disabled={isPending}
                    title="Approve and publish"
                    aria-label="Approve and publish"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="pending-reject"
                    onClick={() => review(quiz.pending_id, "reject")}
                    disabled={isPending}
                    title="Reject"
                    aria-label="Reject"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      </section>
      {noteQuiz && (
        <section className="pending-card pending-note-editor-card">
          <div className="pending-note-editor-heading">
            <div>
              <h2>Note for Submission {noteQuiz.pending_id}</h2>
              <p>
                Explain what the contributor needs to change before resubmitting
                this quiz.
              </p>
            </div>
            <button
              type="button"
              className="pending-note-cancel"
              onClick={() => {
                setNoteQuiz(null);
                setNoteDraft("");
              }}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
          <textarea
            className="pending-note-textarea"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Describe the changes needed..."
            rows={5}
            autoFocus
          />
          <button
            type="button"
            className="pending-note-save"
            onClick={saveNote}
            disabled={isPending || !noteDraft.trim()}
          >
            {isPending ? "Saving Note..." : "Save Note"}
          </button>
        </section>
      )}
    </div>
  );
}
