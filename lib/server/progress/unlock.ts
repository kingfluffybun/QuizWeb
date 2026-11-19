import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import {
  computeCurriculumUnlockState,
  type CanonicalUnitSummary,
} from "@/lib/curriculum";
import { isStaff, type UserRole } from "@/lib/rbac";
import { resolveUserId, resolveUserRole } from "@/lib/server/session";
import {
  fetchAvailableUnitsForStaff,
  getCachedAvailableUnits,
} from "@/lib/server/quiz/queries";
import type { CurriculumUnlockStateResult } from "@/lib/types/progress";
import type { AvailableUnit } from "@/lib/types/quiz";
import { getCanonicalCurriculumUnitSequence } from "./catalog";

export async function getUserCurriculumUnlockStateImpl(
  explicitUserId?: number,
  preResolvedRole?: UserRole,
): Promise<CurriculumUnlockStateResult> {
  try {
    const userId = await resolveUserId(explicitUserId);
    const hasValidUser = Boolean(userId && Number.isInteger(userId) && userId > 0);

    const [allUnitsOrdered, completedUnitIds, userRole] = await Promise.all([
      getCanonicalCurriculumUnitSequence() as Promise<CanonicalUnitSummary[]>,
      hasValidUser
        ? db
            .query<RowDataPacket[]>(
              "SELECT unit_id FROM user_lesson_progress_tbl WHERE user_id = ? AND is_completed = 1",
              [userId],
            )
            .then(([rows]) => {
              const set = new Set<number>();
              for (const pr of rows) set.add(Number(pr.unit_id));
              return set;
            })
        : Promise.resolve(new Set<number>()),
      preResolvedRole !== undefined
        ? Promise.resolve(preResolvedRole)
        : resolveUserRole(userId ?? undefined),
    ]);

    const state = computeCurriculumUnlockState(allUnitsOrdered, completedUnitIds);

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

export async function isUnitUnlockedForUserImpl(
  unitId: number,
  explicitUserId?: number,
): Promise<boolean> {
  const userId = await resolveUserId(explicitUserId);
  const userRole = await resolveUserRole(userId ?? undefined);
  if (isStaff(userRole)) {
    return true;
  }
  const state = await getUserCurriculumUnlockStateImpl(
    userId ?? undefined,
    userRole,
  );
  return state.unlockedUnitIds.has(Number(unitId));
}

export async function getAvailableUnitsForUserImpl(
  explicitUserId?: number,
): Promise<AvailableUnit[]> {
  const userId = await resolveUserId(explicitUserId);
  const userRole = await resolveUserRole(userId ?? undefined);
  const isStaffUser = isStaff(userRole);

  const [units, unlockState] = await Promise.all([
    isStaffUser
      ? fetchAvailableUnitsForStaff(userId ?? undefined)
      : getCachedAvailableUnits(),
    getUserCurriculumUnlockStateImpl(userId ?? undefined, userRole),
  ]);

  return units.map((unit) => ({
    ...unit,
    is_completed: unlockState.completedUnitIds.has(unit.unit_id),
    is_locked: isStaffUser ? false : !unlockState.unlockedUnitIds.has(unit.unit_id),
  }));
}

export async function isLessonCompletedForUserImpl(
  unitId: number,
  explicitUserId?: number,
  preResolvedRole?: UserRole,
): Promise<boolean> {
  const userId = await resolveUserId(explicitUserId);
  const role = preResolvedRole ?? (await resolveUserRole(userId ?? undefined));
  if (isStaff(role)) return true;
  if (!userId) return false;

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT is_lesson_completed, is_completed, current_slide_order, total_slides
     FROM user_lesson_progress_tbl
     WHERE user_id = ? AND unit_id = ? LIMIT 1`,
    [userId, unitId],
  );
  if (rows.length === 0) {
    const [slideRows] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM lesson_slide_tbl WHERE unit_id = ?",
      [unitId],
    );
    return Number(slideRows[0]?.total ?? 0) === 0;
  }
  const r = rows[0];
  return (
    Boolean(r.is_lesson_completed) ||
    Boolean(r.is_completed) ||
    (Number(r.total_slides) > 0 &&
      Number(r.current_slide_order) >= Number(r.total_slides))
  );
}

export async function isQuizCompletedForUserImpl(
  unitId: number,
  explicitUserId?: number,
  preResolvedRole?: UserRole,
): Promise<boolean> {
  const userId = await resolveUserId(explicitUserId);
  const role = preResolvedRole ?? (await resolveUserRole(userId ?? undefined));
  if (isStaff(role)) return true;
  if (!userId) return false;

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT is_quiz_completed, is_completed FROM user_lesson_progress_tbl WHERE user_id = ? AND unit_id = ? LIMIT 1",
    [userId, unitId],
  );
  if (rows.length === 0) {
    const [quizRows] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM quiz_tbl WHERE unit_id = ?",
      [unitId],
    );
    return Number(quizRows[0]?.total ?? 0) === 0;
  }
  return Boolean(rows[0].is_quiz_completed) || Boolean(rows[0].is_completed);
}

export async function isCodeProblemUnlockedForUserImpl(
  unitId: number,
  explicitUserId?: number,
): Promise<boolean> {
  const userId = await resolveUserId(explicitUserId);
  const role = await resolveUserRole(userId ?? undefined);
  if (isStaff(role)) return true;
  if (!userId) return false;

  const [unlockState, quizCompleted] = await Promise.all([
    getUserCurriculumUnlockStateImpl(userId, role),
    isQuizCompletedForUserImpl(unitId, userId, role),
  ]);
  return unlockState.unlockedUnitIds.has(Number(unitId)) && quizCompleted;
}

export async function getNextCurriculumUnitImpl(currentUnitId: number): Promise<{
  unit_id: number;
  unit_title: string;
  sec_id: number;
  sec_num: number;
  cat_name: string;
} | null> {
  try {
    const rows = await getCanonicalCurriculumUnitSequence();
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
