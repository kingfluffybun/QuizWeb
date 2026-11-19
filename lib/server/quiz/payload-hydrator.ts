import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { db } from "@/lib/db";
import {
  CodeProblemAssessmentSchema,
  unwrapCodeProblemAssessment,
  type CodeProblemAssessment,
} from "@/lib/cp-schema";
import type { ExtractedLessonSlidePayload } from "@/lib/server/quiz/parsers";
import type { QuizPayloadStructure, QuizRow } from "@/lib/types/quiz";

interface CPStepItem {
  prompt: string;
  template?: string;
  expected: string;
}

interface CPMapItem {
  [key: string]: unknown;
  title: string;
  steps: CPStepItem[];
  prompts: string[];
  prompt: string;
  template: string;
  expected: string;
}

export async function populateQuizPayloads(
  quizzes: QuizRow[],
): Promise<QuizRow[]> {
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
  const fitbMap = new Map<number, { answer: string }>();
  const orderMap = new Map<number, { items: string[] }>();
  const pairMap = new Map<number, { pairs: { left: string; right: string }[] }>();
  const cpMap = new Map<number, CPMapItem>();

  await Promise.all([
    mcqIds.length > 0
      ? db
          .query<RowDataPacket[]>(
            `SELECT quiz_id, option_index, option_text, is_correct
             FROM quiz_mcq_option_tbl
             WHERE quiz_id IN (?)
             ORDER BY quiz_id, option_index ASC`,
            [mcqIds],
          )
          .then(([rows]) => {
            for (const r of rows) {
              const qId = Number(r.quiz_id);
              let entry = mcqMap.get(qId);
              if (!entry) {
                entry = { options: [], correct_index: 0 };
                mcqMap.set(qId, entry);
              }
              entry.options.push(String(r.option_text ?? ""));
              if (Boolean(r.is_correct)) {
                entry.correct_index = entry.options.length - 1;
              }
            }
          })
      : Promise.resolve(),
    fitbIds.length > 0
      ? db
          .query<RowDataPacket[]>(
            `SELECT quiz_id, correct_answer
             FROM quiz_fitb_tbl
             WHERE quiz_id IN (?)`,
            [fitbIds],
          )
          .then(([rows]) => {
            for (const r of rows) {
              fitbMap.set(Number(r.quiz_id), {
                answer: String(r.correct_answer ?? ""),
              });
            }
          })
      : Promise.resolve(),
    orderIds.length > 0
      ? db
          .query<RowDataPacket[]>(
            `SELECT quiz_id, canonical_order, item_text
             FROM quiz_order_item_tbl
             WHERE quiz_id IN (?)
             ORDER BY quiz_id, canonical_order ASC`,
            [orderIds],
          )
          .then(([rows]) => {
            for (const r of rows) {
              const qId = Number(r.quiz_id);
              let entry = orderMap.get(qId);
              if (!entry) {
                entry = { items: [] };
                orderMap.set(qId, entry);
              }
              entry.items.push(String(r.item_text ?? ""));
            }
          })
      : Promise.resolve(),
    pairIds.length > 0
      ? db
          .query<RowDataPacket[]>(
            `SELECT quiz_id, pair_order, left_text, right_text
             FROM quiz_pair_tbl
             WHERE quiz_id IN (?)
             ORDER BY quiz_id, pair_order ASC, pair_id ASC`,
            [pairIds],
          )
          .then(([rows]) => {
            for (const r of rows) {
              const qId = Number(r.quiz_id);
              let entry = pairMap.get(qId);
              if (!entry) {
                entry = { pairs: [] };
                pairMap.set(qId, entry);
              }
              entry.pairs.push({
                left: String(r.left_text ?? ""),
                right: String(r.right_text ?? ""),
              });
            }
          })
      : Promise.resolve(),
    cpIds.length > 0
      ? Promise.all([
          db.query<RowDataPacket[]>(
            `SELECT quiz_id, title FROM quiz_cp_tbl WHERE quiz_id IN (?)`,
            [cpIds],
          ),
          db.query<RowDataPacket[]>(
            `SELECT quiz_id, step_order, prompt, template_code, expected_code
             FROM quiz_cp_step_tbl
             WHERE quiz_id IN (?)
             ORDER BY quiz_id, step_order ASC`,
            [cpIds],
          ),
        ]).then(([[cpRows], [stepRows]]) => {
          const stepsByQuiz = new Map<number, CPStepItem[]>();
          for (const s of stepRows) {
            const qId = Number(s.quiz_id);
            let list = stepsByQuiz.get(qId);
            if (!list) {
              list = [];
              stepsByQuiz.set(qId, list);
            }
            list.push({
              prompt: String(s.prompt ?? ""),
              template: s.template_code ?? "",
              expected: String(s.expected_code ?? ""),
            });
          }
          for (const c of cpRows) {
            const qId = Number(c.quiz_id);
            const steps = stepsByQuiz.get(qId) ?? [];
            cpMap.set(qId, {
              title: c.title,
              steps,
              prompts: steps.map((s) => s.prompt),
              prompt: steps[0]?.prompt ?? "",
              template: steps[0]?.template ?? "",
              expected: steps[0]?.expected ?? "",
            });
          }
        })
      : Promise.resolve(),
  ]);

  for (const q of quizzes) {
    if (
      q.quiz_payload &&
      typeof q.quiz_payload === "object" &&
      Object.keys(q.quiz_payload).length > 0
    ) {
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

export async function hydrateAssessmentsByUnitIds(
  unitIds: number[],
): Promise<Map<number, Record<string, unknown>>> {
  const result = new Map<number, Record<string, unknown>>();
  if (unitIds.length === 0) return result;

  const [assessments] = await db.query<RowDataPacket[]>(
    `SELECT assessment_id, unit_id, title, description, expected_outcome
     FROM unit_assessment_tbl
     WHERE unit_id IN (?)`,
    [unitIds],
  );
  if (assessments.length === 0) return result;

  const assessmentIds = assessments.map((a) => Number(a.assessment_id));
  const [steps] = await db.query<RowDataPacket[]>(
    `SELECT assessment_id, step_number, instruction, inherit_previous_code,
            starter_html, starter_css, starter_js,
            expected_html, expected_css, expected_js
     FROM assessment_step_tbl
     WHERE assessment_id IN (?)
     ORDER BY assessment_id, step_number ASC`,
    [assessmentIds],
  );

  const stepsByAssessment = new Map<number, RowDataPacket[]>();
  for (const st of steps) {
    const aId = Number(st.assessment_id);
    let list = stepsByAssessment.get(aId);
    if (!list) {
      list = [];
      stepsByAssessment.set(aId, list);
    }
    list.push(st);
  }

  for (const a of assessments) {
    const uId = Number(a.unit_id);
    const stList = stepsByAssessment.get(Number(a.assessment_id)) ?? [];
    result.set(uId, {
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

  return result;
}

export async function insertSlidesForUnit(
  connection: PoolConnection,
  unitId: number,
  lessonSlides: Array<ExtractedLessonSlidePayload | Record<string, unknown>>,
): Promise<void> {
  if (lessonSlides.length === 0) return;

  const values = lessonSlides.map((slide, i) => {
    const s = slide as Record<string, unknown>;
    return [
      unitId,
      i + 1,
      String(s.lesson_title ?? s.slide_title ?? s.title ?? ""),
      String(s.lesson_text ?? s.slide_text ?? s.text ?? ""),
      s.lesson_code ?? s.slide_code ?? s.code ?? null,
    ];
  });

  await connection.query(
    `INSERT INTO lesson_slide_tbl (unit_id, slide_order, slide_title, slide_text, slide_code)
     VALUES ?`,
    [values],
  );
}

export async function insertQuizSubtypePayload(
  connection: PoolConnection,
  quizId: number,
  quizTypeId: number,
  questionText: string,
  payload: QuizPayloadStructure,
): Promise<void> {
  if (quizTypeId === 1) {
    const options = Array.isArray(payload.options) ? payload.options : [];
    if (options.length === 0) return;
    const correctIdx = Number(payload.correct_index ?? 0);
    const values = options.map((opt, optIdx) => [
      quizId,
      optIdx,
      String(opt),
      optIdx === correctIdx ? 1 : 0,
    ]);
    await connection.query(
      `INSERT INTO quiz_mcq_option_tbl (quiz_id, option_index, option_text, is_correct) VALUES ?`,
      [values],
    );
  } else if (quizTypeId === 2) {
    const answer = String(payload.answer ?? payload.correct_answer ?? "");
    await connection.query(
      `INSERT INTO quiz_fitb_tbl (quiz_id, correct_answer) VALUES (?, ?)`,
      [quizId, answer],
    );
  } else if (quizTypeId === 3) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) return;
    const values = items.map((item, itemIdx) => [
      quizId,
      itemIdx + 1,
      String(item),
    ]);
    await connection.query(
      `INSERT INTO quiz_order_item_tbl (quiz_id, canonical_order, item_text) VALUES ?`,
      [values],
    );
  } else if (quizTypeId === 4) {
    const pairs = Array.isArray(payload.pairs) ? payload.pairs : [];
    if (pairs.length === 0) return;
    const values = pairs.map((p, pairIdx) => [
      quizId,
      pairIdx + 1,
      String(p?.left ?? ""),
      String(p?.right ?? ""),
    ]);
    await connection.query(
      `INSERT INTO quiz_pair_tbl (quiz_id, pair_order, left_text, right_text) VALUES ?`,
      [values],
    );
  } else if (quizTypeId === 5) {
    await connection.query(
      `INSERT INTO quiz_cp_tbl (quiz_id, title) VALUES (?, ?)`,
      [quizId, String(payload.title ?? questionText)],
    );
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    if (steps.length > 0) {
      const values = steps.map((s, sIdx) => [
        quizId,
        sIdx + 1,
        String(s?.prompt ?? ""),
        String(s?.template ?? ""),
        String(s?.expected ?? ""),
      ]);
      await connection.query(
        `INSERT INTO quiz_cp_step_tbl (quiz_id, step_order, prompt, template_code, expected_code) VALUES ?`,
        [values],
      );
    }
  }
}

export async function insertQuizzesForUnit(
  connection: PoolConnection,
  unitId: number,
  quizzes: Array<Record<string, unknown>>,
): Promise<void> {
  const [[typeRows], [diffRows]] = await Promise.all([
    connection.query<RowDataPacket[]>(
      "SELECT quiz_type_id, type_name FROM quiz_type_tbl",
    ),
    connection.query<RowDataPacket[]>(
      "SELECT difficulty_id, difficulty_name FROM difficulty_tbl",
    ),
  ]);
  const typeIdByName = new Map<string, number>(
    typeRows.map((t) => [String(t.type_name).toUpperCase(), Number(t.quiz_type_id)]),
  );
  const diffIdByName = new Map<string, number>(
    diffRows.map((d) => [
      String(d.difficulty_name).toLowerCase(),
      Number(d.difficulty_id),
    ]),
  );

  for (let i = 0; i < quizzes.length; i++) {
    const q = quizzes[i];
    if (!q || typeof q !== "object") continue;

    let quizTypeId = Number(q.quiz_type_id);
    if (!quizTypeId || Number.isNaN(quizTypeId)) {
      const typeStr = String(q.type_name ?? q.type ?? "").toUpperCase();
      quizTypeId = typeIdByName.get(typeStr) ?? 1;
    }

    let difficultyId = Number(q.difficulty_id);
    if (!difficultyId || Number.isNaN(difficultyId)) {
      const diffStr = String(
        q.difficulty_name ?? q.difficulty ?? "beginner",
      ).toLowerCase();
      difficultyId = diffIdByName.get(diffStr) ?? 1;
    }

    const questionText = String(q.question_text ?? "").trim() || "Quiz Question";
    const quizOrder = Number(q.quiz_order ?? i + 1);

    const [qResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO quiz_tbl (unit_id, difficulty_id, quiz_type_id, quiz_order, question_text)
       VALUES (?, ?, ?, ?, ?)`,
      [unitId, difficultyId, quizTypeId, quizOrder, questionText],
    );
    const quizId = qResult.insertId;

    const payload = (q.quiz_payload ?? {}) as QuizPayloadStructure;
    await insertQuizSubtypePayload(
      connection,
      quizId,
      quizTypeId,
      questionText,
      payload,
    );
  }
}

export async function insertAssessmentForUnit(
  connection: PoolConnection,
  unitId: number,
  assessmentCandidate: unknown,
  unitTitle: string,
): Promise<void> {
  if (!assessmentCandidate) return;

  // Skip redundant unwrap/Zod validation when already validated as schemaVersion 2 CodeProblemAssessment
  let unwrapped: CodeProblemAssessment | null = null;
  if (
    typeof assessmentCandidate === "object" &&
    assessmentCandidate !== null &&
    (assessmentCandidate as { schemaVersion?: unknown }).schemaVersion === 2 &&
    Array.isArray((assessmentCandidate as { steps?: unknown }).steps)
  ) {
    const directCheck = CodeProblemAssessmentSchema.safeParse(assessmentCandidate);
    if (directCheck.success) {
      unwrapped = directCheck.data;
    }
  }
  if (!unwrapped) {
    unwrapped = unwrapCodeProblemAssessment(assessmentCandidate, unitTitle);
  }
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

  const stepValues = unwrapped.steps.map((step) => [
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
  ]);

  await connection.query(
    `INSERT INTO assessment_step_tbl (
       assessment_id, step_number, instruction, inherit_previous_code,
       starter_html, starter_css, starter_js,
       expected_html, expected_css, expected_js
     ) VALUES ?`,
    [stepValues],
  );
}
