import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import "./env-loader";
import { parseAssessmentImport, extractLessonSlides } from "../lib/assessment-json-import";
import { db } from "../lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

async function runMaintainerJsonImportTest() {
  console.log("================================================================================");
  console.log(" Maintainer JSON Input & 10-Table Separation Test Suite");
  console.log("================================================================================");

  // Set mock staff authentication for saveUnit and deleteUnit
  (globalThis as any).__TEST_AUTH_SESSION__ = {
    user: { id: "4", role: "admin", user_role: "admin", email: "clarence.luna651@gmail.com" },
  };

  const { saveUnit, deleteUnit } = await import("../app/actions/quiz");

  let createdUnitId: number | null = null;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Load Unit 98 from exports/quizweb-units-latest.json
    // -------------------------------------------------------------------------
    console.log("\n[Step 1] Loading exported Unit 98...");
    const exportPath = path.resolve(process.cwd(), "exports/quizweb-units-latest.json");
    assert.ok(fs.existsSync(exportPath), "exports/quizweb-units-latest.json must exist");

    const rawExport = JSON.parse(fs.readFileSync(exportPath, "utf8"));
    const unit98 = rawExport.units?.find((u: any) => u.unit_id === 98);
    assert.ok(unit98, "Unit 98 must be present in exported units");
    console.log(`✔ Found Unit 98: "${unit98.unit_title}" with ${unit98.unit_quiz_json?.length} quizzes`);

    // -------------------------------------------------------------------------
    // Step 2: Validate parseAssessmentImport on Unit 98
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Passing Unit 98 through parseAssessmentImport()...");
    const importResult = parseAssessmentImport(JSON.stringify(unit98));
    assert.equal(importResult.success, true, "parseAssessmentImport must succeed on Unit 98");
    if (!importResult.success) {
      throw new Error(`Parse failed: ${importResult.errors.join(", ")}`);
    }

    assert.equal(importResult.mode, "full", "Mode must be 'full'");
    assert.equal(importResult.data.unit_title, "Document Structure");
    assert.equal(importResult.data.sec_id, 1);
    assert.equal(importResult.data.unit_quiz_json.length, 9, "Expected 9 quizzes");
    assert.equal(importResult.data.unit_assessment_json.steps.length, 5, "Expected 5 assessment steps");
    console.log(`✔ parseAssessmentImport verified with 0 errors: title="${importResult.data.unit_title}", quizzes=${importResult.data.unit_quiz_json.length}, steps=${importResult.data.unit_assessment_json.steps.length}`);

    // -------------------------------------------------------------------------
    // Step 2b: Verify schema edge cases
    // -------------------------------------------------------------------------
    console.log("\n[Step 2b] Verifying schema edge cases (2-pair questions, export envelopes, cp_steps adaptation)...");

    // Test 1: Full export envelope unwrapping
    const envelopeResult = parseAssessmentImport(JSON.stringify(rawExport));
    assert.equal(envelopeResult.success, true, "Full export envelope should unwrap cleanly");

    // Test 2: Unit array unwrapping
    const arrayResult = parseAssessmentImport(JSON.stringify([unit98]));
    assert.equal(arrayResult.success, true, "Unit array should unwrap cleanly");

    // Test 3: 2-pair question validation
    const twoPairUnit = {
      unit_title: "2-Pair Test Unit",
      sec_id: "1",
      unit_assessment_json: {
        title: "Test Assessment",
        description: "Test description",
        steps: ["Step 1 instruction"],
      },
      unit_quiz_json: [
        {
          cat_id: 1,
          difficulty_id: 1,
          quiz_type_id: 4,
          question_text: "Match the two pairs",
          quiz_payload: {
            pairs: [
              { left: "A", right: "1" },
              { left: "B", right: "2" },
            ],
          },
          author_id: 4,
          status: "approved",
        },
      ],
    };
    const twoPairResult = parseAssessmentImport(JSON.stringify(twoPairUnit));
    assert.equal(twoPairResult.success, true, "2-pair unit with quiz export metadata should validate");

    // Test 4: cp_steps with { prompt, template, expected } and omitted stepNumber
    const cpStepsUnit = {
      unit_title: "CP Steps Test Unit",
      sec_id: 1,
      unit_assessment_json: {
        title: "CP Assessment",
        description: "CP description",
        status: "approved",
        unit_id: 999,
        assessment_id: 888,
        cp_steps: [
          {
            prompt: "Step 1 Prompt",
            template: "<div></div>",
            expected: "<div><h1>Hello</h1></div>",
          },
          {
            prompt: "Step 2 Prompt",
            template: "<div><h1>Hello</h1></div>",
            expected: "<div><h1>Hello</h1><p>World</p></div>",
          },
        ],
      },
      unit_quiz_json: [
        {
          cat_id: 1,
          difficulty_id: 1,
          quiz_type_id: 1,
          question_text: "Sample MCQ",
          quiz_payload: {
            options: ["A", "B", "C", "D"],
            correct_index: 0,
          },
        },
      ],
    };
    const cpStepsResult = parseAssessmentImport(JSON.stringify(cpStepsUnit));
    assert.equal(cpStepsResult.success, true, "cp_steps with prompt/template/expected and auto-numbering must succeed");
    if (cpStepsResult.success && cpStepsResult.mode === "full") {
      assert.equal(cpStepsResult.data.unit_assessment_json.steps.length, 2);
      assert.equal(cpStepsResult.data.unit_assessment_json.steps[0].stepNumber, 1);
      assert.equal(cpStepsResult.data.unit_assessment_json.steps[1].stepNumber, 2);
      assert.equal(cpStepsResult.data.unit_assessment_json.steps[0].instruction, "Step 1 Prompt");
    }
    console.log("✔ Schema edge cases verified: 2-pair quiz, export envelopes, cp_steps adaptation, auto-numbering, and export metadata tolerance");

    // -------------------------------------------------------------------------
    // Step 3: Verify slide extraction from unit_lesson_card_json
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Verifying extractLessonSlides()...");
    const extractedSlides = extractLessonSlides(unit98.unit_lesson_card_json);
    assert.ok(extractedSlides && extractedSlides.length === 6, "Expected 6 lesson slides extracted");
    assert.equal(extractedSlides[0].title, "Basic HTML Skeletons");
    assert.ok(extractedSlides[0].text.length > 0);
    assert.ok(extractedSlides[0].code && extractedSlides[0].code.includes("<!DOCTYPE html>"));
    console.log(`✔ extractLessonSlides verified: extracted ${extractedSlides.length} slides with title, text, and code`);

    // -------------------------------------------------------------------------
    // Step 4: Construct FormData and submit unit via saveUnit()
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Submitting imported unit via saveUnit()...");
    const formData = new FormData();
    const testTitle = `Document Structure [Import Test ${Date.now()}]`;
    formData.set("unit_title", testTitle);
    formData.set("sec_id", "1");

    extractedSlides.forEach((slide, idx) => {
      formData.set(`lesson_text_${idx}`, slide.text);
      if (slide.title) formData.set(`lesson_title_${idx}`, slide.title);
      if (slide.code) formData.set(`lesson_code_${idx}`, slide.code);
    });

    // Unit 98 has types 1 (MCQ), 2 (FITB), 3 (Order), 4 (Pair - including 3 pairs).
    // Append a type 5 (Coding Problem) quiz to test all 5 quiz types and all 10 DB tables.
    const cpQuizEntry = {
      cat_id: 1,
      sec_id: 1,
      difficulty_id: 1,
      quiz_type_id: 5,
      question_text: "Add an HTML paragraph element",
      quiz_payload: {
        title: "Paragraph Element Test",
        steps: [
          {
            prompt: "Add a paragraph tag with text",
            template: "<main>\n  \n</main>",
            expected: "<main>\n  <p>Hello World</p>\n</main>",
          },
        ],
      },
    };

    const allQuizzes = [...importResult.data.unit_quiz_json, cpQuizEntry];

    const bulkPayload = {
      unit_assessment_json: importResult.data.unit_assessment_json,
      unit_quiz_json: allQuizzes,
    };
    formData.set("assessment_bulk_import", JSON.stringify(bulkPayload));

    const saveResult = await saveUnit(null, formData);
    assert.ok(!saveResult.error, `saveUnit failed: ${saveResult.error}`);
    assert.equal(saveResult.success, true);
    assert.ok(saveResult.unitId && saveResult.unitId > 0, "saveUnit must return new unitId");
    createdUnitId = saveResult.unitId;
    console.log(`✔ saveUnit successful! Created Unit ID: ${createdUnitId}`);

    // -------------------------------------------------------------------------
    // Step 5: Verify separation across all 10 normalized tables
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Verifying database records across all 10 normalized tables...");

    // 1. unit_tbl
    const [unitRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM unit_tbl WHERE unit_id = ?",
      [createdUnitId],
    );
    assert.equal(unitRows.length, 1, "Table 1 (unit_tbl): unit record must exist");
    assert.equal(unitRows[0].unit_title, testTitle);
    assert.equal(unitRows[0].sec_id, 1);
    assert.equal(unitRows[0].status, "pending");
    console.log("  ✔ Table 1: unit_tbl verified (id, title, sec_id, status='pending')");

    // 2. lesson_slide_tbl
    const [slideRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM lesson_slide_tbl WHERE unit_id = ? ORDER BY slide_order ASC",
      [createdUnitId],
    );
    assert.equal(slideRows.length, 6, "Table 2 (lesson_slide_tbl): 6 slides must exist");
    assert.equal(slideRows[0].slide_title, "Basic HTML Skeletons");
    assert.equal(slideRows[5].slide_title, "The Title tag");
    console.log(`  ✔ Table 2: lesson_slide_tbl verified (${slideRows.length} slides ordered 1..6)`);

    // 3. quiz_tbl
    const [quizRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM quiz_tbl WHERE unit_id = ? ORDER BY quiz_order ASC",
      [createdUnitId],
    );
    assert.equal(quizRows.length, 10, "Table 3 (quiz_tbl): 10 quizzes must exist");
    console.log(`  ✔ Table 3: quiz_tbl verified (${quizRows.length} quizzes linked to unit)`);

    // 4. quiz_mcq_option_tbl
    const [mcqRows] = await db.query<RowDataPacket[]>(
      `SELECT o.* FROM quiz_mcq_option_tbl o
       JOIN quiz_tbl q ON o.quiz_id = q.quiz_id
       WHERE q.unit_id = ?`,
      [createdUnitId],
    );
    assert.ok(mcqRows.length >= 16, "Table 4 (quiz_mcq_option_tbl): options must exist for MCQ quizzes");
    assert.ok(mcqRows.some((o) => o.is_correct === 1), "At least one option must have is_correct=1");
    console.log(`  ✔ Table 4: quiz_mcq_option_tbl verified (${mcqRows.length} options separated)`);

    // 5. quiz_fitb_tbl
    const [fitbRows] = await db.query<RowDataPacket[]>(
      `SELECT f.* FROM quiz_fitb_tbl f
       JOIN quiz_tbl q ON f.quiz_id = q.quiz_id
       WHERE q.unit_id = ?`,
      [createdUnitId],
    );
    assert.equal(fitbRows.length, 2, "Table 5 (quiz_fitb_tbl): 2 FITB answers must exist");
    assert.ok(fitbRows[0].correct_answer.length > 0, "FITB answer must not be empty");
    console.log(`  ✔ Table 5: quiz_fitb_tbl verified (${fitbRows.length} FITB answers stored)`);

    // 6. quiz_order_item_tbl
    const [orderRows] = await db.query<RowDataPacket[]>(
      `SELECT ord.* FROM quiz_order_item_tbl ord
       JOIN quiz_tbl q ON ord.quiz_id = q.quiz_id
       WHERE q.unit_id = ?`,
      [createdUnitId],
    );
    assert.ok(orderRows.length >= 4, "Table 6 (quiz_order_item_tbl): order items must exist");
    assert.ok(orderRows[0].canonical_order >= 1, "Order items must have canonical_order");
    console.log(`  ✔ Table 6: quiz_order_item_tbl verified (${orderRows.length} order items stored)`);

    // 7. quiz_pair_tbl
    const [pairRows] = await db.query<RowDataPacket[]>(
      `SELECT p.* FROM quiz_pair_tbl p
       JOIN quiz_tbl q ON p.quiz_id = q.quiz_id
       WHERE q.unit_id = ?`,
      [createdUnitId],
    );
    // Unit 98 has two pair quizzes: one with 4 pairs, one with 3 pairs (total 7 pairs)
    assert.equal(pairRows.length, 7, "Table 7 (quiz_pair_tbl): 7 total pairs must exist (4 + 3)");
    assert.ok(pairRows[0].left_text && pairRows[0].right_text, "Pairs must have left_text and right_text");
    console.log(`  ✔ Table 7: quiz_pair_tbl verified (${pairRows.length} pairs, including 3-pair quiz)`);

    // 8. quiz_cp_tbl & quiz_cp_step_tbl
    const [cpRows] = await db.query<RowDataPacket[]>(
      `SELECT cp.* FROM quiz_cp_tbl cp
       JOIN quiz_tbl q ON cp.quiz_id = q.quiz_id
       WHERE q.unit_id = ?`,
      [createdUnitId],
    );
    const [cpStepRows] = await db.query<RowDataPacket[]>(
      `SELECT cps.* FROM quiz_cp_step_tbl cps
       JOIN quiz_tbl q ON cps.quiz_id = q.quiz_id
       WHERE q.unit_id = ?`,
      [createdUnitId],
    );
    assert.equal(cpRows.length, 1, "Table 8a (quiz_cp_tbl): 1 CP quiz record must exist");
    assert.equal(cpStepRows.length, 1, "Table 8b (quiz_cp_step_tbl): 1 CP step record must exist");
    assert.equal(cpStepRows[0].prompt, "Add a paragraph tag with text");
    console.log(`  ✔ Table 8: quiz_cp_tbl & quiz_cp_step_tbl verified (coding problem quiz separated)`);

    // 9. unit_assessment_tbl
    const [assessmentRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM unit_assessment_tbl WHERE unit_id = ?",
      [createdUnitId],
    );
    assert.equal(assessmentRows.length, 1, "Table 9 (unit_assessment_tbl): assessment record must exist");
    assert.equal(assessmentRows[0].title, "Unit 1 Assessment");
    assert.ok(assessmentRows[0].expected_outcome.includes("<!doctype html>"), "Expected outcome must be stored");
    const assessmentId = assessmentRows[0].assessment_id;
    console.log(`  ✔ Table 9: unit_assessment_tbl verified (assessment_id=${assessmentId}, title="${assessmentRows[0].title}")`);

    // 10. assessment_step_tbl
    const [stepRows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM assessment_step_tbl WHERE assessment_id = ? ORDER BY step_number ASC",
      [assessmentId],
    );
    assert.equal(stepRows.length, 5, "Table 10 (assessment_step_tbl): 5 assessment steps must exist");
    assert.equal(stepRows[0].step_number, 1);
    assert.equal(stepRows[0].instruction, "Add the Document Type");
    assert.equal(stepRows[4].step_number, 5);
    assert.equal(stepRows[4].instruction, "Add the Title element");
    console.log(`  ✔ Table 10: assessment_step_tbl verified (${stepRows.length} sequential assessment steps with HTML templates)`);

    console.log("\n================================================================================");
    console.log(" ALL 10 NORMALIZED TABLES VERIFIED WITH 100% SEPARATION INTEGRITY!");
    console.log("================================================================================");
  } finally {
    // -------------------------------------------------------------------------
    // Step 6: Cleanup test unit
    // -------------------------------------------------------------------------
    if (createdUnitId) {
      console.log(`\n[Cleanup] Deleting test unit ${createdUnitId}...`);
      await deleteUnit(createdUnitId);
      const [remaining] = await db.query<RowDataPacket[]>(
        "SELECT unit_id FROM unit_tbl WHERE unit_id = ?",
        [createdUnitId],
      );
      assert.equal(remaining.length, 0, "Test unit must be deleted from DB");
      console.log("✔ Test unit successfully deleted and DB cleaned up.");
    }
    (globalThis as any).__TEST_AUTH_SESSION__ = undefined;
  }
}

runMaintainerJsonImportTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
