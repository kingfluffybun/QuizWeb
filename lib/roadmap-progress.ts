import type { RoadmapUnitNode } from "@/app/actions/curriculum-roadmap";

export type RoadlineStartSide = "left" | "right";
export type RoadlineSegment = "to-top" | "to-side";

export interface SelectedRoadmapNode {
  unitId?: number;
  unitTitle: string;
  secId: number;
  secNum: number;
  catName: string;
  nodeType: "lesson" | "quiz" | "code_problem" | "checkpoint" | "coming_soon";
  isCompleted: boolean;
  isLocked: boolean;
  lockReason?: string;
  slideCount?: number;
  quizCount?: number;
}

export function getRoadlinePath(
  startSide: RoadlineStartSide,
  segment: RoadlineSegment,
): string {
  if (segment === "to-top") {
    return startSide === "left"
      ? "M 101 38 H 138 Q 168 38 168 68 V 113"
      : "M 123 38 H 86 Q 56 38 56 68 V 113";
  }

  return startSide === "left"
    ? "M 56 77 V 121 Q 56 151 86 151 H 123"
    : "M 168 77 V 121 Q 168 151 138 151 H 101";
}

export function isRoadmapLessonComplete(unit: RoadmapUnitNode): boolean {
  return (
    unit.is_completed ||
    Boolean(unit.is_lesson_completed) ||
    (unit.slide_count > 0 && unit.current_slide_order >= unit.slide_count)
  );
}

export function isRoadmapQuizComplete(unit: RoadmapUnitNode): boolean {
  return unit.is_completed || Boolean(unit.is_quiz_completed);
}

export function isRoadmapCpComplete(unit: RoadmapUnitNode): boolean {
  return unit.is_completed || Boolean(unit.is_cp_completed);
}

export function computeSectionStats(units: RoadmapUnitNode[]) {
  let totalLevels = 0;
  let completedLevels = 0;
  let sectionProgressPoints = 0;

  for (const unit of units) {
    const hasQuiz = unit.quiz_count > 0;
    const hasCp = unit.has_coding_assessment;
    totalLevels += 1 + Number(hasQuiz) + Number(hasCp);

    const lessonDone = isRoadmapLessonComplete(unit);
    const quizDone = hasQuiz && isRoadmapQuizComplete(unit);
    const cpDone = hasCp && isRoadmapCpComplete(unit);

    completedLevels += Number(lessonDone) + Number(quizDone) + Number(cpDone);

    const lessonProgress =
      unit.is_completed || lessonDone
        ? 1
        : unit.slide_count > 0
          ? Math.min(1, Math.max(0, unit.current_slide_order / unit.slide_count))
          : 0;
    sectionProgressPoints += lessonProgress + Number(quizDone) + Number(cpDone);
  }

  const sectionProgress = totalLevels
    ? Math.round((sectionProgressPoints / totalLevels) * 100)
    : 0;

  return { totalLevels, completedLevels, sectionProgress };
}

export interface UnitNodeStates {
  hasQuiz: boolean;
  hasCp: boolean;
  lessonSide: RoadlineStartSide;
  quizSide: RoadlineStartSide;
  cpSide: RoadlineStartSide;
  isLessonCompleted: boolean;
  isLessonLocked: boolean;
  lessonLockReason?: string;
  isQuizCompleted: boolean;
  isQuizLocked: boolean;
  quizLockReason?: string;
  isCpCompleted: boolean;
  isCpLocked: boolean;
  cpLockReason?: string;
}

export function computeUnitNodeStates(
  unit: RoadmapUnitNode,
  unitIndex: number,
  options: { isGuest: boolean; isStaffUser: boolean; firstUnitId: number },
): UnitNodeStates {
  const { isGuest, isStaffUser, firstUnitId } = options;
  const startSide: RoadlineStartSide = unitIndex % 2 === 0 ? "left" : "right";
  const hasQuiz = unit.quiz_count > 0;
  const hasCp = unit.has_coding_assessment;
  const lessonSide: RoadlineStartSide = startSide;
  const quizSide: RoadlineStartSide = lessonSide === "left" ? "right" : "left";
  const cpSide: RoadlineStartSide = hasQuiz
    ? quizSide === "left"
      ? "right"
      : "left"
    : lessonSide === "left"
      ? "right"
      : "left";

  const isGuestUnitLocked = isGuest && unit.unit_id !== firstUnitId;

  const isLessonCompleted = isRoadmapLessonComplete(unit);
  const isLessonLocked = isStaffUser
    ? false
    : isGuestUnitLocked
      ? true
      : unit.is_locked;
  const lessonLockReason = isGuestUnitLocked
    ? "Sign in to unlock"
    : isLessonLocked
      ? "Locked"
      : undefined;

  const isQuizCompleted = isRoadmapQuizComplete(unit);
  const isQuizLocked = isStaffUser
    ? false
    : isGuestUnitLocked
      ? true
      : unit.is_locked || (!isLessonCompleted && unit.slide_count > 0);
  const quizLockReason = isGuestUnitLocked
    ? "Sign in to unlock"
    : unit.is_locked
      ? "Locked"
      : !isLessonCompleted && unit.slide_count > 0
        ? "Complete Lesson first"
        : undefined;

  const isCpCompleted = isRoadmapCpComplete(unit);
  const isCpPrerequisiteMet = hasQuiz ? isQuizCompleted : isLessonCompleted;
  const isCpLocked = isStaffUser
    ? false
    : isGuestUnitLocked
      ? true
      : unit.is_locked || !isCpPrerequisiteMet;
  const cpLockReason = isGuestUnitLocked
    ? "Sign in to unlock"
    : unit.is_locked
      ? "Locked"
      : hasQuiz && !isQuizCompleted
        ? "Complete Quiz first"
        : !isLessonCompleted
          ? "Complete Lesson first"
          : undefined;

  return {
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
  };
}
