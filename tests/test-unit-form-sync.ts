import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseAssessmentBulkImport,
  parseAssessmentImport,
} from "../lib/assessment-json-import";
import { reconcileCategory, stampUnitFields } from "../lib/unit-form-sync";

// Mirrors the curriculum: HTML 1-3, CSS 4-7 & 13-14, JavaScript 8-12 & 15-16
const sections = [
  { sec_id: 1, cat_id: 1 },
  { sec_id: 2, cat_id: 1 },
  { sec_id: 3, cat_id: 1 },
  { sec_id: 4, cat_id: 2 },
  { sec_id: 8, cat_id: 3 },
  { sec_id: 99 }, // section with no category info
];

// Same projection QuizInputForm.handleSubmit applies before validating the import envelope
function buildSubmittedImport(
  assessment: unknown,
  batch: Array<Record<string, unknown>>,
) {
  return {
    unit_assessment_json: assessment,
    unit_quiz_json: batch.map((quiz) => ({
      cat_id: quiz.cat_id ?? 0,
      ...(quiz.sec_id == null ? {} : { sec_id: quiz.sec_id }),
      difficulty_id: quiz.difficulty_id ?? 0,
      quiz_type_id: Number(quiz.quiz_type_id ?? 0),
      question_text: quiz.question_text ?? "",
      quiz_payload: quiz.quiz_payload ?? {},
    })),
  };
}

function run() {
  console.log("Unit form sync & JSON import compatibility");

  // ---- reconcileCategory: the section is the source of truth -------------------------
  assert.equal(reconcileCategory(sections, "1", "2"), "1", "HTML section wins over CSS category");
  assert.equal(reconcileCategory(sections, "4", "1"), "2", "CSS section wins over HTML category");
  assert.equal(reconcileCategory(sections, "8", ""), "3", "JS section fills an empty category");
  assert.equal(reconcileCategory(sections, "", "2"), "2", "no section keeps category");
  assert.equal(reconcileCategory(sections, "12345", "2"), "2", "unknown section keeps category");
  assert.equal(reconcileCategory(sections, "99", "2"), "2", "section without cat_id keeps category");
  console.log("✔ reconcileCategory");

  // ---- stampUnitFields ----------------------------------------------------------------
  const base: Array<Record<string, unknown>> = [{ question_text: "q1" }, { question_text: "q2", cat_id: 1, sec_id: 1 }];
  const stamped = stampUnitFields(base, { catId: "3", secId: "8", unit: "2" });
  assert.deepEqual(
    stamped.map((q) => [q.cat_id, q.sec_id, q.unit]),
    [[3, 8, 2], [3, 8, 2]],
  );
  assert.equal(base[1].cat_id, 1, "input must not be mutated");
  const untouched = stampUnitFields(base, { catId: "", secId: "0", unit: null });
  assert.deepEqual(untouched, base, "empty/zero values leave entries untouched");
  console.log("✔ stampUnitFields");

  // ---- JSON import still validates as-is AND after stamping ---------------------------
  const exportPath = path.resolve(process.cwd(), "exports/quizweb-units-latest.json");
  assert.ok(fs.existsSync(exportPath), "exports/quizweb-units-latest.json must exist");
  const rawExport = JSON.parse(fs.readFileSync(exportPath, "utf8"));
  const unit98 = (rawExport.units as Array<{ unit_id: number }> | undefined)?.find((u) => u.unit_id === 98);
  assert.ok(unit98, "Unit 98 must exist in export");

  const imported = parseAssessmentImport(JSON.stringify(unit98));
  assert.equal(imported.success, true);
  if (!imported.success || imported.mode !== "full") throw new Error("Unit 98 should parse in full mode");
  const quizzes = imported.data.unit_quiz_json as Array<Record<string, unknown>>;

  const asIs = parseAssessmentBulkImport(
    JSON.stringify(buildSubmittedImport(imported.data.unit_assessment_json, quizzes)),
  );
  assert.equal(asIs.success, true, "unstamped import envelope must validate");

  for (const [catId, secId, unit] of [["1", "1", "1"], ["2", "4", "2"], ["3", "8", "3"]]) {
    const result = parseAssessmentBulkImport(
      JSON.stringify(
        buildSubmittedImport(
          imported.data.unit_assessment_json,
          stampUnitFields(quizzes, { catId, secId, unit }),
        ),
      ),
    );
    assert.equal(result.success, true, `stamped import (cat ${catId}, sec ${secId}) must validate`);
  }
  // Empty selection must not poison the strict schema (cat_id must stay positive)
  const emptyStamp = parseAssessmentBulkImport(
    JSON.stringify(
      buildSubmittedImport(
        imported.data.unit_assessment_json,
        stampUnitFields(quizzes, { catId: "", secId: "", unit: "" }),
      ),
    ),
  );
  assert.equal(emptyStamp.success, true, "empty-selection stamping must leave a valid import");
  console.log("✔ JSON import validates as-is and after stamping (Unit 98, 3 categories)");

  console.log("ALL UNIT FORM SYNC TESTS PASSED");
}

run();
