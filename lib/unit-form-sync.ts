/**
 * Pure helpers for keeping the unit-level Category / Section / Unit fields of the
 * authoring form consistent. A unit's category is always derived from its section
 * (sec_tbl.cat_id), so the section is the source of truth.
 */

export interface SectionLike {
  sec_id: number;
  cat_id?: number | null;
}

/**
 * Returns the category id (as a string) the form should show for the selected section.
 * Falls back to the current category when the section is empty, unknown, or has no category.
 */
export function reconcileCategory(
  sections: readonly SectionLike[],
  selectedSecId: string,
  selectedCatId: string,
): string {
  if (!selectedSecId) return selectedCatId;
  const section = sections.find((s) => s.sec_id.toString() === selectedSecId);
  if (section?.cat_id == null) return selectedCatId;
  return String(section.cat_id);
}

function toPositiveInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Stamps the unit-level cat_id / sec_id / unit onto every quiz entry.
 * Only positive integers are applied; empty or invalid values leave the entry untouched
 * so strict import validation (positive ints only) is never violated.
 */
export function stampUnitFields<T extends object>(
  batch: readonly T[],
  fields: {
    catId: string | number | null | undefined;
    secId: string | number | null | undefined;
    unit: string | number | null | undefined;
  },
): T[] {
  const catId = toPositiveInt(fields.catId);
  const secId = toPositiveInt(fields.secId);
  const unit = toPositiveInt(fields.unit);
  return batch.map((entry) => ({
    ...entry,
    ...(catId === null ? {} : { cat_id: catId }),
    ...(secId === null ? {} : { sec_id: secId }),
    ...(unit === null ? {} : { unit }),
  }));
}

export interface UnitExportQuiz {
  cat_id?: number | string | null;
  sec_id?: number | string | null;
  difficulty_id?: number | string | null;
  quiz_type_id?: number | string | null;
  question_text?: string | null;
  quiz_payload?: unknown;
}

export interface UnitExportSource {
  unitTitle: string;
  secId: string | number | null | undefined;
  catId: string | number | null | undefined;
  lessonSlides: ReadonlyArray<{ text: string; title?: string; code?: string }>;
  assessment: {
    title: string;
    description: string;
    steps: readonly unknown[];
    expectedOutcome: string;
  };
  quizzes: readonly UnitExportQuiz[];
}

/** Recursively drops null/undefined values so strict payload schemas (optional, non-null) accept them. */
function stripNullish(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullish);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== null && entry !== undefined)
        .map(([key, entry]) => [key, stripNullish(entry)]),
    );
  }
  return value;
}

function normalizePayload(payload: unknown): Record<string, unknown> {
  let parsed = payload;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return stripNullish(parsed) as Record<string, unknown>;
}

/**
 * Serializes the unit currently loaded in the authoring form into the canonical import
 * envelope accepted by `parseAssessmentImport` (full mode). Only fields allowed by the strict
 * import schema are emitted, so the result can be pasted straight back into "Import JSON".
 */
export function exportUnitToImportJson(source: UnitExportSource) {
  const secId = toPositiveInt(source.secId);
  const unitTitle = source.unitTitle.trim();
  const quizzes = stampUnitFields(source.quizzes, {
    catId: source.catId,
    secId: source.secId,
    unit: null,
  }).map((quiz) => {
    const quizSecId = toPositiveInt(quiz.sec_id);
    return {
      cat_id: Number(quiz.cat_id ?? 0),
      ...(quizSecId === null ? {} : { sec_id: quizSecId }),
      difficulty_id: Number(quiz.difficulty_id ?? 0),
      quiz_type_id: Number(quiz.quiz_type_id ?? 0),
      question_text: String(quiz.question_text ?? ""),
      quiz_payload: normalizePayload(quiz.quiz_payload),
    };
  });

  return {
    ...(unitTitle ? { unit_title: unitTitle } : {}),
    ...(secId === null ? {} : { sec_id: secId }),
    unit_lesson_card_json: {
      ...(unitTitle ? { lesson_title: unitTitle } : {}),
      lesson_slide: source.lessonSlides.map((slide) => ({
        ...(slide.title ? { lesson_title: slide.title } : {}),
        lesson_text: slide.text,
        ...(slide.code ? { lesson_code: slide.code } : {}),
      })),
    },
    unit_assessment_json: {
      schemaVersion: 2 as const,
      title: source.assessment.title,
      description: source.assessment.description,
      steps: source.assessment.steps.map((step) => stripNullish(step)),
      expected_outcome: source.assessment.expectedOutcome,
    },
    unit_quiz_json: quizzes,
  };
}
