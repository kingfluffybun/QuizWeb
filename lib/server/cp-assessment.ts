import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";
import type { CodeProblemAssessment, CPStep } from "@/lib/cp-schema";
import { createSafeCache } from "./cache";

export interface AuthoritativeAssessment {
  resolvedUnitId: number;
  unitTitle: string;
  assessment: CodeProblemAssessment;
}

function mapAssessmentSteps(stepRows: RowDataPacket[]): CPStep[] {
  return stepRows.map((s) => ({
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
  }));
}

async function fetchAuthoritativeAssessmentUncached(
  unitKey: number,
): Promise<AuthoritativeAssessment | null> {
  try {
    const query =
      unitKey > 0
        ? `SELECT ua.assessment_id, ua.unit_id, ua.title, ua.description, ua.expected_outcome, u.unit_title
           FROM unit_assessment_tbl ua
           JOIN unit_tbl u ON ua.unit_id = u.unit_id
           WHERE ua.unit_id = ?
           LIMIT 1`
        : `SELECT ua.assessment_id, ua.unit_id, ua.title, ua.description, ua.expected_outcome, u.unit_title
           FROM unit_assessment_tbl ua
           JOIN unit_tbl u ON ua.unit_id = u.unit_id
           WHERE u.status = 'approved'
           ORDER BY u.unit_id DESC
           LIMIT 1`;

    const [rows] = await db.query<RowDataPacket[]>(
      query,
      unitKey > 0 ? [unitKey] : [],
    );
    const assessmentRow = rows[0];
    if (!assessmentRow) return null;

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

    const unitTitle = String(
      assessmentRow.unit_title ?? assessmentRow.title ?? "Coding Assessment",
    );
    return {
      resolvedUnitId: Number(assessmentRow.unit_id),
      unitTitle,
      assessment: {
        schemaVersion: 2,
        title: String(assessmentRow.title ?? unitTitle),
        description: String(assessmentRow.description ?? ""),
        expected_outcome: String(assessmentRow.expected_outcome ?? ""),
        steps: mapAssessmentSteps(steps),
      },
    };
  } catch (error) {
    console.error("Failed to resolve authoritative coding assessment:", error);
    return null;
  }
}

const getCachedAuthoritativeAssessment = createSafeCache(
  fetchAuthoritativeAssessmentUncached,
  ["cp-authoritative-assessment"],
  { tags: ["curriculum"], revalidate: 3600 },
);

/**
 * Resolves the authoritative `CodeProblemAssessment` from `unit_assessment_tbl` and `assessment_step_tbl`.
 * Kept in a plain server module (not `"use server"`) so private `expectedTemplate` solutions
 * are never directly callable from the browser.
 */
export async function resolveAuthoritativeAssessment(
  unitId?: number,
): Promise<AuthoritativeAssessment | null> {
  const unitKey = unitId && Number.isInteger(unitId) && unitId > 0 ? unitId : 0;
  return getCachedAuthoritativeAssessment(unitKey);
}

/**
 * Batch-fetches authoritative coding assessments for multiple `unitIds` in 2 SQL queries.
 */
export async function resolveAuthoritativeAssessmentsByUnitIds(
  unitIds: number[],
): Promise<Map<number, AuthoritativeAssessment>> {
  const result = new Map<number, AuthoritativeAssessment>();
  const uniqueIds = Array.from(
    new Set(unitIds.filter((id) => Number.isInteger(id) && id > 0)),
  );
  if (uniqueIds.length === 0) return result;

  const [assessmentRows] = await db.query<RowDataPacket[]>(
    `SELECT ua.assessment_id, ua.unit_id, ua.title, ua.description, ua.expected_outcome, u.unit_title
     FROM unit_assessment_tbl ua
     JOIN unit_tbl u ON ua.unit_id = u.unit_id
     WHERE ua.unit_id IN (?)`,
    [uniqueIds],
  );

  if (!Array.isArray(assessmentRows) || assessmentRows.length === 0) {
    return result;
  }

  const assessmentIds = assessmentRows.map((r) => Number(r.assessment_id));
  const [stepRows] = await db.query<RowDataPacket[]>(
    `SELECT assessment_id, step_number, instruction, inherit_previous_code,
            starter_html, starter_css, starter_js,
            expected_html, expected_css, expected_js
     FROM assessment_step_tbl
     WHERE assessment_id IN (?)
     ORDER BY assessment_id ASC, step_number ASC`,
    [assessmentIds],
  );

  const stepsByAssessmentId = new Map<number, RowDataPacket[]>();
  for (const row of stepRows) {
    const aid = Number(row.assessment_id);
    const list = stepsByAssessmentId.get(aid) ?? [];
    list.push(row);
    stepsByAssessmentId.set(aid, list);
  }

  for (const row of assessmentRows) {
    const aid = Number(row.assessment_id);
    const unitId = Number(row.unit_id);
    const steps = stepsByAssessmentId.get(aid);
    if (!steps || steps.length === 0) continue;

    const unitTitle = String(row.unit_title ?? row.title ?? "Coding Assessment");
    result.set(unitId, {
      resolvedUnitId: unitId,
      unitTitle,
      assessment: {
        schemaVersion: 2,
        title: String(row.title ?? unitTitle),
        description: String(row.description ?? ""),
        expected_outcome: String(row.expected_outcome ?? ""),
        steps: mapAssessmentSteps(steps),
      },
    });
  }

  return result;
}
