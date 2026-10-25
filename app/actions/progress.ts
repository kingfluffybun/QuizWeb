"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getNextSectionId, getNextAvailableSectionId } from "@/lib/curriculum";
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
  sec_title?: string;
  difficulty_name?: string;
  cat_id: number;
  cat_name: string;
  resume_type?: "in_progress" | "up_next" | "completed_all";
  next_unit_id?: number | null;
  next_unit_title?: string | null;
  next_sec_id?: number | null;
  next_sec_num?: number | null;
  next_cat_name?: string | null;
  next_slide_order?: number | null;
}

export interface UnitProgressItem {
  unit_id: number;
  unit_title: string;
  current_slide_order: number;
  total_slides: number;
  is_completed: boolean;
  percentage: number;
  unit_order?: number;
}

export interface UserSectionProgress {
  section: {
    sec_id: number;
    sec_num: number;
    cat_id: number;
    cat_name: string;
    sec_title?: string;
    difficulty_name?: string;
    difficulty_id?: number;
  };
  units: UnitProgressItem[];
  overallPercentage: number;
  totalUnits: number;
  completedUnits: number;
}

/**
 * Retrieves the most recently accessed lesson progress for the current user,
 * enriched with forward-pointing progression targets so learners never stall.
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
         s.sec_title,
         d.difficulty_name,
         c.cat_id,
         c.cat_name
       FROM user_lesson_progress_tbl p
       JOIN unit_tbl u ON p.unit_id = u.unit_id
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
       WHERE p.user_id = ?
       ORDER BY p.last_accessed_at DESC, p.progress_id DESC
       LIMIT 1`,
      [userId],
    );

    // If user has not started any unit yet, point them to the first canonical approved unit
    if (rows.length === 0) {
      const [firstUnitRows] = await db.query<RowDataPacket[]>(
        `SELECT 
           u.unit_id,
           u.unit_title,
           s.sec_id,
           s.sec_num,
           s.sec_title,
           d.difficulty_name,
           c.cat_id,
           c.cat_name
         FROM unit_tbl u
         JOIN sec_tbl s ON u.sec_id = s.sec_id
         JOIN cat_tbl c ON s.cat_id = c.cat_id
         LEFT JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
         WHERE u.status = 'approved'
         ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC
         LIMIT 1`,
      );
      if (firstUnitRows.length === 0) return null;

      const f = firstUnitRows[0];
      return {
        progress_id: 0,
        user_id: userId,
        unit_id: Number(f.unit_id),
        current_slide_order: 1,
        total_slides: 1,
        is_completed: false,
        completed_at: null,
        last_accessed_at: new Date().toISOString(),
        unit_title: String(f.unit_title),
        sec_id: Number(f.sec_id),
        sec_num: Number(f.sec_num),
        sec_title: f.sec_title != null ? String(f.sec_title) : undefined,
        difficulty_name: f.difficulty_name != null ? String(f.difficulty_name) : undefined,
        cat_id: Number(f.cat_id),
        cat_name: String(f.cat_name),
        resume_type: "up_next",
        next_unit_id: Number(f.unit_id),
        next_unit_title: String(f.unit_title),
        next_sec_id: Number(f.sec_id),
        next_sec_num: Number(f.sec_num),
        next_cat_name: String(f.cat_name),
        next_slide_order: 1,
      };
    }

    const r = rows[0];
    const isCompleted = Boolean(r.is_completed);

    let resumeType: "in_progress" | "up_next" | "completed_all" = isCompleted
      ? "up_next"
      : "in_progress";
    let nextUnitId: number | null = Number(r.unit_id);
    let nextUnitTitle: string | null = String(r.unit_title);
    let nextSecId: number | null = Number(r.sec_id);
    let nextSecNum: number | null = Number(r.sec_num);
    let nextCatName: string | null = String(r.cat_name);
    let nextSlideOrder: number | null = Math.max(1, Number(r.current_slide_order));

    if (isCompleted) {
      // Find the next incomplete approved unit in the canonical progression
      const [allUnitRows] = await db.query<RowDataPacket[]>(
        `SELECT 
           u.unit_id,
           u.unit_title,
           u.unit_order,
           s.sec_id,
           s.sec_num,
           s.sec_title,
           c.cat_name,
           COALESCE(p.is_completed, 0) AS is_completed
         FROM unit_tbl u
         JOIN sec_tbl s ON u.sec_id = s.sec_id
         JOIN cat_tbl c ON s.cat_id = c.cat_id
         LEFT JOIN user_lesson_progress_tbl p ON u.unit_id = p.unit_id AND p.user_id = ?
         WHERE u.status = 'approved'
         ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
        [userId],
      );

      const curIndex = allUnitRows.findIndex(
        (u) => Number(u.unit_id) === Number(r.unit_id),
      );
      // Look forward first
      let targetUnit = allUnitRows
        .slice(curIndex >= 0 ? curIndex + 1 : 0)
        .find((u) => !Number(u.is_completed));

      // If no incomplete unit found ahead, check from beginning
      if (!targetUnit) {
        targetUnit = allUnitRows.find((u) => !Number(u.is_completed));
      }

      if (targetUnit) {
        resumeType = "up_next";
        nextUnitId = Number(targetUnit.unit_id);
        nextUnitTitle = String(targetUnit.unit_title);
        nextSecId = Number(targetUnit.sec_id);
        nextSecNum = Number(targetUnit.sec_num);
        nextCatName = String(targetUnit.cat_name);
        nextSlideOrder = 1;
      } else {
        resumeType = "completed_all";
        nextUnitId = Number(r.unit_id);
        nextUnitTitle = String(r.unit_title);
        nextSecId = Number(r.sec_id);
        nextSecNum = Number(r.sec_num);
        nextCatName = String(r.cat_name);
        nextSlideOrder = Math.max(1, Number(r.total_slides));
      }
    }

    return {
      progress_id: Number(r.progress_id),
      user_id: Number(r.user_id),
      unit_id: Number(r.unit_id),
      current_slide_order: Number(r.current_slide_order),
      total_slides: Math.max(1, Number(r.total_slides)),
      is_completed: isCompleted,
      completed_at: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      last_accessed_at: new Date(r.last_accessed_at).toISOString(),
      unit_title: String(r.unit_title),
      sec_id: Number(r.sec_id),
      sec_num: Number(r.sec_num),
      sec_title: r.sec_title != null ? String(r.sec_title) : undefined,
      difficulty_name: r.difficulty_name != null ? String(r.difficulty_name) : undefined,
      cat_id: Number(r.cat_id),
      cat_name: String(r.cat_name),
      resume_type: resumeType,
      next_unit_id: nextUnitId,
      next_unit_title: nextUnitTitle,
      next_sec_id: nextSecId,
      next_sec_num: nextSecNum,
      next_cat_name: nextCatName,
      next_slide_order: nextSlideOrder,
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
    section: {
      sec_id: 1,
      sec_num: 1,
      cat_id: 1,
      cat_name: "HTML",
      sec_title: "Getting Started",
      difficulty_id: 1,
      difficulty_name: "Beginner",
    },
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

    let targetSectionId =
      explicitSectionId != null && Number.isFinite(Number(explicitSectionId))
        ? Number(explicitSectionId)
        : undefined;

    if (!targetSectionId || targetSectionId < 1) {
      const [playerRows] = await db.query<RowDataPacket[]>(
        "SELECT current_section FROM player_tbl WHERE user_id = ? LIMIT 1",
        [userId],
      );
      targetSectionId = Number(playerRows[0]?.current_section || 1);
    }

    if (!explicitSectionId) {
      // Check if targetSectionId has approved units; if not, route to nearest section with units
      const [hasUnitsRows] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM unit_tbl WHERE sec_id = ? AND status = 'approved'",
        [targetSectionId],
      );
      if (Number(hasUnitsRows[0]?.total ?? 0) === 0) {
        const [availableSecRows] = await db.query<RowDataPacket[]>(
          "SELECT DISTINCT sec_id FROM unit_tbl WHERE status = 'approved'",
        );
        const availableSectionIds = new Set<number>(
          availableSecRows.map((r) => Number(r.sec_id)),
        );
        const nextAvail = getNextAvailableSectionId(
          targetSectionId,
          availableSectionIds,
        );
        if (nextAvail !== null) {
          targetSectionId = nextAvail;
        } else if (availableSectionIds.size > 0) {
          const [firstAvail] = await db.query<RowDataPacket[]>(
            `SELECT s.sec_id FROM sec_tbl s
             JOIN unit_tbl u ON s.sec_id = u.sec_id AND u.status = 'approved'
             ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16) LIMIT 1`,
          );
          if (firstAvail[0]?.sec_id) {
            targetSectionId = Number(firstAvail[0].sec_id);
          }
        }
      }
    }

    const [secRows] = await db.query<RowDataPacket[]>(
      `SELECT s.sec_id, s.sec_num, s.sec_title, s.difficulty_id, d.difficulty_name, c.cat_id, c.cat_name
       FROM sec_tbl s
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
       WHERE s.sec_id = ?
       LIMIT 1`,
      [targetSectionId],
    );

    let sectionMeta = defaultFallback.section;
    if (secRows[0]) {
      sectionMeta = {
        sec_id: Number(secRows[0].sec_id),
        sec_num: Number(secRows[0].sec_num),
        cat_id: Number(secRows[0].cat_id),
        cat_name: String(secRows[0].cat_name),
        sec_title: String(secRows[0].sec_title ?? ""),
        difficulty_id: Number(secRows[0].difficulty_id ?? 1),
        difficulty_name: String(secRows[0].difficulty_name ?? "Beginner"),
      };
    } else {
      // If targetSectionId is invalid/missing in sec_tbl, fall back targetSectionId to Section 1
      targetSectionId = defaultFallback.section.sec_id;
    }

    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.unit_order,
              COALESCE(sc.slide_count, 1) AS total_slides,
              COALESCE(p.current_slide_order, 0) AS current_slide_order,
              COALESCE(p.is_completed, 0) AS is_completed
       FROM unit_tbl u
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
       ) sc ON u.unit_id = sc.unit_id
       LEFT JOIN user_lesson_progress_tbl p ON u.unit_id = p.unit_id AND p.user_id = ?
       WHERE u.sec_id = ? AND u.status = 'approved'
       ORDER BY u.unit_order ASC, u.unit_id ASC`,
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
        unit_order: r.unit_order != null ? Number(r.unit_order) : 1,
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
 * Automatically advances player_tbl.current_section when all units in a section are completed.
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

    // Auto-advance player_tbl.current_section if all approved units in this unit's section are now completed
    let advancedSectionId: number | null = null;
    if (dbIsCompleted) {
      const [unitSecRows] = await db.query<RowDataPacket[]>(
        "SELECT sec_id FROM unit_tbl WHERE unit_id = ? LIMIT 1",
        [unitId],
      );
      const currentSectionId = Number(unitSecRows[0]?.sec_id);

      if (Number.isInteger(currentSectionId) && currentSectionId > 0) {
        const [completionCheckRows] = await db.query<RowDataPacket[]>(
          `SELECT 
             COUNT(u.unit_id) AS total_units,
             COUNT(p.unit_id) AS completed_units
           FROM unit_tbl u
           LEFT JOIN user_lesson_progress_tbl p 
             ON u.unit_id = p.unit_id AND p.user_id = ? AND p.is_completed = 1
           WHERE u.sec_id = ? AND u.status = 'approved'`,
          [userId, currentSectionId],
        );

        const totalUnits = Number(completionCheckRows[0]?.total_units ?? 0);
        const completedUnits = Number(completionCheckRows[0]?.completed_units ?? 0);

        if (totalUnits > 0 && completedUnits >= totalUnits) {
          const [availableSecRows] = await db.query<RowDataPacket[]>(
            "SELECT DISTINCT sec_id FROM unit_tbl WHERE status = 'approved'",
          );
          const availableSectionIds = new Set<number>(
            availableSecRows.map((r) => Number(r.sec_id)),
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
              advancedSectionId = nextSectionId;
            }
          }
        }
      }
    }

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
      advancedSectionId,
    };
  } catch (error) {
    console.error("Failed to record lesson slide progress:", error);
    return { success: false, error: "Failed to record slide progress" };
  }
}

/**
 * Resolves the next approved unit in canonical curriculum sequence following currentUnitId.
 */
export async function getNextCurriculumUnit(currentUnitId: number): Promise<{
  unit_id: number;
  unit_title: string;
  sec_id: number;
  sec_num: number;
  cat_name: string;
} | null> {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT 
         u.unit_id,
         u.unit_title,
         s.sec_id,
         s.sec_num,
         c.cat_name
       FROM unit_tbl u
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       WHERE u.status = 'approved'
       ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
    );

    if (rows.length === 0) return null;
    const currentIndex = rows.findIndex(
      (r) => Number(r.unit_id) === Number(currentUnitId),
    );
    if (currentIndex === -1 || currentIndex >= rows.length - 1) {
      return null;
    }
    const nextRow = rows[currentIndex + 1];
    return {
      unit_id: Number(nextRow.unit_id),
      unit_title: String(nextRow.unit_title),
      sec_id: Number(nextRow.sec_id),
      sec_num: Number(nextRow.sec_num),
      cat_name: String(nextRow.cat_name),
    };
  } catch (error) {
    console.error("Failed to get next curriculum unit:", error);
    return null;
  }
}
