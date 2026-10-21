import { z } from "zod";
import { CodeProblemAssessmentImportSchema } from "./cp-schema";

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
    .min(4),
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
  cat_id: z.number().int().positive(),
  sec_id: z.number().int().positive().nullable().optional(),
  difficulty_id: z.number().int().positive(),
  quiz_type_id: z.number().int().positive(),
  question_text: RequiredText,
  quiz_payload: QuizImportPayloadSchema,
};

export const QuizImportEntrySchema = z.strictObject(QuizImportEntryBase);

export const AssessmentBulkImportSchema = z.strictObject({
  unit_assessment_json: CodeProblemAssessmentImportSchema,
  unit_quiz_json: z.array(QuizImportEntrySchema).min(1),
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
    const hasChoiceList = Array.isArray(question.choices);
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

      if (hasChoiceList && question.choices.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["choices"],
          message: "Multiple-choice questions require at least 2 choices.",
        });
      }
    }

    if (question.type === "matching" && (!question.choices || question.choices.length < 2)) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Matching questions require at least 2 choice pairs.",
      });
    }

    if (
      question.type === "ordering" &&
      (!question.choices || question.choices.length < 2)
    ) {
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
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const UnitQuestionSchema = UnitAssessmentQuestionSchema;
export const UnitBulkEntrySchema = UnitBulkImportSchema;

export type QuizImportEntry = z.infer<typeof QuizImportEntrySchema>;
export type AssessmentBulkImport = z.infer<typeof AssessmentBulkImportSchema>;
export type UnitLesson = z.infer<typeof UnitLessonSchema>;
export type UnitMetadata = z.infer<typeof UnitMetadataSchema>;
export type UnitAssessmentQuestion = z.infer<typeof UnitAssessmentQuestionSchema>;
export type UnitAssessment = z.infer<typeof UnitAssessmentSchema>;
export type UnitBulkImport = z.infer<typeof UnitBulkImportSchema>;

export type AssessmentBulkImportResult =
  | { success: true; data: AssessmentBulkImport }
  | { success: false; errors: string[] };

export type UnitBulkImportResult =
  | { success: true; data: UnitBulkImport }
  | { success: false; errors: string[] };

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

  const result = AssessmentBulkImportSchema.safeParse(candidate);
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
