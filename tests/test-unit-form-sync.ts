import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  extractLessonSlides,
  parseAssessmentBulkImport,
  parseAssessmentImport,
} from "../lib/assessment-json-import";
import {
  exportUnitToImportJson,
  reconcileCategory,
  stampUnitFields,
} from "../lib/unit-form-sync";

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

  // ---- exportUnitToImportJson: existing unit -> canonical JSON -> re-import ---------
  // Quizzes shaped like getUnitById rows (extra DB columns, null CP title, string payload)
  const dbQuizzes = [
    {
      quiz_id: 501, unit_id: 98, quiz_order: 1, cat_id: 1, sec_id: 1,
      difficulty_id: 1, quiz_type_id: 1, type_name: "MCQ", difficulty_name: "Easy",
      question_text: "Which tag starts an HTML document?",
      quiz_payload: { options: ["<html>", "<head>", "<body>", "<p>"], correct_index: 0 },
    },
    {
      quiz_id: 502, unit_id: 98, quiz_order: 2, cat_id: 1, sec_id: 1,
      difficulty_id: 2, quiz_type_id: 5, type_name: "CP",
      question_text: "Write a heading",
      quiz_payload: JSON.stringify({
        title: null,
        steps: [{ prompt: "Add an h1", template: "", expected: "<h1>Hi</h1>" }],
      }),
    },
  ];
  const exportSource = {
    unitTitle: "  Document Structure  ",
    secId: "4",
    catId: "2",
    lessonSlides: [
      { title: "Skeleton", text: "Every page has a skeleton.", code: "<html></html>" },
      { text: "Second slide without title or code." },
    ],
    assessment: {
      title: "Build a page",
      description: "Create a heading",
      steps: [
        {
          stepNumber: 1,
          instruction: "Add an h1",
          inheritPreviousCode: false,
          starterCode: { html: "", css: "", js: "" },
          expectedTemplate: { html: "<h1>####</h1>", css: "", js: "" },
          hint: undefined,
        },
      ],
      expectedOutcome: "<h1>Hello</h1>",
    },
    quizzes: dbQuizzes,
  };
  const exported = exportUnitToImportJson(exportSource);
  assert.equal(exported.unit_title, "Document Structure");
  assert.equal(exported.sec_id, 4);
  assert.deepEqual(
    exported.unit_quiz_json.map((q) => [q.cat_id, q.sec_id]),
    [[2, 4], [2, 4]],
    "unit category/section are stamped onto every exported quiz",
  );
  assert.ok(!("quiz_id" in exported.unit_quiz_json[0]), "DB-only columns are dropped");

  const reimported = parseAssessmentImport(JSON.stringify(exported, null, 2));
  if (!reimported.success) throw new Error(`export must re-import: ${reimported.errors.join(" | ")}`);
  assert.equal(reimported.mode, "full", "exported unit re-imports as a full unit");
  if (reimported.mode !== "full") throw new Error("unreachable");
  assert.equal(reimported.data.unit_title, "Document Structure");
  assert.equal(reimported.data.sec_id, 4);
  assert.equal(reimported.data.unit_quiz_json.length, 2);
  assert.equal(reimported.data.unit_quiz_json[1].question_text, "Write a heading");
  assert.equal(reimported.data.unit_assessment_json.steps.length, 1);
  assert.equal(reimported.data.unit_assessment_json.expected_outcome, "<h1>Hello</h1>");
  assert.deepEqual(extractLessonSlides(reimported.data.unit_lesson_card_json), [
    { title: "Skeleton", text: "Every page has a skeleton.", code: "<html></html>" },
    { text: "Second slide without title or code." },
  ]);

  // Re-exporting the re-imported data is stable (idempotent round trip)
  const reexported = exportUnitToImportJson({
    ...exportSource,
    unitTitle: reimported.data.unit_title ?? "",
    lessonSlides: extractLessonSlides(reimported.data.unit_lesson_card_json) ?? [],
    assessment: {
      title: reimported.data.unit_assessment_json.title,
      description: reimported.data.unit_assessment_json.description,
      steps: reimported.data.unit_assessment_json.steps,
      expectedOutcome: reimported.data.unit_assessment_json.expected_outcome,
    },
    quizzes: reimported.data.unit_quiz_json,
  });
  assert.deepEqual(reexported, exported, "export -> import -> export is stable");

  // The submit envelope built from the re-imported unit still validates
  const submitted = parseAssessmentBulkImport(
    JSON.stringify(
      buildSubmittedImport(
        reimported.data.unit_assessment_json,
        reimported.data.unit_quiz_json as Array<Record<string, unknown>>,
      ),
    ),
  );
  assert.equal(submitted.success, true, "submit envelope from re-imported unit must validate");

  // Real exported unit (Unit 98) also round-trips through the exporter
  const unit98Export = exportUnitToImportJson({
    unitTitle: imported.data.unit_title ?? "",
    secId: imported.data.sec_id ?? "",
    catId: "",
    lessonSlides: extractLessonSlides(imported.data.unit_lesson_card_json) ?? [],
    assessment: {
      title: imported.data.unit_assessment_json.title,
      description: imported.data.unit_assessment_json.description,
      steps: imported.data.unit_assessment_json.steps,
      expectedOutcome: imported.data.unit_assessment_json.expected_outcome,
    },
    quizzes: imported.data.unit_quiz_json,
  });
  const unit98Reimport = parseAssessmentImport(JSON.stringify(unit98Export));
  assert.equal(unit98Reimport.success, true, "Unit 98 export must re-import");
  if (unit98Reimport.success && unit98Reimport.mode === "full") {
    assert.equal(unit98Reimport.data.unit_quiz_json.length, imported.data.unit_quiz_json.length);
  } else {
    throw new Error("Unit 98 export should re-import in full mode");
  }
  console.log("✔ exportUnitToImportJson round-trips through Import JSON");

  console.log("ALL UNIT FORM SYNC TESTS PASSED");
}

run();
