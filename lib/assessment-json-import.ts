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

export type QuizImportEntry = z.infer<typeof QuizImportEntrySchema>;
export type AssessmentBulkImport = z.infer<typeof AssessmentBulkImportSchema>;

export type AssessmentBulkImportResult =
  | { success: true; data: AssessmentBulkImport }
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
