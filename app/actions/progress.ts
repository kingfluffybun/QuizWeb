"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  getNextAvailableSectionId,
  computeCurriculumUnlockState,
  type CanonicalUnitSummary,
} from "@/lib/curriculum";
import {
  getAvailableUnits,
  getAvailableUnitsForStaff,
  type AvailableUnit,
} from "@/app/actions/quiz";
import { isStaff, requireStaff } from "@/lib/rbac";
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
  is_locked: boolean;
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
    is_locked?: boolean;
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
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        return null;
      }
      if (!userId) return null;
    }
    if (!Number.isInteger(userId) || userId < 1) return null;

    const unlockState = await getUserCurriculumUnlockState(userId);

    const [allUnitRows] = await db.query<RowDataPacket[]>(
      `SELECT 
         u.unit_id,
         u.unit_title,
         u.unit_order,
         COALESCE(sc.slide_count, 1) AS total_slides,
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
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
       ) sc ON u.unit_id = sc.unit_id
       WHERE u.status = 'approved'
       ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
    );

    if (allUnitRows.length === 0) return null;

    // Check if user completed all approved units in curriculum
    const allCompleted = allUnitRows.every((u) =>
      unlockState.completedUnitIds.has(Number(u.unit_id)),
    );
    if (allCompleted) {
      const last = allUnitRows[allUnitRows.length - 1];
      const lastTotal = Math.max(1, Number(last.total_slides));
      return {
        progress_id: 0,
        user_id: userId,
        unit_id: Number(last.unit_id),
        current_slide_order: lastTotal,
        total_slides: lastTotal,
        is_completed: true,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
        unit_title: String(last.unit_title),
        sec_id: Number(last.sec_id),
        sec_num: Number(last.sec_num),
        sec_title: last.sec_title != null ? String(last.sec_title) : undefined,
        difficulty_name: last.difficulty_name != null ? String(last.difficulty_name) : undefined,
        cat_id: Number(last.cat_id),
        cat_name: String(last.cat_name),
        resume_type: "completed_all",
        next_unit_id: Number(last.unit_id),
        next_unit_title: String(last.unit_title),
        next_sec_id: Number(last.sec_id),
        next_sec_num: Number(last.sec_num),
        next_cat_name: String(last.cat_name),
        next_slide_order: lastTotal,
      };
    }

    // Target unit is strictly the curriculum's active (first incomplete) unit
    const targetUnitId = unlockState.activeUnitId ?? Number(allUnitRows[0].unit_id);
    const targetUnit =
      allUnitRows.find((u) => Number(u.unit_id) === targetUnitId) ?? allUnitRows[0];

    // Check if user has recorded progress on this active unit
    const [progRows] = await db.query<RowDataPacket[]>(
      `SELECT progress_id, current_slide_order, is_completed, completed_at, last_accessed_at
       FROM user_lesson_progress_tbl
       WHERE user_id = ? AND unit_id = ?
       LIMIT 1`,
      [userId, targetUnitId],
    );

    const pr = progRows[0];
    const totalSlides = Math.max(1, Number(targetUnit.total_slides));
    const currentSlide = pr
      ? Math.min(totalSlides, Math.max(1, Number(pr.current_slide_order || 1)))
      : 1;
    const hasStartedActiveUnit = pr && Number(pr.current_slide_order) > 1 && !pr.is_completed;

    const resumeType: "in_progress" | "up_next" | "completed_all" = hasStartedActiveUnit
      ? "in_progress"
      : "up_next";

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
      unit_title: String(targetUnit.unit_title),
      sec_id: Number(targetUnit.sec_id),
      sec_num: Number(targetUnit.sec_num),
      sec_title: targetUnit.sec_title != null ? String(targetUnit.sec_title) : undefined,
      difficulty_name: targetUnit.difficulty_name != null ? String(targetUnit.difficulty_name) : undefined,
      cat_id: Number(targetUnit.cat_id),
      cat_name: String(targetUnit.cat_name),
      resume_type: resumeType,
      next_unit_id: targetUnitId,
      next_unit_title: String(targetUnit.unit_title),
      next_sec_id: Number(targetUnit.sec_id),
      next_sec_num: Number(targetUnit.sec_num),
      next_cat_name: String(targetUnit.cat_name),
      next_slide_order: currentSlide,
    };
  } catch (error) {
    console.error("Failed to get user last active progress:", error);
    return null;
  }
}

/**
 * Resolves the role for a user (maintainer, admin, or user) from session or database.
 */
async function getUserRole(explicitUserId?: number): Promise<string | null> {
  const testSession = (
    globalThis as unknown as {
      __TEST_AUTH_SESSION__?: {
        user?: { id?: string | number; role?: string; user_role?: string };
      } | null;
    }
  ).__TEST_AUTH_SESSION__;

  if (testSession?.user) {
    const sessionUserId = testSession.user.id ? Number(testSession.user.id) : undefined;
    const sessionRole = testSession.user.role || testSession.user.user_role;
    if (sessionRole && (!explicitUserId || explicitUserId === sessionUserId)) {
      return String(sessionRole);
    }
  }

  let sessionUserRole: string | undefined;
  let sessionUserId: number | undefined;
  try {
    const session = await auth();
    if (session?.user) {
      sessionUserId = session.user.id ? Number(session.user.id) : undefined;
      sessionUserRole = (session.user.role as string) || (session.user.user_role as string);
    }
  } catch {
    // Handled gracefully outside Next.js request context
  }

  const targetUserId = explicitUserId ?? sessionUserId;
  if (sessionUserRole && (!explicitUserId || explicitUserId === sessionUserId)) {
    return sessionUserRole;
  }

  if (targetUserId && Number.isInteger(targetUserId) && targetUserId > 0) {
    try {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
        [targetUserId],
      );
      if (rows.length > 0 && rows[0]?.user_role) {
        return String(rows[0].user_role);
      }
    } catch {
      // Graceful fallback
    }
  }

  return null;
}

/**
 * Computes the user's unlocked units and sections across the entire curriculum.
 *
 * Enforces strict per-unit progression for regular users:
 * - A unit is unlocked only if the user has completed its predecessor.
 * - A section becomes available only once all units in the previous section are completed.
 *
 * Maintainers and admins are immune/exempted from these unit tracking limitations;
 * all units and sections are immediately unlocked for staff.
 */
export async function getUserCurriculumUnlockState(
  explicitUserId?: number,
): Promise<{
  unlockedUnitIds: Set<number>;
  unlockedSectionIds: Set<number>;
  completedSectionIds: Set<number>;
  completedUnitIds: Set<number>;
  activeUnitId: number | null;
  activeSectionId: number | null;
}> {
  try {
    let userId = explicitUserId;
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        // Handled gracefully when invoked outside a Next.js request context (e.g., tests/scripts)
      }
    }

    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_order, s.sec_id
       FROM unit_tbl u
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       WHERE u.status = 'approved'
       ORDER BY FIELD(s.sec_id, 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16), u.unit_order ASC, u.unit_id ASC`,
    );

    const allUnitsOrdered: CanonicalUnitSummary[] = unitRows.map((r) => ({
      unit_id: Number(r.unit_id),
      unit_order: Number(r.unit_order || 1),
      sec_id: Number(r.sec_id),
    }));

    const completedUnitIds = new Set<number>();
    if (userId && Number.isInteger(userId) && userId > 0) {
      const [progressRows] = await db.query<RowDataPacket[]>(
        "SELECT unit_id FROM user_lesson_progress_tbl WHERE user_id = ? AND is_completed = 1",
        [userId],
      );
      for (const pr of progressRows) {
        completedUnitIds.add(Number(pr.unit_id));
      }
    }

    const state = computeCurriculumUnlockState(allUnitsOrdered, completedUnitIds);

    // Maintainers and admins are immune/exempted from unit tracking limitations:
    // All approved curriculum units and sections are immediately unlocked for staff.
    const userRole = await getUserRole(userId);
    if (isStaff(userRole)) {
      return {
        unlockedUnitIds: new Set<number>(allUnitsOrdered.map((u) => u.unit_id)),
        unlockedSectionIds: new Set<number>(allUnitsOrdered.map((u) => u.sec_id)),
        completedSectionIds: state.completedSectionIds,
        completedUnitIds,
        activeUnitId: state.activeUnitId,
        activeSectionId: state.activeSectionId,
      };
    }

    return {
      ...state,
      completedUnitIds,
    };
  } catch (error) {
    console.error("Failed to get curriculum unlock state:", error);
    return {
      unlockedUnitIds: new Set<number>([98]),
      unlockedSectionIds: new Set<number>([1]),
      completedSectionIds: new Set<number>(),
      completedUnitIds: new Set<number>(),
      activeUnitId: 98,
      activeSectionId: 1,
    };
  }
}

/**
 * Checks whether a specific unit is currently unlocked for the user.
 * Maintainers and admins are immune to unit tracking limitations and can access any unit.
 */
export async function isUnitUnlockedForUser(
  unitId: number,
  explicitUserId?: number,
): Promise<boolean> {
  const userRole = await getUserRole(explicitUserId);
  if (isStaff(userRole) || (await requireStaff())) {
    return true;
  }
  const state = await getUserCurriculumUnlockState(explicitUserId);
  return state.unlockedUnitIds.has(Number(unitId));
}

/**
 * Returns all available units enriched with user-specific unlock and completion states.
 */
export async function getAvailableUnitsForUser(
  explicitUserId?: number,
): Promise<AvailableUnit[]> {
  const userRole = await getUserRole(explicitUserId);
  const isStaffUser = isStaff(userRole);
  if (isStaffUser) {
    const staffUnits = await getAvailableUnitsForStaff(explicitUserId);
    const unlockState = await getUserCurriculumUnlockState(explicitUserId);
    return staffUnits.map((unit) => ({
      ...unit,
      is_completed: unlockState.completedUnitIds.has(unit.unit_id),
      is_locked: false,
    }));
  }

  const baseUnits = await getAvailableUnits();
  const unlockState = await getUserCurriculumUnlockState(explicitUserId);

  return baseUnits.map((u) => ({
    ...u,
    is_completed: unlockState.completedUnitIds.has(u.unit_id),
    is_locked: !unlockState.unlockedUnitIds.has(u.unit_id),
  }));
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
      is_locked: false,
    },
    units: [],
    overallPercentage: 0,
    totalUnits: 0,
    completedUnits: 0,
  };

  try {
    let userId = explicitUserId;
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        return defaultFallback;
      }
      if (!userId) return defaultFallback;
    }
    if (!Number.isInteger(userId) || userId < 1) return defaultFallback;

    const unlockState = await getUserCurriculumUnlockState(userId);

    let targetSectionId =
      explicitSectionId != null && Number.isFinite(Number(explicitSectionId))
        ? Number(explicitSectionId)
        : undefined;

    if (!targetSectionId || targetSectionId < 1) {
      targetSectionId = unlockState.activeSectionId ?? 1;
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
        is_locked: !unlockState.unlockedSectionIds.has(targetSectionId),
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
      const uId = Number(r.unit_id);
      const totalSlides = Math.max(1, Number(r.total_slides));
      const currentSlide = Math.min(totalSlides, Math.max(0, Number(r.current_slide_order)));
      const isCompleted = Boolean(r.is_completed) || unlockState.completedUnitIds.has(uId);
      const isLocked = !unlockState.unlockedUnitIds.has(uId);
      const percentage = isCompleted
        ? 100
        : Math.min(99, Math.round((currentSlide / totalSlides) * 100));

      return {
        unit_id: uId,
        unit_title: String(r.unit_title),
        current_slide_order: isLocked ? 0 : currentSlide,
        total_slides: totalSlides,
        is_completed: isCompleted,
        is_locked: isLocked,
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
  skipUnlockCheck = false,
) {
  try {
    let userId = explicitUserId;
    if (!userId) {
      try {
        const session = await auth();
        if (session?.user?.id) userId = Number(session.user.id);
      } catch {
        return { success: false, error: "Unauthorized" };
      }
      if (!userId) {
        return { success: false, error: "Unauthorized" };
      }
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

    if (!skipUnlockCheck) {
      const isUnlocked = await isUnitUnlockedForUser(unitId, userId);
      if (!isUnlocked) {
        return { success: false, error: "Unit is locked in the curriculum" };
      }
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
