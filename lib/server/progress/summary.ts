import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { getNextAvailableSectionId } from "@/lib/curriculum";
import { resolveUserId } from "@/lib/server/session";
import type {
  CurriculumUnlockStateResult,
  UnitProgressItem,
  UserLessonProgress,
  UserSectionProgress,
} from "@/lib/types/progress";
import {
  getCachedApprovedUnitCatalog,
  getCanonicalSectionMeta,
} from "./catalog";
import { getUserCurriculumUnlockStateImpl } from "./unlock";

export async function getUserLastActiveProgressImpl(
  explicitUserId?: number,
  precomputedUnlockState?: CurriculumUnlockStateResult,
): Promise<UserLessonProgress | null> {
  try {
    const userId = await resolveUserId(explicitUserId);
    if (!userId || !Number.isInteger(userId) || userId < 1) return null;

    const [unlockState, allUnits] = await Promise.all([
      precomputedUnlockState
        ? Promise.resolve(precomputedUnlockState)
        : getUserCurriculumUnlockStateImpl(userId),
      getCachedApprovedUnitCatalog(),
    ]);

    if (allUnits.length === 0) return null;

    const allCompleted = allUnits.every((u) =>
      unlockState.completedUnitIds.has(u.unit_id),
    );
    if (allCompleted) {
      const last = allUnits[allUnits.length - 1];
      return {
        progress_id: 0,
        user_id: userId,
        unit_id: last.unit_id,
        current_slide_order: last.total_slides,
        total_slides: last.total_slides,
        is_completed: true,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        unit_title: last.unit_title,
        sec_id: last.sec_id,
        sec_num: last.sec_num,
        sec_title: last.sec_title || undefined,
        difficulty_name: last.difficulty_name || undefined,
        cat_id: last.cat_id,
        cat_name: last.cat_name,
        resume_type: "completed_all",
        next_unit_id: last.unit_id,
        next_unit_title: last.unit_title,
        next_sec_id: last.sec_id,
        next_sec_num: last.sec_num,
        next_cat_name: last.cat_name,
        next_slide_order: last.total_slides,
      };
    }

    const targetUnitId = unlockState.activeUnitId ?? allUnits[0].unit_id;
    const targetUnit =
      allUnits.find((u) => u.unit_id === targetUnitId) ?? allUnits[0];

    const [progRows] = await db.query<RowDataPacket[]>(
      `SELECT progress_id, current_slide_order, is_completed, completed_at, last_accessed_at
       FROM user_lesson_progress_tbl
       WHERE user_id = ? AND unit_id = ?
       LIMIT 1`,
      [userId, targetUnitId],
    );

    const pr = progRows[0];
    const totalSlides = targetUnit.total_slides;
    const currentSlide = pr
      ? Math.min(totalSlides, Math.max(1, Number(pr.current_slide_order || 1)))
      : 1;
    const hasStartedActiveUnit =
      Boolean(pr) && Number(pr.current_slide_order) > 1 && !pr.is_completed;

    return {
      progress_id: pr ? Number(pr.progress_id) : 0,
      user_id: userId,
      unit_id: targetUnitId,
      current_slide_order: currentSlide,
      total_slides: totalSlides,
      is_completed: false,
      completed_at: null,
      last_accessed_at: pr?.last_accessed_at
        ? new Date(pr.last_accessed_at).toISOString()
        : new Date().toISOString(),
      unit_title: targetUnit.unit_title,
      sec_id: targetUnit.sec_id,
      sec_num: targetUnit.sec_num,
      sec_title: targetUnit.sec_title || undefined,
      difficulty_name: targetUnit.difficulty_name || undefined,
      cat_id: targetUnit.cat_id,
      cat_name: targetUnit.cat_name,
      resume_type: hasStartedActiveUnit ? "in_progress" : "up_next",
      next_unit_id: targetUnitId,
      next_unit_title: targetUnit.unit_title,
      next_sec_id: targetUnit.sec_id,
      next_sec_num: targetUnit.sec_num,
      next_cat_name: targetUnit.cat_name,
      next_slide_order: currentSlide,
    };
  } catch (error) {
    console.error("Failed to get user last active progress:", error);
    return null;
  }
}

export async function getUserSectionProgressImpl(
  explicitUserId?: number,
  explicitSectionId?: number,
  precomputedUnlockState?: CurriculumUnlockStateResult,
): Promise<UserSectionProgress> {
  const defaultFallback: UserSectionProgress = {
    section: {
      sec_id: 1,
      sec_num: 1,
      cat_id: 1,
      cat_name: "HTML",
      sec_title: "Getting Started",
      difficulty_id: 1,
      difficulty_name: "Beginner",
      is_locked: false,
    },
    units: [],
    overallPercentage: 0,
    totalUnits: 0,
    completedUnits: 0,
    totalActivities: 0,
    completedActivities: 0,
  };

  try {
    const userId = await resolveUserId(explicitUserId);
    if (!userId || !Number.isInteger(userId) || userId < 1) {
      return defaultFallback;
    }

    const [unlockState, allCatalogUnits] = await Promise.all([
      precomputedUnlockState
        ? Promise.resolve(precomputedUnlockState)
        : getUserCurriculumUnlockStateImpl(userId),
      getCachedApprovedUnitCatalog(),
    ]);

    let targetSectionId =
      explicitSectionId != null && Number.isFinite(Number(explicitSectionId))
        ? Number(explicitSectionId)
        : undefined;

    if (!targetSectionId || targetSectionId < 1) {
      targetSectionId = unlockState.activeSectionId ?? 1;
    }

    const availableSectionIds = new Set(allCatalogUnits.map((u) => u.sec_id));
    if (!explicitSectionId && !availableSectionIds.has(targetSectionId)) {
      const nextAvail = getNextAvailableSectionId(
        targetSectionId,
        availableSectionIds,
      );
      if (nextAvail !== null) {
        targetSectionId = nextAvail;
      } else if (allCatalogUnits[0]?.sec_id) {
        targetSectionId = allCatalogUnits[0].sec_id;
      }
    }

    const sectionCatalogUnits = allCatalogUnits.filter(
      (u) => u.sec_id === targetSectionId,
    );
    const metaSource = sectionCatalogUnits[0];
    const canonicalMeta = getCanonicalSectionMeta(targetSectionId);

    const sectionMeta = metaSource
      ? {
          sec_id: metaSource.sec_id,
          sec_num: metaSource.sec_num,
          cat_id: metaSource.cat_id,
          cat_name: metaSource.cat_name,
          sec_title: metaSource.sec_title,
          difficulty_id: metaSource.difficulty_id,
          difficulty_name: metaSource.difficulty_name,
          is_locked: !unlockState.unlockedSectionIds.has(targetSectionId),
        }
      : {
          ...canonicalMeta,
          is_locked: !unlockState.unlockedSectionIds.has(targetSectionId),
        };

    const progressByUnit = new Map<number, RowDataPacket>();
    const sectionUnitIds = sectionCatalogUnits.map((u) => u.unit_id);
    if (sectionUnitIds.length > 0) {
      const [progRows] = await db.query<RowDataPacket[]>(
        `SELECT unit_id, current_slide_order, is_lesson_completed,
                is_quiz_completed, is_cp_completed, is_completed
         FROM user_lesson_progress_tbl
         WHERE user_id = ? AND unit_id IN (?)`,
        [userId, sectionUnitIds],
      );
      for (const r of progRows) {
        progressByUnit.set(Number(r.unit_id), r);
      }
    }

    const units: UnitProgressItem[] = sectionCatalogUnits.map((u) => {
      const pr = progressByUnit.get(u.unit_id);
      const totalSlides = u.total_slides;
      const currentSlide = Math.min(
        totalSlides,
        Math.max(0, Number(pr?.current_slide_order ?? 0)),
      );
      const isCompleted =
        Boolean(pr?.is_completed) || unlockState.completedUnitIds.has(u.unit_id);
      const isLocked = !unlockState.unlockedUnitIds.has(u.unit_id);
      const percentage = isCompleted
        ? 100
        : Math.min(99, Math.round((currentSlide / totalSlides) * 100));
      const hasQuiz = u.quiz_count > 0;
      const hasCodingAssessment = u.has_coding_assessment;
      const lessonCompleted =
        isCompleted ||
        Boolean(pr?.is_lesson_completed) ||
        currentSlide >= totalSlides;
      const quizCompleted = isCompleted || Boolean(pr?.is_quiz_completed);
      const cpCompleted = isCompleted || Boolean(pr?.is_cp_completed);
      const lessonProgress =
        isCompleted || lessonCompleted
          ? 1
          : Math.min(1, Math.max(0, currentSlide / totalSlides));
      const activityCount = 1 + Number(hasQuiz) + Number(hasCodingAssessment);
      const completedActivityCount =
        Number(lessonCompleted) +
        Number(hasQuiz && quizCompleted) +
        Number(hasCodingAssessment && cpCompleted);
      const activityProgress =
        lessonProgress +
        Number(hasQuiz && quizCompleted) +
        Number(hasCodingAssessment && cpCompleted);

      return {
        unit_id: u.unit_id,
        unit_title: u.unit_title,
        current_slide_order: isLocked ? 0 : currentSlide,
        total_slides: totalSlides,
        is_completed: isCompleted,
        is_locked: isLocked,
        percentage,
        activity_count: activityCount,
        completed_activity_count: completedActivityCount,
        activity_percentage: Math.round((activityProgress / activityCount) * 100),
        unit_order: u.unit_order,
      };
    });

    const completedUnits = units.filter((u) => u.is_completed).length;
    const totalActivities = units.reduce(
      (total, unit) => total + unit.activity_count,
      0,
    );
    const completedActivities = units.reduce(
      (total, unit) => total + unit.completed_activity_count,
      0,
    );
    const activityProgressPoints = units.reduce(
      (total, unit) =>
        total + (unit.activity_percentage / 100) * unit.activity_count,
      0,
    );
    const overallPercentage = totalActivities
      ? Math.round((activityProgressPoints / totalActivities) * 100)
      : 0;

    return {
      section: sectionMeta,
      units,
      overallPercentage,
      totalUnits: units.length,
      completedUnits,
      totalActivities,
      completedActivities,
    };
  } catch (error) {
    console.error("Failed to get user section progress:", error);
    return defaultFallback;
  }
}
