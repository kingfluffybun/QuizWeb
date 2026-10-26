import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runTests() {
  console.log("=== RUNNING UNIT PASS & COMPLETION VERIFICATION SUITE ===");
  const { db } = await import("../lib/db");
  const {
    recordLessonSlideProgress,
    getUserCurriculumUnlockState,
    getUserSectionProgress,
    getUserLastActiveProgress,
  } = await import("../app/actions/progress");

  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const testUserId = 99990;

  try {
    // -------------------------------------------------------------
    // Test 1: Setup isolated test user on Section 1
    // -------------------------------------------------------------
    console.log("\n[1] Setting up isolated test user...");
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testUserId]);
    await db.query("INSERT IGNORE INTO user_auth_tbl (user_id, email, password_hash) VALUES (?, 'pass_test@test.com', 'hash')", [testUserId]);
    await db.query("INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'pass_test_user', 1)", [testUserId]);

    // Initial state: Unit 98 unlocked, 0 completed
    const initialUnlock = await getUserCurriculumUnlockState(testUserId);
    testAssert(initialUnlock.unlockedUnitIds.has(98), "Unit 98 is unlocked initially");
    testAssert(!initialUnlock.unlockedUnitIds.has(103), "Unit 103 is locked initially");
    testAssert(initialUnlock.completedUnitIds.size === 0, "No units completed initially");

    // -------------------------------------------------------------
    // Test 2: Incomplete slide progress does NOT mark unit complete
    // -------------------------------------------------------------
    console.log("\n[2] Verifying incomplete slide progress does NOT mark unit complete...");
    // Slide 3 of 7 with isCompleted = false
    const progressMid = await recordLessonSlideProgress(98, 3, 7, false, testUserId);
    testAssert(progressMid.success === true, "recordLessonSlideProgress (slide 3) succeeded");
    testAssert(progressMid.isCompleted === false, "Action result reports isCompleted = false");

    const unlockMid = await getUserCurriculumUnlockState(testUserId);
    testAssert(!unlockMid.completedUnitIds.has(98), "Unit 98 is NOT in completedUnitIds");
    testAssert(!unlockMid.unlockedUnitIds.has(103), "Next unit 103 remains strictly LOCKED");

    const secProgMid = await getUserSectionProgress(testUserId, 1);
    const unit98Mid = secProgMid.units.find((u) => u.unit_id === 98);
    testAssert(unit98Mid?.is_completed === false, "Unit 98 is_completed is false in section progress");
    testAssert(unit98Mid?.percentage === 43, `Unit 98 percentage is partial (actual: ${unit98Mid?.percentage}%)`);

    // Advance to final slide 7 of 7 with isCompleted = false (e.g. read all slides, but hasn't passed quiz!)
    const progressFinalSlide = await recordLessonSlideProgress(98, 7, 7, false, testUserId);
    testAssert(progressFinalSlide.isCompleted === false, "Reaching final slide with isCompleted = false does not complete unit");

    const unlockFinalSlide = await getUserCurriculumUnlockState(testUserId);
    testAssert(!unlockFinalSlide.completedUnitIds.has(98), "Unit 98 is STILL not in completedUnitIds on final slide");
    testAssert(!unlockFinalSlide.unlockedUnitIds.has(103), "Unit 103 remains strictly LOCKED on final slide without quiz completion");

    const secProgFinalSlide = await getUserSectionProgress(testUserId, 1);
    const unit98Final = secProgFinalSlide.units.find((u) => u.unit_id === 98);
    testAssert(unit98Final?.is_completed === false, "Unit 98 is_completed remains false");
    testAssert(unit98Final?.percentage === 99, `Unit 98 percentage is capped at 99% before passing quiz (${unit98Final?.percentage}%)`);

    // -------------------------------------------------------------
    // Test 3: Actual Quiz Passing marks unit completed and unlocks strictly next unit
    // -------------------------------------------------------------
    console.log("\n[3] Verifying explicit completion unlocks strictly next unit...");
    const progressCompleted = await recordLessonSlideProgress(98, 7, 7, true, testUserId);
    testAssert(progressCompleted.success === true, "recordLessonSlideProgress (isCompleted = true) succeeded");
    testAssert(progressCompleted.isCompleted === true, "Action result reports isCompleted = true");

    const unlockPassed = await getUserCurriculumUnlockState(testUserId);
    testAssert(unlockPassed.completedUnitIds.has(98), "Unit 98 is now recorded in completedUnitIds");
    testAssert(unlockPassed.unlockedUnitIds.has(103), "Next unit 103 is now strictly UNLOCKED");
    testAssert(!unlockPassed.unlockedUnitIds.has(105), "Section 2 Unit 105 remains locked");

    const secProgPassed = await getUserSectionProgress(testUserId, 1);
    const unit98Passed = secProgPassed.units.find((u) => u.unit_id === 98);
    testAssert(unit98Passed?.is_completed === true, "Unit 98 is_completed is true in section progress");
    testAssert(unit98Passed?.percentage === 100, "Unit 98 percentage is 100%");

    // -------------------------------------------------------------
    // Test 4: Verifying LearnUnitsClient has NO Code Problem button
    // -------------------------------------------------------------
    console.log("\n[4] Verifying LearnUnitsClient.tsx source code conformance...");
    const learnClientSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/learn/LearnUnitsClient.tsx"),
      "utf-8"
    );
    testAssert(
      !learnClientSource.includes("available-unit-cp-link"),
      "available-unit-cp-link is completely removed from LearnUnitsClient.tsx"
    );
    testAssert(
      !learnClientSource.includes('href={`/quiz-cp?unitId=${unit.pending_id}`}'),
      "No direct /quiz-cp link rendered in LearnUnitsClient.tsx"
    );

    // -------------------------------------------------------------
    // Test 5: Verifying QuizLandingClient Quiz Passing Guard
    // -------------------------------------------------------------
    console.log("\n[5] Verifying QuizLandingClient.tsx passing guard & Code Problem automatic display...");
    const quizLandingSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/quiz/QuizLandingClient.tsx"),
      "utf-8"
    );
    testAssert(
      quizLandingSource.includes("const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);"),
      "QuizLandingClient includes strict isPassed guard requiring lives > 0 and full score"
    );
    testAssert(
      quizLandingSource.includes("if (!isPassed) return;"),
      "QuizLandingClient aborts completion recording when isPassed is false"
    );
    testAssert(
      quizLandingSource.includes("{isPassed && hasCodingAssessment && ("),
      "QuizLandingClient automatically renders Code Problem when isPassed and unit has assessment"
    );

    // Clean up test user
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [testUserId]);
    console.log("  ✓ Cleaned up test user");

  } catch (err) {
    console.error("Test execution threw error:", err);
    failed++;
  } finally {
    await db.end();
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runTests();
