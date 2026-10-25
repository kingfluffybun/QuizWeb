"use server";

import { revalidatePath, updateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireAdmin, requireStaff } from "@/lib/rbac";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
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

function createSafeCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  parts: string[],
  options?: { tags?: string[]; revalidate?: number | false }
): T {
  try {
    const cached = unstable_cache(fn, parts, options);
    return (async (...args: Parameters<T>) => {
      try {
        return await cached(...args);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message || "";
        if (msg.includes("incrementalCache missing")) {
          return await fn(...args);
        }
        throw err;
      }
    }) as T;
  } catch {
    return fn;
  }
}

function revalidateQuizPaths() {
  try {
    revalidatePath("/learn");
    revalidatePath("/quiz");
    revalidatePath("/quiz-cp");
    revalidatePath("/admin");
    revalidatePath("/maintainer");
    revalidatePath("/input");
    revalidatePath("/pending");
    updateTag("curriculum");
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
  cat_id?: number;
  sec_title?: string;
  difficulty_id?: number;
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
  quiz_payload: any;
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

async function fetchQuizMetadataInternal() {
  try {
    const [[categories], [sections], [difficulties], [types]] = await Promise.all([
      db.query<RowDataPacket[]>("SELECT * FROM cat_tbl ORDER BY cat_name"),
      db.query<RowDataPacket[]>("SELECT * FROM sec_tbl ORDER BY sec_id"),
      db.query<RowDataPacket[]>("SELECT * FROM difficulty_tbl ORDER BY difficulty_id"),
      db.query<RowDataPacket[]>("SELECT * FROM quiz_type_tbl ORDER BY quiz_type_id"),
    ]);

    const mappedSections: Section[] = (sections as RowDataPacket[]).map((s) => ({
      sec_id: Number(s.sec_id),
      sec_num: String(s.sec_num),
      cat_id: s.cat_id != null ? Number(s.cat_id) : undefined,
      sec_title: s.sec_title != null ? String(s.sec_title) : undefined,
      difficulty_id: s.difficulty_id != null ? Number(s.difficulty_id) : undefined,
    }));

    return {
      categories: categories as Category[],
      difficulties: difficulties as Difficulty[],
      types: types as QuizType[],
      sections: mappedSections,
    };
  } catch (error) {
    console.error("Failed to fetch quiz metadata:", error);
    return { categories: [], difficulties: [], types: [], sections: [] };
  }
}

export const getQuizMetadata = createSafeCache(
  fetchQuizMetadataInternal,
  ["quiz-metadata"],
  { tags: ["curriculum", "metadata"], revalidate: 3600 }
);

async function populateQuizPayloads(quizzes: QuizRow[]): Promise<QuizRow[]> {
  if (!Array.isArray(quizzes) || quizzes.length === 0) return [];

  const mcqIds: number[] = [];
  const fitbIds: number[] = [];
  const orderIds: number[] = [];
  const pairIds: number[] = [];
  const cpIds: number[] = [];

  for (const q of quizzes) {
    const type = String(q.type_name ?? "").toUpperCase();
    const typeId = Number(q.quiz_type_id);
    if (type === "MCQ" || typeId === 1) mcqIds.push(q.quiz_id);
    else if (type === "FITB" || typeId === 2) fitbIds.push(q.quiz_id);
    else if (type === "ORDER" || typeId === 3) orderIds.push(q.quiz_id);
    else if (type === "PAIR" || typeId === 4) pairIds.push(q.quiz_id);
    else if (type === "CP" || typeId === 5) cpIds.push(q.quiz_id);
  }

  const mcqMap = new Map<number, { options: string[]; correct_index: number }>();
  if (mcqIds.length > 0) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT quiz_id, option_index, option_text, is_correct
       FROM quiz_mcq_option_tbl
       WHERE quiz_id IN (?)
       ORDER BY quiz_id, option_index ASC`,
      [mcqIds],
    );
    for (const r of rows) {
      const qId = Number(r.quiz_id);
      if (!mcqMap.has(qId)) {
        mcqMap.set(qId, { options: [], correct_index: 0 });
      }
      const entry = mcqMap.get(qId)!;
      entry.options.push(String(r.option_text ?? ""));
      if (Boolean(r.is_correct)) {
        entry.correct_index = entry.options.length - 1;
      }
    }
  }

  const fitbMap = new Map<number, { answer: string }>();
  if (fitbIds.length > 0) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT quiz_id, correct_answer
       FROM quiz_fitb_tbl
       WHERE quiz_id IN (?)`,
      [fitbIds],
    );
    for (const r of rows) {
      fitbMap.set(Number(r.quiz_id), { answer: String(r.correct_answer ?? "") });
    }
  }

  const orderMap = new Map<number, { items: string[] }>();
  if (orderIds.length > 0) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT quiz_id, canonical_order, item_text
       FROM quiz_order_item_tbl
       WHERE quiz_id IN (?)
       ORDER BY quiz_id, canonical_order ASC`,
      [orderIds],
    );
    for (const r of rows) {
      const qId = Number(r.quiz_id);
      if (!orderMap.has(qId)) {
        orderMap.set(qId, { items: [] });
      }
      orderMap.get(qId)!.items.push(String(r.item_text ?? ""));
    }
  }

  const pairMap = new Map<number, { pairs: { left: string; right: string }[] }>();
  if (pairIds.length > 0) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT quiz_id, pair_order, left_text, right_text
       FROM quiz_pair_tbl
       WHERE quiz_id IN (?)
       ORDER BY quiz_id, pair_order ASC, pair_id ASC`,
      [pairIds],
    );
    for (const r of rows) {
      const qId = Number(r.quiz_id);
      if (!pairMap.has(qId)) {
        pairMap.set(qId, { pairs: [] });
      }
      pairMap.get(qId)!.pairs.push({
        left: String(r.left_text ?? ""),
        right: String(r.right_text ?? ""),
      });
    }
  }

  const cpMap = new Map<number, any>();
  if (cpIds.length > 0) {
    const [cpRows] = await db.query<RowDataPacket[]>(
      `SELECT quiz_id, title FROM quiz_cp_tbl WHERE quiz_id IN (?)`,
      [cpIds],
    );
    const [stepRows] = await db.query<RowDataPacket[]>(
      `SELECT quiz_id, step_order, prompt, template_code, expected_code
       FROM quiz_cp_step_tbl
       WHERE quiz_id IN (?)
       ORDER BY quiz_id, step_order ASC`,
      [cpIds],
    );
    const stepsByQuiz = new Map<number, any[]>();
    for (const s of stepRows) {
      const qId = Number(s.quiz_id);
      if (!stepsByQuiz.has(qId)) stepsByQuiz.set(qId, []);
      stepsByQuiz.get(qId)!.push({
        prompt: s.prompt,
        template: s.template_code ?? "",
        expected: s.expected_code,
      });
    }
    for (const c of cpRows) {
      const qId = Number(c.quiz_id);
      const steps = stepsByQuiz.get(qId) ?? [];
      cpMap.set(qId, {
        title: c.title,
        steps,
        prompts: steps.map((s: any) => s.prompt),
        prompt: steps[0]?.prompt ?? "",
        template: steps[0]?.template ?? "",
        expected: steps[0]?.expected ?? "",
      });
    }
  }

  for (const q of quizzes) {
    if (q.quiz_payload && typeof q.quiz_payload === "object" && Object.keys(q.quiz_payload).length > 0) {
      continue;
    }
    const type = String(q.type_name ?? "").toUpperCase();
    const typeId = Number(q.quiz_type_id);
    if (type === "MCQ" || typeId === 1) {
      q.quiz_payload = mcqMap.get(q.quiz_id) ?? { options: [], correct_index: 0 };
    } else if (type === "FITB" || typeId === 2) {
      q.quiz_payload = fitbMap.get(q.quiz_id) ?? { answer: "" };
    } else if (type === "ORDER" || typeId === 3) {
      q.quiz_payload = orderMap.get(q.quiz_id) ?? { items: [] };
    } else if (type === "PAIR" || typeId === 4) {
      q.quiz_payload = pairMap.get(q.quiz_id) ?? { pairs: [] };
    } else if (type === "CP" || typeId === 5) {
      q.quiz_payload = cpMap.get(q.quiz_id) ?? { steps: [] };
    } else {
      q.quiz_payload = {};
    }
  }

  return quizzes;
}

async function insertSlidesForUnit(
  connection: PoolConnection,
  unitId: number,
  lessonSlides: any[],
) {
  for (let i = 0; i < lessonSlides.length; i++) {
    const s = lessonSlides[i];
    await connection.query(
      `INSERT INTO lesson_slide_tbl (unit_id, slide_order, slide_title, slide_text, slide_code)
       VALUES (?, ?, ?, ?, ?)`,
      [
        unitId,
        i + 1,
        String(s.lesson_title ?? s.slide_title ?? s.title ?? ""),
        String(s.lesson_text ?? s.slide_text ?? s.text ?? ""),
        s.lesson_code ?? s.slide_code ?? s.code ?? null,
      ],
    );
  }
}

async function insertQuizzesForUnit(
  connection: PoolConnection,
  unitId: number,
  quizzes: any[],
) {
  const [typeRows] = await connection.query<RowDataPacket[]>("SELECT quiz_type_id, type_name FROM quiz_type_tbl");
  const typeIdByName = new Map<string, number>(typeRows.map((t) => [String(t.type_name).toUpperCase(), Number(t.quiz_type_id)]));
  const [diffRows] = await connection.query<RowDataPacket[]>("SELECT difficulty_id, difficulty_name FROM difficulty_tbl");
  const diffIdByName = new Map<string, number>(diffRows.map((d) => [String(d.difficulty_name).toLowerCase(), Number(d.difficulty_id)]));

  for (let i = 0; i < quizzes.length; i++) {
    const q = quizzes[i];
    if (!q || typeof q !== "object") continue;

    let quizTypeId = Number(q.quiz_type_id);
    if (!quizTypeId || isNaN(quizTypeId)) {
      const typeStr = String(q.type_name ?? q.type ?? "").toUpperCase();
      quizTypeId = typeIdByName.get(typeStr) ?? 1;
    }

    let difficultyId = Number(q.difficulty_id);
    if (!difficultyId || isNaN(difficultyId)) {
      const diffStr = String(q.difficulty_name ?? q.difficulty ?? "beginner").toLowerCase();
      difficultyId = diffIdByName.get(diffStr) ?? 1;
    }

    const questionText = String(q.question_text ?? "").trim() || "Quiz Question";
    const quizOrder = Number(q.quiz_order ?? (i + 1));

    const [qResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO quiz_tbl (unit_id, difficulty_id, quiz_type_id, quiz_order, question_text)
       VALUES (?, ?, ?, ?, ?)`,
      [unitId, difficultyId, quizTypeId, quizOrder, questionText],
    );
    const quizId = qResult.insertId;

    const payload = q.quiz_payload ?? {};
    if (quizTypeId === 1) {
      const options = Array.isArray(payload.options) ? payload.options : [];
      const correctIdx = Number(payload.correct_index ?? 0);
      for (let optIdx = 0; optIdx < options.length; optIdx++) {
        await connection.query(
          `INSERT INTO quiz_mcq_option_tbl (quiz_id, option_index, option_text, is_correct)
           VALUES (?, ?, ?, ?)`,
          [quizId, optIdx, String(options[optIdx]), optIdx === correctIdx ? 1 : 0],
        );
      }
    } else if (quizTypeId === 2) {
      const answer = String(payload.answer ?? payload.correct_answer ?? "");
      await connection.query(
        `INSERT INTO quiz_fitb_tbl (quiz_id, correct_answer) VALUES (?, ?)`,
        [quizId, answer],
      );
    } else if (quizTypeId === 3) {
      const items = Array.isArray(payload.items) ? payload.items : [];
      for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
        await connection.query(
          `INSERT INTO quiz_order_item_tbl (quiz_id, canonical_order, item_text)
           VALUES (?, ?, ?)`,
          [quizId, itemIdx + 1, String(items[itemIdx])],
        );
      }
    } else if (quizTypeId === 4) {
      const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
      for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
        const p = pairs[pairIdx];
        await connection.query(
          `INSERT INTO quiz_pair_tbl (quiz_id, pair_order, left_text, right_text)
           VALUES (?, ?, ?, ?)`,
          [quizId, pairIdx + 1, String(p?.left ?? ""), String(p?.right ?? "")],
        );
      }
    } else if (quizTypeId === 5) {
      await connection.query(
        `INSERT INTO quiz_cp_tbl (quiz_id, title) VALUES (?, ?)`,
        [quizId, String(payload.title ?? questionText)],
      );
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      for (let sIdx = 0; sIdx < steps.length; sIdx++) {
        const s = steps[sIdx];
        await connection.query(
          `INSERT INTO quiz_cp_step_tbl (quiz_id, step_order, prompt, template_code, expected_code)
           VALUES (?, ?, ?, ?, ?)`,
          [quizId, sIdx + 1, String(s?.prompt ?? ""), String(s?.template ?? ""), String(s?.expected ?? "")],
        );
      }
    }
  }
}

async function insertAssessmentForUnit(
  connection: PoolConnection,
  unitId: number,
  assessmentCandidate: any,
  unitTitle: string,
) {
  if (!assessmentCandidate) return;
  const unwrapped = unwrapCodeProblemAssessment(assessmentCandidate, unitTitle);
  if (!unwrapped || unwrapped.steps.length === 0) return;

  const [aResult] = await connection.query<ResultSetHeader>(
    `INSERT INTO unit_assessment_tbl (unit_id, title, description, expected_outcome)
     VALUES (?, ?, ?, ?)`,
    [
      unitId,
      unwrapped.title || unitTitle,
      unwrapped.description || "",
      unwrapped.expected_outcome || "",
    ],
  );
  const assessmentId = aResult.insertId;

  for (const step of unwrapped.steps) {
    await connection.query(
      `INSERT INTO assessment_step_tbl (
         assessment_id, step_number, instruction, inherit_previous_code,
         starter_html, starter_css, starter_js,
         expected_html, expected_css, expected_js
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assessmentId,
        step.stepNumber,
        step.instruction,
        step.inheritPreviousCode ? 1 : 0,
        step.starterCode?.html || null,
        step.starterCode?.css || null,
        step.starterCode?.js || null,
        step.expectedTemplate?.html || null,
        step.expectedTemplate?.css || null,
        step.expectedTemplate?.js || null,
      ],
    );
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

  let authorId = staff.id ? Number(staff.id) : null;
  if (!authorId) {
    try {
      const session = await auth();
      if (session?.user?.id) authorId = Number(session.user.id);
    } catch {
      // safe fallback outside request scope
    }
  }

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

    const [unitResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO unit_tbl (unit_title, sec_id, author_id, lesson_format, status)
       VALUES (?, ?, ?, 'slides', 'pending')`,
      [lessonTitle, sectionIdNumber, authorId],
    );
    const newUnitId = unitResult.insertId;

    await insertSlidesForUnit(connection, newUnitId, lessonSlides);
    await insertQuizzesForUnit(connection, newUnitId, parsedQuizJson);
    await insertAssessmentForUnit(
      connection,
      newUnitId,
      imported.data ? imported.data.unit_assessment_json : builtAssessment.document,
      lessonTitle,
    );

    await connection.commit();
    revalidateQuizPaths();

    return {
      success: true,
      pending: true,
      pendingId: newUnitId,
      unitId: newUnitId,
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
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, s.sec_num, u.status
       FROM unit_tbl u
       LEFT JOIN sec_tbl s ON s.sec_id = u.sec_id
       ORDER BY u.unit_id DESC`,
    );

    const unitIds = rows.map((r) => Number(r.unit_id));
    if (unitIds.length === 0) return [];

    const [slides] = await db.query<RowDataPacket[]>(
      `SELECT unit_id, slide_order, slide_title, slide_text, slide_code
       FROM lesson_slide_tbl
       WHERE unit_id IN (?)
       ORDER BY unit_id, slide_order ASC`,
      [unitIds],
    );
    const slidesByUnit = new Map<number, any[]>();
    for (const s of slides) {
      const uId = Number(s.unit_id);
      if (!slidesByUnit.has(uId)) slidesByUnit.set(uId, []);
      slidesByUnit.get(uId)!.push({
        lesson_title: s.slide_title,
        lesson_text: s.slide_text,
        lesson_code: s.slide_code ?? "",
      });
    }

    const [quizzes] = await db.query<RowDataPacket[]>(
      `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
              d.difficulty_name, t.type_name,
              u.sec_id, s.sec_num, s.cat_id, c.cat_name
       FROM quiz_tbl q
       JOIN unit_tbl u ON q.unit_id = u.unit_id
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
       JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
       WHERE q.unit_id IN (?)
       ORDER BY q.unit_id, q.quiz_order ASC, q.quiz_id ASC`,
      [unitIds],
    );
    const populatedQuizzes = await populateQuizPayloads(quizzes as QuizRow[]);
    const quizzesByUnit = new Map<number, any[]>();
    for (const q of populatedQuizzes) {
      const uId = Number(q.unit_id);
      if (!quizzesByUnit.has(uId)) quizzesByUnit.set(uId, []);
      quizzesByUnit.get(uId)!.push(q);
    }

    const [assessments] = await db.query<RowDataPacket[]>(
      `SELECT assessment_id, unit_id, title, description, expected_outcome
       FROM unit_assessment_tbl
       WHERE unit_id IN (?)`,
      [unitIds],
    );
    const assessmentIds = assessments.map((a) => Number(a.assessment_id));
    const stepsByAssessment = new Map<number, any[]>();
    if (assessmentIds.length > 0) {
      const [steps] = await db.query<RowDataPacket[]>(
        `SELECT assessment_id, step_number, instruction, inherit_previous_code,
                starter_html, starter_css, starter_js,
                expected_html, expected_css, expected_js
         FROM assessment_step_tbl
         WHERE assessment_id IN (?)
         ORDER BY assessment_id, step_number ASC`,
        [assessmentIds],
      );
      for (const st of steps) {
        const aId = Number(st.assessment_id);
        if (!stepsByAssessment.has(aId)) stepsByAssessment.set(aId, []);
        stepsByAssessment.get(aId)!.push(st);
      }
    }
    const assessmentByUnit = new Map<number, any>();
    for (const a of assessments) {
      const uId = Number(a.unit_id);
      const stList = stepsByAssessment.get(Number(a.assessment_id)) ?? [];
      assessmentByUnit.set(uId, {
        schemaVersion: 2,
        title: a.title,
        description: a.description,
        expected_outcome: a.expected_outcome,
        steps: stList.map((s) => s.instruction),
        cp_steps: stList.map((s) => ({
          stepNumber: Number(s.step_number),
          instruction: s.instruction,
          inheritPreviousCode: Boolean(s.inherit_previous_code),
          starterCode: {
            html: s.starter_html ?? "",
            css: s.starter_css ?? "",
            js: s.starter_js ?? "",
          },
          expectedTemplate: {
            html: s.expected_html ?? "",
            css: s.expected_css ?? "",
            js: s.expected_js ?? "",
          },
        })),
        assessment: stList.map((s) => s.instruction).join("\n\n"),
      });
    }

    return rows.map((row) => {
      const uId = Number(row.unit_id);
      const unitSlides = slidesByUnit.get(uId) ?? [];
      const unitQuizList = quizzesByUnit.get(uId) ?? [];
      const unitAssessment = assessmentByUnit.get(uId) ?? null;

      return {
        unit_id: uId,
        unit_title: row.unit_title,
        sec_id: row.sec_id,
        sec_num: row.sec_num,
        unit_lesson_card_json: { lesson_slide: unitSlides },
        quiz_json: unitQuizList,
        assessment_json: unitAssessment,
      };
    });
  } catch (error) {
    console.error("Failed to fetch units:", error);
    return [];
  }
}

export interface AvailableUnit {
  pending_id: number;
  unit_id: number;
  unit_title: string;
  category_name?: string;
  sec_id?: number;
  sec_num?: string;
  unit_number?: number | string | null;
  quiz_count: number;
  has_coding_assessment?: boolean;
  sec_title?: string;
  difficulty_name?: string;
  unit_order?: number;
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
      `SELECT u.unit_id, u.unit_title, ua.assessment_id, ua.title, ua.description
       FROM unit_tbl u
       JOIN unit_assessment_tbl ua ON u.unit_id = ua.unit_id
       WHERE u.status = 'approved' ${unitFilter}
       ORDER BY u.unit_id DESC`,
      params,
    );

    const problems: CodeProblem[] = [];
    for (const row of rows) {
      const [steps] = await db.query<RowDataPacket[]>(
        `SELECT step_number, instruction, inherit_previous_code,
                starter_html, starter_css, starter_js,
                expected_html, expected_css, expected_js
         FROM assessment_step_tbl
         WHERE assessment_id = ?
         ORDER BY step_number ASC`,
        [row.assessment_id],
      );
      if (!steps || steps.length === 0) continue;

      const instructions = steps.map((s) => String(s.instruction ?? ""));
      const codeSteps: CodeProblemStep[] = steps.map((s) => ({
        prompt: String(s.instruction ?? ""),
        template: String(s.starter_html || s.starter_css || s.starter_js || ""),
        expected: String(s.expected_html || s.expected_css || s.expected_js || ""),
      }));

      problems.push({
        unit_id: Number(row.unit_id),
        unit_title: String(row.unit_title),
        question_text: String(row.title ?? row.description ?? row.unit_title),
        instructions,
        steps: codeSteps,
      });
    }

    // Also support CP quizzes in quiz_cp_tbl / quiz_cp_step_tbl
    const [cpQuizRows] = await db.query<RowDataPacket[]>(
      `SELECT q.quiz_id, q.unit_id, q.question_text, cp.title, u.unit_title
       FROM quiz_tbl q
       JOIN unit_tbl u ON q.unit_id = u.unit_id
       JOIN quiz_cp_tbl cp ON q.quiz_id = cp.quiz_id
       WHERE u.status = 'approved' ${unitFilter ? "AND u.unit_id = ?" : ""}
       ORDER BY q.quiz_id DESC`,
      params,
    );

    for (const cpRow of cpQuizRows) {
      const [cpSteps] = await db.query<RowDataPacket[]>(
        `SELECT step_order, prompt, template_code, expected_code
         FROM quiz_cp_step_tbl
         WHERE quiz_id = ?
         ORDER BY step_order ASC`,
        [cpRow.quiz_id],
      );
      if (!cpSteps || cpSteps.length === 0) continue;

      const instructions = cpSteps.map((s) => String(s.prompt ?? ""));
      const codeSteps: CodeProblemStep[] = cpSteps.map((s) => ({
        prompt: String(s.prompt ?? ""),
        template: String(s.template_code ?? ""),
        expected: String(s.expected_code ?? ""),
      }));

      problems.push({
        unit_id: Number(cpRow.unit_id),
        quiz_id: Number(cpRow.quiz_id),
        unit_title: String(cpRow.unit_title),
        question_text: String(cpRow.title ?? cpRow.question_text ?? cpRow.unit_title),
        instructions,
        steps: codeSteps,
      });
    }

    return problems;
  } catch (error) {
    console.error("Failed to fetch code problems:", error);
    return [];
  }
}

async function fetchAvailableUnitsInternal(): Promise<AvailableUnit[]> {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT 
        u.unit_id,
        u.unit_id AS pending_id,
        u.unit_title,
        u.unit_order,
        u.sec_id,
        s.sec_num,
        s.sec_title,
        d.difficulty_name,
        c.cat_name AS category_name,
        (SELECT COUNT(*) FROM quiz_tbl q WHERE q.unit_id = u.unit_id) AS quiz_count,
        EXISTS(SELECT 1 FROM unit_assessment_tbl ua WHERE ua.unit_id = u.unit_id) AS has_coding_assessment
      FROM unit_tbl u
      JOIN sec_tbl s ON u.sec_id = s.sec_id
      JOIN cat_tbl c ON s.cat_id = c.cat_id
      LEFT JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
      WHERE u.status = 'approved'
      ORDER BY u.unit_id ASC`,
    );

    return rows.map((row) => ({
      pending_id: Number(row.pending_id),
      unit_id: Number(row.unit_id),
      unit_title: String(row.unit_title),
      category_name: row.category_name != null ? String(row.category_name) : undefined,
      sec_id: row.sec_id != null ? Number(row.sec_id) : undefined,
      sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
      sec_title: row.sec_title != null ? String(row.sec_title) : undefined,
      difficulty_name: row.difficulty_name != null ? String(row.difficulty_name) : undefined,
      unit_order: row.unit_order != null ? Number(row.unit_order) : undefined,
      unit_number: row.sec_num != null ? Number(row.sec_num) : null,
      quiz_count: Number(row.quiz_count ?? 0),
      has_coding_assessment: Boolean(row.has_coding_assessment),
    }));
  } catch (error) {
    console.error("Failed to fetch available units:", error);
    return [];
  }
}

export const getAvailableUnits = createSafeCache(
  fetchAvailableUnitsInternal,
  ["available-units"],
  { tags: ["curriculum"], revalidate: 3600 }
);

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

  try {
    const [result] = await db.query<ResultSetHeader>(
      "DELETE FROM unit_tbl WHERE unit_id = ?",
      [unitId],
    );

    if (result.affectedRows === 0) {
      return { error: "Unit was not found." };
    }
    revalidateQuizPaths();
    return { success: true };
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return { error: "An error occurred while deleting the unit." };
  }
}

export async function getQuizMetrics(): Promise<QuizMetricsData> {
  try {
    const [totalRows] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM quiz_tbl",
    );
    const totalQuizzes = Number(totalRows[0]?.total ?? 0);

    // 2. Breakdown by Category
    const [catRows] = await db.query<RowDataPacket[]>(`
      SELECT c.cat_id, c.cat_name, COUNT(q.quiz_id) AS count
      FROM cat_tbl c
      LEFT JOIN sec_tbl s ON c.cat_id = s.cat_id
      LEFT JOIN unit_tbl u ON s.sec_id = u.sec_id
      LEFT JOIN quiz_tbl q ON u.unit_id = q.unit_id
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
        LEFT JOIN unit_tbl u ON s.sec_id = u.sec_id
        LEFT JOIN quiz_tbl q ON u.unit_id = q.unit_id
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
        LEFT JOIN sec_tbl s ON c.cat_id = s.cat_id
        LEFT JOIN unit_tbl u ON s.sec_id = u.sec_id
        LEFT JOIN quiz_tbl q ON u.unit_id = q.unit_id AND d.difficulty_id = q.difficulty_id
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
        JOIN unit_tbl u ON q.unit_id = u.unit_id
        JOIN sec_tbl s ON u.sec_id = s.sec_id
        JOIN cat_tbl c ON s.cat_id = c.cat_id
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
    const safePageSize = Math.max(1, Math.floor(pageSize));
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filters.id?.trim()) {
      where.push("CAST(q.quiz_id AS CHAR) LIKE ?");
      params.push(`%${filters.id.replace(/^[#\s]+/, "").trim()}%`);
    }
    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      where.push("(q.question_text LIKE ? OR u.unit_title LIKE ?)");
      params.push(search, search);
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
      JOIN unit_tbl u ON q.unit_id = u.unit_id
      JOIN sec_tbl s ON u.sec_id = s.sec_id
      JOIN cat_tbl c ON s.cat_id = c.cat_id
      JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
      JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
    `;
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${joins} ${whereClause}`,
      params,
    );
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
    const offset = (currentPage - 1) * safePageSize;

    const [quizzes] = await db.query<QuizRow[]>(
      `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order,
              q.question_text, c.cat_id, c.cat_name, d.difficulty_name, t.type_name,
              s.sec_id, s.sec_num
       ${joins}
       ${whereClause}
       ORDER BY q.quiz_id DESC
       LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset],
    );

    const populatedQuizzes = await populateQuizPayloads(quizzes);

    return {
      quizzes: populatedQuizzes.map((q) => ({
        ...q,
        sec_num: q.sec_num ?? undefined,
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

export interface RecentUnitItem {
  unit_id: number;
  unit_title: string;
  sec_id: number;
  sec_num?: string | number;
  cat_id: number;
  cat_name: string;
  author_id: number | null;
  author_name: string;
  status: "pending" | "approved" | "rejected";
  pending_note: string | null;
  slide_count: number;
  question_count: number;
  created_at?: string;
  updated_at?: string;
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
): Promise<{
  units: RecentUnitItem[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}> {
  try {
    const numericPageSize = Number(pageSize);
    const safePageSize =
      Number.isFinite(numericPageSize) && numericPageSize > 0
        ? Math.floor(numericPageSize)
        : 20;
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (filters.id?.trim()) {
      where.push("CAST(u.unit_id AS CHAR) LIKE ?");
      params.push(`%${filters.id.replace(/^[#\s]+/, "").trim()}%`);
    }
    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      where.push("(u.unit_title LIKE ? OR p.username LIKE ? OR ua.email LIKE ?)");
      params.push(search, search, search);
    }
    if (filters.category) {
      where.push("c.cat_name = ?");
      params.push(filters.category);
    }
    if (filters.section) {
      where.push("s.sec_num = ?");
      params.push(filters.section);
    }
    if (filters.status) {
      where.push("u.status = ?");
      params.push(filters.status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const joins = `
      FROM unit_tbl u
      LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id
      LEFT JOIN cat_tbl c ON s.cat_id = c.cat_id
      LEFT JOIN player_tbl p ON u.author_id = p.user_id
      LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
    `;

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${joins} ${whereClause}`,
      params,
    );
    const totalCount = Number(countRows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const numericPage = Number(page);
    const requestedPage =
      Number.isFinite(numericPage) && numericPage > 0
        ? Math.floor(numericPage)
        : 1;
    const currentPage = Math.min(requestedPage, totalPages);
    const offset = (currentPage - 1) * safePageSize;

    const [units] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, u.author_id, u.status, u.pending_note,
              u.created_at, u.updated_at,
              s.sec_num, c.cat_id, COALESCE(c.cat_name, 'General') AS cat_name,
              COALESCE(p.username, ua.email, 'Administrator') AS author_name,
              COALESCE(sc.slide_count, 0) AS slide_count,
              COALESCE(qc.quiz_count, 0) AS question_count
       ${joins}
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS slide_count FROM lesson_slide_tbl GROUP BY unit_id
       ) sc ON u.unit_id = sc.unit_id
       LEFT JOIN (
         SELECT unit_id, COUNT(*) AS quiz_count FROM quiz_tbl GROUP BY unit_id
       ) qc ON u.unit_id = qc.unit_id
       ${whereClause}
       ORDER BY u.unit_id DESC
       LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset],
    );

    return {
      units: units.map((u) => ({
        unit_id: Number(u.unit_id),
        unit_title: String(u.unit_title),
        sec_id: Number(u.sec_id),
        sec_num: u.sec_num != null ? Number(u.sec_num) : undefined,
        cat_id: Number(u.cat_id),
        cat_name: String(u.cat_name),
        author_id: u.author_id != null ? Number(u.author_id) : null,
        author_name: String(u.author_name),
        status: (u.status as "pending" | "approved" | "rejected") || "approved",
        pending_note: u.pending_note != null ? String(u.pending_note) : null,
        slide_count: Number(u.slide_count),
        question_count: Number(u.question_count),
        created_at: u.created_at ? new Date(u.created_at).toISOString() : undefined,
        updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : undefined,
      })),
      currentPage,
      totalPages,
      totalCount,
    };
  } catch (error) {
    console.error("Failed to fetch recent units:", error);
    return { units: [], currentPage: 1, totalPages: 1, totalCount: 0 };
  }
}

export async function getRecentUnits() {
  const result = await getPaginatedRecentUnits(1, 20);
  return result.units;
}

async function fetchUnitByIdInternal(unitId: number) {
  if (!Number.isInteger(unitId) || unitId < 1) return null;

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, u.author_id, u.status, u.pending_note,
              s.sec_num, c.cat_id, c.cat_name,
              COALESCE(p.username, ua.email, 'Administrator') AS pending_name
       FROM unit_tbl u
       LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id
       LEFT JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN player_tbl p ON u.author_id = p.user_id
       LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
       WHERE u.unit_id = ?
       LIMIT 1`,
      [unitId],
    );
    const unit = rows[0];
    if (!unit) return null;

    const [slides] = await db.query<RowDataPacket[]>(
      `SELECT slide_id, slide_order, slide_title, slide_text, slide_code
       FROM lesson_slide_tbl
       WHERE unit_id = ?
       ORDER BY slide_order ASC`,
      [unitId],
    );

    const lessonCard = {
      lesson_title: unit.unit_title,
      lesson_slide: slides.map((s) => ({
        lesson_title: s.slide_title,
        lesson_text: s.slide_text,
        lesson_code: s.slide_code ?? "",
      })),
    };

    const [quizzes] = await db.query<QuizRow[]>(
      `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
              d.difficulty_name, t.type_name,
              u.sec_id, s.sec_num, s.cat_id, c.cat_name
       FROM quiz_tbl q
       JOIN unit_tbl u ON q.unit_id = u.unit_id
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
       JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
       WHERE q.unit_id = ?
       ORDER BY q.quiz_order ASC, q.quiz_id ASC`,
      [unitId],
    );

    const populatedQuizzes = await populateQuizPayloads(quizzes);

    const [assessments] = await db.query<RowDataPacket[]>(
      `SELECT assessment_id, unit_id, title, description, expected_outcome
       FROM unit_assessment_tbl
       WHERE unit_id = ?
       LIMIT 1`,
      [unitId],
    );

    let assessmentObj: any = null;
    if (assessments.length > 0) {
      const a = assessments[0];
      const [steps] = await db.query<RowDataPacket[]>(
        `SELECT step_number, instruction, inherit_previous_code,
                starter_html, starter_css, starter_js,
                expected_html, expected_css, expected_js
         FROM assessment_step_tbl
         WHERE assessment_id = ?
         ORDER BY step_number ASC`,
        [a.assessment_id],
      );
      assessmentObj = {
        schemaVersion: 2,
        title: a.title,
        description: a.description,
        expected_outcome: a.expected_outcome,
        steps: steps.map((s) => s.instruction),
        cp_steps: steps.map((s) => ({
          stepNumber: Number(s.step_number),
          instruction: s.instruction,
          inheritPreviousCode: Boolean(s.inherit_previous_code),
          starterCode: {
            html: s.starter_html ?? "",
            css: s.starter_css ?? "",
            js: s.starter_js ?? "",
          },
          expectedTemplate: {
            html: s.expected_html ?? "",
            css: s.expected_css ?? "",
            js: s.expected_js ?? "",
          },
        })),
        assessment: steps.map((s) => s.instruction).join("\n\n"),
      };
    }

    return {
      quiz_id: Number(unit.unit_id),
      unit_id: Number(unit.unit_id),
      cat_id: Number(unit.cat_id ?? 0),
      sec_id: Number(unit.sec_id ?? 1),
      difficulty_id: populatedQuizzes[0]?.difficulty_id ?? 0,
      quiz_type_id: populatedQuizzes[0]?.quiz_type_id ?? 0,
      question_text: String(unit.unit_title),
      cat_name: String(unit.cat_name ?? "Unit"),
      sec_num: unit.sec_num != null ? String(unit.sec_num) : undefined,
      difficulty_name: String(unit.status),
      type_name: "Unit",
      quiz_payload: {
        title: String(unit.unit_title),
        lesson_card: lessonCard,
        quizzes: populatedQuizzes,
        assessment: assessmentObj,
        unit_number: unit.sec_num ?? null,
        pending_name: unit.pending_name,
        pending_status: unit.status,
        pending_note: unit.pending_note,
      },
    };
  } catch (error) {
    console.error("Failed to fetch selected unit:", error);
    return null;
  }
}

export const getUnitById = createSafeCache(
  fetchUnitByIdInternal,
  ["unit-by-id"],
  { tags: ["curriculum"], revalidate: 3600 }
);

export async function getQuizOrUnitById(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  const unit = await getUnitById(id);
  if (unit) return unit;

  try {
    const [quizzes] = await db.query<QuizRow[]>(
      `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
              d.difficulty_name, t.type_name,
              u.sec_id, s.sec_num, s.cat_id, c.cat_name
       FROM quiz_tbl q
       JOIN unit_tbl u ON q.unit_id = u.unit_id
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
       JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
       WHERE q.quiz_id = ?
       LIMIT 1`,
      [id],
    );
    if (!quizzes.length) return null;
    const populated = await populateQuizPayloads(quizzes);
    const q = populated[0];
    return {
      ...q,
      sec_num: q.sec_num ?? undefined,
    };
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

    let authorId = staff.id ? Number(staff.id) : null;
    if (!authorId) {
      try {
        const session = await auth();
        if (session?.user?.id) authorId = Number(session.user.id);
      } catch {
        // safe fallback outside request scope
      }
    }
    const resolvedSecId = secId && String(secId).trim() !== "" ? Number(secId) : 1;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [unitResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO unit_tbl (unit_title, sec_id, author_id, lesson_format, status)
         VALUES (?, ?, ?, 'slides', 'pending')`,
        [questionText.toString().trim().slice(0, 50), resolvedSecId, authorId],
      );
      const newUnitId = unitResult.insertId;

      await insertQuizzesForUnit(connection, newUnitId, [
        {
          difficulty_id: Number(difficultyId),
          quiz_type_id: Number(quizTypeId),
          question_text: questionText.toString().trim(),
          quiz_payload: parsedPayload.payload,
        },
      ]);

      await connection.commit();
      revalidateQuizPaths();

      return {
        success: true,
        pending: true,
        pendingId: newUnitId,
        message: "Quiz submitted for review.",
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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
  try {
    const [result] = await db.query<ResultSetHeader>(
      "DELETE FROM quiz_tbl WHERE quiz_id = ?",
      [quizId],
    );
    revalidateQuizPaths();
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

  const catId = formData.get("cat_id");
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

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE quiz_tbl SET difficulty_id = ?, quiz_type_id = ?, question_text = ? WHERE quiz_id = ?`,
        [difficultyId, quizTypeId, questionText.toString().trim(), quizId],
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return { error: "Quiz question was not found." };
      }

      await connection.query("DELETE FROM quiz_mcq_option_tbl WHERE quiz_id = ?", [quizId]);
      await connection.query("DELETE FROM quiz_fitb_tbl WHERE quiz_id = ?", [quizId]);
      await connection.query("DELETE FROM quiz_order_item_tbl WHERE quiz_id = ?", [quizId]);
      await connection.query("DELETE FROM quiz_pair_tbl WHERE quiz_id = ?", [quizId]);
      await connection.query("DELETE FROM quiz_cp_step_tbl WHERE quiz_id = ?", [quizId]);
      await connection.query("DELETE FROM quiz_cp_tbl WHERE quiz_id = ?", [quizId]);

      const typeIdNum = Number(quizTypeId);
      const payload = parsedPayload.payload as any;
      if (typeIdNum === 1) {
        const options = Array.isArray(payload.options) ? payload.options : [];
        const correctIdx = Number(payload.correct_index ?? 0);
        for (let optIdx = 0; optIdx < options.length; optIdx++) {
          await connection.query(
            `INSERT INTO quiz_mcq_option_tbl (quiz_id, option_index, option_text, is_correct)
             VALUES (?, ?, ?, ?)`,
            [quizId, optIdx, String(options[optIdx]), optIdx === correctIdx ? 1 : 0],
          );
        }
      } else if (typeIdNum === 2) {
        await connection.query(
          `INSERT INTO quiz_fitb_tbl (quiz_id, correct_answer) VALUES (?, ?)`,
          [quizId, String(payload.answer ?? "")],
        );
      } else if (typeIdNum === 3) {
        const items = Array.isArray(payload.items) ? payload.items : [];
        for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
          await connection.query(
            `INSERT INTO quiz_order_item_tbl (quiz_id, canonical_order, item_text)
             VALUES (?, ?, ?)`,
            [quizId, itemIdx + 1, String(items[itemIdx])],
          );
        }
      } else if (typeIdNum === 4) {
        const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
        for (let pairIdx = 0; pairIdx < pairs.length; pairIdx++) {
          const p = pairs[pairIdx];
          await connection.query(
            `INSERT INTO quiz_pair_tbl (quiz_id, pair_order, left_text, right_text)
             VALUES (?, ?, ?, ?)`,
            [quizId, pairIdx + 1, String(p?.left ?? ""), String(p?.right ?? "")],
          );
        }
      } else if (typeIdNum === 5) {
        await connection.query(
          `INSERT INTO quiz_cp_tbl (quiz_id, title) VALUES (?, ?)`,
          [quizId, String(payload.title ?? questionText)],
        );
        const steps = Array.isArray(payload.steps) ? payload.steps : [];
        for (let sIdx = 0; sIdx < steps.length; sIdx++) {
          const s = steps[sIdx];
          await connection.query(
            `INSERT INTO quiz_cp_step_tbl (quiz_id, step_order, prompt, template_code, expected_code)
             VALUES (?, ?, ?, ?, ?)`,
            [quizId, sIdx + 1, String(s?.prompt ?? ""), String(s?.template ?? ""), String(s?.expected ?? "")],
          );
        }
      }

      await connection.commit();
      revalidateQuizPaths();
      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to update quiz:", error);
    return {
      error: "An error occurred while updating the quiz in the database.",
    };
  }
}

export async function getQuizzes(filters?: {
  cat_id?: number;
  sec_id?: number;
  difficulty_id?: number;
  status?: string;
}) {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.status) {
      if (filters.status !== "all") {
        conditions.push("u.status = ?");
        params.push(filters.status);
      }
    } else {
      // By default, regular quiz consumers only receive questions from approved units
      conditions.push("u.status = 'approved'");
    }

    if (filters?.cat_id) {
      conditions.push("s.cat_id = ?");
      params.push(filters.cat_id);
    }
    if (filters?.sec_id) {
      conditions.push("u.sec_id = ?");
      params.push(filters.sec_id);
    }
    if (filters?.difficulty_id) {
      conditions.push("q.difficulty_id = ?");
      params.push(filters.difficulty_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [quizzes] = await db.query<QuizRow[]>(
      `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
              c.cat_id, c.cat_name, d.difficulty_name, t.type_name,
              s.sec_id, s.sec_num
       FROM quiz_tbl q
       JOIN unit_tbl u ON q.unit_id = u.unit_id
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
       JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
       ${where}
       ORDER BY q.quiz_id DESC`,
      params,
    );

    const populated = await populateQuizPayloads(quizzes);
    return populated.map((quiz) => ({
      ...quiz,
      sec_num: quiz.sec_num ?? undefined,
    }));
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return [];
  }
}

export interface PendingUnit {
  pending_id: number;
  unit_id: number;
  unit_title: string;
  sec_id: number;
  unit_lesson_card_json: any;
  unit_quiz_json: any;
  unit_assessment_json?: any;
  pending_status: "pending" | "approved" | "rejected" | string;
  pending_name: string;
  pending_note?: string | null;
  sec_num?: string;
  question_text: string;
  cat_name: string;
  difficulty_name: string;
  type_name: string;
  quiz_payload: any;
}

export async function getPendingQuizzes(statusFilter = "pending"): Promise<PendingUnit[]> {
  try {
    const params: string[] = [];
    let whereClause = "";
    if (statusFilter !== "all") {
      whereClause = "WHERE u.status = ?";
      params.push(statusFilter);
    }

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id AS pending_id, u.unit_id, u.unit_title, u.sec_id, u.lesson_format,
              u.status AS pending_status, u.pending_note, s.sec_num,
              c.cat_id, c.cat_name,
              COALESCE(p.username, ua.email, 'Anonymous') AS pending_name
       FROM unit_tbl u
       LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id
       LEFT JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN player_tbl p ON u.author_id = p.user_id
       LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
       ${whereClause}
       ORDER BY u.unit_id DESC`,
      params,
    );

    const unitIds = rows.map((r) => Number(r.unit_id));
    const quizzesByUnit = new Map<number, QuizRow[]>();

    if (unitIds.length > 0) {
      const [quizzes] = await db.query<QuizRow[]>(
        `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
                d.difficulty_name, t.type_name,
                s.sec_id, s.sec_num, s.cat_id, c.cat_name
         FROM quiz_tbl q
         JOIN unit_tbl u ON q.unit_id = u.unit_id
         JOIN sec_tbl s ON u.sec_id = s.sec_id
         JOIN cat_tbl c ON s.cat_id = c.cat_id
         JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
         JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
         WHERE q.unit_id IN (?)
         ORDER BY q.unit_id, q.quiz_order ASC, q.quiz_id ASC`,
        [unitIds],
      );

      const populatedQuizzes = await populateQuizPayloads(quizzes);
      for (const q of populatedQuizzes) {
        const uId = Number(q.unit_id);
        if (!quizzesByUnit.has(uId)) quizzesByUnit.set(uId, []);
        quizzesByUnit.get(uId)!.push(q);
      }
    }

    return rows.map((row) => {
      const uId = Number(row.unit_id);
      const unitQuizzes = quizzesByUnit.get(uId) ?? [];
      const firstQuiz = unitQuizzes[0] ?? null;

      return {
        pending_id: uId,
        unit_id: uId,
        unit_title: String(row.unit_title ?? ""),
        sec_id: Number(row.sec_id ?? 0),
        pending_status: String(row.pending_status ?? "pending"),
        pending_name: String(row.pending_name ?? "Anonymous"),
        pending_note: row.pending_note != null ? String(row.pending_note) : null,
        unit_lesson_card_json: { lesson_card: { lesson_format: row.lesson_format ?? "slides" } },
        unit_quiz_json: unitQuizzes,
        unit_assessment_json: null,
        sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
        question_text: String(row.unit_title ?? ""),
        cat_name: String(row.cat_name ?? firstQuiz?.cat_name ?? ""),
        difficulty_name: String(firstQuiz?.difficulty_name ?? "Beginner"),
        type_name: String(firstQuiz?.type_name ?? "Unit"),
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
  const unit = await getUnitById(pendingId);
  if (!unit) {
    return { error: "The pending unit was not found." };
  }
  const payload = unit.quiz_payload as any;
  return {
    pending_id: unit.unit_id,
    unit_id: unit.unit_id,
    unit_title: unit.question_text,
    sec_id: unit.sec_id,
    sec_num: unit.sec_num,
    pending_status: unit.difficulty_name,
    pending_name: payload?.pending_name ?? "Administrator",
    pending_note: payload?.pending_note ?? null,
    unit_lesson_card_json: payload?.lesson_card,
    unit_quiz_json: payload?.quizzes ?? [],
    unit_assessment_json: payload?.assessment,
    question_text: unit.question_text,
    cat_name: unit.cat_name,
    difficulty_name: unit.difficulty_name,
    type_name: "Unit",
    quiz_payload: payload,
  };
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
    const [unitRows] = await connection.query<RowDataPacket[]>(
      "SELECT unit_id, status FROM unit_tbl WHERE unit_id = ? FOR UPDATE",
      [pendingId],
    );
    const unit = unitRows[0];
    if (!unit) {
      await connection.rollback();
      return { error: "Pending unit not found." };
    }

    if (unit.status !== "pending") {
      await connection.rollback();
      return { error: "This unit has already been reviewed." };
    }

    if (decision === "reject") {
      await connection.query(
        "UPDATE unit_tbl SET status = 'rejected', pending_note = ? WHERE unit_id = ?",
        [rejectionNotes.trim(), pendingId],
      );
      await connection.commit();
      revalidateQuizPaths();
      return {
        success: true,
        message: "Unit rejected and retained in the review history.",
      };
    }

    await connection.query(
      "UPDATE unit_tbl SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE unit_id = ?",
      [pendingId],
    );
    await connection.commit();
    revalidateQuizPaths();
    return {
      success: true,
      unitId: pendingId,
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
      "UPDATE unit_tbl SET unit_title = ? WHERE unit_id = ?",
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
      "UPDATE unit_tbl SET pending_note = ? WHERE unit_id = ? AND status = 'rejected'",
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

    const resolvedSecId = secId && String(secId).trim() !== "" ? Number(secId) : 1;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE unit_tbl SET unit_title = ?, sec_id = ? WHERE unit_id = ?",
        [questionText.toString().trim().slice(0, 255), resolvedSecId, pendingId],
      );
      await connection.query("DELETE FROM quiz_tbl WHERE unit_id = ?", [pendingId]);
      await insertQuizzesForUnit(connection, pendingId, [
        {
          difficulty_id: Number(difficultyId),
          quiz_type_id: Number(quizTypeId),
          question_text: questionText.toString().trim(),
          quiz_payload: parsedPayload.payload,
        },
      ]);
      await connection.commit();
      revalidateQuizPaths();
      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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

    const [unitUpdate] = await connection.query<ResultSetHeader>(
      `UPDATE unit_tbl
       SET unit_title = ?, sec_id = ?,
           status = CASE WHEN status = 'rejected' THEN 'pending' ELSE status END,
           pending_note = CASE WHEN status = 'rejected' THEN NULL ELSE pending_note END,
           updated_at = CURRENT_TIMESTAMP
       WHERE unit_id = ?`,
      [unitTitle, sectionIdNumber, pendingId],
    );

    if (unitUpdate.affectedRows === 0) {
      await connection.rollback();
      return { error: "Unit was not found." };
    }

    // Resync slides
    await connection.query("DELETE FROM lesson_slide_tbl WHERE unit_id = ?", [pendingId]);
    await insertSlidesForUnit(connection, pendingId, lessonSlides);

    // Resync quizzes (cascades to subtype tables)
    await connection.query("DELETE FROM quiz_tbl WHERE unit_id = ?", [pendingId]);
    await insertQuizzesForUnit(connection, pendingId, quizzes);

    // Resync assessment (cascades to step table)
    await connection.query("DELETE FROM unit_assessment_tbl WHERE unit_id = ?", [pendingId]);
    await insertAssessmentForUnit(
      connection,
      pendingId,
      imported.data ? imported.data.unit_assessment_json : builtAssessment.document,
      unitTitle,
    );

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
  return deleteUnit(pendingId);
}
