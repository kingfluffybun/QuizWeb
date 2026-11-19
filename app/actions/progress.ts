"use server";

import { revalidatePath } from "next/cache";
import {
  recordCodeProblemCompletionProgressImpl,
  recordLessonSlideProgressImpl,
  recordQuizCompletionProgressImpl,
} from "@/lib/server/progress/mutations";
import { getPreloadLearnSectionDataImpl } from "@/lib/server/progress/preload";
import {
  getUserLastActiveProgressImpl,
  getUserSectionProgressImpl,
} from "@/lib/server/progress/summary";
import {
  getAvailableUnitsForUserImpl,
  getNextCurriculumUnitImpl,
  getUserCurriculumUnlockStateImpl,
  isCodeProblemUnlockedForUserImpl,
  isLessonCompletedForUserImpl,
  isQuizCompletedForUserImpl,
  isUnitUnlockedForUserImpl,
} from "@/lib/server/progress/unlock";

import type { CurriculumUnlockStateResult } from "@/lib/types/progress";

export type {
  CanonicalCurriculumUnitItem,
  CurriculumUnlockStateResult,
  LearnPreloadResponse,
  PreloadedSectionMeta,
  PreloadedUnitPayload,
  UnitProgressItem,
  UserLessonProgress,
  UserSectionProgress,
} from "@/lib/types/progress";

function revalidateLearnProgressPaths(extraPaths: string[] = []) {
  try {
    revalidatePath("/home");
    revalidatePath("/learn");
    revalidatePath("/learn-old");
    for (const p of extraPaths) {
      revalidatePath(p);
    }
  } catch {
    // Safely ignore revalidation outside Next.js request context (e.g. tests)
  }
}

export async function getUserLastActiveProgress(
  explicitUserId?: number,
  precomputedUnlockState?: CurriculumUnlockStateResult,
) {
  return getUserLastActiveProgressImpl(explicitUserId, precomputedUnlockState);
}

export async function getUserCurriculumUnlockState(explicitUserId?: number) {
  return getUserCurriculumUnlockStateImpl(explicitUserId);
}

export async function isUnitUnlockedForUser(
  unitId: number,
  explicitUserId?: number,
) {
  return isUnitUnlockedForUserImpl(unitId, explicitUserId);
}

export async function getAvailableUnitsForUser(explicitUserId?: number) {
  return getAvailableUnitsForUserImpl(explicitUserId);
}

export async function getUserSectionProgress(
  explicitUserId?: number,
  explicitSectionId?: number,
  precomputedUnlockState?: CurriculumUnlockStateResult,
) {
  return getUserSectionProgressImpl(
    explicitUserId,
    explicitSectionId,
    precomputedUnlockState,
  );
}

export async function recordLessonSlideProgress(
  unitId: number,
  slideOrder: number,
  totalSlides?: number,
  isCompleted = false,
  explicitUserId?: number,
  skipUnlockCheck = false,
  isLessonDone = false,
) {
  return recordLessonSlideProgressImpl(
    unitId,
    slideOrder,
    totalSlides,
    isCompleted,
    explicitUserId,
    skipUnlockCheck,
    isLessonDone,
    () => revalidateLearnProgressPaths(),
  );
}

export async function isLessonCompletedForUser(
  unitId: number,
  explicitUserId?: number,
) {
  return isLessonCompletedForUserImpl(unitId, explicitUserId);
}

export async function isQuizCompletedForUser(
  unitId: number,
  explicitUserId?: number,
) {
  return isQuizCompletedForUserImpl(unitId, explicitUserId);
}

export async function isCodeProblemUnlockedForUser(
  unitId: number,
  explicitUserId?: number,
) {
  return isCodeProblemUnlockedForUserImpl(unitId, explicitUserId);
}

export async function recordQuizCompletionProgress(
  unitId: number,
  explicitUserId?: number,
) {
  return recordQuizCompletionProgressImpl(unitId, explicitUserId, () =>
    revalidateLearnProgressPaths(["/quiz", `/quiz/${unitId}`]),
  );
}

export async function recordCodeProblemCompletionProgress(
  unitId: number,
  explicitUserId?: number,
) {
  return recordCodeProblemCompletionProgressImpl(unitId, explicitUserId, () =>
    revalidateLearnProgressPaths(["/quiz", "/quiz-cp", `/quiz-cp/${unitId}`]),
  );
}

export async function getNextCurriculumUnit(currentUnitId: number) {
  return getNextCurriculumUnitImpl(currentUnitId);
}

export async function getPreloadLearnSectionData(
  explicitUserId?: number,
  requestedSectionId?: number,
) {
  return getPreloadLearnSectionDataImpl(explicitUserId, requestedSectionId);
}
