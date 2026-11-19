import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { getNextAvailableSectionId } from "@/lib/curriculum";
import { isStaff } from "@/lib/rbac";
import { resolveUserId, resolveUserRole } from "@/lib/server/session";
import { getCanonicalCurriculumUnitSequence } from "./catalog";
import {
  getNextCurriculumUnitImpl,
  isLessonCompletedForUserImpl,
  isQuizCompletedForUserImpl,
  isUnitUnlockedForUserImpl,
} from "./unlock";

async function checkAndAdvanceSection(
  userId: number,
  unitId: number,
): Promise<number | null> {
  const [unitSecRows] = await db.query<RowDataPacket[]>(
    "SELECT sec_id FROM unit_tbl WHERE unit_id = ? LIMIT 1",
    [unitId],
  );
  const currentSectionId = Number(unitSecRows[0]?.sec_id);
  if (!Number.isInteger(currentSectionId) || currentSectionId <= 0) return null;

  const [[completionCheckRows], canonicalUnits] = await Promise.all([
    db.query<RowDataPacket[]>(
      `SELECT
         COUNT(u.unit_id) AS total_units,
         COUNT(p.unit_id) AS completed_units
       FROM unit_tbl u
       LEFT JOIN user_lesson_progress_tbl p
         ON u.unit_id = p.unit_id AND p.user_id = ? AND p.is_completed = 1
       WHERE u.sec_id = ? AND u.status = 'approved'`,
      [userId, currentSectionId],
    ),
    getCanonicalCurriculumUnitSequence(),
  ]);

  const totalUnits = Number(completionCheckRows[0]?.total_units ?? 0);
  const completedUnits = Number(completionCheckRows[0]?.completed_units ?? 0);

  if (totalUnits > 0 && completedUnits >= totalUnits) {
    const availableSectionIds = new Set<number>(
      canonicalUnits.map((r) => Number(r.sec_id)),
    );
    const nextSectionId = getNextAvailableSectionId(
      currentSectionId,
      availableSectionIds,
    );
    if (nextSectionId !== null) {
      const [playerRows] = await db.query<RowDataPacket[]>(
        "SELECT current_section FROM player_tbl WHERE user_id = ? LIMIT 1",
        [userId],
      );
      const playerCurrentSec = Number(playerRows[0]?.current_section || 1);
      if (playerCurrentSec <= currentSectionId) {
        const [updateResult] = await db.query<ResultSetHeader>(
          "UPDATE player_tbl SET current_section = ? WHERE user_id = ?",
          [nextSectionId, userId],
        );
        if (updateResult.affectedRows === 0) {
          await db.query<ResultSetHeader>(
            `INSERT INTO player_tbl (user_id, username, current_section)
             SELECT user_id, COALESCE(SUBSTRING_INDEX(email, '@', 1), 'User'), ? FROM user_auth_tbl WHERE user_id = ?
             ON DUPLICATE KEY UPDATE current_section = VALUES(current_section)`,
            [nextSectionId, userId],
          );
        }
        return nextSectionId;
      }
    }
  }
  return null;
}

async function fetchUnitStructureCounts(unitId: number): Promise<{
  slideCount: number;
  quizCount: number;
  cpCount: number;
}> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM lesson_slide_tbl WHERE unit_id = ?) AS slide_count,
       (SELECT COUNT(*) FROM quiz_tbl WHERE unit_id = ?) AS quiz_count,
       (SELECT COUNT(*) FROM unit_assessment_tbl WHERE unit_id = ?) AS cp_count`,
    [unitId, unitId, unitId],
  );
  return {
    slideCount: Math.max(1, Number(rows[0]?.slide_count ?? 1)),
    quizCount: Number(rows[0]?.quiz_count ?? 0),
    cpCount: Number(rows[0]?.cp_count ?? 0),
  };
}

export async function recordLessonSlideProgressImpl(
  unitId: number,
  slideOrder: number,
  totalSlides: number | undefined,
  isCompleted: boolean,
  explicitUserId: number | undefined,
  skipUnlockCheck: boolean,
  isLessonDone: boolean,
  onRevalidate: () => void,
) {
  try {
    const userId = await resolveUserId(explicitUserId);
    if (!userId || !Number.isInteger(userId) || userId < 1) {
      return { success: false, error: explicitUserId ? "Invalid user ID" : "Unauthorized" };
    }
    if (!Number.isInteger(unitId) || unitId < 1) {
      return { success: false, error: "Invalid unit ID" };
    }
    if (!Number.isInteger(slideOrder) || slideOrder < 1) {
      return { success: false, error: "Invalid slide order" };
    }

    if (!skipUnlockCheck) {
      const isUnlocked = await isUnitUnlockedForUserImpl(unitId, userId);
      if (!isUnlocked) {
        return { success: false, error: "Unit is locked in the curriculum" };
      }
    }

    let resolvedTotal = totalSlides;
    let hasQuiz = false;
    let hasCp = false;

    if (!resolvedTotal || resolvedTotal < 1 || !isCompleted) {
      const counts = await fetchUnitStructureCounts(unitId);
      if (!resolvedTotal || resolvedTotal < 1) {
        resolvedTotal = counts.slideCount;
      }
      hasQuiz = counts.quizCount > 0;
      hasCp = counts.cpCount > 0;
    }

    const safeSlideOrder = Math.min(resolvedTotal, Math.max(1, slideOrder));
    const lessonCompletedFlag =
      isCompleted || isLessonDone || safeSlideOrder >= resolvedTotal ? 1 : 0;

    const quizCompletedFlag = isCompleted ? 1 : 0;
    const cpCompletedFlag = isCompleted ? 1 : 0;
    const isLessonOnly = !hasQuiz && !hasCp;
    const unitCompletedFlag = isCompleted || (isLessonOnly && lessonCompletedFlag === 1) ? 1 : 0;

    await db.query<ResultSetHeader>(
      `INSERT INTO user_lesson_progress_tbl
         (user_id, unit_id, current_slide_order, total_slides, is_lesson_completed, is_quiz_completed, is_cp_completed, is_completed, completed_at, last_accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 1, CURRENT_TIMESTAMP, NULL), CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         current_slide_order = VALUES(current_slide_order),
         total_slides = GREATEST(total_slides, VALUES(total_slides)),
         is_lesson_completed = IF(VALUES(is_lesson_completed) = 1, 1, is_lesson_completed),
         is_quiz_completed = IF(VALUES(is_quiz_completed) = 1, 1, is_quiz_completed),
         is_cp_completed = IF(VALUES(is_cp_completed) = 1, 1, is_cp_completed),
         is_completed = IF(VALUES(is_completed) = 1, 1, is_completed),
         completed_at = IF(VALUES(is_completed) = 1, COALESCE(completed_at, CURRENT_TIMESTAMP), completed_at),
         last_accessed_at = CURRENT_TIMESTAMP`,
      [
        userId,
        unitId,
        safeSlideOrder,
        resolvedTotal,
        lessonCompletedFlag,
        quizCompletedFlag,
        cpCompletedFlag,
        unitCompletedFlag,
        unitCompletedFlag,
      ],
    );

    const [statusRows] = await db.query<RowDataPacket[]>(
      "SELECT is_lesson_completed, is_completed FROM user_lesson_progress_tbl WHERE user_id = ? AND unit_id = ?",
      [userId, unitId],
    );
    const dbIsLessonCompleted = Boolean(statusRows[0]?.is_lesson_completed);
    const dbIsCompleted = Boolean(statusRows[0]?.is_completed);

    let advancedSectionId: number | null = null;
    if (dbIsCompleted) {
      advancedSectionId = await checkAndAdvanceSection(userId, unitId);
    }

    onRevalidate();

    return {
      success: true,
      unitId,
      currentSlideOrder: safeSlideOrder,
      totalSlides: resolvedTotal,
      isLessonCompleted: dbIsLessonCompleted,
      isCompleted: dbIsCompleted,
      advancedSectionId,
    };
  } catch (error) {
    console.error("Failed to record lesson slide progress:", error);
    return { success: false, error: "Failed to record slide progress" };
  }
}

export async function recordQuizCompletionProgressImpl(
  unitId: number,
  explicitUserId: number | undefined,
  onRevalidate: () => void,
): Promise<{
  success: boolean;
  error?: string;
  isQuizCompleted?: boolean;
  isUnitCompleted?: boolean;
  hasCodingAssessment?: boolean;
  codingAssessmentHref?: string;
  advancedSectionId?: number | null;
}> {
  try {
    const userId = await resolveUserId(explicitUserId);
    if (!userId) return { success: false, error: "Unauthorized" };

    const userRole = await resolveUserRole(userId);
    const isStaffUser = isStaff(userRole);

    if (!isStaffUser) {
      const [isUnitUnlocked, isLessonDone] = await Promise.all([
        isUnitUnlockedForUserImpl(unitId, userId),
        isLessonCompletedForUserImpl(unitId, userId, userRole),
      ]);
      if (!isUnitUnlocked) {
        return { success: false, error: "Unit is locked in curriculum" };
      }
      if (!isLessonDone) {
        return { success: false, error: "Complete Lesson first" };
      }
    }

    const counts = await fetchUnitStructureCounts(unitId);
    const hasCodingAssessment = counts.cpCount > 0;
    const unitCompletedFlag = hasCodingAssessment ? 0 : 1;
    const totalSlides = counts.slideCount;

    await db.query<ResultSetHeader>(
      `INSERT INTO user_lesson_progress_tbl
         (user_id, unit_id, current_slide_order, total_slides, is_lesson_completed, is_quiz_completed, is_cp_completed, is_completed, completed_at, last_accessed_at)
       VALUES (?, ?, ?, ?, 1, 1, 0, ?, IF(? = 1, CURRENT_TIMESTAMP, NULL), CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         current_slide_order = GREATEST(current_slide_order, VALUES(current_slide_order)),
         total_slides = GREATEST(total_slides, VALUES(total_slides)),
         is_lesson_completed = 1,
         is_quiz_completed = 1,
         is_completed = IF(VALUES(is_completed) = 1, 1, is_completed),
         completed_at = IF(VALUES(is_completed) = 1, COALESCE(completed_at, CURRENT_TIMESTAMP), completed_at),
         last_accessed_at = CURRENT_TIMESTAMP`,
      [userId, unitId, totalSlides, totalSlides, unitCompletedFlag, unitCompletedFlag],
    );

    let dbIsCompleted = unitCompletedFlag === 1;
    if (!dbIsCompleted) {
      const [statusRows] = await db.query<RowDataPacket[]>(
        "SELECT is_completed FROM user_lesson_progress_tbl WHERE user_id = ? AND unit_id = ?",
        [userId, unitId],
      );
      dbIsCompleted = Boolean(statusRows[0]?.is_completed);
    }

    let advancedSectionId: number | null = null;
    if (dbIsCompleted) {
      advancedSectionId = await checkAndAdvanceSection(userId, unitId);
    }

    onRevalidate();

    return {
      success: true,
      isQuizCompleted: true,
      isUnitCompleted: dbIsCompleted,
      hasCodingAssessment,
      codingAssessmentHref: hasCodingAssessment ? `/quiz-cp/${unitId}` : undefined,
      advancedSectionId,
    };
  } catch (error) {
    console.error("Failed to record quiz completion progress:", error);
    return { success: false, error: "Failed to record quiz progress" };
  }
}

export async function recordCodeProblemCompletionProgressImpl(
  unitId: number,
  explicitUserId: number | undefined,
  onRevalidate: () => void,
): Promise<{
  success: boolean;
  error?: string;
  isUnitCompleted?: boolean;
  advancedSectionId?: number | null;
  nextUnit?: {
    unit_id: number;
    unit_title: string;
    sec_id: number;
    sec_num: number;
    cat_name: string;
  } | null;
}> {
  try {
    const userId = await resolveUserId(explicitUserId);
    if (!userId) return { success: false, error: "Unauthorized" };

    const userRole = await resolveUserRole(userId);
    const isStaffUser = isStaff(userRole);

    if (!isStaffUser) {
      const [isUnitUnlocked, isQuizDone] = await Promise.all([
        isUnitUnlockedForUserImpl(unitId, userId),
        isQuizCompletedForUserImpl(unitId, userId, userRole),
      ]);
      if (!isUnitUnlocked) {
        return { success: false, error: "Unit is locked in curriculum" };
      }
      if (!isQuizDone) {
        return { success: false, error: "Complete Quiz first" };
      }
    }

    const counts = await fetchUnitStructureCounts(unitId);
    const totalSlides = counts.slideCount;

    await db.query<ResultSetHeader>(
      `INSERT INTO user_lesson_progress_tbl
         (user_id, unit_id, current_slide_order, total_slides, is_lesson_completed, is_quiz_completed, is_cp_completed, is_completed, completed_at, last_accessed_at)
       VALUES (?, ?, ?, ?, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         current_slide_order = GREATEST(current_slide_order, VALUES(current_slide_order)),
         total_slides = GREATEST(total_slides, VALUES(total_slides)),
         is_lesson_completed = 1,
         is_quiz_completed = 1,
         is_cp_completed = 1,
         is_completed = 1,
         completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
         last_accessed_at = CURRENT_TIMESTAMP`,
      [userId, unitId, totalSlides, totalSlides],
    );

    const [advancedSectionId, nextUnit] = await Promise.all([
      checkAndAdvanceSection(userId, unitId),
      getNextCurriculumUnitImpl(unitId),
    ]);

    onRevalidate();

    return {
      success: true,
      isUnitCompleted: true,
      advancedSectionId,
      nextUnit,
    };
  } catch (error) {
    console.error("Failed to record code problem completion progress:", error);
    return { success: false, error: "Failed to record code problem progress" };
  }
}
