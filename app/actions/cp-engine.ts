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
 * Resolves the authoritative `CodeProblemAssessment` from `unit_assessment_tbl` and `assessment_step_tbl`.
 */
export async function resolveAuthoritativeAssessment(unitId?: number): Promise<{
  resolvedUnitId: number;
  unitTitle: string;
  assessment: CodeProblemAssessment;
} | null> {
  try {
    let assessmentRow: RowDataPacket | undefined;

    if (unitId && Number.isInteger(unitId) && unitId > 0) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT ua.assessment_id, ua.unit_id, ua.title, ua.description, ua.expected_outcome, u.unit_title
         FROM unit_assessment_tbl ua
         JOIN unit_tbl u ON ua.unit_id = u.unit_id
         WHERE ua.unit_id = ?
         LIMIT 1`,
        [unitId],
      );
      assessmentRow = rows[0];
    } else {
      // No unitId specified: find newest approved unit with an assessment
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT ua.assessment_id, ua.unit_id, ua.title, ua.description, ua.expected_outcome, u.unit_title
         FROM unit_assessment_tbl ua
         JOIN unit_tbl u ON ua.unit_id = u.unit_id
         WHERE u.status = 'approved'
         ORDER BY u.unit_id DESC
         LIMIT 1`,
      );
      assessmentRow = rows[0];
    }

    if (!assessmentRow) {
      return null;
    }

    const [steps] = await db.query<RowDataPacket[]>(
      `SELECT step_number, instruction, inherit_previous_code,
              starter_html, starter_css, starter_js,
              expected_html, expected_css, expected_js
       FROM assessment_step_tbl
       WHERE assessment_id = ?
       ORDER BY step_number ASC`,
      [assessmentRow.assessment_id],
    );

    if (!Array.isArray(steps) || steps.length === 0) {
      return null;
    }

    const unitTitle = String(assessmentRow.unit_title ?? assessmentRow.title ?? "Coding Assessment");
    const assessment: CodeProblemAssessment = {
      schemaVersion: 2,
      title: String(assessmentRow.title ?? unitTitle),
      description: String(assessmentRow.description ?? ""),
      expected_outcome: String(assessmentRow.expected_outcome ?? ""),
      steps: steps.map((s) => ({
        stepNumber: Number(s.step_number),
        instruction: String(s.instruction ?? ""),
        starterCode: {
          html: String(s.starter_html ?? ""),
          css: String(s.starter_css ?? ""),
          js: String(s.starter_js ?? ""),
        },
        expectedTemplate: {
          html: String(s.expected_html ?? ""),
          css: String(s.expected_css ?? ""),
          js: String(s.expected_js ?? ""),
        },
        inheritPreviousCode: Boolean(s.inherit_previous_code),
      })),
    };

    return {
      resolvedUnitId: Number(assessmentRow.unit_id),
      unitTitle,
      assessment,
    };
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
