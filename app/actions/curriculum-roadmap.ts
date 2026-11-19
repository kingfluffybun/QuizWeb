"use server";

import { db } from "@/lib/db";
import { CANONICAL_SECTIONS, type CanonicalSection } from "@/lib/curriculum";
import { getSectionDescription } from "@/lib/curriculum-descriptions";
import { isStaff } from "@/lib/rbac";
import { getCachedApprovedUnitCatalog } from "@/lib/server/progress/catalog";
import { getUserCurriculumUnlockStateImpl } from "@/lib/server/progress/unlock";
import { resolveUserId, resolveUserRole } from "@/lib/server/session";
import type { RowDataPacket } from "mysql2/promise";

export interface RoadmapUnitNode {
  unit_id: number;
  unit_title: string;
  unit_order: number;
  sec_id: number;
  slide_count: number;
  quiz_count: number;
  has_coding_assessment: boolean;
  is_locked: boolean;
  is_completed: boolean;
  is_lesson_completed: boolean;
  is_quiz_completed: boolean;
  is_cp_completed: boolean;
  current_slide_order: number;
}

export interface RoadmapSection {
  sec_id: number;
  cat_id: number;
  cat_name: "HTML" | "CSS" | "JavaScript";
  sec_num: number;
  sec_title: string;
  difficulty_id: number;
  difficulty_name: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  is_locked: boolean;
  is_completed: boolean;
  total_units: number;
  total_slides: number;
  total_questions: number;
  units: RoadmapUnitNode[];
}

export interface CurriculumRoadmapData {
  sections: RoadmapSection[];
  userProgression: {
    userId?: number;
    activeSectionId: number | null;
    activeUnitId: number | null;
    unlockedSectionIds: number[];
    unlockedUnitIds: number[];
    completedSectionIds: number[];
    completedUnitIds: number[];
    isStaff: boolean;
  };
}

interface UnitProgressRow extends RowDataPacket {
  unit_id: number;
  current_slide_order: number | null;
  is_lesson_completed: number | null;
  is_quiz_completed: number | null;
  is_cp_completed: number | null;
  is_completed: number | null;
}

/**
 * Queries the complete curriculum roadmap data:
 * - 16 canonical sections with descriptions
 * - Cached approved unit catalog joined in-memory with per-user lesson progress
 * - Strict per-user unlock and completion status
 */
export async function getCurriculumRoadmapData(
  explicitUserId?: number,
): Promise<CurriculumRoadmapData> {
  try {
    const resolvedUserId = await resolveUserId(explicitUserId);
    const userId = resolvedUserId ?? undefined;
    const userRole = await resolveUserRole(userId);
    const isStaffUser = isStaff(userRole);

    const [catalog, unlockState, progressRows] = await Promise.all([
      getCachedApprovedUnitCatalog(),
      getUserCurriculumUnlockStateImpl(userId, userRole),
      userId
        ? db
            .query<UnitProgressRow[]>(
              `SELECT
                 unit_id,
                 current_slide_order,
                 is_lesson_completed,
                 is_quiz_completed,
                 is_cp_completed,
                 is_completed
               FROM user_lesson_progress_tbl
               WHERE user_id = ?`,
              [userId],
            )
            .then(([rows]) => rows)
        : Promise.resolve<UnitProgressRow[]>([]),
    ]);

    const progressByUnitId = new Map<number, UnitProgressRow>();
    for (const row of progressRows) {
      progressByUnitId.set(Number(row.unit_id), row);
    }

    const unitsBySection = new Map<number, RoadmapUnitNode[]>();
    for (const unit of catalog) {
      const progress = progressByUnitId.get(unit.unit_id);
      const isCompleted =
        Boolean(progress?.is_completed) ||
        unlockState.completedUnitIds.has(unit.unit_id);
      const isLocked = isStaffUser
        ? false
        : !unlockState.unlockedUnitIds.has(unit.unit_id);
      const currentSlideOrder = Number(progress?.current_slide_order ?? 0);

      const isLessonCompleted =
        isCompleted ||
        Boolean(progress?.is_lesson_completed) ||
        (unit.slide_count > 0 && currentSlideOrder >= unit.slide_count);
      const isQuizCompleted = isCompleted || Boolean(progress?.is_quiz_completed);
      const isCpCompleted = isCompleted || Boolean(progress?.is_cp_completed);

      const node: RoadmapUnitNode = {
        unit_id: unit.unit_id,
        unit_title: unit.unit_title,
        unit_order: unit.unit_order,
        sec_id: unit.sec_id,
        slide_count: unit.slide_count,
        quiz_count: unit.quiz_count,
        has_coding_assessment: unit.has_coding_assessment,
        is_locked: isLocked,
        is_completed: isCompleted,
        is_lesson_completed: isLessonCompleted,
        is_quiz_completed: isQuizCompleted,
        is_cp_completed: isCpCompleted,
        current_slide_order: currentSlideOrder,
      };

      const list = unitsBySection.get(unit.sec_id) ?? [];
      list.push(node);
      unitsBySection.set(unit.sec_id, list);
    }

    const sections: RoadmapSection[] = CANONICAL_SECTIONS.map((sec: CanonicalSection) => {
      const secUnits = unitsBySection.get(sec.sec_id) ?? [];
      const totalUnits = secUnits.length;
      const totalSlides = secUnits.reduce((acc, u) => acc + u.slide_count, 0);
      const totalQuestions = secUnits.reduce((acc, u) => acc + u.quiz_count, 0);
      const isLocked = isStaffUser
        ? false
        : !unlockState.unlockedSectionIds.has(sec.sec_id);
      const isCompleted = unlockState.completedSectionIds.has(sec.sec_id);

      return {
        sec_id: sec.sec_id,
        cat_id: sec.cat_id,
        cat_name: sec.cat_name,
        sec_num: sec.sec_num,
        sec_title: sec.sec_title,
        difficulty_id: sec.difficulty_id,
        difficulty_name: sec.difficulty_name,
        description: getSectionDescription(sec.sec_id),
        is_locked: isLocked,
        is_completed: isCompleted,
        total_units: totalUnits,
        total_slides: totalSlides,
        total_questions: totalQuestions,
        units: secUnits,
      };
    });

    return {
      sections,
      userProgression: {
        userId,
        activeSectionId: unlockState.activeSectionId ?? 1,
        activeUnitId:
          unlockState.activeUnitId ?? (catalog[0]?.unit_id ?? null),
        unlockedSectionIds: Array.from(unlockState.unlockedSectionIds),
        unlockedUnitIds: Array.from(unlockState.unlockedUnitIds),
        completedSectionIds: Array.from(unlockState.completedSectionIds),
        completedUnitIds: Array.from(unlockState.completedUnitIds),
        isStaff: isStaffUser,
      },
    };
  } catch (error) {
    console.error("Failed to get curriculum roadmap data:", error);

    const fallbackSections: RoadmapSection[] = CANONICAL_SECTIONS.map((sec) => ({
      sec_id: sec.sec_id,
      cat_id: sec.cat_id,
      cat_name: sec.cat_name,
      sec_num: sec.sec_num,
      sec_title: sec.sec_title,
      difficulty_id: sec.difficulty_id,
      difficulty_name: sec.difficulty_name,
      description: getSectionDescription(sec.sec_id),
      is_locked: sec.sec_id !== 1,
      is_completed: false,
      total_units: 0,
      total_slides: 0,
      total_questions: 0,
      units: [],
    }));

    return {
      sections: fallbackSections,
      userProgression: {
        userId: explicitUserId,
        activeSectionId: 1,
        activeUnitId: null,
        unlockedSectionIds: [1],
        unlockedUnitIds: [],
        completedSectionIds: [],
        completedUnitIds: [],
        isStaff: false,
      },
    };
  }
}
