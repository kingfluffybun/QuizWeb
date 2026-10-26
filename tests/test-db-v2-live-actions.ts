import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runLiveConformanceTests() {
  console.log("================================================================================");
  console.log(" Running Database V2 Conformance Live Integration Verification");
  console.log("================================================================================");

  // Dynamically import modules AFTER environment variables are loaded
  const {
    getAvailableUnits,
    getUnitById,
    getQuizMetrics,
    getPaginatedRecentQuizzes,
    getPendingQuizzes,
    getQuizzes,
    getCodeProblems,
    getUnits,
  } = await import("../app/actions/quiz");
  const { resolveAuthoritativeAssessment, getPublicCodeProblem } = await import("../app/actions/cp-engine");
  const { getAdminAnalytics, getAdminReviewQueue } = await import("../app/actions/admin");
  const { getMaintainerStats, getMaintainerSubmissions } = await import("../app/actions/maintainer");
  const { db } = await import("../lib/db");

  // 1. Test getAvailableUnits()
  console.log("\n[Test 1] Testing getAvailableUnits()...");
  const availableUnits = await getAvailableUnits();
  assert.ok(Array.isArray(availableUnits), "Available units must be an array");
  assert.ok(availableUnits.length >= 20, `Expected at least 20 curriculum units in experimental_v2_quizweb_db (actual: ${availableUnits.length})`);
  const firstUnit = availableUnits[0];
  assert.ok(firstUnit.unit_id > 0, "Unit must have a positive unit_id");
  assert.ok(firstUnit.pending_id > 0, "Unit must have pending_id alias");
  assert.ok(typeof firstUnit.quiz_count === "number" && firstUnit.quiz_count > 0, "Unit must have quiz_count > 0");
  assert.equal(typeof firstUnit.has_coding_assessment, "boolean", "has_coding_assessment must be boolean");
  console.log(`✔ getAvailableUnits() verified: retrieved ${availableUnits.length} units with quiz counts & assessment flags`);

  // 2. Test getUnitById(98)
  console.log("\n[Test 2] Testing getUnitById(98)...");
  const unit98 = await getUnitById(98);
  assert.ok(unit98, "Unit 98 must exist");
  assert.equal(unit98.unit_id, 98);
  assert.equal(unit98.question_text, "Document Structure");
  interface Unit98Payload {
    lesson_card: { lesson_slide: unknown[] };
    quizzes: unknown[];
    assessment: { cp_steps: unknown[] };
  }
  const payload = unit98.quiz_payload as Unit98Payload;
  assert.ok(payload.lesson_card, "Payload must contain lesson_card");
  assert.ok(Array.isArray(payload.lesson_card.lesson_slide), "Lesson card must contain lesson_slide array");
  assert.ok(payload.lesson_card.lesson_slide.length > 0, "Lesson slides must not be empty");
  assert.ok(Array.isArray(payload.quizzes), "Payload must contain quizzes array");
  assert.equal(payload.quizzes.length, 11, "Unit 98 must contain 11 quizzes");
  assert.ok(payload.assessment, "Unit 98 must contain assessment object");
  assert.ok(Array.isArray(payload.assessment.cp_steps), "Assessment must contain cp_steps");
  assert.equal(payload.assessment.cp_steps.length, 4, "Unit 98 assessment must have 4 steps");
  console.log(`✔ getUnitById(98) verified: ${payload.lesson_card.lesson_slide.length} slides, ${payload.quizzes.length} quizzes, ${payload.assessment.cp_steps.length} assessment steps`);

  // 3. Test resolveAuthoritativeAssessment(98) and getPublicCodeProblem(98)
  console.log("\n[Test 3] Testing resolveAuthoritativeAssessment(98) & getPublicCodeProblem(98)...");
  const res98 = await resolveAuthoritativeAssessment(98);
  assert.ok(res98, "Authoritative assessment for unit 98 must resolve");
  assert.equal(res98.resolvedUnitId, 98);
  assert.equal(res98.unitTitle, "Document Structure");
  const assessment98 = res98.assessment;
  assert.equal(assessment98.title, "Build an HTML Skeleton");
  assert.equal(assessment98.steps.length, 4, "Must contain 4 CP steps");
  assert.ok(assessment98.steps[0].instruction, "Step 1 must have instruction");
  assert.ok(assessment98.steps[0].expectedTemplate.html, "Step 1 must have expectedTemplate html");

  const publicProblem = await getPublicCodeProblem(98);
  assert.ok(publicProblem, "Public code problem must resolve");
  assert.equal(publicProblem.steps.length, 4);
  assert.equal("expectedTemplate" in publicProblem.steps[0], false, "expectedTemplate must be stripped from public payload");
  console.log(`✔ resolveAuthoritativeAssessment(98) & getPublicCodeProblem(98) verified: "${assessment98.title}" with ${assessment98.steps.length} steps (private templates protected)`);

  // 4. Test getAdminAnalytics() with RBAC guard and Admin Session
  console.log("\n[Test 4] Testing getAdminAnalytics()...");
  // Unauthenticated call must fail
  (globalThis as Record<string, unknown>).__TEST_AUTH_SESSION__ = null;
  let unauthError = false;
  try {
    await getAdminAnalytics();
  } catch {
    unauthError = true;
  }
  assert.ok(unauthError, "getAdminAnalytics() must reject unauthenticated callers");

  // Admin session must succeed
  (globalThis as Record<string, unknown>).__TEST_AUTH_SESSION__ = {
    user: { id: "4", role: "admin", user_role: "admin", email: "clarence.luna651@gmail.com" },
  };
  const analytics = await getAdminAnalytics();
  assert.ok(analytics, "Analytics must return valid data");
  assert.ok(analytics.totalQuizzes >= 258, `Expected at least 258 quizzes in database (actual: ${analytics.totalQuizzes})`);
  assert.ok(analytics.categories.length > 0, "Category distribution must not be empty");
  assert.ok(analytics.difficulties.length > 0, "Difficulty distribution must not be empty");
  console.log(`✔ getAdminAnalytics() verified: RBAC guard enforced; retrieved ${analytics.totalQuizzes} total quizzes across ${analytics.categories.length} categories`);

  // 5. Test getAdminReviewQueue()
  console.log("\n[Test 5] Testing getAdminReviewQueue()...");
  const reviewQueue = await getAdminReviewQueue();
  assert.ok(Array.isArray(reviewQueue), "Review queue must be an array");
  console.log(`✔ getAdminReviewQueue() verified: returned ${reviewQueue.length} pending submissions`);

  // 6. Test getMaintainerStats() and getMaintainerSubmissions()
  console.log("\n[Test 6] Testing Maintainer server actions...");
  (globalThis as Record<string, unknown>).__TEST_AUTH_SESSION__ = {
    user: { id: "889656", role: "maintainer", user_role: "maintainer", email: "drizzly-clamshell54@bravealias.com" },
  };
  const stats = await getMaintainerStats();
  assert.ok(typeof stats.total === "number", "stats.total must be a number");
  assert.ok(typeof stats.approved === "number", "stats.approved must be a number");
  assert.ok(typeof stats.pending === "number", "stats.pending must be a number");
  assert.ok(typeof stats.rejected === "number", "stats.rejected must be a number");
  console.log(`✔ getMaintainerStats() verified: total=${stats.total}, approved=${stats.approved}, pending=${stats.pending}, rejected=${stats.rejected}`);

  const subResult = await getMaintainerSubmissions();
  assert.ok(subResult && Array.isArray(subResult.submissions), "Maintainer submissions must be an array");
  console.log(`✔ getMaintainerSubmissions() verified: returned ${subResult.submissions.length} maintainer submissions`);

  // Reset test session
  (globalThis as Record<string, unknown>).__TEST_AUTH_SESSION__ = undefined;

  // 7. Test getQuizMetrics()
  console.log("\n[Test 7] Testing getQuizMetrics()...");
  const metrics = await getQuizMetrics();
  assert.ok(metrics.totalQuizzes >= 256, "Total quizzes in metrics must match DB count");
  assert.ok(metrics.byCategory.length > 0, "Must have category metrics");
  assert.ok(metrics.matrix.length > 0, "Must have coverage matrix");
  console.log(`✔ getQuizMetrics() verified: totalQuizzes=${metrics.totalQuizzes}, matrix categories=${metrics.matrix.length}`);

  // 8. Test getPaginatedRecentQuizzes()
  console.log("\n[Test 8] Testing getPaginatedRecentQuizzes()...");
  const recent = await getPaginatedRecentQuizzes(1, 10);
  assert.equal(recent.quizzes.length, 10, "Expected 10 recent quizzes on page 1");
  assert.ok(recent.totalCount >= 256, "Expected totalCount >= 256");
  assert.ok(recent.quizzes[0].quiz_payload, "First quiz must have populated quiz_payload");
  console.log(`✔ getPaginatedRecentQuizzes() verified: page 1 returned ${recent.quizzes.length} populated quizzes out of ${recent.totalCount}`);

  // 9. Test User Info Query Conformance (learning_goal, daily_xp_goal, and created_at in user_auth_tbl)
  console.log("\n[Test 9] Testing User Info Query Conformance...");
  const [userRows] = await db.query<RowDataPacket[]>(
    `SELECT u.user_id, u.email, p.username, u.user_role, u.avatar_color, u.daily_xp_goal, u.learning_goal, u.created_at,
            p.xp, p.current_streak, p.max_streak
     FROM user_auth_tbl u
     LEFT JOIN player_tbl p ON u.user_id = p.user_id
     LIMIT 1`
  );
  assert.ok(userRows.length > 0, "Expected at least one user record");
  const user = userRows[0];
  assert.ok("daily_xp_goal" in user, "Must select daily_xp_goal");
  assert.ok("learning_goal" in user, "Must select learning_goal from user_auth_tbl");
  assert.equal(typeof user.learning_goal, "number", "learning_goal must be numeric");
  assert.ok("created_at" in user, "Must select created_at from user_auth_tbl");
  assert.ok(user.created_at != null, "created_at must not be null");
  console.log(`✔ User Info query verified for user_id=${user.user_id}, email=${user.email}, daily_xp_goal=${user.daily_xp_goal}, learning_goal=${user.learning_goal}, created_at=${user.created_at}`);

  // 10. Test getPendingQuizzes("all")
  console.log("\n[Test 10] Testing getPendingQuizzes('all')...");
  const allPending = await getPendingQuizzes("all");
  assert.ok(Array.isArray(allPending), "Pending units must be an array");
  assert.ok(allPending.length >= 20, `Expected at least 20 units returned by getPendingQuizzes('all') (actual: ${allPending.length})`);
  const samplePending = allPending[0];
  assert.ok(samplePending.cat_name && samplePending.cat_name.length > 0, "Pending unit must have cat_name populated");
  assert.notEqual(samplePending.difficulty_name, "approved", "Pending unit difficulty_name must NOT be status enum");
  assert.ok(Array.isArray(samplePending.unit_quiz_json) && samplePending.unit_quiz_json.length > 0, "Pending unit must contain populated unit_quiz_json array");
  assert.ok(samplePending.unit_lesson_card_json?.lesson_card?.lesson_format, "Pending unit must contain lesson_format");
  console.log(`✔ getPendingQuizzes('all') verified: returned ${allPending.length} units with cat_name="${samplePending.cat_name}", difficulty="${samplePending.difficulty_name}", quizzesCount=${samplePending.unit_quiz_json.length}`);

  // 11. Test getQuizzes()
  console.log("\n[Test 11] Testing getQuizzes()...");
  const activeQuizzes = await getQuizzes();
  assert.ok(activeQuizzes.length >= 258, `Expected at least 258 approved quizzes for active learners (actual: ${activeQuizzes.length})`);
  const firstActiveQuiz = activeQuizzes[0];
  assert.ok(firstActiveQuiz.quiz_payload, "Active quiz must have quiz_payload");
  assert.ok(firstActiveQuiz.cat_name, "Active quiz must have cat_name");
  assert.ok(firstActiveQuiz.difficulty_name, "Active quiz must have difficulty_name");

  const htmlQuizzes = await getQuizzes({ cat_id: 1 });
  assert.ok(htmlQuizzes.length > 0, "Expected HTML quizzes");
  assert.ok(htmlQuizzes.every((q) => q.cat_id === 1), "All returned quizzes must belong to cat_id 1");
  console.log(`✔ getQuizzes() verified: ${activeQuizzes.length} approved quizzes; cat_id=1 filter returned ${htmlQuizzes.length} HTML quizzes`);

  // 12. Test getCodeProblems()
  console.log("\n[Test 12] Testing getCodeProblems()...");
  const codeProblems = await getCodeProblems();
  assert.ok(codeProblems.length >= 20, `Expected at least 20 code problems from unit assessments (actual: ${codeProblems.length})`);
  const firstCP = codeProblems[0];
  assert.ok(firstCP.steps.length > 0, "Code problem must have steps");
  assert.ok(firstCP.instructions.length > 0, "Code problem must have instructions");
  assert.ok(firstCP.steps[0].prompt, "First step must have prompt");
  console.log(`✔ getCodeProblems() verified: ${codeProblems.length} code problems with step templates`);

  // 13. Test getUnits()
  console.log("\n[Test 13] Testing getUnits()...");
  const allUnits = await getUnits();
  assert.ok(allUnits.length >= 20, `Expected at least 20 units from getUnits() (actual: ${allUnits.length})`);
  const sampleUnit = allUnits[0];
  assert.ok(Array.isArray(sampleUnit.unit_lesson_card_json.lesson_slide), "Unit must have slides");
  assert.ok(Array.isArray(sampleUnit.quiz_json) && sampleUnit.quiz_json.length > 0, "Unit must have quizzes");
  assert.ok(sampleUnit.assessment_json !== null, "Unit must have assessment_json");
  console.log(`✔ getUnits() verified: retrieved ${allUnits.length} units with full slides, quizzes, and assessments`);

  console.log("\n================================================================================");
  console.log(" All 13 Database V2 Conformance Live Integration Tests Passed!");
  console.log("================================================================================\n");
}

runLiveConformanceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  });
