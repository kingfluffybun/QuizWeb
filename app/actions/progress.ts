"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export interface UserLessonProgress {
  progress_id: number;
  user_id: number;
  unit_id: number;
  current_slide_order: number;
  total_slides: number;
  is_completed: boolean;
  completed_at: string | null;
  last_accessed_at: string;
  unit_title: string;
  sec_id: number;
  sec_num: number;
  cat_id: number;
  cat_name: string;
}

export interface UnitProgressItem {
  unit_id: number;
  unit_title: string;
  current_slide_order: number;
  total_slides: number;
  is_completed: boolean;
  percentage: number;
}

export interface UserSectionProgress {
  section: {
    sec_id: number;
    sec_num: number;
    cat_id: number;
    cat_name: string;
  };
  units: UnitProgressItem[];
  overallPercentage: number;
  totalUnits: number;
  completedUnits: number;
}

/**
 * Retrieves the most recently accessed lesson progress for the current user.
 */
export async function getUserLastActiveProgress(
  explicitUserId?: number,
): Promise<UserLessonProgress | null> {
  try {
    let userId = explicitUserId;
    if (!userId) {
      const session = await auth();
      if (!session?.user?.id) return null;
      userId = Number(session.user.id);
    }
    if (!Number.isInteger(userId) || userId < 1) return null;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT 
         p.progress_id,
         p.user_id,
         p.unit_id,
         p.current_slide_order,
         p.total_slides,
         p.is_completed,
         p.completed_at,
         p.last_accessed_at,
         u.unit_title,
         u.sec_id,
         s.sec_num,
         c.cat_id,
         c.cat_name
       FROM user_lesson_progress_tbl p
       JOIN unit_tbl u ON p.unit_id = u.unit_id
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       WHERE p.user_id = ?
       ORDER BY p.last_accessed_at DESC
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      progress_id: Number(r.progress_id),
      user_id: Number(r.user_id),
      unit_id: Number(r.unit_id),
      current_slide_order: Number(r.current_slide_order),
      total_slides: Math.max(1, Number(r.total_slides)),
      is_completed: Boolean(r.is_completed),
      completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      last_accessed_at: new Date(r.last_accessed_at).toISOString(),
      unit_title: String(r.unit_title),
      sec_id: Number(r.sec_id),
      sec_num: Number(r.sec_num),
      cat_id: Number(r.cat_id),
      cat_name: String(r.cat_name),
    };
  } catch (error) {
    console.error("Failed to get user last active progress:", error);
    return null;
  }
}

/**
 * Retrieves the user's progress across units in their active curriculum section.
 */
export async function getUserSectionProgress(
  explicitUserId?: number,
  explicitSectionId?: number,
): Promise<UserSectionProgress> {
  const defaultFallback: UserSectionProgress = {
    section: { sec_id: 1, sec_num: 1, cat_id: 1, cat_name: "HTML" },
    units: [],
    overallPercentage: 0,
    totalUnits: 0,
    completedUnits: 0,
  };

  try {
    let userId = explicitUserId;
    if (!userId) {
      const session = await auth();
      if (!session?.user?.id) return defaultFallback;
      userId = Number(session.user.id);
    }
    if (!Number.isInteger(userId) || userId < 1) return defaultFallback;

    let targetSectionId = explicitSectionId;
    if (!targetSectionId) {
      const [playerRows] = await db.query<RowDataPacket[]>(
        "SELECT current_section FROM player_tbl WHERE user_id = ? LIMIT 1",
        [userId],
      );
      targetSectionId = Number(playerRows[0]?.current_section || 1);
    }

    const [secRows] = await db.query<RowDataPacket[]>(
      `SELECT s.sec_id, s.sec_num, c.cat_id, c.cat_name
       FROM sec_tbl s
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       WHERE s.sec_id = ?
       LIMIT 1`,
      [targetSectionId],
    );

    const sectionMeta = secRows[0]
      ? {
          sec_id: Number(secRows[0].sec_id),
          sec_num: Number(secRows[0].sec_num),
          cat_id: Number(secRows[0].cat_id),
          cat_name: String(secRows[0].cat_name),
        }
      : defaultFallback.section;

    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title,
              COALESCE(sc.slide_count, 1) AS total_slides,
              COALESCE(p.current_slide_order, 0) AS current_slide_order,
              COALESCE(p.is_completed, 0) AS is_completed
       FROM unit_tbl u
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
       ) sc ON u.unit_id = sc.unit_id
       LEFT JOIN user_lesson_progress_tbl p ON u.unit_id = p.unit_id AND p.user_id = ?
       WHERE u.sec_id = ? AND u.status = 'approved'
       ORDER BY u.unit_id ASC`,
      [userId, targetSectionId],
    );

    const units: UnitProgressItem[] = unitRows.map((r) => {
      const totalSlides = Math.max(1, Number(r.total_slides));
      const currentSlide = Math.min(totalSlides, Math.max(0, Number(r.current_slide_order)));
      const isCompleted = Boolean(r.is_completed);
      const percentage = isCompleted
        ? 100
        : Math.min(99, Math.round((currentSlide / totalSlides) * 100));

      return {
        unit_id: Number(r.unit_id),
        unit_title: String(r.unit_title),
        current_slide_order: currentSlide,
        total_slides: totalSlides,
        is_completed: isCompleted,
        percentage,
      };
    });

    const completedUnits = units.filter((u) => u.is_completed).length;
    const overallPercentage =
      units.length > 0
        ? Math.round(
            units.reduce((acc, u) => acc + u.percentage, 0) / units.length,
          )
        : 0;

    return {
      section: sectionMeta,
      units,
      overallPercentage,
      totalUnits: units.length,
      completedUnits,
    };
  } catch (error) {
    console.error("Failed to get user section progress:", error);
    return defaultFallback;
  }
}

/**
 * Records or updates the user's current slide progress in a lesson unit.
 */
export async function recordLessonSlideProgress(
  unitId: number,
  slideOrder: number,
  totalSlides?: number,
  isCompleted = false,
  explicitUserId?: number,
) {
  try {
    let userId = explicitUserId;
    if (!userId) {
      const session = await auth();
      if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
      }
      userId = Number(session.user.id);
    }
    if (!Number.isInteger(userId) || userId < 1) {
      return { success: false, error: "Invalid user ID" };
    }
    if (!Number.isInteger(unitId) || unitId < 1) {
      return { success: false, error: "Invalid unit ID" };
    }
    if (!Number.isInteger(slideOrder) || slideOrder < 1) {
      return { success: false, error: "Invalid slide order" };
    }

    let resolvedTotal = totalSlides;
    if (!resolvedTotal || resolvedTotal < 1) {
      const [slideCountRows] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM lesson_slide_tbl WHERE unit_id = ?",
        [unitId],
      );
      resolvedTotal = Math.max(1, Number(slideCountRows[0]?.total ?? 1));
    }

    const safeSlideOrder = Math.min(resolvedTotal, Math.max(1, slideOrder));
    const completedFlag = isCompleted ? 1 : 0;

    await db.query<ResultSetHeader>(
      `INSERT INTO user_lesson_progress_tbl
         (user_id, unit_id, current_slide_order, total_slides, is_completed, completed_at, last_accessed_at)
       VALUES (?, ?, ?, ?, ?, IF(? = 1, CURRENT_TIMESTAMP, NULL), CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         current_slide_order = VALUES(current_slide_order),
         total_slides = GREATEST(total_slides, VALUES(total_slides)),
         is_completed = IF(VALUES(is_completed) = 1, 1, is_completed),
         completed_at = IF(VALUES(is_completed) = 1, COALESCE(completed_at, CURRENT_TIMESTAMP), completed_at),
         last_accessed_at = CURRENT_TIMESTAMP`,
      [userId, unitId, safeSlideOrder, resolvedTotal, completedFlag, completedFlag],
    );

    const [statusRows] = await db.query<RowDataPacket[]>(
      "SELECT is_completed FROM user_lesson_progress_tbl WHERE user_id = ? AND unit_id = ?",
      [userId, unitId],
    );
    const dbIsCompleted = Boolean(statusRows[0]?.is_completed);

    try {
      revalidatePath("/home");
      revalidatePath("/learn");
    } catch {
      // Safely ignore revalidation outside Next.js request context (e.g. tests)
    }
    return {
      success: true,
      unitId,
      currentSlideOrder: safeSlideOrder,
      totalSlides: resolvedTotal,
      isCompleted: dbIsCompleted,
    };
  } catch (error) {
    console.error("Failed to record lesson slide progress:", error);
    return { success: false, error: "Failed to record slide progress" };
  }
}
