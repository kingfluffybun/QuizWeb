"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { recordQuizAnswer } from "@/app/actions/player";
import { UNIFIED_CURRICULUM_ROADMAP } from "@/lib/curriculumRoadmap";
import { ensureLookupTables } from "@/lib/seedLookup";
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

export interface QuizItem {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quiz_payload: any;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quiz_payload: any;
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
    await ensureLookupTables();
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

export async function getQuizMetrics(): Promise<QuizMetricsData> {
  try {
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

async function assertAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  return session;
}

export async function createQuiz(state: unknown, formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Authentication required to submit quizzes." };
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
    const values: unknown[] = [
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
  try {
    await assertAdminSession();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unauthorized: Admin privileges required." };
  }

  if (!quizId) {
    return { error: "Quiz ID is required for deletion." };
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
  try {
    await assertAdminSession();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unauthorized: Admin privileges required." };
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
  type_name?: string;
  cat_name?: string;
  sec_num?: number | string;
  difficulty_name?: string;
}) {
  try {
    await ensureLookupTables();
    const conditions: string[] = [];
    const params: (number | string)[] = [];
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
    if (filters?.type_name) {
      conditions.push("t.type_name = ?");
      params.push(filters.type_name);
    }
    if (filters?.cat_name) {
      conditions.push("c.cat_name = ?");
      params.push(filters.cat_name);
    }
    if (filters?.sec_num) {
      conditions.push("s.sec_num = ?");
      params.push(String(filters.sec_num));
    }
    if (filters?.difficulty_name) {
      conditions.push("d.difficulty_name = ?");
      params.push(filters.difficulty_name);
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
            ORDER BY q.quiz_id ASC
            LIMIT 50
            `,
      params,
    );

    let finalQuizzes = quizzes;
    if (finalQuizzes.length === 0 && filters?.cat_name === "HTML" && String(filters?.sec_num) === "4") {
      const fallbackParams: (number | string)[] = ["CSS", "4"];
      let fallbackDiff = "";
      if (filters?.difficulty_name) {
        fallbackDiff = " AND d.difficulty_name = ?";
        fallbackParams.push(filters.difficulty_name);
      }
      const [fallbackRows] = await db.query<QuizRow[]>(
        `
        SELECT q.quiz_id, 1 as cat_id, 4 as sec_id, '4' as sec_num, q.difficulty_id, q.quiz_type_id,
               q.question_text, q.quiz_payload,
               'HTML' as cat_name, d.difficulty_name, t.type_name
        FROM quiz_tbl q
        JOIN cat_tbl c ON q.cat_id = c.cat_id
        JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
        JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
        LEFT JOIN sec_tbl s ON q.sec_id = s.sec_id
        WHERE c.cat_name = ? AND s.sec_num = ? ${fallbackDiff}
        ORDER BY q.quiz_id ASC
        LIMIT 50
        `,
        fallbackParams,
      );
      finalQuizzes = fallbackRows;
    }

    return finalQuizzes.map((quiz) => {
      const payload =
        typeof quiz.quiz_payload === "string"
          ? JSON.parse(quiz.quiz_payload)
          : quiz.quiz_payload;

      // Finding 8: Sanitize answers and keys before sending to player client
      const sanitized: Record<string, unknown> = { ...payload };
      delete sanitized.correct_index;
      delete sanitized.answer;

      return {
        ...quiz,
        sec_num: quiz.sec_num ?? undefined,
        quiz_payload: sanitized,
      };
    });
  } catch (error) {
    console.error("Failed to fetch quizzes:", error);
    return [];
  }
}

export async function getSkipChallengeQuizzes(
  catName: string,
  targetSecNum: number,
  targetDiffName = "Easy"
) {
  try {
    await ensureLookupTables();

    let targetDiffId = 1;
    if (targetDiffName === "Medium") targetDiffId = 2;
    if (targetDiffName === "Hard") targetDiffId = 3;

    // Locate target step in the unified roadmap
    const targetStepIndex = UNIFIED_CURRICULUM_ROADMAP.findIndex(
      (s) => s.catName.toLowerCase() === catName.toLowerCase() && s.secNum === targetSecNum
    );

    // Prior steps in the sequential roadmap
    const priorSteps = targetStepIndex > 0
      ? UNIFIED_CURRICULUM_ROADMAP.slice(0, targetStepIndex)
      : [];

    // Build SQL condition for checkpoints strictly lower than the target checkpoint
    const stepConditions: string[] = [];
    const queryParams: (string | number)[] = [];

    for (const step of priorSteps) {
      stepConditions.push("(c.cat_name = ? AND s.sec_num = ?)");
      queryParams.push(step.catName, step.secNum);
    }

    // Also include the target step if difficulty is strictly lower
    if (targetDiffId > 1) {
      stepConditions.push("(c.cat_name = ? AND s.sec_num = ? AND d.difficulty_id < ?)");
      queryParams.push(catName, targetSecNum, targetDiffId);
    }

    if (stepConditions.length === 0) {
      stepConditions.push("(c.cat_name = ? AND s.sec_num = ?)");
      queryParams.push(catName, targetSecNum);
    }

    const whereClause = stepConditions.join(" OR ");

    // Fetch up to 5 questions strictly from lower levels, prioritized by highest difficulty first
    const [rows] = await db.query<QuizRow[]>(
      `
      SELECT q.quiz_id, q.cat_id, q.sec_id, s.sec_num, q.difficulty_id, q.quiz_type_id,
             q.question_text, q.quiz_payload,
             c.cat_name, d.difficulty_name, t.type_name
      FROM quiz_tbl q
      JOIN cat_tbl c ON q.cat_id = c.cat_id
      JOIN sec_tbl s ON q.sec_id = s.sec_id
      JOIN difficulty_tbl d ON q.difficulty_id = d.difficulty_id
      JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
      WHERE (${whereClause})
      ORDER BY d.difficulty_id DESC, RAND()
      LIMIT 5
      `,
      queryParams
    );

    return rows.map((quiz) => {
      const payload =
        typeof quiz.quiz_payload === "string"
          ? JSON.parse(quiz.quiz_payload)
          : quiz.quiz_payload;

      const sanitized: Record<string, unknown> = { ...payload };
      delete sanitized.correct_index;
      delete sanitized.answer;

      return {
        ...quiz,
        sec_num: quiz.sec_num ?? undefined,
        quiz_payload: sanitized,
      };
    });
  } catch (error) {
    console.error("Failed to fetch skip challenge quizzes:", error);
    return [];
  }
}

export async function submitAnswer(quizId: number, submittedValue: unknown) {
  if (!quizId) {
    return { error: "Quiz ID is required." };
  }

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT q.quiz_id, q.quiz_payload, t.type_name 
       FROM quiz_tbl q
       JOIN quiz_type_tbl t ON q.quiz_type_id = t.quiz_type_id
       WHERE q.quiz_id = ? LIMIT 1`,
      [quizId],
    );

    if (rows.length === 0) {
      return { error: "Quiz question not found." };
    }

    const quiz = rows[0];
    const payload =
      typeof quiz.quiz_payload === "string"
        ? JSON.parse(quiz.quiz_payload)
        : quiz.quiz_payload;

    let isCorrect = false;
    let message = "Incorrect.";

    switch (quiz.type_name) {
      case "MCQ": {
        if (typeof submittedValue === "string") {
          const expected = payload.options?.[payload.correct_index]?.trim().toLowerCase();
          isCorrect = !!expected && expected === submittedValue.trim().toLowerCase();
        } else if (typeof submittedValue === "number") {
          isCorrect = submittedValue === payload.correct_index;
        } else {
          return { error: "Please select an answer." };
        }
        message = isCorrect ? "Correct!" : "Incorrect";
        break;
      }
      case "FITB": {
        const expected = (payload.answer ?? "").trim().toLowerCase();
        const submitted = typeof submittedValue === "string" ? submittedValue.trim().toLowerCase() : "";
        isCorrect = submitted !== "" && submitted === expected;
        message = isCorrect ? "Correct!" : "Incorrect.";
        break;
      }
      case "Order": {
        if (!Array.isArray(submittedValue)) {
          return { error: "Please arrange all items before submitting." };
        }
        isCorrect = JSON.stringify(submittedValue) === JSON.stringify(payload.items);
        message = isCorrect ? "Correct!" : "Incorrect";
        break;
      }
      case "Pair": {
        const totalPairs = payload.pairs?.length ?? 0;
        isCorrect = submittedValue === totalPairs;
        message = isCorrect ? "Correct!" : "Match all pairs before submitting.";
        break;
      }
      case "CP": {
        if (typeof submittedValue === "string") {
          const expected = (payload.expected ?? payload.steps?.[0]?.expected ?? "").trim();
          const cleanSubmitted = submittedValue.trim().replace(/\r\n/g, "\n");
          const cleanExpected = expected.replace(/\r\n/g, "\n");
          isCorrect = cleanSubmitted === cleanExpected ||
                      cleanSubmitted.replace(/\s+/g, " ") === cleanExpected.replace(/\s+/g, " ");
        } else if (typeof submittedValue === "object" && submittedValue !== null) {
          const val = submittedValue as { stepIndex?: number; code?: string; allStepsCompleted?: boolean };
          if (val.allStepsCompleted) {
            isCorrect = true;
          } else if (typeof val.code === "string") {
            const stepIdx = val.stepIndex ?? 0;
            const expected = (payload.steps?.[stepIdx]?.expected ?? payload.expected ?? "").trim();
            const cleanSubmitted = val.code.trim().replace(/\r\n/g, "\n");
            const cleanExpected = expected.replace(/\r\n/g, "\n");
            isCorrect = cleanSubmitted === cleanExpected ||
                        cleanSubmitted.replace(/\s+/g, " ") === cleanExpected.replace(/\s+/g, " ");
          }
        }
        message = isCorrect ? "Code verified successfully!" : "Code does not match expected output.";
        break;
      }
      default:
        return { error: `Unsupported quiz type: ${quiz.type_name}` };
    }

    let progressResult = null;
    try {
      progressResult = await recordQuizAnswer(quizId, isCorrect);
    } catch (progErr) {
      console.error("Failed to record player progress:", progErr);
    }

    return {
      correct: isCorrect,
      message,
      progress: progressResult,
    };
  } catch (error) {
    console.error("Failed to evaluate answer:", error);
    return { error: "An error occurred while evaluating your answer." };
  }
}

export interface PendingQuiz extends RowDataPacket {
  pending_id: number;
  cat_id: number;
  sec_id?: number;
  difficulty_id: number;
  quiz_type_id: number;
  question_text: string;
  quiz_payload: unknown;
  pending_status: "pending" | "approved" | "rejected" | string;
  pending_name: string;
  cat_name: string;
  sec_num?: string;
  difficulty_name: string;
  type_name: string;
  quiz_id?: number;
  approved_id?: number;
}

export async function getPendingQuizzes(statusFilter = "pending") {
  try {
    await assertAdminSession();
  } catch {
    return [];
  }

  try {
    const params: string[] = [];
    let whereClause = "";
    if (statusFilter !== "all") {
      whereClause = "WHERE p.pending_status = ?";
      params.push(statusFilter);
    }

    const [rows] = await db.query<PendingQuiz[]>(
      `
            SELECT p.pending_id, p.cat_id, p.sec_id, p.difficulty_id, p.quiz_type_id,
                   p.question_text, p.quiz_payload, p.pending_status, p.pending_name,
                   c.cat_name, s.sec_num, d.difficulty_name, t.type_name,
                   qa.quiz_id, qa.approved_id
            FROM pending_tbl p
            JOIN cat_tbl c ON p.cat_id = c.cat_id
            LEFT JOIN sec_tbl s ON p.sec_id = s.sec_id
            JOIN difficulty_tbl d ON p.difficulty_id = d.difficulty_id
            JOIN quiz_type_tbl t ON p.quiz_type_id = t.quiz_type_id
            LEFT JOIN quiz_approved_tbl qa ON p.pending_id = qa.pending_id
            ${whereClause}
            ORDER BY p.pending_id DESC
        `,
      params,
    );

    return rows.map((row) => ({
      ...row,
      quiz_payload:
        typeof row.quiz_payload === "string"
          ? JSON.parse(row.quiz_payload)
          : row.quiz_payload,
    }));
  } catch (error) {
    console.error("Failed to fetch pending quizzes:", error);
    return [];
  }
}

export async function reviewPendingQuiz(
  pendingId: number,
  decision: "approve" | "reject",
) {
  try {
    await assertAdminSession();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unauthorized: Admin privileges required." };
  }

  if (!pendingId || !["approve", "reject"].includes(decision)) {
    return { error: "A valid pending quiz and decision are required." };
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [pendingRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM pending_tbl WHERE pending_id = ? FOR UPDATE",
      [pendingId],
    );
    const pendingQuiz = pendingRows[0];
    if (!pendingQuiz) {
      await connection.rollback();
      return { error: "Pending quiz not found." };
    }

    if (pendingQuiz.pending_status !== "pending") {
      await connection.rollback();
      return { error: "This quiz has already been reviewed." };
    }

    if (decision === "reject") {
      await connection.query(
        "UPDATE pending_tbl SET pending_status = 'rejected' WHERE pending_id = ?",
        [pendingId],
      );
      await connection.commit();
      return {
        success: true,
        message: "Quiz rejected and retained in the review history.",
      };
    }

    const [quizResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO quiz_tbl (cat_id, sec_id, difficulty_id, quiz_type_id, question_text, quiz_payload)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [
        pendingQuiz.cat_id,
        pendingQuiz.sec_id,
        pendingQuiz.difficulty_id,
        pendingQuiz.quiz_type_id,
        pendingQuiz.question_text,
        typeof pendingQuiz.quiz_payload === "object"
          ? JSON.stringify(pendingQuiz.quiz_payload)
          : pendingQuiz.quiz_payload,
      ],
    );

    await connection.query(
      "INSERT INTO quiz_approved_tbl (pending_id, quiz_id) VALUES (?, ?)",
      [pendingId, quizResult.insertId],
    );
    await connection.query(
      "UPDATE pending_tbl SET pending_status = 'approved' WHERE pending_id = ?",
      [pendingId],
    );
    await connection.commit();
    return {
      success: true,
      message: "Quiz approved and added to the quiz bank.",
    };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to review pending quiz:", error);
    return { error: "An error occurred while reviewing the quiz." };
  } finally {
    connection.release();
  }
}
