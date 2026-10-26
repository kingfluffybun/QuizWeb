import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runTests() {
  console.log("=== RUNNING ENHANCEMENTS & MIGRATION TEST SUITE ===");
  const { getPaginatedRecentUnits, getQuizMetadata } = await import("../app/actions/quiz");
  const {
    getUserLastActiveProgress,
    getUserSectionProgress,
    recordLessonSlideProgress,
  } = await import("../app/actions/progress");
  const { db } = await import("../lib/db");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test Suite 1: Normalized Database & Legacy Translation Conformance
    // -------------------------------------------------------------
    console.log("\n[1] Verifying Translated Legacy Data & Normalized Relational Counts...");
    const [unitCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM unit_tbl");
    const unitCount = Number(unitCountRows[0].c);
    assert(unitCount >= 20, `unit_tbl has >= 20 records (actual: ${unitCount})`);

    const [slideCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM lesson_slide_tbl");
    const slideCount = Number(slideCountRows[0].c);
    assert(slideCount >= 150, `lesson_slide_tbl has >= 150 records (actual: ${slideCount})`);

    const [quizCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM quiz_tbl");
    const quizCount = Number(quizCountRows[0].c);
    assert(quizCount >= 250, `quiz_tbl has >= 250 records (actual: ${quizCount})`);

    const [mcqCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM quiz_mcq_option_tbl");
    assert(Number(mcqCountRows[0].c) >= 1000, `quiz_mcq_option_tbl has >= 1000 options (actual: ${mcqCountRows[0].c})`);

    const [fitbCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM quiz_fitb_tbl");
    assert(Number(fitbCountRows[0].c) >= 200, `quiz_fitb_tbl has >= 200 answers (actual: ${fitbCountRows[0].c})`);

    const [orderCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM quiz_order_item_tbl");
    assert(Number(orderCountRows[0].c) >= 500, `quiz_order_item_tbl has >= 500 items (actual: ${orderCountRows[0].c})`);

    const [pairCountRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM quiz_pair_tbl");
    assert(Number(pairCountRows[0].c) >= 400, `quiz_pair_tbl has >= 400 pairs (actual: ${pairCountRows[0].c})`);

    const [assessmentRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM unit_assessment_tbl");
    assert(Number(assessmentRows[0].c) >= 20, `unit_assessment_tbl has >= 20 assessments (actual: ${assessmentRows[0].c})`);

    const [userAuthRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM user_auth_tbl");
    assert(Number(userAuthRows[0].c) >= 23, `user_auth_tbl has >= 23 users (actual: ${userAuthRows[0].c})`);

    const [pendingRows] = await db.query<any[]>("SELECT COUNT(*) AS c FROM pending_tbl");
    assert(Number(pendingRows[0].c) >= 26, `pending_tbl has >= 26 submissions (actual: ${pendingRows[0].c})`);

    // -------------------------------------------------------------
    // Test Suite 2: getPaginatedRecentUnits (unit_tbl query & aggregation)
    // -------------------------------------------------------------
    console.log("\n[2] Verifying getPaginatedRecentUnits aggregation & pagination...");
    const paginatedUnits = await getPaginatedRecentUnits(1, 10);
    assert(paginatedUnits.units.length > 0, `Returned ${paginatedUnits.units.length} units`);
    assert(paginatedUnits.totalCount >= 20, `Total unit count is >= 20 (${paginatedUnits.totalCount})`);
    assert(paginatedUnits.totalPages >= 2, `Total pages is >= 2 (${paginatedUnits.totalPages})`);

    const firstUnit = paginatedUnits.units[0];
    assert(Boolean(firstUnit.unit_title), `First unit has title: "${firstUnit.unit_title}"`);
    assert(Boolean(firstUnit.cat_name), `First unit has category: "${firstUnit.cat_name}"`);
    assert(firstUnit.slide_count > 0, `First unit has aggregated slide_count > 0 (${firstUnit.slide_count})`);
    assert(firstUnit.question_count >= 0, `First unit has aggregated question_count >= 0 (${firstUnit.question_count})`);
    assert(Boolean(firstUnit.author_name), `First unit has resolved author_name: "${firstUnit.author_name}"`);
    assert(firstUnit.status === "approved" || firstUnit.status === "pending", `First unit has valid status: "${firstUnit.status}"`);

    const authorSearchUnits = await getPaginatedRecentUnits(1, 10, { search: firstUnit.author_name.split(" ")[0] });
    assert(authorSearchUnits.units.length > 0, `Author search finds units matching author name "${firstUnit.author_name.split(" ")[0]}"`);

    // -------------------------------------------------------------
    // Test Suite 3: Player Lesson Progress Tracking & 3NF Compliance
    // -------------------------------------------------------------
    console.log("\n[3] Verifying user_lesson_progress_tbl & progress actions...");
    // Use an isolated test user and canonical unlocked Unit 98 to test progress tracking
    const testUserId = 99991;
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testUserId]);
    await db.query("INSERT IGNORE INTO user_auth_tbl (user_id, email, password_hash) VALUES (?, 'enhancements_test@test.com', 'hash')", [testUserId]);
    await db.query("INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'enhancements_test', 1)", [testUserId]);

    const testUnitId = 98;
    const testUnitSlideCount = 7;
    const testUnitSecId = 1;

    // Step 3a: Record initial slide progress (slide 1)
    const recordResult1 = await recordLessonSlideProgress(testUnitId, 1, testUnitSlideCount, false, testUserId);
    assert(recordResult1.success === true, "recordLessonSlideProgress (slide 1) returned success");

    // Step 3b: Query last active progress
    const active1 = await getUserLastActiveProgress(testUserId);
    assert(active1 !== null, "getUserLastActiveProgress found active record");
    assert(active1?.unit_id === testUnitId, `active progress unit_id matches (${active1?.unit_id})`);
    assert(active1?.current_slide_order === 1, `active progress current_slide_order is 1 (${active1?.current_slide_order})`);
    assert(active1?.is_completed === false, "active progress is_completed is false");

    // Step 3c: Advance slide progress (slide 2)
    const recordResult2 = await recordLessonSlideProgress(testUnitId, 2, testUnitSlideCount, false, testUserId);
    assert(recordResult2.success === true, "recordLessonSlideProgress (slide 2) returned success");

    const active2 = await getUserLastActiveProgress(testUserId);
    assert(active2?.current_slide_order === 2, `active progress updated to slide 2 (${active2?.current_slide_order})`);

    // Step 3c-2: Edge case - Advance to final slide with isCompleted = false
    // Must NOT mark unit completed just because final slide was reached!
    const recordResultFinalSlide = await recordLessonSlideProgress(
      testUnitId,
      testUnitSlideCount,
      testUnitSlideCount,
      false,
      testUserId,
    );
    assert(recordResultFinalSlide.success === true, "recordLessonSlideProgress (final slide, incomplete) returned success");
    assert(recordResultFinalSlide.isCompleted === false, "recordLessonSlideProgress does not prematurely report completion");

    const activeFinalSlide = await getUserLastActiveProgress(testUserId);
    assert(activeFinalSlide?.current_slide_order === testUnitSlideCount, `active progress reaches slide ${testUnitSlideCount}`);
    assert(activeFinalSlide?.is_completed === false, "active progress is_completed remains false before explicit completion");
    assert(activeFinalSlide?.completed_at === null, "completed_at remains null before explicit completion");

    const sectionProgressIncomplete = await getUserSectionProgress(testUserId, testUnitSecId);
    const targetIncomplete = sectionProgressIncomplete.units.find((u) => u.unit_id === testUnitId);
    assert(targetIncomplete?.percentage === 99, `incomplete unit on last slide is capped at 99% until completed (${targetIncomplete?.percentage}%)`);

    // Step 3d: Complete unit progress explicitly
    const completeResult = await recordLessonSlideProgress(testUnitId, testUnitSlideCount, testUnitSlideCount, true, testUserId);
    assert(completeResult.success === true, "recordLessonSlideProgress (completed) returned success");

    const [dbCompleteRows] = await db.query<any[]>(
      "SELECT is_completed, completed_at FROM user_lesson_progress_tbl WHERE user_id = ? AND unit_id = ?",
      [testUserId, testUnitId]
    );
    assert(Number(dbCompleteRows[0]?.is_completed) === 1, "active progress is_completed is now true in database");
    assert(dbCompleteRows[0]?.completed_at !== null, `active progress has completed_at timestamp (${dbCompleteRows[0]?.completed_at})`);

    const active3 = await getUserLastActiveProgress(testUserId);
    assert(active3?.unit_id === 103, `after completing unit 98, active progress advances to unit 103 (${active3?.unit_id})`);
    assert(active3?.resume_type === "up_next", "active progress next unit has resume_type 'up_next'");

    // Step 3d-2: Reviewing an earlier slide retains is_completed = true
    const reviewResult = await recordLessonSlideProgress(testUnitId, 1, testUnitSlideCount, false, testUserId);
    assert(reviewResult.isCompleted === true, "reviewing earlier slide retains completed status in action result");
    const [dbReviewRows] = await db.query<any[]>(
      "SELECT is_completed, current_slide_order FROM user_lesson_progress_tbl WHERE user_id = ? AND unit_id = ?",
      [testUserId, testUnitId]
    );
    assert(Number(dbReviewRows[0]?.is_completed) === 1, "active progress is_completed stays true when reviewing earlier slide");
    assert(Number(dbReviewRows[0]?.current_slide_order) === 1, "active progress current_slide_order updates to review slide 1");

    // Step 3e: Section progress aggregation
    const sectionProgress = await getUserSectionProgress(testUserId, testUnitSecId);
    assert(sectionProgress.units.length > 0, `sectionProgress contains ${sectionProgress.units.length} units`);
    const targetUnitProgress = sectionProgress.units.find((u) => u.unit_id === testUnitId);
    assert(targetUnitProgress !== undefined, "sectionProgress includes test unit");
    assert(targetUnitProgress?.is_completed === true, "target unit is marked completed in sectionProgress");
    assert(targetUnitProgress?.percentage === 100, `target unit has 100% completion in sectionProgress (${targetUnitProgress?.percentage}%)`);
    assert(sectionProgress.completedUnits >= 1, `sectionProgress completedUnits >= 1 (${sectionProgress.completedUnits})`);

    // Clean up test record
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [testUserId]);
    console.log("  ✓ Cleaned up test lesson progress records and test user");

    // -------------------------------------------------------------
    // Test Suite 4: Strict Schema & 3NF Referential Integrity
    // -------------------------------------------------------------
    console.log("\n[4] Verifying 3NF Foreign Key Constraints on user_lesson_progress_tbl...");
    // Attempt inserting invalid foreign key user_id: 999999
    let fkFailed = false;
    try {
      await db.query(
        "INSERT INTO user_lesson_progress_tbl (user_id, unit_id, current_slide_order, total_slides) VALUES (999999, ?, 1, 5)",
        [testUnitId]
      );
    } catch (err: any) {
      if (err.message.includes("foreign key constraint") || err.code === "ER_NO_REFERENCED_ROW_2") {
        fkFailed = true;
      }
    }
    assert(fkFailed, "user_lesson_progress_tbl strictly rejects non-existent user_id foreign key (3NF enforcement)");

    // Attempt inserting invalid foreign key unit_id: 999999
    let unitFkFailed = false;
    try {
      await db.query(
        "INSERT INTO user_lesson_progress_tbl (user_id, unit_id, current_slide_order, total_slides) VALUES (?, 999999, 1, 5)",
        [testUserId]
      );
    } catch (err: any) {
      if (err.message.includes("foreign key constraint") || err.code === "ER_NO_REFERENCED_ROW_2") {
        unitFkFailed = true;
      }
    }
    assert(unitFkFailed, "user_lesson_progress_tbl strictly rejects non-existent unit_id foreign key (3NF enforcement)");

  } catch (error) {
    console.error("Test execution threw error:", error);
    failed++;
  } finally {
    // End the pool connection so the script exits cleanly
    await db.end();
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
