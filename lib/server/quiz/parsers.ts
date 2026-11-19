import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import {
  CodeProblemAssessmentSchema,
  hasAnyNonEmptyBuffer,
  type CodeProblemAssessment,
  type CPStep,
} from "@/lib/cp-schema";
import {
  parseAssessmentBulkImport,
  quizPayloadMatchesType,
  type AssessmentBulkImport,
} from "@/lib/assessment-json-import";

export interface ExtractedLessonSlidePayload {
  lesson_title?: string;
  lesson_text: string;
  lesson_code?: string;
}

export function extractLessonSlidesFromForm(
  formData: FormData,
): ExtractedLessonSlidePayload[] {
  const getText = (name: string) => String(formData.get(name) ?? "").trim();

  return Array.from(formData.entries())
    .filter(([name]) => /^lesson_text_\d+$/.test(name))
    .sort(
      ([left], [right]) =>
        Number(left.slice("lesson_text_".length)) -
        Number(right.slice("lesson_text_".length)),
    )
    .map(([name]) => {
      const index = name.slice("lesson_text_".length);
      const lessonText = getText(`lesson_text_${index}`);
      const slideTitle = getText(`lesson_title_${index}`);
      return {
        ...(slideTitle ? { lesson_title: slideTitle } : {}),
        lesson_text: lessonText,
        ...(formData.has(`lesson_code_${index}`)
          ? {
              lesson_code: String(formData.get(`lesson_code_${index}`) ?? ""),
            }
          : {}),
      };
    });
}

function getAssessmentStepsFromForm(formData: FormData): string[] | null {
  const rawSteps = formData.get("assessment_steps");
  if (typeof rawSteps === "string") {
    try {
      const parsedSteps: unknown = JSON.parse(rawSteps);
      if (
        !Array.isArray(parsedSteps) ||
        parsedSteps.some((step) => typeof step !== "string")
      ) {
        return null;
      }
      return parsedSteps.map((step: string) => step.trim()).filter(Boolean);
    } catch {
      return null;
    }
  }

  const legacyAssessment = String(formData.get("assessment") ?? "").trim();
  return legacyAssessment ? [legacyAssessment] : [];
}

export type BuiltAssessmentResult =
  | { assessment: CodeProblemAssessment | Record<string, unknown>; error?: undefined }
  | { assessment?: undefined; error: string };

export function buildAssessmentFromForm(
  formData: FormData,
): BuiltAssessmentResult {
  const assessmentTitle = String(formData.get("assessment_title") ?? "").trim();
  const assessmentDescription = String(
    formData.get("assessment_description") ?? "",
  ).trim();
  const expectedOutcome = String(formData.get("expected_outcome") ?? "").trim();

  const rawCpSteps = formData.get("assessment_cp_steps");
  if (typeof rawCpSteps === "string" && rawCpSteps.trim()) {
    try {
      const parsedCpSteps: unknown = JSON.parse(rawCpSteps);
      if (Array.isArray(parsedCpSteps) && parsedCpSteps.length > 0) {
        const activeSteps = (parsedCpSteps as CPStep[]).filter(
          (s) =>
            s &&
            typeof s === "object" &&
            (String(s.instruction ?? "").trim().length > 0 ||
              (s.expectedTemplate && hasAnyNonEmptyBuffer(s.expectedTemplate)) ||
              (s.starterCode && hasAnyNonEmptyBuffer(s.starterCode))),
        );

        const hasAnyCodeBuffers = activeSteps.some(
          (s) =>
            (s.expectedTemplate && hasAnyNonEmptyBuffer(s.expectedTemplate)) ||
            (s.starterCode && hasAnyNonEmptyBuffer(s.starterCode)),
        );

        if (activeSteps.length > 0 && hasAnyCodeBuffers) {
          const normalizedSteps: CPStep[] = activeSteps.map((s, idx) => ({
            stepNumber: idx + 1,
            instruction: String(s.instruction ?? "").trim(),
            starterCode: {
              html: String(s.starterCode?.html ?? ""),
              css: String(s.starterCode?.css ?? ""),
              js: String(s.starterCode?.js ?? ""),
            },
            expectedTemplate: {
              html: String(s.expectedTemplate?.html ?? ""),
              css: String(s.expectedTemplate?.css ?? ""),
              js: String(s.expectedTemplate?.js ?? ""),
            },
            inheritPreviousCode:
              typeof s.inheritPreviousCode === "boolean"
                ? s.inheritPreviousCode
                : idx > 0,
            ...(s.hint && String(s.hint).trim()
              ? { hint: String(s.hint).trim() }
              : {}),
          }));

          const validation = CodeProblemAssessmentSchema.safeParse({
            schemaVersion: 2,
            title: assessmentTitle,
            description: assessmentDescription,
            steps: normalizedSteps,
            expected_outcome: expectedOutcome,
          });

          if (!validation.success) {
            return {
              error:
                validation.error.issues[0]?.message ??
                "Invalid coding assessment step configuration.",
            };
          }

          return { assessment: validation.data };
        }
      }
    } catch {
      return { error: "Assessment coding steps JSON is malformed." };
    }
  }

  const assessmentSteps = getAssessmentStepsFromForm(formData);
  if (!assessmentSteps) {
    return { error: "Assessment steps are invalid." };
  }

  return {
    assessment: {
      title: assessmentTitle,
      description: assessmentDescription,
      assessment: assessmentSteps.join("\n\n"),
      steps: assessmentSteps,
      expected_outcome: expectedOutcome,
    },
  };
}

export function readAssessmentBulkImport(
  formData: FormData,
): { data: AssessmentBulkImport | null; error?: string } {
  const rawImport = formData.get("assessment_bulk_import");
  if (rawImport === null) return { data: null };
  if (typeof rawImport !== "string") {
    return { data: null, error: "Bulk assessment JSON must be text." };
  }

  const result = parseAssessmentBulkImport(rawImport);
  return result.success
    ? { data: result.data }
    : { data: null, error: result.errors.join(" | ") };
}

export async function validateImportedQuestionReferences(
  connection: PoolConnection,
  bulkImport: AssessmentBulkImport,
  unitSectionId: number,
): Promise<string | null> {
  const questions = bulkImport.unit_quiz_json;
  const categoryIds = [...new Set(questions.map((question) => question.cat_id))];
  const difficultyIds = [
    ...new Set(questions.map((question) => question.difficulty_id)),
  ];
  const typeIds = [...new Set(questions.map((question) => question.quiz_type_id))];
  const sectionIds = [
    ...new Set([
      unitSectionId,
      ...questions.flatMap((question) =>
        question.sec_id == null ? [] : [question.sec_id],
      ),
    ]),
  ];

  const selectByIds = async (table: string, column: string, ids: number[]) => {
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT ${column} FROM ${table} WHERE ${column} IN (${placeholders})`,
      ids,
    );
    return new Set(rows.map((row) => Number(row[column])));
  };

  const [categories, difficulties, typeRows, sections] = await Promise.all([
    selectByIds("cat_tbl", "cat_id", categoryIds),
    selectByIds("difficulty_tbl", "difficulty_id", difficultyIds),
    connection
      .query<RowDataPacket[]>(
        `SELECT quiz_type_id, type_name
         FROM quiz_type_tbl
         WHERE quiz_type_id IN (${typeIds.map(() => "?").join(", ")})`,
        typeIds,
      )
      .then(([rows]) => rows),
    selectByIds("sec_tbl", "sec_id", sectionIds),
  ]);

  if (categories.size !== categoryIds.length) {
    return "Bulk import contains an unknown category ID.";
  }
  if (difficulties.size !== difficultyIds.length) {
    return "Bulk import contains an unknown difficulty ID.";
  }
  if (sections.size !== sectionIds.length) {
    return "Bulk import contains an unknown section ID.";
  }

  const typeNames = new Map(
    typeRows.map((row) => [Number(row.quiz_type_id), String(row.type_name)]),
  );
  if (typeNames.size !== typeIds.length) {
    return "Bulk import contains an unknown quiz type ID.";
  }
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const typeName = typeNames.get(question.quiz_type_id);
    if (!typeName || !quizPayloadMatchesType(typeName, question.quiz_payload)) {
      return `Question ${index + 1} payload does not match its quiz type.`;
    }
  }

  return null;
}

function getIndexedFormValues(formData: FormData, prefix: string): string[] {
  const values: string[] = [];
  for (let index = 0; ; index++) {
    const value = formData.get(`${prefix}${index}`);
    if (typeof value !== "string") {
      break;
    }
    values.push(value);
  }
  return values;
}

export function getQuizPayload(typeName: string, formData: FormData) {
  if (typeName === "MCQ") {
    const options = [0, 1, 2, 3].map(
      (index) => formData.get(`option_${index}`) as string,
    );
    const correctIndex = formData.get("correct_option_index");
    const assessment =
      (formData.get("assessment") as string | null)?.trim() ?? "";

    if (options.some((option) => !option) || correctIndex === null) {
      return {
        error:
          "All 4 options and the correct answer selection are required for MCQ.",
      };
    }

    return {
      payload: {
        options: options.map((option) => option.trim()),
        correct_index: parseInt(correctIndex as string, 10),
        ...(assessment ? { assessment } : {}),
      },
    };
  }

  if (typeName === "FITB") {
    const answer = formData.get("fitb_answer") as string;
    return answer
      ? { payload: { answer: answer.trim() } }
      : { error: "Correct answer is required for FITB." };
  }

  if (typeName === "Order") {
    const items = getIndexedFormValues(formData, "order_");
    return items.length < 4 || items.some((item) => !item.trim())
      ? {
          error: "At least 4 items are required for Order syntax arrangement.",
        }
      : { payload: { items: items.map((item) => item.trim()) } };
  }

  if (typeName === "Pair") {
    const leftValues = getIndexedFormValues(formData, "pair_left_");
    const rightValues = getIndexedFormValues(formData, "pair_right_");
    if (
      leftValues.length < 4 ||
      leftValues.length !== rightValues.length ||
      leftValues.some(
        (left, index) => !left.trim() || !rightValues[index].trim(),
      )
    ) {
      return {
        error: "At least 4 complete matching pairs are required.",
      };
    }
    return {
      payload: {
        pairs: leftValues.map((left, index) => ({
          left: left.trim(),
          right: rightValues[index].trim(),
        })),
      },
    };
  }

  if (typeName === "CP") {
    const title = (formData.get("cp_title") as string | null)?.trim() ?? "";
    if (!title) {
      return { error: "A title is required for coding problems." };
    }

    const promptCountRaw = formData.get("cp_prompt_count");
    const promptCount = Number(promptCountRaw ?? "1");
    const safePromptCount =
      Number.isFinite(promptCount) && promptCount > 0 ? promptCount : 1;
    const steps: { prompt: string; template: string; expected: string }[] = [];

    for (let index = 0; index < safePromptCount; index++) {
      const prompt =
        (formData.get(`cp_prompt_${index}`) as string | null)?.trim() ?? "";
      const stepTemplate =
        (formData.get(`cp_template_${index}`) as string | null)?.trim() ?? "";
      const fallbackTemplate =
        (formData.get("cp_template") as string | null)?.trim() ?? "";
      const finalTemplate =
        stepTemplate || (index === 0 ? fallbackTemplate : "");

      const expected =
        (formData.get(`cp_expected_${index}`) as string | null)?.trim() ?? "";
      const fallbackExpected =
        (formData.get("cp_expected") as string | null)?.trim() ?? "";
      const finalExpected = expected || (index === 0 ? fallbackExpected : "");

      if (prompt || finalTemplate || finalExpected) {
        if (!prompt || !finalExpected) {
          return {
            error: `Instruction and Expected Output are required for Step ${index + 1}.`,
          };
        }
        steps.push({
          prompt,
          template: finalTemplate,
          expected: finalExpected,
        });
      }
    }

    if (steps.length === 0) {
      return {
        error:
          "Each coding problem requires at least one step with Instruction and Expected Output.",
      };
    }

    const prompts = steps.map((s) => s.prompt);
    return {
      payload: {
        title,
        steps,
        prompts,
        prompt: prompts[0],
        template: steps[0].template,
        expected: steps[0].expected,
      },
    };
  }

  return { error: "Unsupported quiz type." };
}
