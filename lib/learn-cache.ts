import type {
  LearnPreloadResponse,
  PreloadedUnitPayload,
} from "@/app/actions/progress";
import type { QuizData } from "@/app/quiz/types";
import { inferQuizTypeName } from "@/app/quiz/unwrap";
import { ensureUnit1AllQuizTypes } from "@/lib/unit1-onboarding-quizzes";

export const LEARN_SECTION_CACHE_KEY = "quizweb_learn_section_cache_v1";
export const LEARN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type StoredLearnPreloadSnapshot = LearnPreloadResponse & {
  userId?: number;
};

let inMemoryStore: StoredLearnPreloadSnapshot | null = null;
let expectedUserId: number | null = null;
const inFlightRequests = new Map<string, Promise<LearnPreloadResponse | null>>();
let cacheGeneration = 0;
let sessionPersistTimer: ReturnType<typeof setTimeout> | null = null;

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
  );
}

function normalizeUserId(userId?: number | string | null): number | null {
  if (userId === undefined || userId === null || userId === "") return null;
  const n = Number(userId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isCacheFresh(
  data: StoredLearnPreloadSnapshot | null,
  ownerUserId: number | null = expectedUserId,
): data is StoredLearnPreloadSnapshot {
  if (!data || typeof data !== "object" || !data.units) return false;
  if (
    ownerUserId !== null &&
    data.userId !== undefined &&
    data.userId !== ownerUserId
  ) {
    return false;
  }
  const age = Date.now() - (Number(data.cachedAt) || 0);
  return age >= 0 && age < LEARN_CACHE_TTL_MS;
}

function readFromSessionStorage(
  ownerUserId: number | null = expectedUserId,
): StoredLearnPreloadSnapshot | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(LEARN_SECTION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLearnPreloadSnapshot;
    if (!isCacheFresh(parsed, ownerUserId)) {
      window.sessionStorage.removeItem(LEARN_SECTION_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToSessionStorageImmediate(data: StoredLearnPreloadSnapshot): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(LEARN_SECTION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Gracefully ignore storage quota or private mode errors
  }
}

function scheduleSessionStorageWrite(data: StoredLearnPreloadSnapshot): void {
  if (!isBrowser()) return;
  if (sessionPersistTimer) {
    clearTimeout(sessionPersistTimer);
  }
  sessionPersistTimer = setTimeout(() => {
    sessionPersistTimer = null;
    if (inMemoryStore === data) {
      writeToSessionStorageImmediate(data);
    }
  }, 250);
}

export function setLearnCacheExpectedUserId(
  userId?: number | string | null,
): void {
  const normalized = normalizeUserId(userId);
  if (
    normalized !== null &&
    inMemoryStore?.userId !== undefined &&
    inMemoryStore.userId !== normalized
  ) {
    clearLearnCache();
  }
  expectedUserId = normalized;
}

/**
 * Returns the active learn cache snapshot from memory or sessionStorage.
 */
export function getLearnCacheSnapshot(
  ownerUserId?: number | string | null,
): LearnPreloadResponse | null {
  const resolvedOwner =
    ownerUserId !== undefined ? normalizeUserId(ownerUserId) : expectedUserId;
  if (isCacheFresh(inMemoryStore, resolvedOwner)) {
    return inMemoryStore;
  }
  const restored = readFromSessionStorage(resolvedOwner);
  if (restored) {
    inMemoryStore = restored;
    return restored;
  }
  inMemoryStore = null;
  return null;
}

/**
 * Explicitly seeds the client learn cache using client `Date.now()` to avoid server/client clock skew.
 */
export function setLearnCacheData(
  data: LearnPreloadResponse,
  userId?: number | string | null,
): void {
  const resolvedUserId =
    normalizeUserId(userId) ??
    normalizeUserId((data as StoredLearnPreloadSnapshot).userId) ??
    expectedUserId ??
    undefined;
  if (resolvedUserId !== undefined) {
    expectedUserId = resolvedUserId;
  }
  const stamped: StoredLearnPreloadSnapshot = {
    ...data,
    ...(resolvedUserId !== undefined ? { userId: resolvedUserId } : {}),
    cachedAt: Date.now(),
  };
  inMemoryStore = stamped;
  if (sessionPersistTimer) {
    clearTimeout(sessionPersistTimer);
    sessionPersistTimer = null;
  }
  writeToSessionStorageImmediate(stamped);
}

/**
 * Checks whether the client learn cache is populated and fresh.
 */
export function isLearnCacheWarmed(requiredSectionId?: number): boolean {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return false;
  if (
    requiredSectionId != null &&
    Number.isInteger(requiredSectionId) &&
    requiredSectionId > 0
  ) {
    return (
      snapshot.activeSectionId === requiredSectionId ||
      snapshot.nextSectionId === requiredSectionId
    );
  }
  return snapshot.unitIds.length > 0;
}

/**
 * Retrieves a preloaded unit by unitId in O(1) time from the client cache.
 */
export function getCachedUnit(unitId: number): PreloadedUnitPayload | null {
  const id = Number(unitId);
  if (!Number.isInteger(id) || id < 1) return null;
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return null;
  return snapshot.units[id] ?? null;
}

export function hasCachedUnit(unitId: number): boolean {
  return getCachedUnit(unitId) !== null;
}

export function getCachedSectionUnits(secId: number): PreloadedUnitPayload[] {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return [];
  const targetSec = Number(secId);
  return snapshot.unitIds
    .map((id) => snapshot.units[id])
    .filter((u): u is PreloadedUnitPayload => Boolean(u) && u.sec_id === targetSec);
}

export function getCurrentSectionUnits(): PreloadedUnitPayload[] {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return [];
  return getCachedSectionUnits(snapshot.activeSectionId);
}

export function getNextSectionUnits(): PreloadedUnitPayload[] {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot || snapshot.nextSectionId == null) return [];
  return getCachedSectionUnits(snapshot.nextSectionId);
}

/**
 * Immutably marks a unit as completed in the local cache and unlocks its successor.
 */
export function markUnitCompletedLocally(unitId: number): void {
  const snapshot = getLearnCacheSnapshot() as StoredLearnPreloadSnapshot | null;
  if (!snapshot) return;
  const id = Number(unitId);
  const unit = snapshot.units[id];
  if (!unit) return;

  const nextUnits: Record<number, PreloadedUnitPayload> = {
    ...snapshot.units,
    [id]: {
      ...unit,
      is_completed: true,
      current_slide_order: unit.total_slides,
    },
  };

  let nextActiveUnitId = snapshot.activeUnitId;
  if (unit.nextUnit?.unit_id) {
    const nextUnit = snapshot.units[unit.nextUnit.unit_id];
    if (nextUnit) {
      nextUnits[unit.nextUnit.unit_id] = {
        ...nextUnit,
        is_unlocked: true,
      };
    }
    nextActiveUnitId = unit.nextUnit.unit_id;
  }

  const updated: StoredLearnPreloadSnapshot = {
    ...snapshot,
    activeUnitId: nextActiveUnitId,
    units: nextUnits,
  };
  inMemoryStore = updated;
  scheduleSessionStorageWrite(updated);
}

/**
 * Immutably updates a unit's slide progress in the local cache (debouncing sessionStorage writes).
 */
export function updateUnitSlideProgressLocally(
  unitId: number,
  slideOrder: number,
): void {
  const snapshot = getLearnCacheSnapshot() as StoredLearnPreloadSnapshot | null;
  if (!snapshot) return;
  const id = Number(unitId);
  const unit = snapshot.units[id];
  if (!unit) return;

  const clamped = Math.min(unit.total_slides, Math.max(0, Number(slideOrder) || 0));
  if (clamped > unit.current_slide_order) {
    const updated: StoredLearnPreloadSnapshot = {
      ...snapshot,
      units: {
        ...snapshot.units,
        [id]: {
          ...unit,
          current_slide_order: clamped,
        },
      },
    };
    inMemoryStore = updated;
    scheduleSessionStorageWrite(updated);
  }
}

/**
 * Clears all preloaded learn section data from memory and sessionStorage (called on sign-out).
 */
export function clearLearnCache(): void {
  cacheGeneration += 1;
  inMemoryStore = null;
  expectedUserId = null;
  inFlightRequests.clear();
  if (sessionPersistTimer) {
    clearTimeout(sessionPersistTimer);
    sessionPersistTimer = null;
  }
  if (isBrowser()) {
    try {
      window.sessionStorage.removeItem(LEARN_SECTION_CACHE_KEY);
    } catch {
      // Ignore storage access errors
    }
  }
}

/**
 * Converts a PreloadedUnitPayload into the unwrapped QuizData[] array expected by QuizLandingClient.
 */
export function toQuizLandingQuizzes(unit: PreloadedUnitPayload): QuizData[] {
  const rawQuizzes = Array.isArray(unit.quizzes) ? unit.quizzes : [];
  if (rawQuizzes.length === 0) {
    return [
      {
        quiz_id: unit.unit_id,
        unit_id: unit.unit_id,
        unit_order: unit.unit_order,
        cat_id: unit.cat_id,
        sec_id: unit.sec_id,
        difficulty_id: unit.difficulty_id,
        quiz_type_id: 0,
        question_text: unit.unit_title,
        cat_name: unit.cat_name,
        sec_num: String(unit.sec_num),
        difficulty_name: unit.difficulty_name,
        type_name: "Unit",
        unit_title: unit.unit_title,
        unit_lesson_card: unit.lesson_card,
        unit_assessment: unit.assessment ?? {},
        quiz_payload: {},
      } as QuizData,
    ];
  }

  const mapped = rawQuizzes.map((entry, index) => {
    const entryRecord = entry as Partial<QuizData> & { type?: string };
    const entryPayload = (entryRecord.quiz_payload ?? {}) as Record<string, unknown>;
    const inferredType = inferQuizTypeName(
      entryRecord.type_name ?? entryRecord.type,
      entryPayload,
    );

    return {
      ...entryRecord,
      unit_id: unit.unit_id,
      unit_order: unit.unit_order,
      unit_title: unit.unit_title,
      unit_lesson_card: unit.lesson_card,
      unit_assessment: unit.assessment ?? {},
      quiz_id: entryRecord.quiz_id ?? -(unit.unit_id * 1000 + index + 1),
      question_text:
        entryRecord.question_text ?? unit.unit_title ?? `Question ${index + 1}`,
      cat_id: entryRecord.cat_id ?? unit.cat_id,
      cat_name: entryRecord.cat_name ?? unit.cat_name,
      sec_id: unit.sec_id,
      sec_num: String(unit.sec_num),
      difficulty_id: entryRecord.difficulty_id ?? unit.difficulty_id,
      difficulty_name: entryRecord.difficulty_name ?? unit.difficulty_name,
      quiz_type_id: entryRecord.quiz_type_id ?? 1,
      type_name: inferredType,
      quiz_payload: entryPayload as QuizData["quiz_payload"],
    } as QuizData;
  });

  return ensureUnit1AllQuizTypes(mapped, {
    secId: unit.sec_id,
    unitOrder: unit.unit_order,
    unitId: unit.unit_id,
  });
}

/**
 * Triggers a GET request to /api/learn/preload to preload the user's current and next
 * learn sections into browser sessionStorage and memory, deduplicated per request key.
 */
export async function preloadLearnSections(
  sectionId?: number,
  forceRefresh = false,
  userId?: number | string | null,
): Promise<LearnPreloadResponse | null> {
  if (userId !== undefined) {
    setLearnCacheExpectedUserId(userId);
  }

  if (!forceRefresh && isLearnCacheWarmed(sectionId)) {
    return getLearnCacheSnapshot();
  }

  const reqKey = sectionId != null ? String(sectionId) : "default";
  const existing = inFlightRequests.get(reqKey);
  if (existing && !forceRefresh) {
    return existing;
  }

  if (typeof fetch === "undefined") {
    return null;
  }

  const query =
    sectionId != null && Number.isInteger(sectionId) && sectionId > 0
      ? `?sectionId=${encodeURIComponent(String(sectionId))}`
      : "";
  const requestGen = cacheGeneration;

  const requestPromise = (async () => {
    try {
      const res = await fetch(`/api/learn/preload${query}`, {
        method: "GET",
        credentials: "include",
        cache: forceRefresh ? "no-store" : "default",
        headers: {
          Accept: "application/json",
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as StoredLearnPreloadSnapshot;
      if (cacheGeneration !== requestGen) {
        return null;
      }
      if (data && typeof data === "object" && data.units) {
        setLearnCacheData(data, data.userId);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  })();

  inFlightRequests.set(reqKey, requestPromise);
  void requestPromise.finally(() => {
    if (inFlightRequests.get(reqKey) === requestPromise) {
      inFlightRequests.delete(reqKey);
    }
  });
  return requestPromise;
}
