import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { createSafeCache } from "@/lib/server/cache";
import { isStaff, requireStaff } from "@/lib/rbac";
import type {
  AvailableUnit,
  Category,
  CodeProblem,
  CodeProblemStep,
  Difficulty,
  QuizRow,
  QuizType,
  RecentUnitItem,
  Section,
  SectionUnitBundleEntry,
  UnitByIdPayload,
} from "@/lib/types/quiz";
import {
  hydrateAssessmentsByUnitIds,
  populateQuizPayloads,
} from "./payload-hydrator";

async function fetchQuizMetadataInternal() {
  try {
    const [[categories], [sections], [difficulties], [types]] = await Promise.all([
      db.query<RowDataPacket[]>(
        "SELECT cat_id, cat_name FROM cat_tbl ORDER BY cat_name",
      ),
      db.query<RowDataPacket[]>(
        "SELECT sec_id, sec_num, cat_id, sec_title, difficulty_id FROM sec_tbl ORDER BY sec_id",
      ),
      db.query<RowDataPacket[]>(
        "SELECT difficulty_id, difficulty_name FROM difficulty_tbl ORDER BY difficulty_id",
      ),
      db.query<RowDataPacket[]>(
        "SELECT quiz_type_id, type_name FROM quiz_type_tbl ORDER BY quiz_type_id",
      ),
    ]);

    const mappedSections: Section[] = (sections as RowDataPacket[]).map((s) => ({
      sec_id: Number(s.sec_id),
      sec_num: String(s.sec_num),
      cat_id: s.cat_id != null ? Number(s.cat_id) : undefined,
      sec_title: s.sec_title != null ? String(s.sec_title) : undefined,
      difficulty_id:
        s.difficulty_id != null ? Number(s.difficulty_id) : undefined,
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

export const getCachedQuizMetadata = createSafeCache(
  fetchQuizMetadataInternal,
  ["quiz-metadata"],
  { tags: ["curriculum", "metadata"], revalidate: 3600 },
);

async function fetchUnitsUncached() {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, s.sec_num, u.status
       FROM unit_tbl u
       LEFT JOIN sec_tbl s ON s.sec_id = u.sec_id
       ORDER BY u.unit_id DESC`,
    );

    const unitIds = rows.map((r) => Number(r.unit_id));
    if (unitIds.length === 0) return [];

    const [[slides], populatedQuizzes, assessmentByUnit] = await Promise.all([
      db.query<RowDataPacket[]>(
        `SELECT unit_id, slide_order, slide_title, slide_text, slide_code
         FROM lesson_slide_tbl
         WHERE unit_id IN (?)
         ORDER BY unit_id, slide_order ASC`,
        [unitIds],
      ),
      db
        .query<QuizRow[]>(
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
        )
        .then(([quizzes]) => populateQuizPayloads(quizzes)),
      hydrateAssessmentsByUnitIds(unitIds),
    ]);

    const slidesByUnit = new Map<
      number,
      Array<{ lesson_title: string; lesson_text: string; lesson_code: string }>
    >();
    for (const s of slides) {
      const uId = Number(s.unit_id);
      let list = slidesByUnit.get(uId);
      if (!list) {
        list = [];
        slidesByUnit.set(uId, list);
      }
      list.push({
        lesson_title: s.slide_title,
        lesson_text: s.slide_text,
        lesson_code: s.slide_code ?? "",
      });
    }

    const quizzesByUnit = new Map<number, QuizRow[]>();
    for (const q of populatedQuizzes) {
      const uId = Number(q.unit_id);
      let list = quizzesByUnit.get(uId);
      if (!list) {
        list = [];
        quizzesByUnit.set(uId, list);
      }
      list.push(q);
    }

    return rows.map((row) => {
      const uId = Number(row.unit_id);
      return {
        unit_id: uId,
        unit_title: row.unit_title,
        sec_id: row.sec_id,
        sec_num: row.sec_num,
        unit_lesson_card_json: { lesson_slide: slidesByUnit.get(uId) ?? [] },
        quiz_json: quizzesByUnit.get(uId) ?? [],
        assessment_json: assessmentByUnit.get(uId) ?? null,
      };
    });
  } catch (error) {
    console.error("Failed to fetch units:", error);
    return [];
  }
}

export const getCachedUnits = createSafeCache(
  fetchUnitsUncached,
  ["all-units-list"],
  { tags: ["curriculum"], revalidate: 3600 },
);

async function fetchCodeProblemsUncached(unitKey: number): Promise<CodeProblem[]> {
  try {
    const unitId = unitKey > 0 ? unitKey : undefined;
    const params: number[] = unitId ? [unitId] : [];
    const unitFilter = unitId ? "AND u.unit_id = ?" : "";

    const [[assessmentRows], [cpQuizRows]] = await Promise.all([
      db.query<RowDataPacket[]>(
        `SELECT u.unit_id, u.unit_title, ua.assessment_id, ua.title, ua.description
         FROM unit_tbl u
         JOIN unit_assessment_tbl ua ON u.unit_id = ua.unit_id
         WHERE u.status = 'approved' ${unitFilter}
         ORDER BY u.unit_id DESC`,
        params,
      ),
      db.query<RowDataPacket[]>(
        `SELECT q.quiz_id, q.unit_id, q.question_text, cp.title, u.unit_title
         FROM quiz_tbl q
         JOIN unit_tbl u ON q.unit_id = u.unit_id
         JOIN quiz_cp_tbl cp ON q.quiz_id = cp.quiz_id
         WHERE u.status = 'approved' ${unitFilter}
         ORDER BY q.quiz_id DESC`,
        params,
      ),
    ]);

    const assessmentIds = assessmentRows.map((r) => Number(r.assessment_id));
    const cpQuizIds = cpQuizRows.map((r) => Number(r.quiz_id));

    const [stepRows, cpStepRows] = await Promise.all([
      assessmentIds.length > 0
        ? db
            .query<RowDataPacket[]>(
              `SELECT assessment_id, step_number, instruction, inherit_previous_code,
                      starter_html, starter_css, starter_js,
                      expected_html, expected_css, expected_js
               FROM assessment_step_tbl
               WHERE assessment_id IN (?)
               ORDER BY assessment_id, step_number ASC`,
              [assessmentIds],
            )
            .then(([r]) => r)
        : Promise.resolve<RowDataPacket[]>([]),
      cpQuizIds.length > 0
        ? db
            .query<RowDataPacket[]>(
              `SELECT quiz_id, step_order, prompt, template_code, expected_code
               FROM quiz_cp_step_tbl
               WHERE quiz_id IN (?)
               ORDER BY quiz_id, step_order ASC`,
              [cpQuizIds],
            )
            .then(([r]) => r)
        : Promise.resolve<RowDataPacket[]>([]),
    ]);

    const stepsByAssessment = new Map<number, RowDataPacket[]>();
    for (const st of stepRows) {
      const aid = Number(st.assessment_id);
      let list = stepsByAssessment.get(aid);
      if (!list) {
        list = [];
        stepsByAssessment.set(aid, list);
      }
      list.push(st);
    }

    const stepsByQuiz = new Map<number, RowDataPacket[]>();
    for (const st of cpStepRows) {
      const qid = Number(st.quiz_id);
      let list = stepsByQuiz.get(qid);
      if (!list) {
        list = [];
        stepsByQuiz.set(qid, list);
      }
      list.push(st);
    }

    const problems: CodeProblem[] = [];

    for (const row of assessmentRows) {
      const steps = stepsByAssessment.get(Number(row.assessment_id));
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

    for (const cpRow of cpQuizRows) {
      const cpSteps = stepsByQuiz.get(Number(cpRow.quiz_id));
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
        question_text: String(
          cpRow.title ?? cpRow.question_text ?? cpRow.unit_title,
        ),
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

const getCachedCodeProblemsInternal = createSafeCache(
  fetchCodeProblemsUncached,
  ["code-problems"],
  { tags: ["curriculum"], revalidate: 3600 },
);

export async function fetchCodeProblems(
  unitId?: number,
): Promise<CodeProblem[]> {
  const unitKey = unitId && Number.isInteger(unitId) && unitId > 0 ? unitId : 0;
  return getCachedCodeProblemsInternal(unitKey);
}

async function fetchAvailableUnitsUncached(
  includeAllStatuses = false,
): Promise<AvailableUnit[]> {
  try {
    const statusFilter = includeAllStatuses ? "" : "WHERE u.status = 'approved'";
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
      ${statusFilter}
      ORDER BY u.unit_id ASC`,
    );

    return rows.map((row) => ({
      pending_id: Number(row.pending_id),
      unit_id: Number(row.unit_id),
      unit_title: String(row.unit_title),
      category_name:
        row.category_name != null ? String(row.category_name) : undefined,
      sec_id: row.sec_id != null ? Number(row.sec_id) : undefined,
      sec_num: row.sec_num != null ? String(row.sec_num) : undefined,
      sec_title: row.sec_title != null ? String(row.sec_title) : undefined,
      difficulty_name:
        row.difficulty_name != null ? String(row.difficulty_name) : undefined,
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

export const getCachedAvailableUnits = createSafeCache(
  () => fetchAvailableUnitsUncached(false),
  ["available-units"],
  { tags: ["curriculum"], revalidate: 3600 },
);

const getCachedAvailableUnitsAllStatuses = createSafeCache(
  () => fetchAvailableUnitsUncached(true),
  ["available-units-staff"],
  { tags: ["curriculum"], revalidate: 3600 },
);

export async function fetchAvailableUnitsForStaff(
  explicitUserId?: number,
): Promise<AvailableUnit[]> {
  const staffSession = await requireStaff();
  if (!staffSession) {
    if (explicitUserId && Number.isInteger(explicitUserId) && explicitUserId > 0) {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT user_role FROM user_auth_tbl WHERE user_id = ? LIMIT 1",
        [explicitUserId],
      );
      if (!isStaff(rows[0]?.user_role)) {
        throw new Error(
          "Unauthorized: Maintainer or Administrator access required.",
        );
      }
    } else {
      throw new Error("Unauthorized: Maintainer or Administrator access required.");
    }
  }
  return getCachedAvailableUnitsAllStatuses();
}

export async function fetchPaginatedRecentQuizzes(
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

export async function fetchPaginatedRecentUnits(
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
    const hasSearch = Boolean(filters.search?.trim());
    const needsSectionJoin = Boolean(filters.category || filters.section);

    if (filters.id?.trim()) {
      where.push("CAST(u.unit_id AS CHAR) LIKE ?");
      params.push(`%${filters.id.replace(/^[#\s]+/, "").trim()}%`);
    }
    if (hasSearch) {
      const search = `%${filters.search!.trim()}%`;
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
    const countJoins = `
      FROM unit_tbl u
      ${needsSectionJoin ? "LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id LEFT JOIN cat_tbl c ON s.cat_id = c.cat_id" : ""}
      ${hasSearch ? "LEFT JOIN player_tbl p ON u.author_id = p.user_id LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id" : ""}
    `;

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total ${countJoins} ${whereClause}`,
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
      `SELECT u.unit_id, u.unit_title, u.sec_id, u.unit_order, u.author_id, u.status, u.pending_note,
              u.created_at, u.updated_at,
              s.sec_num, c.cat_id, COALESCE(c.cat_name, 'General') AS cat_name,
              COALESCE(p.username, ua.email, 'Administrator') AS author_name
       FROM unit_tbl u
       LEFT JOIN sec_tbl s ON u.sec_id = s.sec_id
       LEFT JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN player_tbl p ON u.author_id = p.user_id
       LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
       ${whereClause}
       ORDER BY u.unit_id DESC
       LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset],
    );

    const pageUnitIds = units.map((u) => Number(u.unit_id));
    const slideCounts = new Map<number, number>();
    const quizCounts = new Map<number, number>();

    if (pageUnitIds.length > 0) {
      const [[slideRows], [quizRows]] = await Promise.all([
        db.query<RowDataPacket[]>(
          `SELECT unit_id, COUNT(*) AS cnt FROM lesson_slide_tbl WHERE unit_id IN (?) GROUP BY unit_id`,
          [pageUnitIds],
        ),
        db.query<RowDataPacket[]>(
          `SELECT unit_id, COUNT(*) AS cnt FROM quiz_tbl WHERE unit_id IN (?) GROUP BY unit_id`,
          [pageUnitIds],
        ),
      ]);
      for (const r of slideRows) slideCounts.set(Number(r.unit_id), Number(r.cnt));
      for (const r of quizRows) quizCounts.set(Number(r.unit_id), Number(r.cnt));
    }

    return {
      units: units.map((u) => {
        const uid = Number(u.unit_id);
        return {
          unit_id: uid,
          unit_title: String(u.unit_title),
          sec_id: Number(u.sec_id),
          unit_order: Number(u.unit_order ?? 1),
          sec_num: u.sec_num != null ? Number(u.sec_num) : undefined,
          cat_id: Number(u.cat_id),
          cat_name: String(u.cat_name),
          author_id: u.author_id != null ? Number(u.author_id) : null,
          author_name: String(u.author_name),
          status: (u.status as "pending" | "approved" | "rejected") || "approved",
          pending_note: u.pending_note != null ? String(u.pending_note) : null,
          slide_count: slideCounts.get(uid) ?? 0,
          question_count: quizCounts.get(uid) ?? 0,
          created_at: u.created_at ? new Date(u.created_at).toISOString() : undefined,
          updated_at: u.updated_at ? new Date(u.updated_at).toISOString() : undefined,
        };
      }),
      currentPage,
      totalPages,
      totalCount,
    };
  } catch (error) {
    console.error("Failed to fetch recent units:", error);
    return { units: [], currentPage: 1, totalPages: 1, totalCount: 0 };
  }
}

export async function fetchUnitByIdUncached(
  unitId: number,
): Promise<UnitByIdPayload | null> {
  if (!Number.isInteger(unitId) || unitId < 1) return null;

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, u.unit_order, u.author_id, u.status, u.pending_note,
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

    const [[slides], populatedQuizzes, assessmentMap] = await Promise.all([
      db.query<RowDataPacket[]>(
        `SELECT slide_id, slide_order, slide_title, slide_text, slide_code
         FROM lesson_slide_tbl
         WHERE unit_id = ?
         ORDER BY slide_order ASC`,
        [unitId],
      ),
      db
        .query<QuizRow[]>(
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
        )
        .then(([quizzes]) => populateQuizPayloads(quizzes)),
      hydrateAssessmentsByUnitIds([unitId]),
    ]);

    return {
      quiz_id: Number(unit.unit_id),
      unit_id: Number(unit.unit_id),
      cat_id: Number(unit.cat_id ?? 0),
      sec_id: Number(unit.sec_id ?? 1),
      unit_order: Number(unit.unit_order ?? 1),
      difficulty_id: populatedQuizzes[0]?.difficulty_id ?? 0,
      quiz_type_id: populatedQuizzes[0]?.quiz_type_id ?? 0,
      question_text: String(unit.unit_title),
      cat_name: String(unit.cat_name ?? "Unit"),
      sec_num: unit.sec_num != null ? String(unit.sec_num) : undefined,
      difficulty_name: String(unit.status),
      type_name: "Unit",
      quiz_payload: {
        title: String(unit.unit_title),
        lesson_card: {
          lesson_title: String(unit.unit_title),
          lesson_slide: slides.map((s) => ({
            lesson_title: s.slide_title,
            lesson_text: s.slide_text,
            lesson_code: s.slide_code ?? "",
          })),
        },
        quizzes: populatedQuizzes,
        assessment: assessmentMap.get(unitId) ?? null,
        unit_number: unit.sec_num ?? null,
        pending_name: String(unit.pending_name),
        pending_status: String(unit.status),
        pending_note: unit.pending_note != null ? String(unit.pending_note) : null,
      },
    };
  } catch (error) {
    console.error("Failed to fetch selected unit:", error);
    return null;
  }
}

export const getCachedUnitById = createSafeCache(
  fetchUnitByIdUncached,
  ["unit-by-id"],
  { tags: ["curriculum"], revalidate: 3600 },
);

async function fetchSectionUnitsBundleInternal(
  secId: number,
): Promise<SectionUnitBundleEntry[]> {
  if (!Number.isInteger(secId) || secId < 1) return [];

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.unit_order, u.status, u.pending_note,
              s.sec_id, s.sec_num, s.sec_title, s.difficulty_id,
              COALESCE(d.difficulty_name, 'Beginner') AS difficulty_name,
              c.cat_id, c.cat_name,
              COALESCE(p.username, ua.email, 'Administrator') AS pending_name
       FROM unit_tbl u
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       LEFT JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
       LEFT JOIN player_tbl p ON u.author_id = p.user_id
       LEFT JOIN user_auth_tbl ua ON u.author_id = ua.user_id
       WHERE u.sec_id = ? AND u.status = 'approved'
       ORDER BY u.unit_order ASC, u.unit_id ASC`,
      [secId],
    );

    if (rows.length === 0) return [];

    const unitIds = rows.map((r) => Number(r.unit_id));

    // Batch-fetch slides, quizzes (and subtype payloads), and assessments for the entire section
    const [[slideRows], populatedQuizzes, assessmentByUnit] = await Promise.all([
      db.query<RowDataPacket[]>(
        `SELECT unit_id, slide_order, slide_title, slide_text, slide_code
         FROM lesson_slide_tbl
         WHERE unit_id IN (?)
         ORDER BY unit_id, slide_order ASC`,
        [unitIds],
      ),
      db
        .query<QuizRow[]>(
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
        )
        .then(([quizzes]) => populateQuizPayloads(quizzes)),
      hydrateAssessmentsByUnitIds(unitIds),
    ]);

    const slidesByUnit = new Map<
      number,
      Array<{ lesson_title: string; lesson_text: string; lesson_code: string }>
    >();
    for (const s of slideRows) {
      const uid = Number(s.unit_id);
      let list = slidesByUnit.get(uid);
      if (!list) {
        list = [];
        slidesByUnit.set(uid, list);
      }
      list.push({
        lesson_title: String(s.slide_title ?? ""),
        lesson_text: String(s.slide_text ?? ""),
        lesson_code: String(s.slide_code ?? ""),
      });
    }

    const quizzesByUnit = new Map<number, QuizRow[]>();
    for (const q of populatedQuizzes) {
      const uid = Number(q.unit_id);
      let list = quizzesByUnit.get(uid);
      if (!list) {
        list = [];
        quizzesByUnit.set(uid, list);
      }
      list.push(q);
    }

    return rows.map((r) => {
      const uid = Number(r.unit_id);
      const unitSlides = slidesByUnit.get(uid) ?? [];
      const unitQuizzes = quizzesByUnit.get(uid) ?? [];
      const unitAssessment = assessmentByUnit.get(uid) ?? null;

      return {
        unit_id: uid,
        unit_title: String(r.unit_title),
        unit_order: Number(r.unit_order ?? 1),
        sec_id: Number(r.sec_id),
        sec_num: Number(r.sec_num),
        sec_title: String(r.sec_title ?? ""),
        cat_id: Number(r.cat_id),
        cat_name: String(r.cat_name),
        difficulty_id: Number(r.difficulty_id ?? 1),
        difficulty_name: String(r.difficulty_name ?? "Beginner"),
        unitPayload: {
          quiz_id: uid,
          unit_id: uid,
          cat_id: Number(r.cat_id ?? 0),
          sec_id: Number(r.sec_id ?? 1),
          unit_order: Number(r.unit_order ?? 1),
          difficulty_id: unitQuizzes[0]?.difficulty_id ?? 0,
          quiz_type_id: unitQuizzes[0]?.quiz_type_id ?? 0,
          question_text: String(r.unit_title),
          cat_name: String(r.cat_name ?? "Unit"),
          sec_num: r.sec_num != null ? String(r.sec_num) : undefined,
          difficulty_name: String(r.status),
          type_name: "Unit",
          quiz_payload: {
            title: String(r.unit_title),
            lesson_card: {
              lesson_title: String(r.unit_title),
              lesson_slide: unitSlides,
            },
            quizzes: unitQuizzes,
            assessment: unitAssessment,
            unit_number: r.sec_num ?? null,
            pending_name: String(r.pending_name),
            pending_status: String(r.status),
            pending_note: r.pending_note != null ? String(r.pending_note) : null,
          },
        },
      };
    });
  } catch (error) {
    console.error("Failed to fetch section units bundle:", error);
    return [];
  }
}

export const getCachedSectionUnitsBundle = createSafeCache(
  fetchSectionUnitsBundleInternal,
  ["section-units-bundle"],
  { tags: ["curriculum"], revalidate: 3600 },
);

export async function fetchQuizOrUnitById(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  const unit = await getCachedUnitById(id);
  if (unit) return unit;

  try {
    const [quizzes] = await db.query<QuizRow[]>(
      `SELECT q.quiz_id, q.unit_id, q.difficulty_id, q.quiz_type_id, q.quiz_order, q.question_text,
              d.difficulty_name, t.type_name,
              u.sec_id, u.unit_order, s.sec_num, s.cat_id, c.cat_name
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

async function fetchQuizzesUncached(
  catId: number,
  secId: number,
  difficultyId: number,
  statusKey: string,
) {
  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (statusKey !== "all") {
      conditions.push("u.status = ?");
      params.push(statusKey);
    }
    if (catId > 0) {
      conditions.push("s.cat_id = ?");
      params.push(catId);
    }
    if (secId > 0) {
      conditions.push("u.sec_id = ?");
      params.push(secId);
    }
    if (difficultyId > 0) {
      conditions.push("q.difficulty_id = ?");
      params.push(difficultyId);
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

const getCachedQuizzesInternal = createSafeCache(
  fetchQuizzesUncached,
  ["quizzes-filtered"],
  { tags: ["curriculum"], revalidate: 3600 },
);

export async function fetchQuizzes(filters?: {
  cat_id?: number;
  sec_id?: number;
  difficulty_id?: number;
  status?: string;
}) {
  return getCachedQuizzesInternal(
    Number(filters?.cat_id || 0),
    Number(filters?.sec_id || 0),
    Number(filters?.difficulty_id || 0),
    filters?.status || "approved",
  );
}
