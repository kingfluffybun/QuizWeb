"use server";

import { revalidatePath } from "next/cache";
import { invalidateCacheTag } from "@/lib/server/cache";
import { getCachedQuizMetrics } from "@/lib/server/quiz/metrics";
import {
  deleteQuizImpl,
  deleteUnitImpl,
  saveUnitImpl,
  updatePendingUnitFromFormImpl,
  updateQuizImpl,
} from "@/lib/server/quiz/mutations";
import {
  fetchPendingQuizById,
  fetchPendingQuizzes,
  reviewPendingQuizImpl,
  updatePendingNoteImpl,
} from "@/lib/server/quiz/pending";
import {
  fetchAvailableUnitsForStaff,
  fetchCodeProblems,
  fetchPaginatedRecentQuizzes,
  fetchPaginatedRecentUnits,
  fetchQuizOrUnitById,
  fetchQuizzes,
  getCachedAvailableUnits,
  getCachedQuizMetadata,
  getCachedSectionUnitsBundle,
  getCachedUnitById,
  getCachedUnits,
} from "@/lib/server/quiz/queries";

export type {
  AvailableUnit,
  Category,
  CodeProblem,
  CodeProblemStep,
  Difficulty,
  PendingUnit,
  QuizFacetedCount,
  QuizMetricsData,
  QuizPayloadStructure,
  QuizRow,
  QuizType,
  RecentUnitItem,
  Section,
  SectionUnitBundleEntry,
  UnitLessonCardStructure,
  UnitRow,
} from "@/lib/types/quiz";

function revalidateQuizPaths() {
  try {
    revalidatePath("/learn");
    revalidatePath("/learn-old");
    revalidatePath("/quiz");
    revalidatePath("/quiz-cp");
    revalidatePath("/admin");
    revalidatePath("/maintainer");
    revalidatePath("/input");
    revalidatePath("/pending");
  } catch {
    // Ignore when called outside Next.js request context (e.g. CLI test scripts)
  }
  invalidateCacheTag("curriculum");
}

export async function getQuizMetadata() {
  return getCachedQuizMetadata();
}

export async function saveUnit(_state: unknown, formData: FormData) {
  return saveUnitImpl(formData, revalidateQuizPaths);
}

export async function getUnits() {
  return getCachedUnits();
}

export async function getCodeProblems(unitId?: number) {
  return fetchCodeProblems(unitId);
}

export async function getAvailableUnits() {
  return getCachedAvailableUnits();
}

export async function getAvailableUnitsForStaff(explicitUserId?: number) {
  return fetchAvailableUnitsForStaff(explicitUserId);
}

export async function deleteUnit(unitId: number) {
  return deleteUnitImpl(unitId, revalidateQuizPaths);
}

export async function getQuizMetrics() {
  return getCachedQuizMetrics();
}

export async function getPaginatedRecentQuizzes(
  page = 1,
  pageSize = 20,
  filters: {
    id?: string;
    search?: string;
    category?: string;
    section?: string;
    difficulty?: string;
    type?: string;
  } = {},
) {
  return fetchPaginatedRecentQuizzes(page, pageSize, filters);
}

export async function getPaginatedRecentUnits(
  page = 1,
  pageSize = 20,
  filters: {
    id?: string;
    search?: string;
    category?: string;
    section?: string;
    status?: string;
  } = {},
) {
  return fetchPaginatedRecentUnits(page, pageSize, filters);
}

export async function getUnitById(unitId: number) {
  return getCachedUnitById(unitId);
}

export async function getSectionUnitsBundle(secId: number) {
  return getCachedSectionUnitsBundle(secId);
}

export async function getQuizOrUnitById(id: number) {
  return fetchQuizOrUnitById(id);
}

export async function deleteQuiz(quizId: number) {
  return deleteQuizImpl(quizId, revalidateQuizPaths);
}

export async function updateQuiz(quizId: number, formData: FormData) {
  return updateQuizImpl(quizId, formData, revalidateQuizPaths);
}

export async function getQuizzes(filters?: {
  cat_id?: number;
  sec_id?: number;
  difficulty_id?: number;
  status?: string;
}) {
  return fetchQuizzes(filters);
}

export async function getPendingQuizzes(statusFilter = "pending") {
  return fetchPendingQuizzes(statusFilter);
}

export async function getPendingQuizById(pendingId: number) {
  return fetchPendingQuizById(pendingId);
}

export async function reviewPendingQuiz(
  pendingId: number,
  decision: "approve" | "reject",
  rejectionNotes = "",
) {
  return reviewPendingQuizImpl(
    pendingId,
    decision,
    rejectionNotes,
    revalidateQuizPaths,
  );
}

export async function updatePendingNote(
  pendingId: number,
  pendingNote: string,
) {
  return updatePendingNoteImpl(pendingId, pendingNote, revalidateQuizPaths);
}

export async function updatePendingUnitFromForm(
  pendingId: number,
  formData: FormData,
) {
  return updatePendingUnitFromFormImpl(
    pendingId,
    formData,
    revalidateQuizPaths,
  );
}

export async function deletePendingQuiz(pendingId: number) {
  return deleteUnitImpl(pendingId, revalidateQuizPaths);
}
