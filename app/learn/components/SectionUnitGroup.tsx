import type { RoadmapSection, RoadmapUnitNode } from "@/app/actions/curriculum-roadmap";
import { computeUnitNodeStates, getRoadlinePath } from "@/lib/roadmap-progress";
import {
  BookNodeIcon,
  CheckNodeIcon,
  CodeNodeIcon,
  QuizNodeIcon,
} from "./RoadmapIcons";

interface SectionUnitGroupProps {
  unit: RoadmapUnitNode;
  unitIndex: number;
  section: RoadmapSection;
  isGuest: boolean;
  isStaffUser: boolean;
  firstUnitId: number;
  onSelectNode: (
    unit: RoadmapUnitNode,
    section: RoadmapSection,
    nodeType: "lesson" | "quiz" | "code_problem",
    isCompleted: boolean,
    isLocked: boolean,
    lockReason?: string,
  ) => void;
}

export default function SectionUnitGroup({
  unit,
  unitIndex,
  section,
  isGuest,
  isStaffUser,
  firstUnitId,
  onSelectNode,
}: SectionUnitGroupProps) {
  const {
    hasQuiz,
    hasCp,
    lessonSide,
    quizSide,
    cpSide,
    isLessonCompleted,
    isLessonLocked,
    lessonLockReason,
    isQuizCompleted,
    isQuizLocked,
    quizLockReason,
    isCpCompleted,
    isCpLocked,
    cpLockReason,
  } = computeUnitNodeStates(unit, unitIndex, { isGuest, isStaffUser, firstUnitId });

  const hasNextAfterLesson = hasQuiz || hasCp;
  const hasNextAfterQuiz = hasCp;

  return (
    <div className="curriculum-unit-group">
      <div className="level-row-divider">
        <hr />
        <p>{unit.unit_title}</p>
        <hr />
      </div>

      <div className="level-path">
        {/* Lesson Node */}
        <div className={`level-row path-${lessonSide}`}>
          <div className="level-content">
            <div className="level">
              <button
                type="button"
                className={`level-btn${
                  isLessonCompleted ? " complete" : isLessonLocked ? " disabled" : ""
                }`}
                onClick={() =>
                  onSelectNode(
                    unit,
                    section,
                    "lesson",
                    isLessonCompleted,
                    isLessonLocked,
                    lessonLockReason,
                  )
                }
                aria-label={`Lesson for ${unit.unit_title}${
                  isLessonCompleted
                    ? " (Completed)"
                    : isLessonLocked
                      ? " (Locked)"
                      : " (Current Level)"
                }`}
              >
                {isLessonCompleted ? <CheckNodeIcon /> : <BookNodeIcon />}
              </button>
            </div>
          </div>
          {hasNextAfterLesson && (
            <svg
              className={`roadline ${lessonSide === "left" ? "roadline-to-right" : "roadline-to-left"}`}
              viewBox={lessonSide === "left" ? "0 0 168 113" : "0 0 168 189"}
              aria-hidden="true"
            >
              <path d={getRoadlinePath(lessonSide, "to-top")} />
            </svg>
          )}
        </div>

        {/* Quiz Node */}
        {hasQuiz && (
          <div className={`level-row path-${quizSide}`}>
            <div className="level-content">
              <div className="level">
                <button
                  type="button"
                  className={`level-btn${
                    isQuizCompleted ? " complete" : isQuizLocked ? " disabled" : ""
                  }`}
                  onClick={() =>
                    onSelectNode(
                      unit,
                      section,
                      "quiz",
                      isQuizCompleted,
                      isQuizLocked,
                      quizLockReason,
                    )
                  }
                  aria-label={`Quiz for ${unit.unit_title}${
                    isQuizCompleted ? " (Completed)" : isQuizLocked ? " (Locked)" : ""
                  }`}
                >
                  {isQuizCompleted ? <CheckNodeIcon /> : <QuizNodeIcon />}
                </button>
              </div>
            </div>
            {hasNextAfterQuiz && (
              <svg
                className={`roadline ${quizSide === "left" ? "roadline-to-right" : "roadline-to-left"}`}
                viewBox={quizSide === "left" ? "0 0 168 113" : "0 0 168 189"}
                aria-hidden="true"
              >
                <path d={getRoadlinePath(quizSide, "to-side")} />
              </svg>
            )}
          </div>
        )}

        {/* Code Problem Node */}
        {hasCp && (
          <div className={`level-row path-${cpSide}`}>
            <div className="level-content">
              <div className="level">
                <button
                  type="button"
                  className={`level-btn${
                    isCpCompleted ? " complete" : isCpLocked ? " disabled" : ""
                  }`}
                  onClick={() =>
                    onSelectNode(
                      unit,
                      section,
                      "code_problem",
                      isCpCompleted,
                      isCpLocked,
                      cpLockReason,
                    )
                  }
                  aria-label={`Code Problem for ${unit.unit_title}${
                    isCpCompleted ? " (Completed)" : isCpLocked ? " (Locked)" : ""
                  }`}
                >
                  {isCpCompleted ? <CheckNodeIcon /> : <CodeNodeIcon />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
