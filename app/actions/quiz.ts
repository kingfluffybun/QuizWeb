"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireAdmin, requireStaff } from "@/lib/rbac";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  CodeProblemAssessmentSchema,
  hasAnyNonEmptyBuffer,
  unwrapCodeProblemAssessment,
  wrapCodeProblemAssessmentForStorage,
  type CPStep,
} from "@/lib/cp-schema";
import {
  parseAssessmentBulkImport,
  quizPayloadMatchesType,
  type AssessmentBulkImport,
} from "@/lib/assessment-json-import";

function revalidateQuizPaths() {
  try {
    revalidatePath("/learn");
    revalidatePath("/quiz");
    revalidatePath("/quiz-cp");
    revalidatePath("/admin");
    revalidatePath("/maintainer");
    revalidatePath("/input");
    revalidatePath("/pending");
  } catch {
    // Ignore when called outside Next.js request context (e.g. CLI test scripts)
  }
}

const getAssessmentStepsFromForm = (formData: FormData): string[] | null => {
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
};

const buildAssessmentDocumentFromForm = (
  formData: FormData,
): { document: string; error?: string } => {
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
              document: "",
              error:
                validation.error.issues[0]?.message ??
                "Invalid coding assessment step configuration.",
            };

          }

          return {
            document: JSON.stringify(
              wrapCodeProblemAssessmentForStorage(validation.data),
            ),
          };
        }
      }
    } catch {
      return { document: "", error: "Assessment coding steps JSON is malformed." };
    }
  }

  const assessmentSteps = getAssessmentStepsFromForm(formData);
  if (!assessmentSteps) {
    return { document: "", error: "Assessment steps are invalid." };
  }

  return {
    document: JSON.stringify({
      title: assessmentTitle,
      description: assessmentDescription,
      assessment: assessmentSteps.join("\n\n"),
      steps: assessmentSteps,
      expected_outcome: expectedOutcome,
    }),
  };
};

function readAssessmentBulkImport(
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

function serializeImportedAssessment(
  assessment: AssessmentBulkImport["unit_assessment_json"],
): string {
  const instructions = assessment.steps.map((step) => step.instruction);
  const lastStep = assessment.steps[assessment.steps.length - 1];
  const expectedOutcome =
    assessment.expected_outcome ||
    lastStep.expectedTemplate.html ||
    lastStep.expectedTemplate.css ||
    lastStep.expectedTemplate.js;

  return JSON.stringify({
    schemaVersion: 2,
    title: assessment.title,
    description: assessment.description,
    assessment: instructions.join("\n\n"),
    steps: instructions,
    cp_steps: assessment.steps,
    expected_outcome: expectedOutcome,
  });
}

async function validateImportedQuestionReferences(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
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

export interface Category {
  cat_id: number;
  cat_name: string;
}

export interface Section {
  sec_id: number;
  sec_num: string;
}

export interface Difficulty {
  difficulty_id: number;
  difficulty_name: string;
}

export interface QuizType {
  quiz_type_id: number;
  type_name: string;
}

export interface QuizFacetedCount {
  cat_name: string;
  difficulty_name: string;
  type_name: string;
  count: number;
}

export interface QuizMetricsData {
  totalQuizzes: number;
  byCategory: {
    cat_id: number;
    cat_name: string;
    count: number;
    percentage: number;
  }[];
  byType: {
    quiz_type_id: number;
    type_name: string;
    count: number;
    percentage: number;
  }[];
  byDifficulty: {
    difficulty_id: number;
    difficulty_name: string;
    count: number;
    percentage: number;
  }[];
  bySection: { sec_id: number; sec_num: string; count: number }[];
  lowCoverageSections: { sec_id: number; sec_num: string; count: number }[];
  matrix: {
    cat_name: string;
    difficulties: { [diffName: string]: number };
    total: number;
  }[];
  facetedBreakdown: QuizFacetedCount[];
}

export interface QuizRow extends RowDataPacket {
  quiz_id: number;
  cat_id: number;
  sec_id?: number;
  difficulty_id: number;
  quiz_type_id: number;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  question_text: string;
  quiz_payload: unknown;
}

export interface UnitRow extends RowDataPacket {
  unit_id: number;
  unit_title: string;
  sec_id: number;
  sec_num?: string;
  unit_lesson_card_json: unknown;
  quiz_json: unknown;
  assessment_json: unknown;
}

function getIndexedFormValues(formData: FormData, prefix: string) {
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

function getQuizPayload(typeName: string, formData: FormData) {
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
    const mainTemplate = steps[0].template;

    return {
      payload: {
        title,
        steps,
        prompts,
        prompt: prompts[0],
        template: mainTemplate,
        expected: steps[0].expected,
      },
    };
  }

  return { error: "Unsupported quiz type." };
}

async function tableExists(tableName: string) {
  try {
    await db.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function quizHasColumn(columnName: string) {
  try {
    const [columns] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM quiz_tbl LIKE ?",
      [columnName],
    );
    return columns.length > 0;
  } catch {
    return false;
  }
}

export async function getQuizMetadata() {
  try {
    const [categories] = await db.query<RowDataPacket[]>(
      "SELECT * FROM cat_tbl ORDER BY cat_name",
    );
    const [sections] = await db.query<RowDataPacket[]>(
      "SELECT * FROM sec_tbl ORDER BY sec_id",
    );
    const [difficulties] = await db.query<RowDataPacket[]>(
      "SELECT * FROM difficulty_tbl ORDER BY difficulty_id",
    );
    const [types] = await db.query<RowDataPacket[]>(
      "SELECT * FROM quiz_type_tbl ORDER BY quiz_type_id",
    );

    return {
      categories: categories as Category[],
      difficulties: difficulties as Difficulty[],
      types: types as QuizType[],
      sections: sections as Section[],
    };
  } catch (error) {
    console.error("Failed to fetch quiz metadata:", error);
    return { categories: [], difficulties: [], types: [], sections: [] };
  }
}

export async function saveUnit(_state: unknown, formData: FormData) {
  const staff = await requireStaff();
  if (!staff) {
    return { error: "Unauthorized: Maintainer or Administrator access required." };
  }

  const sectionId = formData.get("sec_id") ?? formData.get("unit_sec_id");
  const sectionIdNumber = Number(sectionId);
  if (!Number.isInteger(sectionIdNumber) || sectionIdNumber < 1) {
    return { error: "A valid Section ID is required." };
  }

  const getText = (name: string) => String(formData.get(name) ?? "").trim();
  const lessonTitle = getText("unit_title");
  const lessonSlides = Array.from(formData.entries())
    .filter(([name]) => /^lesson_text_\d+$/.test(name))
    .sort(
      ([left], [right]) =>
        Number(left.slice("lesson_text_".length)) -
        Number(right.slice("lesson_text_".length)),
    )
    .map(([name]) => {
      const index = name.slice("lesson_text_".length);
      const lessonText = getText(`lesson_text_${index}`);
      const lessonTitle = getText(`lesson_title_${index}`);
      return {
        ...(lessonTitle ? { lesson_title: lessonTitle } : {}),
        lesson_text: lessonText,
        ...(formData.has(`lesson_code_${index}`)
          ? {
              lesson_code: String(
                formData.get(`lesson_code_${index}`) ?? "",
              ),
            }
          : {}),
      };
    });
  const imported = readAssessmentBulkImport(formData);
  if (imported.error) {
    return { error: `Bulk import is invalid: ${imported.error}` };
  }
  const builtAssessment = imported.data
    ? { document: serializeImportedAssessment(imported.data.unit_assessment_json) }
    : buildAssessmentDocumentFromForm(formData);
  if ("error" in builtAssessment && builtAssessment.error) {
    return { error: builtAssessment.error };
  }
  if (
    !lessonTitle ||
    lessonSlides.length === 0 ||
    lessonSlides.some((slide) => !slide.lesson_text)
  ) {
    return {
      error: "Lesson title and lesson text are required.",
    };
  }

  const rawQuizJson = formData.get("quiz_json");
  let parsedQuizJson: unknown[];
  if (imported.data) {
    parsedQuizJson = imported.data.unit_quiz_json;
  } else {
    if (typeof rawQuizJson !== "string" || !rawQuizJson.trim()) {
      return { error: "At least one quiz is required before submitting the unit." };
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(rawQuizJson);
    } catch {
      return { error: "Queued quiz data is malformed JSON." };
    }
    if (!Array.isArray(candidate)) {
      return { error: "Queued quiz data must be a JSON array." };
    }
    parsedQuizJson = candidate;
  }

  if (parsedQuizJson.length === 0) {
    return { error: "At least one quiz is required before submitting the unit." };
  }

  const lessonDocument = JSON.stringify({
    lesson_slide: lessonSlides,
  });
  const quizDocument = JSON.stringify(parsedQuizJson);
  const assessmentDocument = builtAssessment.document;
  const session = await auth();
  const authorId = staff.id ? Number(staff.id) : (session?.user?.id ? Number(session.user.id) : null);
  const pendingName = (
    session?.user?.name ??
    session?.user?.email?.split("@")[0] ??
    staff.email?.split("@")[0] ??
    "Contributor"
  ).slice(0, 50);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (imported.data) {
      const referenceError = await validateImportedQuestionReferences(
        connection,
        imported.data,
        sectionIdNumber,
      );
      if (referenceError) {
        await connection.rollback();
        return { error: referenceError };
      }
    }

    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO pending_tbl
       (unit_title, sec_id, unit_lesson_card_json, unit_quiz_json,
        unit_assessment_json, pending_status, pending_note, pending_name, author_id)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        lessonTitle,
        sectionIdNumber,
        lessonDocument,
        quizDocument,
        assessmentDocument,
        "",
        pendingName,
        authorId,
      ],
    );
    await connection.commit();

    return {
      success: true,
      pending: true,
      pendingId: result.insertId,
      message: "Unit submitted for review.",
    };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to submit unit for review:", error);
    return { error: "An error occurred while submitting the unit for review." };
  } finally {
    connection.release();
  }
}

export async function getUnits() {
  try {
    const [rows] = await db.query<UnitRow[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, s.sec_num,
              u.unit_lesson_card_json, u.unit_quiz_json AS quiz_json,
              u.unit_assessment_json AS assessment_json
       FROM unit_tbl u
       LEFT JOIN sec_tbl s ON s.sec_id = u.sec_id
       ORDER BY u.unit_id DESC`,
    );

    return rows.map((row) => ({
      ...row,
      unit_lesson_card_json: parseJsonColumn(row.unit_lesson_card_json),
      quiz_json: parseJsonColumn(row.quiz_json),
      assessment_json: parseJsonColumn(row.assessment_json),
    }));
  } catch (error) {
    console.error("Failed to fetch units:", error);
    return [];
  }
}

export interface AvailableUnit {
  pending_id: number;
  unit_id: number;
  unit_title: string;
  sec_num?: string;
  quiz_count: number;
  has_coding_assessment?: boolean;
}

export interface CodeProblemStep {
  prompt: string;
  template: string;
  expected: string;
}

export interface CodeProblem {
  unit_id: number;
  unit_title: string;
  quiz_id?: number;
  question_text: string;
  instructions: string[];
  steps: CodeProblemStep[];
}

export async function getCodeProblems(unitId?: number): Promise<CodeProblem[]> {
  try {
    const params: number[] = [];
    const unitFilter = unitId ? "AND u.unit_id = ?" : "";
    if (unitId) params.push(unitId);

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.unit_quiz_json,
              u.unit_assessment_json
       FROM unit_approved_tbl a
       JOIN pending_tbl p ON p.pending_id = a.pending_id
       JOIN unit_tbl u ON u.unit_id = a.unit_id
       WHERE p.pending_status = 'approved' ${unitFilter}
       ORDER BY u.unit_id DESC`,
      params,
    );

    const problems: CodeProblem[] = [];
    for (const row of rows) {
      const quizzes = parseJsonColumn(row.unit_quiz_json);
      const assessment = parseJsonColumn(row.unit_assessment_json);
      const quizList = Array.isArray(quizzes) ? quizzes : [];
      const codeQuiz = quizList.find((quiz) => {
        const typeName = typeof quiz?.type_name === "string"
          ? quiz.type_name
          : typeof quiz?.type === "string"
            ? quiz.type
            : "";
        const payload = quiz?.quiz_payload;
        return typeName.toLowerCase() === "cp"
          || (payload && typeof payload === "object" && (
            Array.isArray(payload.steps)
            || payload.template !== undefined
            || payload.expected !== undefined
          ));
      });
      const payload = codeQuiz?.quiz_payload && typeof codeQuiz.quiz_payload === "object"
        ? codeQuiz.quiz_payload
        : {};
      const rawSteps: unknown[] = Array.isArray(payload.steps) ? payload.steps : [];
      const steps = rawSteps
        .map((step: unknown) => {
          if (!step || typeof step !== "object") return null;
          const value = step as Record<string, unknown>;
          return {
            prompt: typeof value.prompt === "string" ? value.prompt.trim() : "",
            template: typeof value.template === "string" ? value.template : "",
            expected: typeof value.expected === "string" ? value.expected : "",
          };
        })
        .filter((step): step is CodeProblemStep => Boolean(step?.prompt));
      const assessmentRecord = assessment && typeof assessment === "object"
        ? assessment as Record<string, unknown>
        : null;
      const rawAssessmentSteps: unknown[] = assessmentRecord
        && Array.isArray(assessmentRecord.steps)
        ? assessmentRecord.steps
        : [];
      const assessmentSteps = rawAssessmentSteps.length > 0
        ? rawAssessmentSteps.filter(
            (step: unknown): step is string =>
              typeof step === "string" && step.trim().length > 0,
          )
        : [];
      const instructions = assessmentSteps.length > 0
        ? assessmentSteps
        : steps.map((step) => step.prompt);

      if (instructions.length === 0 && steps.length === 0) continue;

      const fallbackStep = {
        prompt: typeof codeQuiz?.question_text === "string" ? codeQuiz.question_text : "",
        template: typeof payload.template === "string" ? payload.template : "",
        expected: typeof payload.expected === "string" ? payload.expected : "",
      };

      problems.push({
        unit_id: Number(row.unit_id),
        unit_title: String(row.unit_title),
        quiz_id: typeof codeQuiz?.quiz_id === "number" ? codeQuiz.quiz_id : undefined,
        question_text: fallbackStep.prompt,
        instructions,
        steps: steps.length > 0 ? steps : fallbackStep.prompt ? [fallbackStep] : [],
      });
    }

    return problems;
  } catch (error) {
    console.error("Failed to fetch code problems:", error);
    return [];
  }
}

export async function getAvailableUnits(): Promise<AvailableUnit[]> {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT p.pending_id, u.unit_id, u.unit_title, s.sec_num,
              u.unit_quiz_json, u.unit_assessment_json
       FROM unit_approved_tbl a
       JOIN pending_tbl p ON p.pending_id = a.pending_id
       JOIN unit_tbl u ON u.unit_id = a.unit_id
       LEFT JOIN sec_tbl s ON s.sec_id = u.sec_id
       WHERE p.pending_status = 'approved'
       ORDER BY u.unit_id DESC`,
    );

    return rows.map((row) => {
      const quizzes = parseJsonColumn(row.unit_quiz_json);
      const assessment = parseJsonColumn(row.unit_assessment_json);
      return {
        pending_id: Number(row.pending_id),
        unit_id: Number(row.unit_id),
        unit_title: String(row.unit_title),
        sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
        quiz_count: Array.isArray(quizzes) ? quizzes.length : 0,
        has_coding_assessment: Boolean(unwrapCodeProblemAssessment(assessment)),
      };
    });
  } catch (error) {
    console.error("Failed to fetch available units:", error);
    return [];
  }
}

function parseJsonColumn(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getLessonTitlesFromDocument(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  const lessonCard = value as Record<string, unknown>;
  const slides = Array.isArray(lessonCard.lesson_slide)
    ? lessonCard.lesson_slide
    : Array.isArray(lessonCard.lesson_slides)
      ? lessonCard.lesson_slides
      : [];
  const titles = slides.flatMap((slide) => {
    if (!slide || typeof slide !== "object") return [];
    const slideRecord = slide as Record<string, unknown>;
    const title = slideRecord.lesson_title ?? slideRecord.title;
    return typeof title === "string" ? [title] : [];
  });

  if (typeof lessonCard.lesson_title === "string") {
    titles.push(lessonCard.lesson_title);
  }

  return titles;
}

export async function deleteUnit(unitId: number) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!Number.isInteger(unitId) || unitId < 1) {
    return { error: "A valid Unit ID is required." };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [approvedRows] = await connection.query<RowDataPacket[]>(
      "SELECT pending_id, unit_id FROM unit_approved_tbl WHERE unit_id = ? OR pending_id = ?",
      [unitId, unitId],
    );
    const targetUnitIds = new Set<number>([unitId]);
    const targetPendingIds = new Set<number>();
    for (const r of approvedRows) {
      if (r.unit_id) targetUnitIds.add(Number(r.unit_id));
      if (r.pending_id) targetPendingIds.add(Number(r.pending_id));
    }

    await connection.query(
      "DELETE FROM unit_approved_tbl WHERE unit_id = ? OR pending_id = ?",
      [unitId, unitId],
    );

    let affected = 0;
    for (const uId of targetUnitIds) {
      const [res] = await connection.query<ResultSetHeader>(
        "DELETE FROM unit_tbl WHERE unit_id = ?",
        [uId],
      );
      affected += res.affectedRows;
    }
    for (const pId of targetPendingIds) {
      const [res] = await connection.query<ResultSetHeader>(
        "DELETE FROM pending_tbl WHERE pending_id = ?",
        [pId],
      );
      affected += res.affectedRows;
    }

    if (affected === 0) {
      await connection.rollback();
      return { error: "Unit was not found." };
    }
    await connection.commit();
    revalidateQuizPaths();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to delete unit:", error);
    return { error: "An error occurred while deleting the unit." };
  } finally {
    connection.release();
  }
}

export async function getQuizMetrics(): Promise<QuizMetricsData> {
  try {
    const quizTableAvailable = await tableExists("quiz_tbl");
    let quizTableCount = 0;
    if (quizTableAvailable) {
      const [totalRows] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM quiz_tbl",
      );
      quizTableCount = Number(totalRows[0]?.total ?? 0);
    }

    // When quiz_tbl is empty or absent, compute curriculum metrics from unit_tbl
    if (!quizTableAvailable || quizTableCount === 0) {
      const [catLookup] = await db.query<RowDataPacket[]>(
        "SELECT cat_id, cat_name FROM cat_tbl ORDER BY cat_name",
      );
      const [typeLookup] = await db.query<RowDataPacket[]>(
        "SELECT quiz_type_id, type_name FROM quiz_type_tbl ORDER BY quiz_type_id",
      );
      const [diffLookup] = await db.query<RowDataPacket[]>(
        "SELECT difficulty_id, difficulty_name FROM difficulty_tbl ORDER BY difficulty_id",
      );
      const [secLookup] = await db.query<RowDataPacket[]>(
        "SELECT sec_id, sec_num FROM sec_tbl ORDER BY sec_id",
      );
      const [unitRows] = await db.query<RowDataPacket[]>(
        "SELECT unit_id, sec_id, unit_quiz_json FROM unit_tbl",
      );

      const catCounts = new Map<number, number>();
      const typeCounts = new Map<number, number>();
      const diffCounts = new Map<number, number>();
      const secCounts = new Map<number, number>();
      const matrixCounts = new Map<string, number>();
      const facetedCounts = new Map<string, number>();

      const catNameById = new Map<number, string>(
        catLookup.map((c) => [Number(c.cat_id), String(c.cat_name)]),
      );
      const diffNameById = new Map<number, string>(
        diffLookup.map((d) => [Number(d.difficulty_id), String(d.difficulty_name)]),
      );
      const typeNameById = new Map<number, string>(
        typeLookup.map((t) => [Number(t.quiz_type_id), String(t.type_name)]),
      );

      let totalQuizzes = 0;
      for (const u of unitRows) {
        const unitSecId = Number(u.sec_id ?? 0);
        const parsedQuizzes = parseJsonColumn(u.unit_quiz_json);
        const quizArr = Array.isArray(parsedQuizzes) ? parsedQuizzes : [];
        for (const q of quizArr) {
          if (!q || typeof q !== "object") continue;
          totalQuizzes += 1;
          const cId = Number(q.cat_id ?? 0);
          const dId = Number(q.difficulty_id ?? 0);
          const tId = Number(q.quiz_type_id ?? 0);
          const sId = Number(q.sec_id ?? unitSecId);

          if (cId) catCounts.set(cId, (catCounts.get(cId) ?? 0) + 1);
          if (dId) diffCounts.set(dId, (diffCounts.get(dId) ?? 0) + 1);
          if (tId) typeCounts.set(tId, (typeCounts.get(tId) ?? 0) + 1);
          if (sId) secCounts.set(sId, (secCounts.get(sId) ?? 0) + 1);

          const cName = catNameById.get(cId);
          const dName = diffNameById.get(dId);
          const tName = typeNameById.get(tId);
          if (cName && dName) {
            const mKey = `${cName}|||${dName}`;
            matrixCounts.set(mKey, (matrixCounts.get(mKey) ?? 0) + 1);
            if (tName) {
              const fKey = `${cName}|||${dName}|||${tName}`;
              facetedCounts.set(fKey, (facetedCounts.get(fKey) ?? 0) + 1);
            }
          }
        }
      }

      const byCategory = catLookup.map((c) => {
        const id = Number(c.cat_id);
        const count = catCounts.get(id) ?? 0;
        return {
          cat_id: id,
          cat_name: String(c.cat_name),
          count,
          percentage:
            totalQuizzes > 0 ? Math.round((count / totalQuizzes) * 100) : 0,
        };
      });

      const byType = typeLookup.map((t) => {
        const id = Number(t.quiz_type_id);
        const count = typeCounts.get(id) ?? 0;
        return {
          quiz_type_id: id,
          type_name: String(t.type_name),
          count,
          percentage:
            totalQuizzes > 0 ? Math.round((count / totalQuizzes) * 100) : 0,
        };
      });

      const byDifficulty = diffLookup.map((d) => {
        const id = Number(d.difficulty_id);
        const count = diffCounts.get(id) ?? 0;
        return {
          difficulty_id: id,
          difficulty_name: String(d.difficulty_name),
          count,
          percentage:
            totalQuizzes > 0 ? Math.round((count / totalQuizzes) * 100) : 0,
        };
      });

      const bySection = secLookup.map((s) => {
        const id = Number(s.sec_id);
        return {
          sec_id: id,
          sec_num: String(s.sec_num),
          count: secCounts.get(id) ?? 0,
        };
      });
      const lowCoverageSections = bySection.filter((s) => s.count < 3);

      const matrix = catLookup.map((c) => {
        const cName = String(c.cat_name);
        const difficulties: Record<string, number> = {};
        let total = 0;
        for (const d of diffLookup) {
          const dName = String(d.difficulty_name);
          const cnt = matrixCounts.get(`${cName}|||${dName}`) ?? 0;
          difficulties[dName] = cnt;
          total += cnt;
        }
        return { cat_name: cName, difficulties, total };
      });

      const facetedBreakdown: QuizFacetedCount[] = [];
      for (const [key, count] of facetedCounts.entries()) {
        const [cat_name, difficulty_name, type_name] = key.split("|||");
        facetedBreakdown.push({ cat_name, difficulty_name, type_name, count });
      }

      return {
        totalQuizzes,
        byCategory,
        byType,
        byDifficulty,
        bySection,
        lowCoverageSections,
        matrix,
        facetedBreakdown,
      };
    }

    const totalQuizzes = quizTableCount;

    // 2. Breakdown by Category
    const [catRows] = await db.query<RowDataPacket[]>(`
            SELECT c.cat_id, c.cat_name, COUNT(q.quiz_id) AS count
            FROM cat_tbl c
            LEFT JOIN quiz_tbl q ON c.cat_id = q.cat_id
            GROUP BY c.cat_id, c.cat_name
            ORDER BY c.cat_name
        `);
    const byCategory = catRows.map((r) => ({
      cat_id: Number(r.cat_id),
      cat_name: String(r.cat_name),
      count: Number(r.count),
      percentage:
        totalQuizzes > 0
          ? Math.round((Number(r.count) / totalQuizzes) * 100)
          : 0,
    }));

    // 3. Breakdown by Quiz Type
    const [typeRows] = await db.query<RowDataPacket[]>(`
            SELECT t.quiz_type_id, t.type_name, COUNT(q.quiz_id) AS count
            FROM quiz_type_tbl t
            LEFT JOIN quiz_tbl q ON t.quiz_type_id = q.quiz_type_id
            GROUP BY t.quiz_type_id, t.type_name
            ORDER BY t.quiz_type_id
        `);
    const byType = typeRows.map((r) => ({
      quiz_type_id: Number(r.quiz_type_id),
      type_name: String(r.type_name),
      count: Number(r.count),
      percentage:
        totalQuizzes > 0
          ? Math.round((Number(r.count) / totalQuizzes) * 100)
          : 0,
    }));

    // 4. Breakdown by Difficulty
    const [diffRows] = await db.query<RowDataPacket[]>(`
            SELECT d.difficulty_id, d.difficulty_name, COUNT(q.quiz_id) AS count
            FROM difficulty_tbl d
            LEFT JOIN quiz_tbl q ON d.difficulty_id = q.difficulty_id
            GROUP BY d.difficulty_id, d.difficulty_name
            ORDER BY d.difficulty_id
        `);
    const byDifficulty = diffRows.map((r) => ({
      difficulty_id: Number(r.difficulty_id),
      difficulty_name: String(r.difficulty_name),
      count: Number(r.count),
      percentage:
        totalQuizzes > 0
          ? Math.round((Number(r.count) / totalQuizzes) * 100)
          : 0,
    }));

    // 5. Breakdown by Section
    let bySection: { sec_id: number; sec_num: string; count: number }[] = [];
    try {
      const [secRows] = await db.query<RowDataPacket[]>(`
                SELECT s.sec_id, s.sec_num, COUNT(q.quiz_id) AS count
                FROM sec_tbl s
                LEFT JOIN quiz_tbl q ON s.sec_id = q.sec_id
                GROUP BY s.sec_id, s.sec_num
                ORDER BY s.sec_id
            `);
      bySection = secRows.map((r) => ({
        sec_id: Number(r.sec_id),
        sec_num: String(r.sec_num),
        count: Number(r.count),
      }));
    } catch {
      bySection = [];
    }
    const lowCoverageSections = bySection.filter((s) => s.count < 3);

    // 6. Cross-tabulation Category x Difficulty Matrix
    let matrix: {
      cat_name: string;
      difficulties: { [diffName: string]: number };
      total: number;
    }[] = [];
    try {
      const [matrixRows] = await db.query<RowDataPacket[]>(`
                SELECT c.cat_name, d.difficulty_name, COUNT(q.quiz_id) AS count
                FROM cat_tbl c
                CROSS JOIN difficulty_tbl d
                LEFT JOIN quiz_tbl q ON c.cat_id = q.cat_id AND d.difficulty_id = q.difficulty_id
                GROUP BY c.cat_id, c.cat_name, d.difficulty_id, d.difficulty_name
                ORDER BY c.cat_name, d.difficulty_id
            `);
      const matrixMap: Record<string, Record<string, number>> = {};
      for (const row of matrixRows) {
        const catName = String(row.cat_name);
        const diffName = String(row.difficulty_name);
        if (!matrixMap[catName]) matrixMap[catName] = {};
        matrixMap[catName][diffName] = Number(row.count);
      }
      matrix = Object.keys(matrixMap).map((catName) => {
        const diffs = matrixMap[catName];
        const total = Object.values(diffs).reduce((a, b) => a + b, 0);
        return { cat_name: catName, difficulties: diffs, total };
      });
    } catch (mErr) {
      console.warn("Failed to compute coverage matrix:", mErr);
    }

    // 7. Full Faceted Breakdown across (Category, Difficulty, Type)
    let facetedBreakdown: QuizFacetedCount[] = [];
    try {
      const [facetedRows] = await db.query<RowDataPacket[]>(`
                SELECT c.cat_name, d.difficulty_name, t.type_name, COUNT(q.quiz_id) AS count
                FROM quiz_tbl q
                JOIN cat_tbl c ON q.cat_id = c.cat_id
                JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
                JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
                GROUP BY c.cat_name, d.difficulty_name, t.type_name
            `);
      facetedBreakdown = facetedRows.map((r) => ({
        cat_name: String(r.cat_name),
        difficulty_name: String(r.difficulty_name),
        type_name: String(r.type_name),
        count: Number(r.count),
      }));
    } catch (fErr) {
      console.warn("Failed to compute faceted breakdown:", fErr);
    }

    return {
      totalQuizzes,
      byCategory,
      byType,
      byDifficulty,
      bySection,
      lowCoverageSections,
      matrix,
      facetedBreakdown,
    };
  } catch (error) {
    console.error("Failed to fetch quiz metrics:", error);
    return {
      totalQuizzes: 0,
      byCategory: [],
      byType: [],
      byDifficulty: [],
      bySection: [],
      lowCoverageSections: [],
      matrix: [],
      facetedBreakdown: [],
    };
  }
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
  try {
    const hasQuizTbl = await tableExists("quiz_tbl");
    let quizTblCount = 0;
    if (hasQuizTbl) {
      const [qCountRows] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM quiz_tbl",
      );
      quizTblCount = Number(qCountRows[0]?.total ?? 0);
    }

    if (!hasQuizTbl || quizTblCount === 0) {
      const safePageSize = Math.max(1, Math.floor(pageSize));
      const search = filters.search?.trim().toLowerCase() ?? "";
      const idSearch = filters.id?.replace(/^[#\s]+/, "").trim() ?? "";
      const section = filters.section?.trim() ?? "";
      const categoryFilter = filters.category?.trim().toLowerCase() ?? "";
      const difficultyFilter = filters.difficulty?.trim().toLowerCase() ?? "";
      const typeFilter = filters.type?.trim().toLowerCase() ?? "";

      const [catLookup] = await db.query<RowDataPacket[]>(
        "SELECT cat_id, cat_name FROM cat_tbl",
      );
      const [diffLookup] = await db.query<RowDataPacket[]>(
        "SELECT difficulty_id, difficulty_name FROM difficulty_tbl",
      );
      const catNameById = new Map<number, string>(
        catLookup.map((c) => [Number(c.cat_id), String(c.cat_name)]),
      );
      const diffNameById = new Map<number, string>(
        diffLookup.map((d) => [Number(d.difficulty_id), String(d.difficulty_name)]),
      );

      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT COALESCE(p.pending_id, u.unit_id) AS pending_id,
                u.unit_id,
                COALESCE(u.unit_title, p.unit_title) AS unit_title,
                COALESCE(u.sec_id, p.sec_id) AS sec_id,
                s.sec_num,
                COALESCE(u.unit_lesson_card_json, p.unit_lesson_card_json) AS unit_lesson_card_json,
                COALESCE(u.unit_quiz_json, p.unit_quiz_json) AS unit_quiz_json,
                COALESCE(u.unit_assessment_json, p.unit_assessment_json) AS unit_assessment_json,
                COALESCE(p.pending_status, 'approved') AS pending_status,
                COALESCE(p.pending_name, 'Administrator') AS pending_name
         FROM unit_tbl u
         LEFT JOIN unit_approved_tbl a ON a.unit_id = u.unit_id
         LEFT JOIN pending_tbl p ON p.pending_id = a.pending_id
         LEFT JOIN sec_tbl s ON s.sec_id = COALESCE(u.sec_id, p.sec_id)
         ORDER BY u.unit_id DESC`,
      );

      const allUnits = rows.map((row) => {
        const lessonCard = parseJsonColumn(row.unit_lesson_card_json);
        const quizzes = parseJsonColumn(row.unit_quiz_json);
        const assessment = parseJsonColumn(row.unit_assessment_json);
        const quizList = Array.isArray(quizzes) ? quizzes : [];
        const firstQuiz = quizList[0] ?? {};
        const unitNumber = firstQuiz?.unit ?? null;
        const resolvedCatId = Number(firstQuiz?.cat_id ?? 0);
        const resolvedDiffId = Number(firstQuiz?.difficulty_id ?? 0);
        const resolvedCatName = catNameById.get(resolvedCatId) ?? "Unit";
        const resolvedDiffName =
          diffNameById.get(resolvedDiffId) ?? String(row.pending_status ?? "approved");

        return {
          quiz_id: Number(row.pending_id ?? row.unit_id),
          unit_id: Number(row.unit_id),
          cat_id: resolvedCatId,
          sec_id: Number(row.sec_id),
          difficulty_id: resolvedDiffId,
          quiz_type_id: 0,
          question_text: String(row.unit_title),
          cat_name: resolvedCatName,
          sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
          difficulty_name: resolvedDiffName,
          type_name: "Unit",
          quiz_payload: {
            title: String(row.unit_title),
            lesson_card: lessonCard,
            quizzes: quizList,
            assessment,
            unit_number: unitNumber,
            pending_name: row.pending_name,
            pending_status: row.pending_status,
          },
        };
      });

      const filteredUnits = allUnits.filter((unit) => {
        if (
          idSearch &&
          !String(unit.quiz_id).includes(idSearch) &&
          !String(unit.unit_id).includes(idSearch)
        ) {
          return false;
        }
        if (
          search &&
          !getLessonTitlesFromDocument(unit.quiz_payload.lesson_card).some(
            (title) => title.toLowerCase().includes(search),
          )
        ) {
          return false;
        }
        if (section && (unit.sec_num ?? "") !== section) {
          return false;
        }
        if (
          categoryFilter &&
          unit.cat_name.toLowerCase() !== categoryFilter &&
          categoryFilter !== "unit"
        ) {
          return false;
        }
        if (
          difficultyFilter &&
          unit.difficulty_name.toLowerCase() !== difficultyFilter &&
          String(unit.quiz_payload.pending_status ?? "").toLowerCase() !==
            difficultyFilter
        ) {
          return false;
        }
        if (typeFilter && unit.type_name.toLowerCase() !== typeFilter) {
          return false;
        }
        return true;
      });

      const totalCount = filteredUnits.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
      const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
      const offset = (currentPage - 1) * safePageSize;
      const pagedUnits = filteredUnits.slice(offset, offset + safePageSize);

      return {
        quizzes: pagedUnits,
        currentPage,
        totalPages,
        totalCount,
      };
    }

    const safePageSize = Math.max(1, Math.floor(pageSize));
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filters.id?.trim()) {
      where.push("CAST(q.quiz_id AS CHAR) LIKE ?");
      params.push(`%${filters.id.replace(/^[#\\s]+/, "").trim()}%`);
    }
    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      where.push(
        "CASE WHEN JSON_VALID(q.quiz_payload) THEN JSON_SEARCH(q.quiz_payload, 'one', ?, NULL, '$.lesson_card.lesson_title', '$.lesson_card.lesson_slide[*].lesson_title', '$.lesson_card.lesson_slide[*].title', '$.lesson_card.lesson_slides[*].lesson_title', '$.lesson_card.lesson_slides[*].title') ELSE NULL END IS NOT NULL",
      );
      params.push(search);
    }
    if (filters.category) {
      where.push("c.cat_name = ?");
      params.push(filters.category);
    }
    if (filters.section) {
      where.push("s.sec_num = ?");
      params.push(filters.section);
    }
    if (filters.difficulty) {
      where.push("d.difficulty_name = ?");
      params.push(filters.difficulty);
    }
    if (filters.type) {
      where.push("t.type_name = ?");
      params.push(filters.type);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const joins = `
            FROM quiz_tbl q
            JOIN cat_tbl c ON q.cat_id = c.cat_id
            JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
            JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
            JOIN sec_tbl s ON q.sec_id = s.sec_id
        `;
    const [countRows] = await db.query<RowDataPacket[]>(
      `
            SELECT COUNT(*) AS total
            ${joins}
            ${whereClause}
        `,
      params,
    );
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
    const offset = (currentPage - 1) * safePageSize;
    const [quizzes] = await db.query<QuizRow[]>(
      `
            SELECT q.quiz_id, q.cat_id, q.sec_id, s.sec_num, q.difficulty_id, q.quiz_type_id,
                   q.question_text, q.quiz_payload,
                   c.cat_name, d.difficulty_name, t.type_name
            ${joins}
            ${whereClause}
            ORDER BY q.quiz_id DESC
            LIMIT ? OFFSET ?
        `,
      [...params, safePageSize, offset],
    );

    return {
      quizzes: quizzes.map((q) => ({
        ...q,
        sec_num: q.sec_num ?? undefined,
        quiz_payload:
          typeof q.quiz_payload === "string"
            ? JSON.parse(q.quiz_payload)
            : q.quiz_payload,
      })),
      currentPage,
      totalPages,
      totalCount,
    };
  } catch (error) {
    console.error("Failed to fetch recent quizzes:", error);
    return { quizzes: [], currentPage: 1, totalPages: 1, totalCount: 0 };
  }
}

export async function getRecentQuizzes() {
  const result = await getPaginatedRecentQuizzes(1, 20);
  return result.quizzes;
}

export async function getUnitById(unitId: number) {
  if (!Number.isInteger(unitId) || unitId < 1) return null;

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT p.pending_id, u.unit_id,
              COALESCE(u.unit_title, p.unit_title) AS unit_title,
              COALESCE(u.sec_id, p.sec_id) AS sec_id,
              s.sec_num,
              COALESCE(u.unit_lesson_card_json, p.unit_lesson_card_json) AS unit_lesson_card_json,
              COALESCE(u.unit_quiz_json, p.unit_quiz_json) AS unit_quiz_json,
              COALESCE(u.unit_assessment_json, p.unit_assessment_json) AS unit_assessment_json,
              COALESCE(p.pending_status, 'approved') AS pending_status,
              COALESCE(p.pending_name, 'Administrator') AS pending_name
       FROM unit_tbl u
       LEFT JOIN unit_approved_tbl a ON a.unit_id = u.unit_id
       LEFT JOIN pending_tbl p ON p.pending_id = a.pending_id
       LEFT JOIN sec_tbl s ON s.sec_id = COALESCE(u.sec_id, p.sec_id)
       WHERE u.unit_id = ? OR p.pending_id = ?
       LIMIT 1`,
      [unitId, unitId],
    );
    let row = rows[0];
    if (!row) {
      const [pendingRows] = await db.query<RowDataPacket[]>(
        `SELECT p.pending_id, p.unit_title, p.sec_id, s.sec_num,
                p.unit_lesson_card_json, p.unit_quiz_json,
                p.unit_assessment_json, p.pending_status, p.pending_name
         FROM pending_tbl p
         LEFT JOIN sec_tbl s ON s.sec_id = p.sec_id
         WHERE p.pending_id = ?
         LIMIT 1`,
        [unitId],
      );
      row = pendingRows[0];
    }
    if (!row) return null;

    const quizzes = parseJsonColumn(row.unit_quiz_json);
    return {
      quiz_id: row.pending_id ?? row.unit_id,
      unit_id: row.unit_id ?? row.pending_id,
      cat_id: 0,
      sec_id: row.sec_id,
      difficulty_id: 0,
      quiz_type_id: 0,
      question_text: row.unit_title,
      cat_name: "Unit",
      sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
      difficulty_name: row.pending_status,
      type_name: "Unit",
      quiz_payload: {
        title: row.unit_title,
        lesson_card: parseJsonColumn(row.unit_lesson_card_json),
        quizzes,
        assessment: parseJsonColumn(row.unit_assessment_json),
        unit_number: Array.isArray(quizzes) ? quizzes[0]?.unit ?? null : null,
        pending_name: row.pending_name,
      },
    };
  } catch (error) {
    console.error("Failed to fetch selected unit:", error);
    return null;
  }
}

export async function getQuizOrUnitById(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;

  try {
    if (await tableExists("quiz_tbl")) {
      const [rows] = await db.query<QuizRow[]>(
        `SELECT q.quiz_id, q.cat_id, q.sec_id, s.sec_num, q.difficulty_id,
                q.quiz_type_id, q.question_text, q.quiz_payload,
                c.cat_name, d.difficulty_name, t.type_name
         FROM quiz_tbl q
         JOIN cat_tbl c ON q.cat_id = c.cat_id
         JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
         JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
         LEFT JOIN sec_tbl s ON q.sec_id = s.sec_id
         WHERE q.quiz_id = ?
         LIMIT 1`,
        [id],
      );
      const quiz = rows[0];
      if (quiz) {
        return {
          ...quiz,
          sec_num: quiz.sec_num != null ? String(quiz.sec_num) : undefined,
          quiz_payload:
            typeof quiz.quiz_payload === "string"
              ? parseJsonColumn(quiz.quiz_payload)
              : quiz.quiz_payload,
        };
      }
    }

    return await getUnitById(id);
  } catch (error) {
    console.error("Failed to fetch selected quiz or unit:", error);
    return null;
  }
}

export async function createQuiz(state: unknown, formData: FormData) {
  const staff = await requireStaff();
  if (!staff) {
    return { error: "Unauthorized" };
  }
  if (!(await tableExists("quiz_tbl"))) {
    return {
      error:
        "The quiz bank table is not available in the current database schema.",
    };
  }

  const catId = formData.get("cat_id");
  const secId = formData.get("sec_id");
  const difficultyId = formData.get("difficulty_id");
  const quizTypeId = formData.get("quiz_type_id");
  const questionText =
    (formData.get("question_text") as string | null) ??
    (formData.get("cp_prompt_0") as string | null) ??
    "";

  if (!catId || !difficultyId || !quizTypeId || !questionText) {
    return {
      error: "Category, difficulty, type, and question are all required.",
    };
  }

  try {
    const [typeRow] = await db.query<RowDataPacket[]>(
      "SELECT type_name FROM quiz_type_tbl WHERE quiz_type_id = ?",
      [quizTypeId],
    );

    if (typeRow.length === 0) {
      return { error: "Invalid quiz type selected." };
    }

    const typeName = typeRow[0].type_name;
    const parsedPayload = getQuizPayload(typeName, formData);
    if (parsedPayload.error) {
      return { error: parsedPayload.error };
    }

    const session = await auth();
    const authorId = staff.id ? Number(staff.id) : (session?.user?.id ? Number(session.user.id) : null);
    const pendingName = (
      session?.user?.name ??
      session?.user?.email?.split("@")[0] ??
      staff.email?.split("@")[0] ??
      "Contributor"
    ).slice(0, 50);

    const quizItem = {
      cat_id: Number(catId),
      difficulty_id: Number(difficultyId),
      quiz_type_id: Number(quizTypeId),
      question_text: questionText.toString().trim(),
      quiz_payload: parsedPayload.payload,
    };

    const resolvedSecId = secId && String(secId).trim() !== "" ? Number(secId) : 1;

    const [insertResult] = await db.query<ResultSetHeader>(
      `INSERT INTO pending_tbl
       (unit_title, sec_id, unit_lesson_card_json, unit_quiz_json,
        unit_assessment_json, pending_status, pending_note, pending_name, author_id)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        questionText.toString().trim().slice(0, 50),
        resolvedSecId,
        JSON.stringify({ lesson_slide: [] }),
        JSON.stringify([quizItem]),
        JSON.stringify({ steps: [] }),
        "",
        pendingName,
        authorId !== null && !isNaN(authorId) ? authorId : null,
      ],
    );

    return {
      success: true,
      pending: true,
      pendingId: insertResult.insertId,
      message: "Quiz submitted for review.",
    };
  } catch (error) {
    console.error("Failed to insert quiz:", error);
    return {
      error: "An error occurred while saving the quiz to the database.",
    };
  }
}

export async function deleteQuiz(quizId: number) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!quizId) {
    return { error: "Quiz ID is required for deletion." };
  }
  if (!(await tableExists("quiz_tbl"))) {
    return {
      error:
        "The quiz bank table is not available in the current database schema.",
    };
  }
  try {
    const [result] = await db.query<ResultSetHeader>(
      "DELETE FROM quiz_tbl WHERE quiz_id = ?",
      [quizId],
    );
    return result.affectedRows === 0
      ? { error: "Quiz was not found." }
      : { success: true };
  } catch (error) {
    console.error("Failed to delete quiz:", error);
    return {
      error: "An error occurred while deleting the quiz from the database.",
    };
  }
}

export async function updateQuiz(quizId: number, formData: FormData) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!(await tableExists("quiz_tbl"))) {
    return {
      error:
        "The quiz bank table is not available in the current database schema.",
    };
  }

  const catId = formData.get("cat_id");
  const secId = formData.get("sec_id");
  const difficultyId = formData.get("difficulty_id");
  const quizTypeId = formData.get("quiz_type_id");
  const questionText =
    (formData.get("question_text") as string | null) ??
    (formData.get("cp_prompt_0") as string | null) ??
    "";

  if (!quizId || !catId || !difficultyId || !quizTypeId || !questionText) {
    return {
      error:
        "Quiz ID, category, difficulty, type, and question are all required.",
    };
  }

  try {
    const [typeRows] = await db.query<RowDataPacket[]>(
      "SELECT type_name FROM quiz_type_tbl WHERE quiz_type_id = ?",
      [quizTypeId],
    );
    if (typeRows.length === 0) {
      return { error: "Invalid quiz type selected." };
    }

    const parsedPayload = getQuizPayload(typeRows[0].type_name, formData);
    if (parsedPayload.error) {
      return { error: parsedPayload.error };
    }

    const hasSecId = await quizHasColumn("sec_id");
    const updateFields = [
      "cat_id = ?",
      "difficulty_id = ?",
      "quiz_type_id = ?",
      "question_text = ?",
      "quiz_payload = ?",
    ];
    const values: unknown[] = [
      catId,
      difficultyId,
      quizTypeId,
      questionText.toString().trim(),
      JSON.stringify(parsedPayload.payload),
    ];

    if (hasSecId && secId && secId !== "") {
      updateFields.push("sec_id = ?");
      values.push(secId);
    }

    values.push(quizId);

    const [result] = await db.query<ResultSetHeader>(
      `UPDATE quiz_tbl SET ${updateFields.join(", ")} WHERE quiz_id = ?`,
      values,
    );

    return result.affectedRows === 0
      ? { error: "Quiz question was not found." }
      : { success: true };
  } catch (error) {
    console.error("Failed to update quiz:", error);
    return {
      error: "An error occurred while updating the quiz in the database.",
    };
  }
}

// For /quiz
// export async function getQuizzesByType(typeName: "MCQ" | "FITB" | "Order" | "Pair") {
//     try {
//         const [quizzes] = await db.query<QuizRow[]>(`
//             SELECT q.quiz_id, q.cat_id, q.sec_id, s.sec_num, q.difficulty_id, q.quiz_type_id,
//                     q.question_text, q.quiz_payload,
//                     c.cat_name, d.difficulty_name, t.type_name
//             FROM quiz_tbl q
//             JOIN cat_tbl c ON q.cat_id = c.cat_id
//             JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
//             JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
//             LEFT JOIN sec_tbl s ON q.sec_id = s.sec_id
//             WHERE t.type_name = ?
//             ORDER BY q.quiz_id DESC
//         `, [typeName]);

//         return quizzes.map((quiz) => ({
//             ...quiz,
//             sec_num: quiz.sec_num ?? undefined,
//             quiz_payload:
//                 typeof quiz.quiz_payload === "string"
//                     ? JSON.parse(quiz.quiz_payload)
//                     : quiz.quiz_payload,
//         }));
//     } catch (error) {
//         console.error(`Failed to fetch ${typeName} quizzes:`, error);
//         return [];
//     }
// }

export async function getQuizzes(filters?: {
  cat_id?: number;
  sec_id?: number;
  difficulty_id?: number;
}) {
  try {
    const conditions: string[] = [];
    const params: number[] = [];
    if (filters?.cat_id) {
      conditions.push("q.cat_id = ?");
      params.push(filters.cat_id);
    }
    if (filters?.sec_id) {
      conditions.push("q.sec_id = ?");
      params.push(filters.sec_id);
    }
    if (filters?.difficulty_id) {
      conditions.push("q.difficulty_id = ?");
      params.push(filters.difficulty_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [quizzes] = await db.query<QuizRow[]>(
      `
            SELECT q.quiz_id, q.cat_id, q.sec_id, s.sec_num, q.difficulty_id, q.quiz_type_id,
                    q.question_text, q.quiz_payload,
                    c.cat_name, d.difficulty_name, t.type_name
            FROM quiz_tbl q
            JOIN cat_tbl c ON q.cat_id = c.cat_id
            JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
            JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
            LEFT JOIN sec_tbl s ON q.sec_id = s.sec_id
            ${where}
            ORDER BY q.quiz_id DESC
            `,
      params,
    );

    return quizzes.map((quiz) => ({
      ...quiz,
      sec_num: quiz.sec_num ?? undefined,
      quiz_payload:
        typeof quiz.quiz_payload === "string"
          ? JSON.parse(quiz.quiz_payload)
          : quiz.quiz_payload,
    }));
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return [];
  }
}

export interface PendingUnit extends RowDataPacket {
  pending_id: number;
  unit_id?: number;
  unit_title: string;
  sec_id: number;
  unit_lesson_card_json: unknown;
  unit_quiz_json: unknown;
  unit_assessment_json: unknown;
  pending_status: "pending" | "approved" | "rejected" | string;
  pending_name: string;
  pending_note?: string | null;
  sec_num?: string;
  question_text: string;
  cat_name: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: unknown;
}

export async function getPendingQuizzes(statusFilter = "pending") {
  try {
    const params: string[] = [];
    let whereClause = "";
    if (statusFilter !== "all") {
      whereClause = "WHERE p.pending_status = ?";
      params.push(statusFilter);
    }

    const [rows] = await db.query<PendingUnit[]>(
      `
        SELECT p.pending_id, u.unit_id,
               COALESCE(u.unit_title, p.unit_title) AS unit_title,
               COALESCE(u.sec_id, p.sec_id) AS sec_id,
               COALESCE(u.unit_lesson_card_json, p.unit_lesson_card_json) AS unit_lesson_card_json,
               COALESCE(u.unit_quiz_json, p.unit_quiz_json) AS unit_quiz_json,
               COALESCE(u.unit_assessment_json, p.unit_assessment_json) AS unit_assessment_json,
               p.pending_status, p.pending_name,
               p.pending_note, s.sec_num
        FROM pending_tbl p
        LEFT JOIN unit_approved_tbl a ON a.pending_id = p.pending_id
        LEFT JOIN unit_tbl u ON u.unit_id = a.unit_id
        LEFT JOIN sec_tbl s ON COALESCE(u.sec_id, p.sec_id) = s.sec_id
        ${whereClause}
        ORDER BY p.pending_id DESC
      `,
      params,
    );

    return rows.map((row) => {
      const unitQuizJson = parseJsonColumn(row.unit_quiz_json);
      const firstQuiz = Array.isArray(unitQuizJson) ? unitQuizJson[0] : {};
      return {
        ...row,
        sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
        unit_lesson_card_json: parseJsonColumn(row.unit_lesson_card_json),
        unit_quiz_json: unitQuizJson,
        unit_assessment_json: parseJsonColumn(row.unit_assessment_json),
        question_text: row.unit_title,
        cat_name: "",
        difficulty_name: "",
        type_name: "Unit",
        quiz_payload: firstQuiz?.quiz_payload ?? {},
      };
    });
  } catch (error) {
    console.error("Failed to fetch pending quizzes:", error);
    return [];
  }
}

export async function getPendingQuizById(pendingId: number) {
  if (!Number.isInteger(pendingId) || pendingId < 1) {
    return { error: "A valid pending unit ID is required." };
  }

  try {
    const [rows] = await db.query<PendingUnit[]>(
      `SELECT p.pending_id, u.unit_id,
              COALESCE(u.unit_title, p.unit_title) AS unit_title,
              COALESCE(u.sec_id, p.sec_id) AS sec_id,
              COALESCE(u.unit_lesson_card_json, p.unit_lesson_card_json) AS unit_lesson_card_json,
              COALESCE(u.unit_quiz_json, p.unit_quiz_json) AS unit_quiz_json,
              COALESCE(u.unit_assessment_json, p.unit_assessment_json) AS unit_assessment_json,
              p.pending_status, p.pending_name,
              p.pending_note, s.sec_num
       FROM pending_tbl p
       LEFT JOIN unit_approved_tbl a ON a.pending_id = p.pending_id
       LEFT JOIN unit_tbl u ON u.unit_id = a.unit_id
       LEFT JOIN sec_tbl s ON COALESCE(u.sec_id, p.sec_id) = s.sec_id
       WHERE p.pending_id = ?
       LIMIT 1`,
      [pendingId],
    );
    let quiz = rows[0];

    if (!quiz) {
      const [approvedRows] = await db.query<PendingUnit[]>(
        `SELECT p.pending_id, u.unit_id,
                COALESCE(u.unit_title, p.unit_title) AS unit_title,
                COALESCE(u.sec_id, p.sec_id) AS sec_id,
                COALESCE(u.unit_lesson_card_json, p.unit_lesson_card_json) AS unit_lesson_card_json,
                COALESCE(u.unit_quiz_json, p.unit_quiz_json) AS unit_quiz_json,
                COALESCE(u.unit_assessment_json, p.unit_assessment_json) AS unit_assessment_json,
                p.pending_status, p.pending_name,
                p.pending_note, s.sec_num
         FROM unit_approved_tbl a
         JOIN pending_tbl p ON p.pending_id = a.pending_id
         LEFT JOIN unit_tbl u ON u.unit_id = a.unit_id
         LEFT JOIN sec_tbl s ON COALESCE(u.sec_id, p.sec_id) = s.sec_id
         WHERE a.unit_id = ?
         LIMIT 1`,
        [pendingId],
      );
      quiz = approvedRows[0];
    }

    if (!quiz) {
      const [unitRows] = await db.query<RowDataPacket[]>(
        `SELECT u.unit_id AS pending_id, u.unit_id, u.unit_title, u.sec_id,
                u.unit_lesson_card_json, u.unit_quiz_json,
                u.unit_assessment_json, 'approved' AS pending_status,
                'Administrator' AS pending_name, NULL AS pending_note, s.sec_num
         FROM unit_tbl u
         LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id
         WHERE u.unit_id = ?
         LIMIT 1`,
        [pendingId],
      );
      if (unitRows[0]) {
        quiz = unitRows[0] as unknown as PendingUnit;
      }
    }

    if (!quiz) {
      return { error: "The pending unit was not found." };
    }
    const lessonCard = parseJsonColumn(quiz.unit_lesson_card_json);
    const unitQuizJson = parseJsonColumn(quiz.unit_quiz_json);
    const assessment = parseJsonColumn(quiz.unit_assessment_json);
    const quizzes = Array.isArray(unitQuizJson) ? unitQuizJson : [];
    const firstQuiz = quizzes[0] ?? {};

    return {
      pending_id: Number(quiz.pending_id),
      unit_id: quiz.unit_id == null ? undefined : Number(quiz.unit_id),
      unit_title: String(quiz.unit_title ?? ""),
      sec_id: Number(quiz.sec_id),
      sec_num: quiz.sec_num != null ? String(quiz.sec_num) : undefined,
      pending_status: String(quiz.pending_status ?? ""),
      pending_name: String(quiz.pending_name ?? ""),
      pending_note: quiz.pending_note ?? null,
      unit_lesson_card_json: lessonCard,
      unit_quiz_json: quizzes,
      unit_assessment_json: assessment,
      question_text: String(quiz.unit_title ?? ""),
      cat_name: "",
      difficulty_name: String(quiz.pending_status ?? ""),
      type_name: "Unit",
      quiz_payload: {
        ...(firstQuiz?.quiz_payload ?? {}),
        title: String(quiz.unit_title ?? ""),
        lesson_card: lessonCard,
        quizzes,
        assessment,
      },
    };
  } catch (error) {
    console.error("Failed to fetch pending quiz:", error);
    return { error: "The pending unit could not be fetched." };
  }
}

export async function reviewPendingQuiz(
  pendingId: number,
  decision: "approve" | "reject",
  rejectionNotes = "",
) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!pendingId || !["approve", "reject"].includes(decision)) {
    return { error: "A valid pending quiz and decision are required." };
  }
  if (decision === "reject" && !rejectionNotes.trim()) {
    return { error: "A rejection note is required." };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [pendingRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM pending_tbl WHERE pending_id = ? FOR UPDATE",
      [pendingId],
    );
    const pendingUnit = pendingRows[0];
    if (!pendingUnit) {
      await connection.rollback();
      return { error: "Pending unit not found." };
    }

    if (pendingUnit.pending_status !== "pending") {
      await connection.rollback();
      return { error: "This unit has already been reviewed." };
    }

    if (decision === "reject") {
      await connection.query(
        "UPDATE pending_tbl SET pending_status = 'rejected', pending_note = ? WHERE pending_id = ?",
        [rejectionNotes.trim(), pendingId],
      );
      await connection.commit();
      revalidateQuizPaths();
      return {
        success: true,
        message: "Unit rejected and retained in the review history.",
      };
    }

    const [unitResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO unit_tbl
       (unit_title, sec_id, unit_lesson_card_json, unit_quiz_json,
        unit_assessment_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        pendingUnit.unit_title,
        pendingUnit.sec_id,
        typeof pendingUnit.unit_lesson_card_json === "object"
          ? JSON.stringify(pendingUnit.unit_lesson_card_json)
          : pendingUnit.unit_lesson_card_json,
        typeof pendingUnit.unit_quiz_json === "object"
          ? JSON.stringify(pendingUnit.unit_quiz_json)
          : pendingUnit.unit_quiz_json,
        typeof pendingUnit.unit_assessment_json === "object"
          ? JSON.stringify(pendingUnit.unit_assessment_json)
          : pendingUnit.unit_assessment_json,
      ],
    );

    await connection.query(
      `INSERT INTO unit_approved_tbl (pending_id, unit_id)
       VALUES (?, ?)`,
      [pendingId, unitResult.insertId],
    );

    await connection.query(
      "UPDATE pending_tbl SET pending_status = 'approved' WHERE pending_id = ?",
      [pendingId],
    );
    await connection.commit();
    revalidateQuizPaths();
    return {
      success: true,
      unitId: unitResult.insertId,
      message: "Unit approved and added to the unit bank.",
    };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to review pending quiz:", error);
    return { error: "An error occurred while reviewing the quiz." };
  } finally {
    connection.release();
  }
}

export async function updatePendingQuiz(
  pendingId: number,
  questionText: string,
) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!pendingId || !questionText.trim()) {
    return { error: "A valid pending quiz and question are required." };
  }

  try {
    const trimmed = questionText.trim().slice(0, 255);
    const [result] = await db.query<ResultSetHeader>(
      "UPDATE pending_tbl SET unit_title = ? WHERE pending_id = ?",
      [trimmed, pendingId],
    );
    await db.query(
      `UPDATE unit_tbl u
       JOIN unit_approved_tbl a ON a.unit_id = u.unit_id
       SET u.unit_title = ?
       WHERE a.pending_id = ?`,
      [trimmed, pendingId],
    );
    revalidateQuizPaths();
    return result.affectedRows === 0
      ? { error: "Pending quiz was not found." }
      : { success: true };
  } catch (error) {
    console.error("Failed to update pending quiz:", error);
    return { error: "An error occurred while updating the pending quiz." };
  }
}

export async function updatePendingNote(
  pendingId: number,
  pendingNote: string,
) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!pendingId || !pendingNote.trim()) {
    return { error: "A note is required." };
  }

  try {
    const [result] = await db.query<ResultSetHeader>(
      "UPDATE pending_tbl SET pending_note = ? WHERE pending_id = ? AND pending_status = 'rejected'",
      [pendingNote.trim(), pendingId],
    );
    revalidateQuizPaths();
    return result.affectedRows === 0
      ? { error: "Only rejected quizzes can receive a note." }
      : { success: true };
  } catch (error) {
    console.error("Failed to update pending note:", error);
    return { error: "An error occurred while saving the note." };
  }
}

export async function updatePendingQuizFromForm(
  pendingId: number,
  formData: FormData,
) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  const catId = formData.get("cat_id");
  const secId = formData.get("sec_id");
  const difficultyId = formData.get("difficulty_id");
  const quizTypeId = formData.get("quiz_type_id");
  const questionText =
    formData.get("question_text") ?? formData.get("cp_prompt_0");

  if (!pendingId || !catId || !difficultyId || !quizTypeId || !questionText) {
    return {
      error:
        "Quiz ID, category, difficulty, type, and question are all required.",
    };
  }

  try {
    const [typeRows] = await db.query<RowDataPacket[]>(
      "SELECT type_name FROM quiz_type_tbl WHERE quiz_type_id = ?",
      [quizTypeId],
    );
    if (typeRows.length === 0) return { error: "Invalid quiz type selected." };
    const parsedPayload = getQuizPayload(typeRows[0].type_name, formData);
    if (parsedPayload.error) return { error: parsedPayload.error };

    const quizItem = {
      cat_id: Number(catId),
      difficulty_id: Number(difficultyId),
      quiz_type_id: Number(quizTypeId),
      question_text: questionText.toString().trim(),
      quiz_payload: parsedPayload.payload,
    };
    const resolvedSecId = secId && String(secId).trim() !== "" ? Number(secId) : 1;
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE pending_tbl 
       SET unit_title = ?, sec_id = ?, unit_quiz_json = ? 
       WHERE pending_id = ?`,
      [
        questionText.toString().trim().slice(0, 50),
        resolvedSecId,
        JSON.stringify([quizItem]),
        Number(pendingId),
      ],
    );
    revalidateQuizPaths();
    return result.affectedRows === 0
      ? { success: true, message: "No changes were needed." }
      : { success: true };
  } catch (error) {
    console.error("Failed to update pending quiz:", error);
    return { error: "An error occurred while updating the pending quiz." };
  }
}

export async function updatePendingUnitFromForm(
  pendingId: number,
  formData: FormData,
) {
  const staff = await requireStaff();
  if (!staff) {
    return { error: "Unauthorized" };
  }
  const unitTitle = String(formData.get("unit_title") ?? "").trim();
  const sectionId = formData.get("sec_id");
  const sectionIdNumber = Number(sectionId);
  const lessonSlides = Array.from(formData.entries())
    .filter(([name]) => /^lesson_text_\d+$/.test(name))
    .sort(
      ([left], [right]) =>
        Number(left.slice("lesson_text_".length)) -
        Number(right.slice("lesson_text_".length)),
    )
    .map(([name]) => {
      const index = name.slice("lesson_text_".length);
      const lessonText = String(formData.get(`lesson_text_${index}`) ?? "").trim();
      const lessonTitle = String(
        formData.get(`lesson_title_${index}`) ?? "",
      ).trim();
      return {
        ...(lessonTitle ? { lesson_title: lessonTitle } : {}),
        lesson_text: lessonText,
        ...(formData.has(`lesson_code_${index}`)
          ? {
              lesson_code: String(
                formData.get(`lesson_code_${index}`) ?? "",
              ),
            }
          : {}),
      };
    });
  const imported = readAssessmentBulkImport(formData);
  if (imported.error) {
    return { error: `Bulk import is invalid: ${imported.error}` };
  }
  const builtAssessment = imported.data
    ? { document: serializeImportedAssessment(imported.data.unit_assessment_json) }
    : buildAssessmentDocumentFromForm(formData);
  if ("error" in builtAssessment && builtAssessment.error) {
    return { error: builtAssessment.error };
  }
  const rawQuizJson = formData.get("quiz_json");

  if (
    !pendingId ||
    !unitTitle ||
    !Number.isInteger(sectionIdNumber) ||
    sectionIdNumber < 1 ||
    lessonSlides.length === 0 ||
    lessonSlides.some((slide) => !slide.lesson_text)
  ) {
    return { error: "Unit title, section, and lesson text are required." };
  }

  let quizzes: unknown[];
  if (imported.data) {
    quizzes = imported.data.unit_quiz_json;
  } else {
    let candidate: unknown;
    try {
      candidate =
        typeof rawQuizJson === "string" ? JSON.parse(rawQuizJson) : null;
    } catch {
      return { error: "The queued quiz data is malformed JSON." };
    }
    if (!Array.isArray(candidate)) {
      return { error: "Queued quiz data must be a JSON array." };
    }
    quizzes = candidate;
  }
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    return { error: "At least one quiz is required for the unit." };
  }

  const lessonCardJson = JSON.stringify({ lesson_slide: lessonSlides });
  const quizJson = JSON.stringify(quizzes);
  const assessmentJson = builtAssessment.document;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (imported.data) {
      const referenceError = await validateImportedQuestionReferences(
        connection,
        imported.data,
        sectionIdNumber,
      );
      if (referenceError) {
        await connection.rollback();
        return { error: referenceError };
      }
    }

    const [pendingUpdate] = await connection.query<ResultSetHeader>(
      `UPDATE pending_tbl
       SET unit_title = ?, sec_id = ?, unit_lesson_card_json = ?,
           unit_quiz_json = ?, unit_assessment_json = ?,
           pending_status = CASE WHEN pending_status = 'rejected' THEN 'pending' ELSE pending_status END
       WHERE pending_id = ?`,
      [
        unitTitle,
        sectionIdNumber,
        lessonCardJson,
        quizJson,
        assessmentJson,
        pendingId,
      ],
    );

    // If this pending unit has an approved counterpart in unit_tbl, update it as well
    const [approvedRows] = await connection.query<RowDataPacket[]>(
      "SELECT unit_id FROM unit_approved_tbl WHERE pending_id = ?",
      [pendingId],
    );

    let unitTblUpdated = false;
    if (approvedRows.length > 0) {
      for (const row of approvedRows) {
        await connection.query(
          `UPDATE unit_tbl
           SET unit_title = ?, sec_id = ?, unit_lesson_card_json = ?,
               unit_quiz_json = ?, unit_assessment_json = ?
           WHERE unit_id = ?`,
          [
            unitTitle,
            sectionIdNumber,
            lessonCardJson,
            quizJson,
            assessmentJson,
            row.unit_id,
          ],
        );
        unitTblUpdated = true;
      }
    } else {
      // Check if pendingId is directly a unit_id in unit_tbl
      const [unitRows] = await connection.query<RowDataPacket[]>(
        "SELECT unit_id FROM unit_tbl WHERE unit_id = ?",
        [pendingId],
      );
      if (unitRows.length > 0) {
        await connection.query(
          `UPDATE unit_tbl
           SET unit_title = ?, sec_id = ?, unit_lesson_card_json = ?,
               unit_quiz_json = ?, unit_assessment_json = ?
           WHERE unit_id = ?`,
          [
            unitTitle,
            sectionIdNumber,
            lessonCardJson,
            quizJson,
            assessmentJson,
            pendingId,
          ],
        );
        unitTblUpdated = true;

        await connection.query(
          `UPDATE pending_tbl p
           JOIN unit_approved_tbl a ON a.pending_id = p.pending_id
           SET p.unit_title = ?, p.sec_id = ?, p.unit_lesson_card_json = ?,
               p.unit_quiz_json = ?, p.unit_assessment_json = ?
           WHERE a.unit_id = ?`,
          [
            unitTitle,
            sectionIdNumber,
            lessonCardJson,
            quizJson,
            assessmentJson,
            pendingId,
          ],
        );
      }
    }

    if (pendingUpdate.affectedRows === 0 && !unitTblUpdated) {
      await connection.rollback();
      return { error: "Pending unit was not found." };
    }

    await connection.commit();
    revalidateQuizPaths();
    return { success: true, message: "Unit updated successfully." };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to update unit:", error);
    return { error: "An error occurred while updating the pending unit." };
  } finally {
    connection.release();
  }
}

export async function updateUnit(unitId: number, formData: FormData) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  return updatePendingUnitFromForm(unitId, formData);
}

export async function deletePendingQuiz(pendingId: number) {
  if (!(await requireAdmin())) {
    return { error: "Unauthorized" };
  }
  if (!pendingId) return { error: "Pending quiz ID is required." };

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [approvedRows] = await connection.query<RowDataPacket[]>(
      "SELECT unit_id FROM unit_approved_tbl WHERE pending_id = ?",
      [pendingId],
    );
    await connection.query(
      "DELETE FROM unit_approved_tbl WHERE pending_id = ?",
      [pendingId],
    );
    for (const row of approvedRows) {
      if (row.unit_id) {
        await connection.query("DELETE FROM unit_tbl WHERE unit_id = ?", [
          row.unit_id,
        ]);
      }
    }
    const [result] = await connection.query<ResultSetHeader>(
      "DELETE FROM pending_tbl WHERE pending_id = ?",
      [pendingId],
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return { error: "Pending quiz was not found." };
    }
    await connection.commit();
    revalidateQuizPaths();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to delete pending quiz:", error);
    return { error: "An error occurred while deleting the pending quiz." };
  } finally {
    connection.release();
  }
}
