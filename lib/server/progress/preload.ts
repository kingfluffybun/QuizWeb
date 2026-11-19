import type { RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/db";
import { getNextAvailableSectionId } from "@/lib/curriculum";
import { isStaff } from "@/lib/rbac";
import { resolveUserId, resolveUserRole } from "@/lib/server/session";
import { getCachedSectionUnitsBundle } from "@/lib/server/quiz/queries";
import type {
  LearnPreloadResponse,
  PreloadedUnitPayload,
} from "@/lib/types/progress";
import {
  getCanonicalCurriculumUnitSequence,
  getCanonicalSectionMeta,
} from "./catalog";
import { getUserCurriculumUnlockStateImpl } from "./unlock";

/**
 * Strips private `expectedTemplate` answers from an assessment object before preloading to the client.
 */
function sanitizeAssessmentForClient(
  rawAssessment: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!rawAssessment) return null;
  const rawSteps = Array.isArray(rawAssessment.cp_steps)
    ? rawAssessment.cp_steps
    : null;
  const sanitizedSteps = rawSteps
    ? rawSteps.map((step) => {
        if (!step || typeof step !== "object") return step;
        const copy = { ...(step as Record<string, unknown>) };
        delete copy.expectedTemplate;
        delete copy.expected;
        return copy;
      })
    : undefined;

  return {
    schemaVersion: rawAssessment.schemaVersion ?? 2,
    title: rawAssessment.title ?? "",
    description: rawAssessment.description ?? "",
    expected_outcome: rawAssessment.expected_outcome ?? "",
    steps: rawAssessment.steps ?? [],
    ...(sanitizedSteps ? { cp_steps: sanitizedSteps } : {}),
  };
}

export async function getPreloadLearnSectionDataImpl(
  explicitUserId?: number,
  requestedSectionId?: number,
): Promise<LearnPreloadResponse> {
  const userId = await resolveUserId(explicitUserId);
  const userRole = await resolveUserRole(userId ?? undefined);
  const isStaffUser = isStaff(userRole);

  const [unlockState, canonicalUnits] = await Promise.all([
    getUserCurriculumUnlockStateImpl(userId ?? undefined, userRole),
    getCanonicalCurriculumUnitSequence(),
  ]);

  const availableSectionIds = new Set<number>(
    canonicalUnits.map((u) => u.sec_id),
  );

  const nextUnitMap = new Map<
    number,
    {
      unit_id: number;
      unit_title: string;
      sec_id: number;
      sec_num: number;
      cat_name: string;
    } | null
  >();
  for (let i = 0; i < canonicalUnits.length; i++) {
    const curr = canonicalUnits[i];
    const next = i + 1 < canonicalUnits.length ? canonicalUnits[i + 1] : null;
    nextUnitMap.set(
      curr.unit_id,
      next
        ? {
            unit_id: next.unit_id,
            unit_title: next.unit_title,
            sec_id: next.sec_id,
            sec_num: next.sec_num,
            cat_name: next.cat_name,
          }
        : null,
    );
  }

  const activeSecId = unlockState.activeSectionId ?? 1;
  const nextAfterActive = getNextAvailableSectionId(
    activeSecId,
    availableSectionIds,
  );

  let targetSectionId = activeSecId;
  if (
    requestedSectionId != null &&
    Number.isInteger(Number(requestedSectionId)) &&
    Number(requestedSectionId) > 0
  ) {
    const reqSec = Number(requestedSectionId);
    // Allow preloading requested section only if staff, already unlocked, or immediate next section
    if (
      isStaffUser ||
      unlockState.unlockedSectionIds.has(reqSec) ||
      reqSec === nextAfterActive
    ) {
      targetSectionId = reqSec;
    }
  }

  if (
    availableSectionIds.size > 0 &&
    !availableSectionIds.has(targetSectionId)
  ) {
    const nextAvail = getNextAvailableSectionId(
      targetSectionId,
      availableSectionIds,
    );
    if (nextAvail !== null) {
      targetSectionId = nextAvail;
    } else if (canonicalUnits[0]?.sec_id) {
      targetSectionId = canonicalUnits[0].sec_id;
    }
  }

  const nextSectionId = getNextAvailableSectionId(
    targetSectionId,
    availableSectionIds,
  );

  const [currentSecBundle, nextSecBundle] = await Promise.all([
    getCachedSectionUnitsBundle(targetSectionId),
    nextSectionId != null
      ? getCachedSectionUnitsBundle(nextSectionId)
      : Promise.resolve([]),
  ]);

  const combinedBundle = [...currentSecBundle, ...nextSecBundle];
  const allBundleUnitIds = combinedBundle.map((u) => u.unit_id);

  const userProgressMap = new Map<
    number,
    { current_slide_order: number; is_completed: boolean }
  >();
  if (
    userId &&
    Number.isInteger(userId) &&
    userId > 0 &&
    allBundleUnitIds.length > 0
  ) {
    try {
      const [progRows] = await db.query<RowDataPacket[]>(
        `SELECT unit_id, current_slide_order, is_completed
         FROM user_lesson_progress_tbl
         WHERE user_id = ? AND unit_id IN (?)`,
        [userId, allBundleUnitIds],
      );
      for (const r of progRows) {
        userProgressMap.set(Number(r.unit_id), {
          current_slide_order: Number(r.current_slide_order ?? 0),
          is_completed: Boolean(r.is_completed),
        });
      }
    } catch {
      // Ignore if progress query fails
    }
  }

  const unitsRecord: Record<number, PreloadedUnitPayload> = {};
  const unitIdsList: number[] = [];

  for (const entry of combinedBundle) {
    const uId = entry.unit_id;
    const rawPayload = entry.unitPayload.quiz_payload;
    const lessonCard = rawPayload.lesson_card ?? {
      lesson_title: entry.unit_title,
      lesson_slide: [],
    };

    const slides = Array.isArray(lessonCard.lesson_slide)
      ? lessonCard.lesson_slide.map((s) => ({
          lesson_title: String(s.lesson_title ?? ""),
          lesson_text: String(s.lesson_text ?? ""),
          lesson_code: String(s.lesson_code ?? ""),
        }))
      : [];

    const quizzes = Array.isArray(rawPayload.quizzes) ? rawPayload.quizzes : [];
    const sanitizedAssessment = sanitizeAssessmentForClient(
      rawPayload.assessment && typeof rawPayload.assessment === "object"
        ? rawPayload.assessment
        : null,
    );

    const totalSlides = Math.max(1, slides.length);
    const prog = userProgressMap.get(uId);
    const isCompleted =
      Boolean(prog?.is_completed) || unlockState.completedUnitIds.has(uId);
    const isUnlocked = unlockState.unlockedUnitIds.has(uId);
    const currentSlideOrder = isUnlocked
      ? Math.min(totalSlides, Math.max(0, Number(prog?.current_slide_order ?? 0)))
      : 0;

    unitsRecord[uId] = {
      unit_id: uId,
      unit_title: entry.unit_title,
      unit_order: entry.unit_order,
      sec_id: entry.sec_id,
      sec_num: entry.sec_num,
      cat_id: entry.cat_id,
      cat_name: entry.cat_name,
      difficulty_id: entry.difficulty_id,
      difficulty_name: entry.difficulty_name,
      type_name: "Unit",
      is_unlocked: isUnlocked,
      is_completed: isCompleted,
      current_slide_order: currentSlideOrder,
      total_slides: totalSlides,
      has_coding_assessment: Boolean(sanitizedAssessment),
      quiz_count: quizzes.length,
      lesson_card: {
        lesson_title: String(lessonCard.lesson_title ?? entry.unit_title),
        lesson_slide: slides,
      },
      quizzes,
      assessment: sanitizedAssessment,
      nextUnit: nextUnitMap.get(uId) ?? null,
    };

    unitIdsList.push(uId);
  }

  return {
    currentSection: getCanonicalSectionMeta(targetSectionId),
    nextSection:
      nextSectionId != null ? getCanonicalSectionMeta(nextSectionId) : null,
    activeUnitId: unlockState.activeUnitId,
    activeSectionId: targetSectionId,
    nextSectionId,
    units: unitsRecord,
    unitIds: unitIdsList,
    cachedAt: Date.now(),
    ...(userId ? { userId } : {}),
  };
}
