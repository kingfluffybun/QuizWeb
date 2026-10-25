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

export const QuizImportEntrySchema = z.preprocess((val) => {
  if (!val || typeof val !== "object") return val;
  const obj = { ...(val as Record<string, unknown>) };
  if (typeof obj.quiz_payload === "string") {
    try {
      obj.quiz_payload = JSON.parse(obj.quiz_payload);
    } catch {
      // let zod handle
    }
  }
  if (typeof obj.cat_id === "string" && /^\d+$/.test(obj.cat_id.trim())) {
    obj.cat_id = Number(obj.cat_id);
  }
  if (
    typeof obj.difficulty_id === "string" &&
    /^\d+$/.test(obj.difficulty_id.trim())
  ) {
    obj.difficulty_id = Number(obj.difficulty_id);
  }
  if (
    typeof obj.quiz_type_id === "string" &&
    /^\d+$/.test(obj.quiz_type_id.trim())
  ) {
    obj.quiz_type_id = Number(obj.quiz_type_id);
  }
  if (typeof obj.sec_id === "string" && /^\d+$/.test(obj.sec_id.trim())) {
    obj.sec_id = Number(obj.sec_id);
  }
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

export const AssessmentChoiceSchema = z
  .object({
    id: z.string().optional(),
    text: RequiredText,
    isCorrect: z.boolean().optional(),
    explanation: z.string().optional(),
  })
  .passthrough();

const AssessmentQuestionSchema = z
  .object({
    id: z.string().optional(),
    prompt: RequiredText,
    type: z
      .enum([
        "multiple_choice",
        "single_choice",
        "multiple_select",
        "true_false",
        "short_answer",
        "matching",
        "ordering",
        "coding",
      ])
      .default("multiple_choice"),
    choices: z.array(AssessmentChoiceSchema).optional(),
    correct_index: z.number().int().min(0).optional(),
    correct_indexes: z.array(z.number().int().min(0)).optional(),
    correct_answer: z.string().optional(),
    explanation: z.string().optional(),
    points: z.number().int().min(1).optional(),
  })
  .passthrough()
  .superRefine((question, ctx) => {
    const choices = question.choices;
    const hasChoiceList = Array.isArray(choices);
    const hasLegacyOptions = typeof question.correct_index === "number";

    if (
      ["multiple_choice", "single_choice", "true_false"].includes(question.type)
    ) {
      if (!hasChoiceList && !hasLegacyOptions) {
        ctx.addIssue({
          code: "custom",
          path: ["choices"],
          message: "Questions of type multiple_choice/single_choice/true_false require choices.",
        });
      }

      if (hasChoiceList && choices.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["choices"],
          message: "Multiple-choice questions require at least 2 choices.",
        });
      }
    }

    if (question.type === "matching" && (!choices || choices.length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Matching questions require at least 2 choice pairs.",
      });
    }

    if (question.type === "ordering" && (!choices || choices.length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Ordering questions require at least 2 choices.",
      });
    }
  });

export const UnitLessonCardBlockSchema = z
  .object({
    id: z.string().optional(),
    type: z
      .enum(["markdown", "html", "image", "list", "quote", "code", "callout"])
      .default("markdown"),
    title: z.string().optional(),
    value: z.string().default(""),
    items: z.array(z.string()).optional(),
  })
  .passthrough();

export const UnitLessonCardSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    kind: z.enum(["content", "summary", "exercise"]).optional(),
    blocks: z.array(UnitLessonCardBlockSchema).min(1),
  })
  .passthrough();

export const LessonCardBlockSchema = UnitLessonCardBlockSchema;
export const LessonCardSchema = UnitLessonCardSchema;

export const UnitLessonSchema = z
  .object({
    id: z.string().optional(),
    title: RequiredText,
    summary: z.string().optional(),
    cards: z.array(UnitLessonCardSchema).min(1),
  })
  .passthrough();

export const UnitMetadataSchema = z
  .object({
    id: z.string().or(z.number()).optional(),
    title: RequiredText,
    subtitle: z.string().optional(),
    description: z.string().optional(),
    section_id: z.number().int().positive().nullable().optional(),
    sec_id: z.number().int().positive().nullable().optional(),
    slug: z.string().optional(),
    status: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const UnitAssessmentQuestionSchema = z
  .object({
    id: z.string().optional(),
    prompt: RequiredText,
    type: z
      .enum([
        "multiple_choice",
        "single_choice",
        "multiple_select",
        "true_false",
        "short_answer",
        "matching",
        "ordering",
        "coding",
      ])
      .default("multiple_choice"),
    choices: z.array(AssessmentChoiceSchema).optional(),
    correct_index: z.number().int().min(0).optional(),
    explanation: z.string().optional(),
    points: z.number().int().min(1).optional(),
  })
  .passthrough();

export const UnitAssessmentSchema = z
  .object({
    id: z.string().optional(),
    title: RequiredText,
    description: z.string().optional(),
    questions: z.array(UnitAssessmentQuestionSchema).min(1),
    passing_score: z.number().int().min(0).max(100).optional(),
    due_in: z.string().optional(),
  })
  .passthrough();

export const UnitBulkImportSchema = z
  .object({
    unit: UnitMetadataSchema,
    lessons: z.array(UnitLessonSchema).min(1),
    assessments: z.array(UnitAssessmentSchema).optional().default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const UnitQuestionSchema = UnitAssessmentQuestionSchema;
export const UnitBulkEntrySchema = UnitBulkImportSchema;

export type QuizImportEntry = z.infer<typeof QuizImportEntrySchema>;
export type AssessmentBulkImport = z.infer<typeof AssessmentBulkImportSchema>;
export type AssessmentOnlyImport = z.infer<
  typeof AssessmentOnlyImportSchema
>["unit_assessment_json"];
export type UnitLesson = z.infer<typeof UnitLessonSchema>;
export type UnitMetadata = z.infer<typeof UnitMetadataSchema>;
export type UnitAssessmentQuestion = z.infer<typeof UnitAssessmentQuestionSchema>;
export type UnitAssessment = z.infer<typeof UnitAssessmentSchema>;
export type UnitBulkImport = z.infer<typeof UnitBulkImportSchema>;

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

export type UnitBulkImportResult =
  | { success: true; data: UnitBulkImport }
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
    if (candidate.length > 0 && typeof candidate[0] === "object") {
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

  if (typeof obj.sec_id === "string" && /^\d+$/.test(obj.sec_id.trim())) {
    obj.sec_id = Number(obj.sec_id);
  }

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
      if (typeof quiz.quiz_payload === "string") {
        try {
          quiz.quiz_payload = JSON.parse(quiz.quiz_payload);
        } catch {
          // let zod handle
        }
      }
      return quiz;
    });
  }

  delete obj.created_at;
  delete obj.updated_at;
  delete obj.lesson_format;
  delete obj.slug;

  return obj;
}

export function parseAssessmentBulkImport(
  rawText: string,
): AssessmentBulkImportResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON document.";
    return { success: false, errors: [`JSON syntax error: ${message}`] };
  }

  const normalized = normalizeUnitImportCandidate(candidate);
  const result = AssessmentBulkImportSchema.safeParse(normalized);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    };
  }

  return { success: true, data: result.data };
}

export function parseAssessmentOnlyImport(
  rawText: string,
): AssessmentOnlyImportResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON document.";
    return { success: false, errors: [`JSON syntax error: ${message}`] };
  }

  const normalized = normalizeUnitImportCandidate(candidate);
  const assessmentCandidate =
    normalized &&
    typeof normalized === "object" &&
    !Array.isArray(normalized) &&
    !Object.hasOwn(normalized, "unit_assessment_json") &&
    (Object.hasOwn(normalized, "steps") || Object.hasOwn(normalized, "cp_steps"))
      ? { unit_assessment_json: normalized }
      : normalized;

  const result = AssessmentOnlyImportSchema.safeParse(assessmentCandidate);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    };
  }

  return { success: true, data: result.data.unit_assessment_json };
}

export function parseAssessmentImport(
  rawText: string,
): AssessmentImportResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON document.";
    return { success: false, errors: [`JSON syntax error: ${message}`] };
  }

  const normalized = normalizeUnitImportCandidate(candidate);

  if (
    normalized &&
    typeof normalized === "object" &&
    !Array.isArray(normalized) &&
    Object.hasOwn(normalized, "unit_quiz_json")
  ) {
    const result = AssessmentBulkImportSchema.safeParse(normalized);
    return result.success
      ? { success: true, mode: "full", data: result.data }
      : {
          success: false,
          errors: result.error.issues.map((issue) => {
            const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
            return `${path}${issue.message}`;
          }),
        };
  }

  const assessmentCandidate =
    normalized &&
    typeof normalized === "object" &&
    !Array.isArray(normalized) &&
    !Object.hasOwn(normalized, "unit_assessment_json") &&
    (Object.hasOwn(normalized, "steps") || Object.hasOwn(normalized, "cp_steps"))
      ? { unit_assessment_json: normalized }
      : normalized;

  const result = AssessmentOnlyImportSchema.safeParse(assessmentCandidate);
  return result.success
    ? {
        success: true,
        mode: "assessment-only",
        data: result.data.unit_assessment_json,
      }
    : {
        success: false,
        errors: result.error.issues.map((issue) => {
          const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
          return `${path}${issue.message}`;
        }),
      };
}

export function parseUnitBulkImport(rawText: string): UnitBulkImportResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawText);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON document.";
    return { success: false, errors: [`JSON syntax error: ${message}`] };
  }

  const incoming = candidate && typeof candidate === "object" ? candidate : {};
  const normalizedCandidate = {
    ...(incoming as Record<string, unknown>),
    unit:
      (incoming as Record<string, unknown>).unit ??
      {
        title:
          (incoming as Record<string, unknown>).unit_title ??
          (incoming as Record<string, unknown>).title ??
          "",
        description:
          (incoming as Record<string, unknown>).description ?? "",
        sec_id:
          (incoming as Record<string, unknown>).sec_id ??
          (incoming as Record<string, unknown>).section_id ??
          null,
      },
    lessons:
      (incoming as Record<string, unknown>).lessons ??
      (incoming as Record<string, unknown>).unit_lessons ??
      (incoming as Record<string, unknown>).lesson_cards ??
      [],
    assessments:
      (incoming as Record<string, unknown>).assessments ??
      (incoming as Record<string, unknown>).unit_assessments ??
      (incoming as Record<string, unknown>).assessment ??
      [],
  };

  const result = UnitBulkImportSchema.safeParse(normalizedCandidate);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      }),
    };
  }

  return { success: true, data: result.data };
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
