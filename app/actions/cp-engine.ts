"use server";

import { db } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import {
  CPFileBuffersSchema,
  toPublicCodeProblem,
  unwrapCodeProblemAssessment,
  type CodeProblemAssessment,
  type CPFileBuffers,
  type PublicCodeProblem,
} from "@/lib/cp-schema";
import {
  validateCodeProblemStep,
  type StepValidationResult,
} from "@/lib/cp-validator";

function parseRawJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Resolves the authoritative `CodeProblemAssessment` from `unit_tbl` / `pending_tbl` on the server.
 */
async function resolveAuthoritativeAssessment(unitId?: number): Promise<{
  resolvedUnitId: number;
  unitTitle: string;
  assessment: CodeProblemAssessment;
} | null> {
  try {
    if (unitId && Number.isInteger(unitId) && unitId > 0) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT u.unit_id, p.pending_id,
                COALESCE(u.unit_title, p.unit_title) AS unit_title,
                COALESCE(u.unit_assessment_json, p.unit_assessment_json) AS unit_assessment_json,
                COALESCE(u.unit_quiz_json, p.unit_quiz_json) AS unit_quiz_json
         FROM unit_tbl u
         LEFT JOIN unit_approved_tbl a ON a.unit_id = u.unit_id
         LEFT JOIN pending_tbl p ON p.pending_id = a.pending_id
         WHERE u.unit_id = ? OR p.pending_id = ?
         LIMIT 1`,
        [unitId, unitId],
      );

      let row = rows[0];
      if (!row) {
        const [pendingRows] = await db.query<RowDataPacket[]>(
          `SELECT p.pending_id AS unit_id, p.unit_title,
                  p.unit_assessment_json, p.unit_quiz_json
           FROM pending_tbl p
           WHERE p.pending_id = ?
           LIMIT 1`,
          [unitId],
        );
        row = pendingRows[0];
      }

      if (row) {
        const unitTitle = String(row.unit_title ?? "Coding Assessment");
        const unwrapped = unwrapCodeProblemAssessment(
          row.unit_assessment_json,
          unitTitle,
        );
        if (unwrapped && unwrapped.steps.length > 0) {
          return {
            resolvedUnitId: Number(row.unit_id ?? row.pending_id ?? unitId),
            unitTitle,
            assessment: unwrapped,
          };
        }

        // Fallback: check if legacy CP quiz exists inside unit_quiz_json
        const quizzes = parseRawJson(row.unit_quiz_json);
        if (Array.isArray(quizzes)) {
          for (const q of quizzes) {
            if (q && typeof q === "object" && "quiz_payload" in q) {
              const fromQuiz = unwrapCodeProblemAssessment(
                (q as { quiz_payload: unknown }).quiz_payload,
                unitTitle,
              );
              if (fromQuiz && fromQuiz.steps.length > 0) {
                return {
                  resolvedUnitId: Number(
                    row.unit_id ?? row.pending_id ?? unitId,
                  ),
                  unitTitle,
                  assessment: fromQuiz,
                };
              }
            }
          }
        }
      }
      return null;
    }

    // No unitId specified: find the newest approved unit with a valid Code Problem assessment
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.unit_assessment_json, u.unit_quiz_json
       FROM unit_approved_tbl a
       JOIN pending_tbl p ON p.pending_id = a.pending_id
       JOIN unit_tbl u ON u.unit_id = a.unit_id
       WHERE p.pending_status = 'approved'
       ORDER BY u.unit_id DESC`,
    );

    for (const row of rows) {
      const unitTitle = String(row.unit_title ?? "Coding Assessment");
      const unwrapped = unwrapCodeProblemAssessment(
        row.unit_assessment_json,
        unitTitle,
      );
      if (unwrapped && unwrapped.steps.length > 0) {
        return {
          resolvedUnitId: Number(row.unit_id),
          unitTitle,
          assessment: unwrapped,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to resolve authoritative coding assessment:", error);
    return null;
  }
}

/**
 * Fetches the public Code Problem definition for `/quiz-cp`, stripping all `expectedTemplate` fields
 * so answers are never exposed in the browser network tab.
 */
export async function getPublicCodeProblem(
  unitId?: number,
): Promise<PublicCodeProblem | null> {
  const resolved = await resolveAuthoritativeAssessment(unitId);
  if (!resolved) return null;

  return toPublicCodeProblem(
    resolved.resolvedUnitId,
    resolved.unitTitle,
    resolved.assessment,
  );
}

/**
 * Server Action that grades a student's `{ html, css, js }` buffers for `stepIndex`
 * against the private `expectedTemplate` stored in MySQL.
 */
export async function verifyCodeProblemStep(input: {
  unitId: number;
  stepIndex: number;
  studentCode: CPFileBuffers;
}): Promise<
  StepValidationResult & {
    isFinalStep: boolean;
    nextStepIndex: number;
    totalSteps: number;
  }
> {
  const parsedBuffers = CPFileBuffersSchema.safeParse(input?.studentCode);
  if (!parsedBuffers.success) {
    return {
      passed: false,
      message: "Invalid code submission payload.",
      isFinalStep: false,
      nextStepIndex: input?.stepIndex ?? 0,
      totalSteps: 0,
      tabResults: {} as StepValidationResult["tabResults"],
    };
  }

  const resolved = await resolveAuthoritativeAssessment(input.unitId);
  if (!resolved) {
    return {
      passed: false,
      message: "Coding assessment was not found for this unit.",
      isFinalStep: false,
      nextStepIndex: 0,
      totalSteps: 0,
      tabResults: {} as StepValidationResult["tabResults"],
    };
  }

  const { steps } = resolved.assessment;
  const stepIndex = Number(input.stepIndex);
  if (
    !Number.isInteger(stepIndex) ||
    stepIndex < 0 ||
    stepIndex >= steps.length
  ) {
    return {
      passed: false,
      message: "Invalid assessment step number.",
      isFinalStep: false,
      nextStepIndex: 0,
      totalSteps: steps.length,
      tabResults: {} as StepValidationResult["tabResults"],
    };
  }

  const targetStep = steps[stepIndex];
  const result = validateCodeProblemStep(
    parsedBuffers.data,
    targetStep.expectedTemplate,
  );

  const isFinalStep = stepIndex === steps.length - 1;
  return {
    ...result,
    isFinalStep,
    nextStepIndex: result.passed && !isFinalStep ? stepIndex + 1 : stepIndex,
    totalSteps: steps.length,
  };
}
