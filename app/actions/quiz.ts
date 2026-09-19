"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

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

export async function requireAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
    [userId],
  );
  return rows[0]?.user_role === "admin";
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

async function getSectionTableName() {
  const candidates = ["sec_tbl", "section_tbl", "sections_tbl"];

  for (const tableName of candidates) {
    try {
      await db.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
      return tableName;
    } catch {
      // try the next known section table name
    }
  }

  return null;
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
  const sectionId = formData.get("sec_id") ?? formData.get("unit_sec_id");
  if (!sectionId) {
    return { error: "A valid Section ID is required." };
  }

  const getText = (name: string) => String(formData.get(name) ?? "").trim();
  const lessonTitle = getText("unit_title");
  const lessonCard = getText("lesson_card");
  const lessonText = getText("lesson_text");
  const unitAssessment = getText("assessment");
  if (!lessonTitle || !lessonCard || !lessonText) {
    return {
      error: "Lesson title, lesson card, and lesson text are required.",
    };
  }

  const rawQuizJson = formData.get("quiz_json");
  const parsedQuizJson = (() => {
    if (typeof rawQuizJson !== "string" || !rawQuizJson.trim()) {
      return [];
    }
    try {
      const value = JSON.parse(rawQuizJson);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  })();

  if (parsedQuizJson.length === 0) {
    return { error: "At least one quiz is required before submitting the unit." };
  }

  const lessonDocument = JSON.stringify({
    lesson_card: {
      lesson_format: lessonCard,
      lesson_text: lessonText,
    },
  });
  const quizDocument = JSON.stringify(parsedQuizJson);
  const assessmentDocument = JSON.stringify({
    assessment: unitAssessment,
  });
  const session = await auth();
  const pendingName = (
    session?.user?.name ??
    session?.user?.email?.split("@")[0] ??
    "Contributor"
  ).slice(0, 50);

  try {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO pending_tbl
       (unit_title, sec_id, unit_lesson_card_json, unit_quiz_json,
        unit_assessment_json, pending_status, pending_note, pending_name)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        lessonTitle,
        sectionId,
        lessonDocument,
        quizDocument,
        assessmentDocument,
        "",
        pendingName,
      ],
    );

    return {
      success: true,
      pending: true,
      pendingId: result.insertId,
      message: "Unit submitted for review.",
    };
  } catch (error) {
    console.error("Failed to submit unit for review:", error);
    return { error: "An error occurred while submitting the unit for review." };
  }
}

export async function getUnits() {
  try {
    const [rows] = await db.query<UnitRow[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, s.sec_num,
              u.unit_lesson_card_json, u.quiz_json, u.assessment_json
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

function parseJsonColumn(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function deleteUnit(unitId: number) {
  if (!Number.isInteger(unitId) || unitId < 1) {
    return { error: "A valid Unit ID is required." };
  }

  try {
    const [result] = await db.query<ResultSetHeader>(
      "DELETE FROM unit_tbl WHERE unit_id = ?",
      [unitId],
    );
    return result.affectedRows === 0
      ? { error: "Unit was not found." }
      : { success: true };
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return { error: "An error occurred while deleting the unit." };
  }
}

export async function getQuizMetrics(): Promise<QuizMetricsData> {
  try {
    const quizTableAvailable = await tableExists("quiz_tbl");
    if (!quizTableAvailable) {
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

    // 1. Total count
    const [totalRows] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM quiz_tbl",
    );
    const totalQuizzes = Number(totalRows[0]?.total ?? 0);

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
    if (!(await tableExists("quiz_tbl"))) {
      const safePageSize = Math.max(1, Math.floor(pageSize));
      const search = filters.search?.trim() ?? "";
      const idSearch = filters.id?.replace(/^[#\s]+/, "").trim() ?? "";
      const section = filters.section?.trim() ?? "";
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT p.pending_id, p.unit_title, p.sec_id, s.sec_num,
                p.unit_lesson_card_json, p.unit_quiz_json,
                p.unit_assessment_json, p.pending_status, p.pending_name
         FROM pending_tbl p
         LEFT JOIN sec_tbl s ON s.sec_id = p.sec_id
         WHERE (? = '' OR CAST(p.pending_id AS CHAR) LIKE ?)
           AND (? = '' OR p.unit_title LIKE ? OR p.pending_name LIKE ?)
           AND (? = '' OR s.sec_num = ?)
         ORDER BY p.pending_id DESC`,
        [
          idSearch,
          `%${idSearch}%`,
          search,
          `%${search}%`,
          `%${search}%`,
          section,
          section,
        ],
      );
      const units = rows.map((row) => {
        const lessonCard = parseJsonColumn(row.unit_lesson_card_json);
        const quizzes = parseJsonColumn(row.unit_quiz_json);
        const assessment = parseJsonColumn(row.unit_assessment_json);
        const unitNumber = Array.isArray(quizzes) ? quizzes[0]?.unit : null;
        return {
          quiz_id: row.pending_id,
          cat_id: 0,
          sec_id: row.sec_id,
          difficulty_id: 0,
          quiz_type_id: 0,
          question_text: row.unit_title,
          cat_name: "Unit",
          sec_num: row.sec_num,
          difficulty_name: row.pending_status,
          type_name: "Unit",
          quiz_payload: {
            title: row.unit_title,
            lesson_card: lessonCard,
            quizzes,
            assessment,
            unit_number: unitNumber,
            pending_name: row.pending_name,
          },
        };
      });
      const totalCount = units.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
      const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);
      const offset = (currentPage - 1) * safePageSize;
      return {
        quizzes: units.slice(offset, offset + safePageSize),
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
        "(q.question_text LIKE ? OR c.cat_name LIKE ? OR t.type_name LIKE ? OR d.difficulty_name LIKE ?)",
      );
      params.push(search, search, search, search);
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

export async function createQuiz(state: any, formData: FormData) {
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

    const hasSecId = await quizHasColumn("sec_id");
    const columns = [
      "cat_id",
      "difficulty_id",
      "quiz_type_id",
      "question_text",
      "quiz_payload",
    ];
    const values: any[] = [
      catId,
      difficultyId,
      quizTypeId,
      questionText.toString().trim(),
      JSON.stringify(parsedPayload.payload),
    ];

    if (hasSecId && secId && secId !== "") {
      columns.push("sec_id");
      values.push(secId);
    }

    const session = await auth();
    const pendingName = (
      session?.user?.name ??
      session?.user?.email?.split("@")[0] ??
      "Contributor"
    ).slice(0, 50);

    columns.push("pending_status", "pending_name");
    values.push("pending", pendingName);

    const [insertResult] = await db.query<ResultSetHeader>(
      `INSERT INTO pending_tbl (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      values,
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
    await db.query("DELETE FROM quiz_tbl WHERE quiz_id = ?", [quizId]);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete quiz:", error);
    return {
      error: "An error occurred while deleting the quiz from the database.",
    };
  }
}

export async function updateQuiz(quizId: number, formData: FormData) {
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
    const values: any[] = [
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
           SELECT p.pending_id, p.unit_title, p.sec_id,
             p.unit_lesson_card_json, p.unit_quiz_json,
             p.unit_assessment_json, p.pending_status, p.pending_name,
             p.pending_note, s.sec_num
            FROM pending_tbl p
            LEFT JOIN sec_tbl s ON p.sec_id = s.sec_id
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
  if (!pendingId) return undefined;

  try {
    const [rows] = await db.query<PendingUnit[]>(
      `SELECT p.pending_id, p.unit_title, p.sec_id,
              p.unit_lesson_card_json, p.unit_quiz_json,
              p.unit_assessment_json, p.pending_status, p.pending_name,
              p.pending_note, s.sec_num
       FROM pending_tbl p
       LEFT JOIN sec_tbl s ON p.sec_id = s.sec_id
       WHERE p.pending_id = ?
       LIMIT 1`,
      [pendingId],
    );
    const quiz = rows[0];
    if (!quiz) return undefined;
    const unitQuizJson = parseJsonColumn(quiz.unit_quiz_json);
    const firstQuiz = Array.isArray(unitQuizJson) ? unitQuizJson[0] : {};
    return {
      ...quiz,
      unit_lesson_card_json: parseJsonColumn(quiz.unit_lesson_card_json),
      unit_quiz_json: unitQuizJson,
      unit_assessment_json: parseJsonColumn(quiz.unit_assessment_json),
      question_text: quiz.unit_title,
      cat_name: "",
      difficulty_name: "",
      type_name: "Unit",
      quiz_payload: firstQuiz?.quiz_payload ?? {},
    };
  } catch (error) {
    console.error("Failed to fetch pending quiz:", error);
    return undefined;
  }
}

export async function reviewPendingQuiz(
  pendingId: number,
  decision: "approve" | "reject",
  rejectionNotes = "",
) {
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
      return {
        success: true,
        message: "Unit rejected and retained in the review history.",
      };
    }

    const [unitResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO unit_tbl
       (unit_title, sec_id, unit_lesson_card_json, quiz_json, assessment_json)
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
      "UPDATE pending_tbl SET pending_status = 'approved' WHERE pending_id = ?",
      [pendingId],
    );
    await connection.commit();
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
  if (!pendingId || !questionText.trim()) {
    return { error: "A valid pending quiz and question are required." };
  }

  try {
    const [result] = await db.query<ResultSetHeader>(
      "UPDATE pending_tbl SET question_text = ? WHERE pending_id = ?",
      [questionText.trim(), pendingId],
    );
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
  if (!pendingId || !pendingNote.trim()) {
    return { error: "A note is required." };
  }

  try {
    const [result] = await db.query<ResultSetHeader>(
      "UPDATE pending_tbl SET pending_note = ? WHERE pending_id = ? AND pending_status = 'rejected'",
      [pendingNote.trim(), pendingId],
    );
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

    const [result] = await db.query<ResultSetHeader>(
      `UPDATE pending_tbl
       SET cat_id = ?, sec_id = ?, difficulty_id = ?, quiz_type_id = ?, question_text = ?, quiz_payload = ?
       WHERE pending_id = ?`,
      [
        catId,
        secId || null,
        difficultyId,
        quizTypeId,
        questionText.toString().trim(),
        JSON.stringify(parsedPayload.payload),
        pendingId,
      ],
    );
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
  const unitTitle = String(formData.get("unit_title") ?? "").trim();
  const sectionId = formData.get("sec_id");
  const lessonCard = String(formData.get("lesson_card") ?? "").trim();
  const lessonText = String(formData.get("lesson_text") ?? "").trim();
  const assessment = String(formData.get("assessment") ?? "").trim();
  const rawQuizJson = formData.get("quiz_json");

  if (!pendingId || !unitTitle || !sectionId || !lessonCard || !lessonText) {
    return { error: "Unit title, section, lesson card, and lesson text are required." };
  }

  let quizzes: unknown[];
  try {
    quizzes = typeof rawQuizJson === "string" ? JSON.parse(rawQuizJson) : [];
  } catch {
    return { error: "The queued quiz data is invalid." };
  }
  if (!Array.isArray(quizzes) || quizzes.length === 0) {
    return { error: "At least one quiz is required for the unit." };
  }

  try {
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE pending_tbl
       SET unit_title = ?, sec_id = ?, unit_lesson_card_json = ?,
           unit_quiz_json = ?, unit_assessment_json = ?
       WHERE pending_id = ?`,
      [
        unitTitle,
        sectionId,
        JSON.stringify({ lesson_card: { lesson_format: lessonCard, lesson_text: lessonText } }),
        JSON.stringify(quizzes),
        JSON.stringify({ assessment }),
        pendingId,
      ],
    );
    return result.affectedRows === 0
      ? { error: "Pending unit was not found." }
      : { success: true, message: "Pending unit updated successfully." };
  } catch (error) {
    console.error("Failed to update pending unit:", error);
    return { error: "An error occurred while updating the pending unit." };
  }
}

export async function deletePendingQuiz(pendingId: number) {
  if (!pendingId) return { error: "Pending quiz ID is required." };

  try {
    const [result] = await db.query<ResultSetHeader>(
      "DELETE FROM pending_tbl WHERE pending_id = ?",
      [pendingId],
    );
    return result.affectedRows === 0
      ? { error: "Pending quiz was not found." }
      : { success: true };
  } catch (error) {
    console.error("Failed to delete pending quiz:", error);
    return { error: "An error occurred while deleting the pending quiz." };
  }
}
