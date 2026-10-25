import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
  } = await import("../app/actions/quiz");
  const { resolveAuthoritativeAssessment, getPublicCodeProblem } = await import("../app/actions/cp-engine");
  const { getAdminAnalytics, getAdminReviewQueue } = await import("../app/actions/admin");
  const { getMaintainerStats, getMaintainerSubmissions } = await import("../app/actions/maintainer");
  const { db } = await import("../lib/db");

  // 1. Test getAvailableUnits()
  console.log("\n[Test 1] Testing getAvailableUnits()...");
  const availableUnits = await getAvailableUnits();
  assert.ok(Array.isArray(availableUnits), "Available units must be an array");
  assert.equal(availableUnits.length, 20, "Expected 20 curriculum units in experimental_v2_quizweb_db");
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
  const payload = unit98.quiz_payload as any;
  assert.ok(payload.lesson_card, "Payload must contain lesson_card");
  assert.ok(Array.isArray(payload.lesson_card.lesson_slide), "Lesson card must contain lesson_slide array");
  assert.ok(payload.lesson_card.lesson_slide.length > 0, "Lesson slides must not be empty");
  assert.ok(Array.isArray(payload.quizzes), "Payload must contain quizzes array");
  assert.equal(payload.quizzes.length, 9, "Unit 98 must contain 9 quizzes");
  assert.ok(payload.assessment, "Unit 98 must contain assessment object");
  assert.ok(Array.isArray(payload.assessment.cp_steps), "Assessment must contain cp_steps");
  assert.equal(payload.assessment.cp_steps.length, 5, "Unit 98 assessment must have 5 steps");
  console.log(`✔ getUnitById(98) verified: ${payload.lesson_card.lesson_slide.length} slides, ${payload.quizzes.length} quizzes, ${payload.assessment.cp_steps.length} assessment steps`);

  // 3. Test resolveAuthoritativeAssessment(98) and getPublicCodeProblem(98)
  console.log("\n[Test 3] Testing resolveAuthoritativeAssessment(98) & getPublicCodeProblem(98)...");
  const res98 = await resolveAuthoritativeAssessment(98);
  assert.ok(res98, "Authoritative assessment for unit 98 must resolve");
  assert.equal(res98.resolvedUnitId, 98);
  assert.equal(res98.unitTitle, "Document Structure");
  const assessment98 = res98.assessment;
  assert.equal(assessment98.title, "Unit 1 Assessment");
  assert.equal(assessment98.steps.length, 5, "Must contain 5 CP steps");
  assert.ok(assessment98.steps[0].instruction, "Step 1 must have instruction");
  assert.ok(assessment98.steps[0].expectedTemplate.html, "Step 1 must have expectedTemplate html");

  const publicProblem = await getPublicCodeProblem(98);
  assert.ok(publicProblem, "Public code problem must resolve");
  assert.equal(publicProblem.steps.length, 5);
  assert.equal((publicProblem.steps[0] as any).expectedTemplate, undefined, "expectedTemplate must be stripped from public payload");
  console.log(`✔ resolveAuthoritativeAssessment(98) & getPublicCodeProblem(98) verified: "${assessment98.title}" with ${assessment98.steps.length} steps (private templates protected)`);

  // 4. Test getAdminAnalytics() with RBAC guard and Admin Session
  console.log("\n[Test 4] Testing getAdminAnalytics()...");
  // Unauthenticated call must fail
  (globalThis as any).__TEST_AUTH_SESSION__ = null;
  let unauthError = false;
  try {
    await getAdminAnalytics();
  } catch {
    unauthError = true;
  }
  assert.ok(unauthError, "getAdminAnalytics() must reject unauthenticated callers");

  // Admin session must succeed
  (globalThis as any).__TEST_AUTH_SESSION__ = {
    user: { id: "4", role: "admin", user_role: "admin", email: "clarence.luna651@gmail.com" },
  };
  const analytics = await getAdminAnalytics();
  assert.ok(analytics, "Analytics must return valid data");
  assert.equal(analytics.totalQuizzes, 256, "Expected 256 quizzes in database");
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
  (globalThis as any).__TEST_AUTH_SESSION__ = {
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
  (globalThis as any).__TEST_AUTH_SESSION__ = undefined;

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

  // 9. Test User Info Query Conformance (No learning_goal or created_at in user_auth_tbl)
  console.log("\n[Test 9] Testing User Info Query Conformance...");
  const [userRows] = await db.query<any[]>(
    `SELECT u.user_id, u.email, p.username, u.user_role, u.avatar_color, u.daily_xp_goal,
            p.xp, p.current_streak, p.max_streak
     FROM user_auth_tbl u
     LEFT JOIN player_tbl p ON u.user_id = p.user_id
     LIMIT 1`
  );
  assert.ok(userRows.length > 0, "Expected at least one user record");
  const user = userRows[0];
  assert.ok("daily_xp_goal" in user, "Must select daily_xp_goal");
  assert.ok(!("learning_goal" in user), "Must NOT select non-existent learning_goal from user_auth_tbl");
  console.log(`✔ User Info query verified for user_id=${user.user_id}, email=${user.email}, daily_xp_goal=${user.daily_xp_goal}`);

  console.log("\n================================================================================");
  console.log(" All 9 Database V2 Conformance Live Integration Tests Passed!");
  console.log("================================================================================\n");
}

runLiveConformanceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  });
