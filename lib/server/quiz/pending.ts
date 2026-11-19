import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import type { PendingUnit, QuizRow } from "@/lib/types/quiz";
import { populateQuizPayloads } from "./payload-hydrator";
import { fetchUnitByIdUncached } from "./queries";

export async function fetchPendingQuizzes(
  statusFilter = "pending",
): Promise<PendingUnit[]> {
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
        let list = quizzesByUnit.get(uId);
        if (!list) {
          list = [];
          quizzesByUnit.set(uId, list);
        }
        list.push(q);
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
        unit_lesson_card_json: {
          lesson_card: { lesson_format: row.lesson_format ?? "slides" },
        },
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

export async function fetchPendingQuizById(pendingId: number) {
  if (!Number.isInteger(pendingId) || pendingId < 1) {
    return { error: "A valid pending unit ID is required." };
  }
  const unit = await fetchUnitByIdUncached(pendingId);
  if (!unit) {
    return { error: "The pending unit was not found." };
  }
  const payload = unit.quiz_payload;
  return {
    pending_id: unit.unit_id,
    unit_id: unit.unit_id,
    unit_title: unit.question_text,
    sec_id: unit.sec_id,
    unit_order: unit.unit_order,
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

export async function reviewPendingQuizImpl(
  pendingId: number,
  decision: "approve" | "reject",
  rejectionNotes: string,
  onMutated: () => void,
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
      onMutated();
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
    onMutated();
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

export async function updatePendingNoteImpl(
  pendingId: number,
  pendingNote: string,
  onMutated: () => void,
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
    onMutated();
    return result.affectedRows === 0
      ? { error: "Only rejected quizzes can receive a note." }
      : { success: true };
  } catch (error) {
    console.error("Failed to update pending note:", error);
    return { error: "An error occurred while saving the note." };
  }
}
