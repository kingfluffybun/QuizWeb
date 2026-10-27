import type {
  LearnPreloadResponse,
  PreloadedUnitPayload,
} from "@/app/actions/progress";
import type { QuizData } from "@/app/quiz/types";

export const LEARN_SECTION_CACHE_KEY = "quizweb_learn_section_cache_v1";
export const LEARN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let inMemoryStore: LearnPreloadResponse | null = null;
let inFlightPromise: Promise<LearnPreloadResponse | null> | null = null;
let inFlightSectionKey: string | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function isCacheFresh(data: LearnPreloadResponse | null): data is LearnPreloadResponse {
  if (!data || typeof data !== "object" || !data.units) return false;
  const age = Date.now() - (Number(data.cachedAt) || 0);
  return age >= 0 && age < LEARN_CACHE_TTL_MS;
}

function readFromSessionStorage(): LearnPreloadResponse | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(LEARN_SECTION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LearnPreloadResponse;
    if (!isCacheFresh(parsed)) {
      window.sessionStorage.removeItem(LEARN_SECTION_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToSessionStorage(data: LearnPreloadResponse): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(LEARN_SECTION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Gracefully ignore storage quota or private mode errors
  }
}

/**
 * Returns the active learn cache snapshot from memory or sessionStorage.
 */
export function getLearnCacheSnapshot(): LearnPreloadResponse | null {
  if (isCacheFresh(inMemoryStore)) {
    return inMemoryStore;
  }
  const restored = readFromSessionStorage();
  if (restored) {
    inMemoryStore = restored;
    return restored;
  }
  inMemoryStore = null;
  return null;
}

/**
 * Explicitly seeds the client learn cache (used by preload response or tests).
 */
export function setLearnCacheData(data: LearnPreloadResponse): void {
  const stamped: LearnPreloadResponse = {
    ...data,
    cachedAt: data.cachedAt || Date.now(),
  };
  inMemoryStore = stamped;
  writeToSessionStorage(stamped);
}

/**
 * Checks whether the client learn cache is populated and fresh.
 * If requiredSectionId is provided, verifies that section is covered by the cache.
 */
export function isLearnCacheWarmed(requiredSectionId?: number): boolean {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return false;
  if (requiredSectionId != null && Number.isInteger(requiredSectionId) && requiredSectionId > 0) {
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

/**
 * Checks whether a specific unitId is present in the client cache.
 */
export function hasCachedUnit(unitId: number): boolean {
  return getCachedUnit(unitId) !== null;
}

/**
 * Returns all cached units belonging to a specific section ID in canonical order.
 */
export function getCachedSectionUnits(secId: number): PreloadedUnitPayload[] {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return [];
  const targetSec = Number(secId);
  return snapshot.unitIds
    .map((id) => snapshot.units[id])
    .filter((u): u is PreloadedUnitPayload => Boolean(u) && u.sec_id === targetSec);
}

/**
 * Returns all cached units for the user's current active section.
 */
export function getCurrentSectionUnits(): PreloadedUnitPayload[] {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return [];
  return getCachedSectionUnits(snapshot.activeSectionId);
}

/**
 * Returns all cached units for the user's next canonical section.
 */
export function getNextSectionUnits(): PreloadedUnitPayload[] {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot || snapshot.nextSectionId == null) return [];
  return getCachedSectionUnits(snapshot.nextSectionId);
}

/**
 * Optimistically marks a unit as completed in the local cache and unlocks its successor
 * so transitions to the next unit are immediate without waiting for a server round-trip.
 */
export function markUnitCompletedLocally(unitId: number): void {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return;
  const id = Number(unitId);
  const unit = snapshot.units[id];
  if (!unit) return;

  unit.is_completed = true;
  unit.current_slide_order = unit.total_slides;

  if (unit.nextUnit?.unit_id) {
    const nextUnit = snapshot.units[unit.nextUnit.unit_id];
    if (nextUnit) {
      nextUnit.is_unlocked = true;
    }
    snapshot.activeUnitId = unit.nextUnit.unit_id;
  }

  writeToSessionStorage(snapshot);
}

/**
 * Optimistically updates a unit's slide progress in the local cache.
 */
export function updateUnitSlideProgressLocally(
  unitId: number,
  slideOrder: number,
): void {
  const snapshot = getLearnCacheSnapshot();
  if (!snapshot) return;
  const id = Number(unitId);
  const unit = snapshot.units[id];
  if (!unit) return;

  const clamped = Math.min(unit.total_slides, Math.max(0, Number(slideOrder) || 0));
  if (clamped > unit.current_slide_order) {
    unit.current_slide_order = clamped;
    writeToSessionStorage(snapshot);
  }
}

/**
 * Clears all preloaded learn section data from memory and sessionStorage (called on sign-out).
 */
export function clearLearnCache(): void {
  inMemoryStore = null;
  inFlightPromise = null;
  inFlightSectionKey = null;
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

  return rawQuizzes.map((entry, index) => {
    const entryRecord = entry as Partial<QuizData> & { type?: string };
    const entryPayload = entryRecord.quiz_payload ?? {};
    const inferredType =
      entryRecord.type_name ??
      entryRecord.type ??
      (Array.isArray(entryPayload.options)
        ? "MCQ"
        : Array.isArray(entryPayload.items)
          ? "Order"
          : Array.isArray(entryPayload.pairs)
            ? "Pair"
            : entryPayload.answer !== undefined
              ? "FITB"
              : "");

    return {
      ...entryRecord,
      unit_id: unit.unit_id,
      unit_title: unit.unit_title,
      unit_lesson_card: unit.lesson_card,
      unit_assessment: unit.assessment ?? {},
      quiz_id: entryRecord.quiz_id ?? unit.unit_id ?? index,
      question_text: entryRecord.question_text ?? unit.unit_title ?? `Question ${index + 1}`,
      cat_id: entryRecord.cat_id ?? unit.cat_id,
      cat_name: entryRecord.cat_name ?? unit.cat_name,
      sec_id: unit.sec_id,
      sec_num: String(unit.sec_num),
      difficulty_id: entryRecord.difficulty_id ?? unit.difficulty_id,
      difficulty_name: entryRecord.difficulty_name ?? unit.difficulty_name,
      quiz_type_id: entryRecord.quiz_type_id ?? 1,
      type_name: inferredType,
      quiz_payload: entryPayload,
    } as QuizData;
  });
}

/**
 * Triggers a GET request to /api/learn/preload to preload the user's current and next
 * learn sections into browser sessionStorage and memory.
 * Deduplicates concurrent in-flight requests.
 */
export async function preloadLearnSections(
  sectionId?: number,
  forceRefresh = false,
): Promise<LearnPreloadResponse | null> {
  if (!forceRefresh && isLearnCacheWarmed(sectionId)) {
    return getLearnCacheSnapshot();
  }

  const reqKey = sectionId != null ? String(sectionId) : "default";
  if (inFlightPromise && inFlightSectionKey === reqKey) {
    return inFlightPromise;
  }

  if (typeof fetch === "undefined") {
    return null;
  }

  const query =
    sectionId != null && Number.isInteger(sectionId) && sectionId > 0
      ? `?sectionId=${encodeURIComponent(String(sectionId))}`
      : "";

  inFlightSectionKey = reqKey;
  inFlightPromise = (async () => {
    try {
      const res = await fetch(`/api/learn/preload${query}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as LearnPreloadResponse;
      if (data && typeof data === "object" && data.units) {
        setLearnCacheData(data);
        return data;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightPromise = null;
      inFlightSectionKey = null;
    }
  })();

  return inFlightPromise;
}
