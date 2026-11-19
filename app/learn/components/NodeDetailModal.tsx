import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import type { SelectedRoadmapNode } from "@/lib/roadmap-progress";
import {
  BookNodeIcon,
  BoxesIcon,
  CloseModalIcon,
  CodeNodeIcon,
  FastForwardIcon,
  QuizQuestionIcon,
} from "./RoadmapIcons";

interface NodeDetailModalProps {
  modalRef: RefObject<HTMLDivElement | null>;
  selectedNode: SelectedRoadmapNode;
  isDetailClosing: boolean;
  isGuest: boolean;
  guestCheckpointSlot: ReactNode;
  guestLockedUnitSlot: ReactNode;
  onClose: () => void;
}

export default function NodeDetailModal({
  modalRef,
  selectedNode,
  isDetailClosing,
  isGuest,
  guestCheckpointSlot,
  guestLockedUnitSlot,
  onClose,
}: NodeDetailModalProps) {
  return (
    <div
      ref={modalRef}
      className={`lesson-detail-container${isDetailClosing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-node-title"
    >
      <button
        type="button"
        className="lesson-detail-close"
        onClick={onClose}
        aria-label="Close details"
      >
        <CloseModalIcon />
      </button>

      <div className="lesson-detail">
        {selectedNode.nodeType === "lesson" && (
          <div className="lesson-detail-icon-label">
            <BookNodeIcon size={24} strokeWidth={2} />
            <p>Learn</p>
          </div>
        )}

        {selectedNode.nodeType === "code_problem" && (
          <div className="lesson-detail-icon-label">
            <CodeNodeIcon size={24} strokeWidth={2} />
            <p>Code Problem</p>
          </div>
        )}

        {selectedNode.nodeType === "quiz" && (
          <div className="lesson-detail-icon-label">
            <QuizQuestionIcon />
            <p>Quiz</p>
          </div>
        )}

        {selectedNode.nodeType === "checkpoint" && (
          <div className="lesson-detail-icon-label">
            <FastForwardIcon size={24} strokeWidth={3} />
            <p>Skip Section</p>
          </div>
        )}

        {selectedNode.nodeType === "coming_soon" && (
          <div className="lesson-detail-icon-label">
            <BoxesIcon />
            <p>Coming Soon</p>
          </div>
        )}

        <h2 id="modal-node-title">{selectedNode.unitTitle}</h2>
      </div>

      {selectedNode.nodeType === "checkpoint" ? (
        isGuest ? (
          guestCheckpointSlot
        ) : (
          <div className="skip-modal-content">
            <p className="skip-modal-desc">
              Skip directly to this section by passing the coding assessment for every preceding
              uncompleted unit.
            </p>
            <div className="section-skip-badges" style={{ marginBottom: "12px" }}>
              <span className="section-skip-chip">⏱️ 5 minutes/Unit</span>
              <span className="section-skip-chip">❤️ 5 lives only</span>
            </div>
            <Link href={`/quiz-cp/skip/${selectedNode.secId}`} className="lesson-link">
              <p>Start Skip Challenge</p>
            </Link>
          </div>
        )
      ) : selectedNode.nodeType === "coming_soon" ? (
        <button
          type="button"
          disabled
          className="lesson-link disabled"
          style={{ cursor: "not-allowed", border: "none" }}
        >
          <p>Coming Soon</p>
        </button>
      ) : selectedNode.isLocked ? (
        <div className="locked-node-modal-content">
          {isGuest ? (
            guestLockedUnitSlot
          ) : (
            <button
              type="button"
              disabled
              className="lesson-link disabled"
              style={{ cursor: "not-allowed", border: "none" }}
            >
              <p>{selectedNode.lockReason ?? "Locked"}</p>
            </button>
          )}
        </div>
      ) : (
        <Link
          href={
            selectedNode.nodeType === "code_problem"
              ? `/quiz-cp/${selectedNode.unitId}`
              : selectedNode.nodeType === "quiz"
                ? `/quiz/${selectedNode.unitId}?start=quiz`
                : `/quiz/${selectedNode.unitId}`
          }
          className="lesson-link"
        >
          <p>
            {selectedNode.nodeType === "code_problem"
              ? selectedNode.isCompleted
                ? "Review Code Problem"
                : "Start Code Problem"
              : selectedNode.nodeType === "quiz"
                ? selectedNode.isCompleted
                  ? "Review Quiz"
                  : "Take Quiz"
                : selectedNode.isCompleted
                  ? "Review Lesson"
                  : "Start Lesson"}
          </p>
        </Link>
      )}
    </div>
  );
}
