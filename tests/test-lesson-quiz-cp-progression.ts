import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runTests() {
  console.log("=== RUNNING STRICT 3-STAGE ACTIVITY PROGRESSION TEST SUITE ===");
  const { db } = await import("../lib/db");
  const {
    recordLessonSlideProgress,
    recordQuizCompletionProgress,
    recordCodeProblemCompletionProgress,
    isLessonCompletedForUser,
    isQuizCompletedForUser,
    isCodeProblemUnlockedForUser,
    getUserCurriculumUnlockState,
    getUserSectionProgress,
  } = await import("../app/actions/progress");
  const { getCurriculumRoadmapData } = await import("../app/actions/curriculum-roadmap");

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

  const testUserId = 99991;

  try {
    // -------------------------------------------------------------
    // Setup: Fresh test learner
    // -------------------------------------------------------------
    console.log("\n[1] Setting up isolated test user...");
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [testUserId]);
    await db.query(
      "INSERT INTO user_auth_tbl (user_id, email, password_hash, user_role) VALUES (?, 'activity_test@test.com', 'hash', 'user')",
      [testUserId],
    );
    await db.query(
      "INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'activity_user', 1)",
      [testUserId],
    );

    // Initial state: Unit 98 lesson is unlocked; quiz and cp are locked; next unit (103) is locked
    const initLessonDone = await isLessonCompletedForUser(98, testUserId);
    const initQuizDone = await isQuizCompletedForUser(98, testUserId);
    const initCpUnlocked = await isCodeProblemUnlockedForUser(98, testUserId);
    const initUnlock = await getUserCurriculumUnlockState(testUserId);

    testAssert(!initLessonDone, "Initial: Unit 98 lesson is NOT completed");
    testAssert(!initQuizDone, "Initial: Unit 98 quiz is NOT completed");
    testAssert(!initCpUnlocked, "Initial: Unit 98 code problem is LOCKED");
    testAssert(initUnlock.unlockedUnitIds.has(98), "Initial: Unit 98 is unlocked");
    testAssert(!initUnlock.unlockedUnitIds.has(103), "Initial: Next unit 103 is strictly LOCKED");
    testAssert(!initUnlock.completedUnitIds.has(98), "Initial: Unit 98 is NOT completed");

    // Check roadmap data flags
    const roadmapInit = await getCurriculumRoadmapData(testUserId);
    const unit98Init = roadmapInit.sections[0].units.find((u) => u.unit_id === 98);
    testAssert(unit98Init?.is_lesson_completed === false, "Roadmap: Unit 98 is_lesson_completed is false initially");
    testAssert(unit98Init?.is_quiz_completed === false, "Roadmap: Unit 98 is_quiz_completed is false initially");
    testAssert(unit98Init?.is_cp_completed === false, "Roadmap: Unit 98 is_cp_completed is false initially");
    testAssert(unit98Init?.is_completed === false, "Roadmap: Unit 98 is_completed is false initially");

    // -------------------------------------------------------------
    // Stage 1: When Lesson is done -> Quiz unlocks, CP & Next Unit stay locked
    // -------------------------------------------------------------
    console.log("\n[2] Stage 1: Completing lesson slides...");
    const lessonResult = await recordLessonSlideProgress(98, 7, 7, false, testUserId, false, true);
    testAssert(lessonResult.success === true, "recordLessonSlideProgress succeeded");
    testAssert(lessonResult.isLessonCompleted === true, "Action returns isLessonCompleted = true");
    testAssert(lessonResult.isCompleted === false, "Action returns isCompleted = false (unit not yet complete)");

    const stage1LessonDone = await isLessonCompletedForUser(98, testUserId);
    const stage1QuizDone = await isQuizCompletedForUser(98, testUserId);
    const stage1CpUnlocked = await isCodeProblemUnlockedForUser(98, testUserId);
    const stage1Unlock = await getUserCurriculumUnlockState(testUserId);

    testAssert(stage1LessonDone === true, "Lesson completed: isLessonCompletedForUser is true");
    testAssert(!stage1QuizDone, "Lesson completed: Quiz is not yet completed");
    testAssert(!stage1CpUnlocked, "Lesson completed: Code problem remains LOCKED");
    testAssert(!stage1Unlock.completedUnitIds.has(98), "Lesson completed: Unit 98 is STILL NOT completed");
    testAssert(!stage1Unlock.unlockedUnitIds.has(103), "Lesson completed: Next unit 103 remains strictly LOCKED");

    const roadmapStage1 = await getCurriculumRoadmapData(testUserId);
    const unit98Stage1 = roadmapStage1.sections[0].units.find((u) => u.unit_id === 98);
    testAssert(unit98Stage1?.is_lesson_completed === true, "Roadmap: Unit 98 is_lesson_completed is now true");
    testAssert(unit98Stage1?.is_quiz_completed === false, "Roadmap: Unit 98 is_quiz_completed is false");
    testAssert(unit98Stage1?.is_cp_completed === false, "Roadmap: Unit 98 is_cp_completed is false");
    testAssert(unit98Stage1?.is_completed === false, "Roadmap: Unit 98 is_completed is false");

    // -------------------------------------------------------------
    // Stage 2: When Quiz is done -> Code Problem unlocks, Next Unit stays locked
    // -------------------------------------------------------------
    console.log("\n[3] Stage 2: Passing the quiz...");
    const quizResult = await recordQuizCompletionProgress(98, testUserId);
    testAssert(quizResult.success === true, "recordQuizCompletionProgress succeeded");
    testAssert(quizResult.isQuizCompleted === true, "Action returns isQuizCompleted = true");
    testAssert(quizResult.hasCodingAssessment === true, "Unit 98 has a coding assessment");
    testAssert(quizResult.isUnitCompleted === false, "Unit 98 is NOT marked completed (code problem still required!)");

    const stage2QuizDone = await isQuizCompletedForUser(98, testUserId);
    const stage2CpUnlocked = await isCodeProblemUnlockedForUser(98, testUserId);
    const stage2Unlock = await getUserCurriculumUnlockState(testUserId);

    testAssert(stage2QuizDone === true, "Quiz completed: isQuizCompletedForUser is true");
    testAssert(stage2CpUnlocked === true, "Quiz completed: Code problem is now strictly UNLOCKED!");
    testAssert(!stage2Unlock.completedUnitIds.has(98), "Quiz completed: Unit 98 is STILL NOT completed");
    testAssert(!stage2Unlock.unlockedUnitIds.has(103), "Quiz completed: Next unit 103 remains strictly LOCKED");

    const roadmapStage2 = await getCurriculumRoadmapData(testUserId);
    const unit98Stage2 = roadmapStage2.sections[0].units.find((u) => u.unit_id === 98);
    testAssert(unit98Stage2?.is_lesson_completed === true, "Roadmap: Unit 98 lesson is completed");
    testAssert(unit98Stage2?.is_quiz_completed === true, "Roadmap: Unit 98 quiz is completed");
    testAssert(unit98Stage2?.is_cp_completed === false, "Roadmap: Unit 98 cp is not yet completed");
    testAssert(unit98Stage2?.is_completed === false, "Roadmap: Unit 98 is not yet completed");

    // -------------------------------------------------------------
    // Stage 3: When Code Problem is done -> Next Unit's Lesson unlocks!
    // -------------------------------------------------------------
    console.log("\n[4] Stage 3: Completing the code problem...");
    const cpResult = await recordCodeProblemCompletionProgress(98, testUserId);
    testAssert(cpResult.success === true, "recordCodeProblemCompletionProgress succeeded");
    testAssert(cpResult.isUnitCompleted === true, "Action returns isUnitCompleted = true");
    testAssert(cpResult.nextUnit?.unit_id === 103, "Action returns next unit 103");

    const stage3Unlock = await getUserCurriculumUnlockState(testUserId);
    testAssert(stage3Unlock.completedUnitIds.has(98), "Code problem completed: Unit 98 is now in completedUnitIds!");
    testAssert(stage3Unlock.unlockedUnitIds.has(103), "Code problem completed: Next unit 103 is now strictly UNLOCKED!");
    testAssert(!stage3Unlock.unlockedUnitIds.has(105), "Section 2 Unit 105 remains locked");

    const roadmapStage3 = await getCurriculumRoadmapData(testUserId);
    const unit98Stage3 = roadmapStage3.sections[0].units.find((u) => u.unit_id === 98);
    testAssert(unit98Stage3?.is_lesson_completed === true, "Roadmap: Unit 98 lesson is completed");
    testAssert(unit98Stage3?.is_quiz_completed === true, "Roadmap: Unit 98 quiz is completed");
    testAssert(unit98Stage3?.is_cp_completed === true, "Roadmap: Unit 98 cp is completed");
    testAssert(unit98Stage3?.is_completed === true, "Roadmap: Unit 98 is completely finished!");

    // Next unit (103) state: lesson is unlocked, but quiz and CP are locked!
    const unit103Stage3 = roadmapStage3.sections[0].units.find((u) => u.unit_id === 103);
    testAssert(unit103Stage3?.is_locked === false, "Unit 103 lesson is unlocked");
    testAssert(unit103Stage3?.is_lesson_completed === false, "Unit 103 lesson is not completed");
    testAssert(unit103Stage3?.is_quiz_completed === false, "Unit 103 quiz is not completed");
    testAssert(unit103Stage3?.is_cp_completed === false, "Unit 103 cp is not completed");

    // -------------------------------------------------------------
    // Stage 5: Guard checks on Next Unit 103
    // -------------------------------------------------------------
    console.log("\n[5] Verifying prerequisite guards on next unit (Unit 103)...");
    // Attempting quiz before lesson on Unit 103 should fail
    const prematureQuiz = await recordQuizCompletionProgress(103, testUserId);
    testAssert(prematureQuiz.success === false, "Premature quiz without lesson is rejected");
    testAssert(prematureQuiz.error === "Complete Lesson first", "Rejection error is 'Complete Lesson first'");

    // Attempting CP before quiz on Unit 103 should fail
    const prematureCp = await recordCodeProblemCompletionProgress(103, testUserId);
    testAssert(prematureCp.success === false, "Premature CP without quiz is rejected");
    testAssert(prematureCp.error === "Complete Quiz first", "Rejection error is 'Complete Quiz first'");

    // -------------------------------------------------------------
    // Stage 6: Staff Immunity
    // -------------------------------------------------------------
    console.log("\n[6] Verifying Staff Immunity...");
    const adminUserId = 99992;
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [adminUserId]);
    await db.query(
      "INSERT INTO user_auth_tbl (user_id, email, password_hash, user_role) VALUES (?, 'admin_test@test.com', 'hash', 'admin')",
      [adminUserId],
    );

    const adminLessonUnlocked = await isLessonCompletedForUser(170, adminUserId);
    const adminQuizUnlocked = await isQuizCompletedForUser(170, adminUserId);
    const adminCpUnlocked = await isCodeProblemUnlockedForUser(170, adminUserId);
    testAssert(adminLessonUnlocked === true, "Admin has lesson immunity");
    testAssert(adminQuizUnlocked === true, "Admin has quiz immunity");
    testAssert(adminCpUnlocked === true, "Admin has code problem immunity");

    // Cleanup
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testUserId]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id IN (?, ?)", [testUserId, adminUserId]);
    console.log("  ✓ Cleaned up test users");

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
