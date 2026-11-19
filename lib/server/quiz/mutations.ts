import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/rbac";
import { getSessionContext } from "@/lib/server/session";
import type { QuizPayloadStructure } from "@/lib/types/quiz";
import {
  buildAssessmentFromForm,
  extractLessonSlidesFromForm,
  getQuizPayload,
  readAssessmentBulkImport,
  validateImportedQuestionReferences,
} from "./parsers";
import {
  insertAssessmentForUnit,
  insertQuizzesForUnit,
  insertQuizSubtypePayload,
  insertSlidesForUnit,
} from "./payload-hydrator";

export async function saveUnitImpl(
  formData: FormData,
  onMutated: () => void,
) {
  const staff = await requireStaff();
  if (!staff) {
    return {
      error: "Unauthorized: Maintainer or Administrator access required.",
    };
  }

  const sectionId = formData.get("sec_id") ?? formData.get("unit_sec_id");
  const sectionIdNumber = Number(sectionId);
  if (!Number.isInteger(sectionIdNumber) || sectionIdNumber < 1) {
    return { error: "A valid Section ID is required." };
  }
  const unitOrderNumber = Number(formData.get("unit_order") ?? 1);
  if (!Number.isInteger(unitOrderNumber) || unitOrderNumber < 1) {
    return { error: "A valid Unit order is required." };
  }

  const lessonTitle = String(formData.get("unit_title") ?? "").trim();
  const lessonSlides = extractLessonSlidesFromForm(formData);

  const imported = readAssessmentBulkImport(formData);
  if (imported.error) {
    return { error: `Bulk import is invalid: ${imported.error}` };
  }
  const builtAssessment = imported.data
    ? { assessment: imported.data.unit_assessment_json }
    : buildAssessmentFromForm(formData);
  if (builtAssessment.error) {
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
      return {
        error: "At least one quiz is required before submitting the unit.",
      };
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
    return {
      error: "At least one quiz is required before submitting the unit.",
    };
  }

  let authorId = staff.id ? Number(staff.id) : null;
  if (!authorId) {
    const ctx = await getSessionContext();
    if (ctx.userId) authorId = ctx.userId;
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
      `INSERT INTO unit_tbl (unit_title, sec_id, unit_order, author_id, lesson_format, status)
       VALUES (?, ?, ?, ?, 'slides', 'pending')`,
      [lessonTitle, sectionIdNumber, unitOrderNumber, authorId],
    );
    const newUnitId = unitResult.insertId;

    await insertSlidesForUnit(connection, newUnitId, lessonSlides);
    await insertQuizzesForUnit(
      connection,
      newUnitId,
      parsedQuizJson as Array<Record<string, unknown>>,
    );
    await insertAssessmentForUnit(
      connection,
      newUnitId,
      builtAssessment.assessment,
      lessonTitle,
    );

    await connection.commit();
    onMutated();

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

export async function updatePendingUnitFromFormImpl(
  pendingId: number,
  formData: FormData,
  onMutated: () => void,
) {
  const staff = await requireStaff();
  if (!staff) {
    return { error: "Unauthorized" };
  }
  const unitTitle = String(formData.get("unit_title") ?? "").trim();
  const sectionIdNumber = Number(formData.get("sec_id"));
  const unitOrderNumber = Number(formData.get("unit_order") ?? 1);
  const lessonSlides = extractLessonSlidesFromForm(formData);

  const imported = readAssessmentBulkImport(formData);
  if (imported.error) {
    return { error: `Bulk import is invalid: ${imported.error}` };
  }
  const builtAssessment = imported.data
    ? { assessment: imported.data.unit_assessment_json }
    : buildAssessmentFromForm(formData);
  if (builtAssessment.error) {
    return { error: builtAssessment.error };
  }
  const rawQuizJson = formData.get("quiz_json");

  if (
    !pendingId ||
    !unitTitle ||
    !Number.isInteger(sectionIdNumber) ||
    sectionIdNumber < 1 ||
    !Number.isInteger(unitOrderNumber) ||
    unitOrderNumber < 1 ||
    lessonSlides.length === 0 ||
    lessonSlides.some((slide) => !slide.lesson_text)
  ) {
    return {
      error: "Unit title, section, unit order, and lesson text are required.",
    };
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
       SET unit_title = ?, sec_id = ?, unit_order = ?,
           status = CASE WHEN status = 'rejected' THEN 'pending' ELSE status END,
           pending_note = CASE WHEN status = 'rejected' THEN NULL ELSE pending_note END,
           updated_at = CURRENT_TIMESTAMP
       WHERE unit_id = ?`,
      [unitTitle, sectionIdNumber, unitOrderNumber, pendingId],
    );

    if (unitUpdate.affectedRows === 0) {
      await connection.rollback();
      return { error: "Unit was not found." };
    }

    await connection.query("DELETE FROM lesson_slide_tbl WHERE unit_id = ?", [
      pendingId,
    ]);
    await insertSlidesForUnit(connection, pendingId, lessonSlides);

    await connection.query("DELETE FROM quiz_tbl WHERE unit_id = ?", [pendingId]);
    await insertQuizzesForUnit(
      connection,
      pendingId,
      quizzes as Array<Record<string, unknown>>,
    );

    await connection.query("DELETE FROM unit_assessment_tbl WHERE unit_id = ?", [
      pendingId,
    ]);
    await insertAssessmentForUnit(
      connection,
      pendingId,
      builtAssessment.assessment,
      unitTitle,
    );

    await connection.commit();
    onMutated();
    return { success: true, message: "Unit updated successfully." };
  } catch (error) {
    await connection.rollback();
    console.error("Failed to update unit:", error);
    return { error: "An error occurred while updating the pending unit." };
  } finally {
    connection.release();
  }
}

export async function deleteUnitImpl(unitId: number, onMutated: () => void) {
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
    onMutated();
    return { success: true };
  } catch (error) {
    console.error("Failed to delete unit:", error);
    return { error: "An error occurred while deleting the unit." };
  }
}

export async function deleteQuizImpl(quizId: number, onMutated: () => void) {
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
    onMutated();
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

export async function updateQuizImpl(
  quizId: number,
  formData: FormData,
  onMutated: () => void,
) {
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

      // Parallelize independent subtype table cleanups (quiz_cp_step_tbl cascades via FK from quiz_cp_tbl)
      await Promise.all([
        connection.query("DELETE FROM quiz_mcq_option_tbl WHERE quiz_id = ?", [quizId]),
        connection.query("DELETE FROM quiz_fitb_tbl WHERE quiz_id = ?", [quizId]),
        connection.query("DELETE FROM quiz_order_item_tbl WHERE quiz_id = ?", [quizId]),
        connection.query("DELETE FROM quiz_pair_tbl WHERE quiz_id = ?", [quizId]),
        connection.query("DELETE FROM quiz_cp_tbl WHERE quiz_id = ?", [quizId]),
      ]);

      await insertQuizSubtypePayload(
        connection,
        quizId,
        Number(quizTypeId),
        questionText.toString().trim(),
        (parsedPayload.payload ?? {}) as QuizPayloadStructure,
      );

      await connection.commit();
      onMutated();
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
