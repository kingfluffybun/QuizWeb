import { z } from "zod";
import {
  CodeProblemAssessmentImportSchema,
  unwrapCodeProblemAssessment,
} from "./cp-schema";

const RequiredText = z.string().refine((value) => value.trim().length > 0, {
  message: "Text must not be blank.",
});

const MCQPayloadSchema = z.strictObject({
  options: z.array(RequiredText).length(4),
  correct_index: z.number().int().min(0).max(3),
  assessment: z.string().optional(),
});

const FITBPayloadSchema = z.strictObject({
  answer: RequiredText,
});

const OrderPayloadSchema = z.strictObject({
  items: z.array(RequiredText).min(4),
});

const PairPayloadSchema = z.strictObject({
  pairs: z
    .array(
      z.strictObject({
        left: RequiredText,
        right: RequiredText,
      }),
    )
    .min(2),
});

const CodeProblemPayloadSchema = z.strictObject({
  title: z.string().optional(),
  steps: z
    .array(
      z.strictObject({
        prompt: RequiredText,
        template: z.string(),
        expected: RequiredText,
      }),
    )
    .min(1),
  prompts: z.array(RequiredText).optional(),
  prompt: z.string().optional(),
  template: z.string().optional(),
  expected: z.string().optional(),
});

export const QuizImportPayloadSchema = z.union([
  MCQPayloadSchema,
  FITBPayloadSchema,
  OrderPayloadSchema,
  PairPayloadSchema,
  CodeProblemPayloadSchema,
]);

const QuizImportEntryBase = {
  quiz_id: z.number().int().optional(),
  unit: z.number().int().optional(),
  cat_id: z.number().int().positive(),
  sec_id: z.number().int().positive().nullable().optional(),
  difficulty_id: z.number().int().positive(),
  quiz_type_id: z.number().int().positive(),
  question_text: RequiredText,
  quiz_payload: QuizImportPayloadSchema,
  status: z.string().optional(),
  author_id: z.number().int().nullable().optional(),
};

function tryParseJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function coerceDigits(obj: Record<string, unknown>, key: string) {
  const val = obj[key];
  if (typeof val === "string" && /^\d+$/.test(val.trim())) {
    obj[key] = Number(val);
  }
}

export const QuizImportEntrySchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val;
  const obj = { ...(val as Record<string, unknown>) };
  obj.quiz_payload = tryParseJsonString(obj.quiz_payload);
  coerceDigits(obj, "cat_id");
  coerceDigits(obj, "difficulty_id");
  coerceDigits(obj, "quiz_type_id");
  coerceDigits(obj, "sec_id");
  delete obj.created_at;
  delete obj.updated_at;
  return obj;
}, z.strictObject(QuizImportEntryBase));

export const AssessmentBulkImportSchema = z.strictObject({
  unit_id: z.number().int().optional(),
  unit_title: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  sec_id: z.number().int().positive().nullable().optional(),
  sec_num: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  author_id: z.number().int().nullable().optional(),
  unit_lesson_card_json: z.unknown().optional(),
  lesson_slides: z.unknown().optional(),
  unit_assessment_json: CodeProblemAssessmentImportSchema,
  unit_quiz_json: z.array(QuizImportEntrySchema).min(1),
});

const AssessmentOnlyImportSchema = z.strictObject({
  unit_assessment_json: CodeProblemAssessmentImportSchema,
});

export type QuizImportEntry = z.infer<typeof QuizImportEntrySchema>;
export type AssessmentBulkImport = z.infer<typeof AssessmentBulkImportSchema>;
export type AssessmentOnlyImport = z.infer<
  typeof AssessmentOnlyImportSchema
>["unit_assessment_json"];

export type AssessmentBulkImportResult =
  | { success: true; data: AssessmentBulkImport }
  | { success: false; errors: string[] };

export type AssessmentOnlyImportResult =
  | { success: true; data: AssessmentOnlyImport }
  | { success: false; errors: string[] };

export type AssessmentImportResult =
  | { success: true; mode: "assessment-only"; data: AssessmentOnlyImport }
  | { success: true; mode: "full"; data: AssessmentBulkImport }
  | { success: false; errors: string[] };

export interface ExtractedLessonSlide {
  text: string;
  title?: string;
  code?: string;
}

export function extractLessonSlides(
  rawCard: unknown,
): ExtractedLessonSlide[] | null {
  if (!rawCard) return null;
  let rawSlides: unknown[] | null = null;
  if (Array.isArray(rawCard)) {
    rawSlides = rawCard;
  } else if (typeof rawCard === "object") {
    const cardObj = rawCard as Record<string, unknown>;
    if (Array.isArray(cardObj.lesson_slide)) {
      rawSlides = cardObj.lesson_slide;
    } else if (Array.isArray(cardObj.lesson_slides)) {
      rawSlides = cardObj.lesson_slides;
    } else if (Array.isArray(cardObj.slides)) {
      rawSlides = cardObj.slides;
    } else if (
      typeof cardObj.lesson_text === "string" ||
      typeof cardObj.text === "string"
    ) {
      const text = String(cardObj.lesson_text ?? cardObj.text ?? "").trim();
      const title = cardObj.lesson_title ?? cardObj.title;
      const code = cardObj.lesson_code ?? cardObj.code;
      return [
        {
          text,
          ...(typeof title === "string" && title ? { title } : {}),
          ...(typeof code === "string" && code ? { code } : {}),
        },
      ];
    }
  }
  if (rawSlides && rawSlides.length > 0) {
    return rawSlides.map((slide) => {
      if (typeof slide === "string") {
        return { text: slide };
      }
      if (slide && typeof slide === "object") {
        const s = slide as Record<string, unknown>;
        const text = String(s.lesson_text ?? s.text ?? "").trim();
        const title = s.lesson_title ?? s.title;
        const code = s.lesson_code ?? s.code;
        return {
          text,
          ...(typeof title === "string" && title ? { title } : {}),
          ...(typeof code === "string" && code ? { code } : {}),
        };
      }
      return { text: "" };
    });
  }
  return null;
}

export function normalizeUnitImportCandidate(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== "object") {
    return candidate;
  }
  if (Array.isArray(candidate)) {
    if (candidate.length > 0 && candidate[0] !== null && typeof candidate[0] === "object") {
      candidate = candidate[0];
    } else {
      return candidate;
    }
  }
  const rawObj = candidate as Record<string, unknown>;
  if (
    Array.isArray(rawObj.units) &&
    rawObj.units.length > 0 &&
    !rawObj.unit_quiz_json
  ) {
    return normalizeUnitImportCandidate(rawObj.units[0]);
  }

  const obj = { ...rawObj };
  coerceDigits(obj, "sec_id");

  if (!obj.unit_assessment_json) {
    if (obj.assessment && typeof obj.assessment === "object") {
      obj.unit_assessment_json = obj.assessment;
    } else if (obj.unit_assessment && typeof obj.unit_assessment === "object") {
      obj.unit_assessment_json = obj.unit_assessment;
    }
  }

  if (!obj.unit_lesson_card_json) {
    if (obj.lesson_slides) obj.unit_lesson_card_json = obj.lesson_slides;
    else if (obj.lesson_card) obj.unit_lesson_card_json = obj.lesson_card;
    else if (obj.lessons) obj.unit_lesson_card_json = obj.lessons;
  }

  if (obj.unit_assessment_json && typeof obj.unit_assessment_json === "object") {
    const assessmentObj = {
      ...(obj.unit_assessment_json as Record<string, unknown>),
    };
    const hasCpSteps =
      Array.isArray(assessmentObj.cp_steps) && assessmentObj.cp_steps.length > 0;
    const stepsIsStrings =
      Array.isArray(assessmentObj.steps) &&
      assessmentObj.steps.length > 0 &&
      typeof assessmentObj.steps[0] === "string";

    if (hasCpSteps && (!assessmentObj.steps || stepsIsStrings)) {
      assessmentObj.steps = assessmentObj.cp_steps;
    } else if (stepsIsStrings && !hasCpSteps) {
      const unwrapped = unwrapCodeProblemAssessment(assessmentObj);
      if (unwrapped) {
        assessmentObj.steps = unwrapped.steps;
        assessmentObj.schemaVersion = 2;
      }
    }
    obj.unit_assessment_json = assessmentObj;
  }

  if (Array.isArray(obj.unit_quiz_json)) {
    obj.unit_quiz_json = obj.unit_quiz_json.map((q) => {
      if (!q || typeof q !== "object") return q;
      const quiz = { ...(q as Record<string, unknown>) };
      quiz.quiz_payload = tryParseJsonString(quiz.quiz_payload);
      return quiz;
    });
  }

  delete obj.created_at;
  delete obj.updated_at;
  delete obj.lesson_format;
  delete obj.slug;

  return obj;
}

function parseJsonDocument(
  rawText: string,
): { ok: true; value: unknown } | { ok: false; errors: string[] } {
  try {
    return { ok: true, value: JSON.parse(rawText) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON document.";
    return { ok: false, errors: [`JSON syntax error: ${message}`] };
  }
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

function wrapAssessmentCandidate(normalized: unknown): unknown {
  return normalized &&
    typeof normalized === "object" &&
    !Array.isArray(normalized) &&
    !Object.hasOwn(normalized, "unit_assessment_json") &&
    (Object.hasOwn(normalized, "steps") || Object.hasOwn(normalized, "cp_steps"))
    ? { unit_assessment_json: normalized }
    : normalized;
}

export function parseAssessmentBulkImport(
  rawText: string,
): AssessmentBulkImportResult {
  const parsed = parseJsonDocument(rawText);
  if (!parsed.ok) return { success: false, errors: parsed.errors };

  const normalized = normalizeUnitImportCandidate(parsed.value);
  const result = AssessmentBulkImportSchema.safeParse(normalized);
  if (!result.success) {
    return { success: false, errors: formatZodIssues(result.error) };
  }

  return { success: true, data: result.data };
}

export function parseAssessmentOnlyImport(
  rawText: string,
): AssessmentOnlyImportResult {
  const parsed = parseJsonDocument(rawText);
  if (!parsed.ok) return { success: false, errors: parsed.errors };

  const normalized = normalizeUnitImportCandidate(parsed.value);
  const result = AssessmentOnlyImportSchema.safeParse(
    wrapAssessmentCandidate(normalized),
  );
  if (!result.success) {
    return { success: false, errors: formatZodIssues(result.error) };
  }

  return { success: true, data: result.data.unit_assessment_json };
}

export function parseAssessmentImport(
  rawText: string,
): AssessmentImportResult {
  const parsed = parseJsonDocument(rawText);
  if (!parsed.ok) return { success: false, errors: parsed.errors };

  const normalized = normalizeUnitImportCandidate(parsed.value);

  if (
    normalized &&
    typeof normalized === "object" &&
    !Array.isArray(normalized) &&
    Object.hasOwn(normalized, "unit_quiz_json")
  ) {
    const result = AssessmentBulkImportSchema.safeParse(normalized);
    return result.success
      ? { success: true, mode: "full", data: result.data }
      : { success: false, errors: formatZodIssues(result.error) };
  }

  const result = AssessmentOnlyImportSchema.safeParse(
    wrapAssessmentCandidate(normalized),
  );
  return result.success
    ? {
        success: true,
        mode: "assessment-only",
        data: result.data.unit_assessment_json,
      }
    : { success: false, errors: formatZodIssues(result.error) };
}

export function quizPayloadMatchesType(
  typeName: string,
  payload: z.infer<typeof QuizImportPayloadSchema>,
): boolean {
  switch (typeName.trim().toLowerCase()) {
    case "mcq":
      return "options" in payload;
    case "fitb":
      return "answer" in payload;
    case "order":
      return "items" in payload;
    case "pair":
      return "pairs" in payload;
    case "cp":
      return "steps" in payload;
    default:
      return false;
  }
}
