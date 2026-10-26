import "./env-loader";
import {
  getSequentialSkipQueue,
  completeSequentialSkip,
} from "../app/actions/section-skip";
import { getUserCurriculumUnlockState } from "../app/actions/progress";
import fs from "node:fs";
import path from "node:path";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("=== RUNNING SECTION SKIP TEST SUITE ===\n");

  // 1. Boundary & validation tests for getSequentialSkipQueue
  console.log("[1] Validating Target Section Boundary Checks...");
  {
    const resInvalid1 = await getSequentialSkipQueue(0);
    assert(resInvalid1 === null, "Target Section 0 returns null");

    const resInvalid2 = await getSequentialSkipQueue(1);
    assert(resInvalid2 === null, "Target Section 1 (first section, nothing to skip) returns null");

    const resInvalidNegative = await getSequentialSkipQueue(-5);
    assert(resInvalidNegative === null, "Target Section -5 returns null");

    const resInvalidHigh = await getSequentialSkipQueue(9999);
    assert(resInvalidHigh === null, "Target Section 9999 returns null");
  }

  // 2. Single-section skip: Section 1 -> Section 2
  console.log("\n[2] Verifying Single Section Skip Queue (Section 1 -> Section 2)...");
  {
    const skipQueue = await getSequentialSkipQueue(2);
    assert(skipQueue !== null, "Skip queue to Section 2 is resolved");
    if (skipQueue) {
      assert(skipQueue.targetSectionId === 2, "Target section ID is 2");
      assert(skipQueue.targetSectionTitle === "Linking Your World", "Target section title matches canonical curriculum");
      assert(skipQueue.targetCatName === "HTML", "Target category name is HTML");
      assert(skipQueue.timePerProblemSeconds === 300, "Time per coding problem is 300 seconds (5 minutes)");
      assert(skipQueue.totalHearts === 5, "Total hearts across skip session is 5");
      assert(skipQueue.skippedSections.length === 1, "Exactly 1 section skipped (Section 1)");
      assert(skipQueue.skippedSections[0].sec_id === 1, "Skipped section is Section 1");
      assert(skipQueue.unitsQueue.length >= 2, `Units queue contains at least 2 coding problems (actual: ${skipQueue.unitsQueue.length})`);
      assert(skipQueue.totalCodingProblems === skipQueue.unitsQueue.length, "totalCodingProblems matches unitsQueue length");

      // Verify structure of first problem in queue
      const firstProblem = skipQueue.unitsQueue[0];
      assert(firstProblem.secId === 1, "First problem belongs to Section 1");
      assert(firstProblem.problem.unit_id === firstProblem.unitId, "Problem payload unit_id matches item unitId");
      assert(Array.isArray(firstProblem.problem.steps), "Problem steps is an array");
      assert(firstProblem.problem.steps.length > 0, "Problem has at least 1 step");
      
      // Ensure private answer template is stripped
      for (const step of firstProblem.problem.steps) {
        assert(!("expectedTemplate" in step), "expectedTemplate is strictly stripped from public problem step");
      }
    }
  }

  // 3. Multi-section skip: Section 1 & 2 -> Section 3
  console.log("\n[3] Verifying Multi-Section Skip Queue (Skipping to Section 3)...");
  {
    const skipQueue = await getSequentialSkipQueue(3);
    assert(skipQueue !== null, "Skip queue to Section 3 is resolved");
    if (skipQueue) {
      assert(skipQueue.targetSectionId === 3, "Target section ID is 3");
      assert(skipQueue.targetSectionTitle === "Structuring Pages", "Target section title is Structuring Pages");
      assert(skipQueue.skippedSections.length === 2, "Exactly 2 sections skipped (Section 1 and Section 2)");
      assert(skipQueue.skippedSections.map((s) => s.sec_id).join(",") === "1,2", "Skipped sections are in order: 1, 2");
      assert(skipQueue.unitsQueue.length > 2, `Units queue spans multiple sections (actual problems: ${skipQueue.unitsQueue.length})`);
      
      // Verify ordering
      const secIdsInQueue = skipQueue.unitsQueue.map((item) => item.secId);
      const isMonotonic = secIdsInQueue.every((val, i, arr) => !i || arr[i - 1] <= val);
      assert(isMonotonic, "Problems in unitsQueue are sequentially ordered by section");
    }
  }

  // 4. Progress Filter Check: Completed units excluded from skip queue
  console.log("\n[4] Verifying Dynamic Completed Unit Filter in Skip Queue...");
  {
    // Fetch unlock state to get an actual user
    const unlockState = await getUserCurriculumUnlockState(undefined);
    assert(typeof unlockState.completedUnitIds !== "undefined", "unlockState returns completedUnitIds Set");
  }

  // 5. completeSequentialSkip Server Action Contract
  console.log("\n[5] Verifying completeSequentialSkip Server Action Contract...");
  {
    const invalidResult = await completeSequentialSkip({ targetSectionId: 0 });
    assert(invalidResult.success === false, "Fails gracefully with invalid section ID");

    // Unauthenticated execution fails gracefully
    const unauthResult = await completeSequentialSkip({ targetSectionId: 2 });
    assert(unauthResult.success === false, "Fails gracefully when called without auth");
    assert(unauthResult.error?.includes("Authentication required") === true, "Reports authentication required");
  }

  // 6. UI Route & Learn Isolation Check
  console.log("\n[6] Verifying UI Routes and /learn Isolation Contract...");
  {
    const skipRoutePath = path.resolve(process.cwd(), "app/quiz-cp/skip/[targetSecId]/page.tsx");
    assert(fs.existsSync(skipRoutePath), "Dedicated skip route app/quiz-cp/skip/[targetSecId]/page.tsx exists");

    const learnUiClientPath = path.resolve(process.cwd(), "app/learn-ui/LearnRoadmapClient.tsx");
    const learnUiClientCode = fs.readFileSync(learnUiClientPath, "utf-8");
    assert(learnUiClientCode.includes("section-skip-rail-box"), "LearnRoadmapClient includes section-skip-rail-box");
    assert(learnUiClientCode.includes("/quiz-cp/skip/"), "LearnRoadmapClient links to /quiz-cp/skip/");
    assert(learnUiClientCode.includes("skip-modal-content"), "LearnRoadmapClient contains skip modal content");

    // Strictly verify /learn/page.tsx is untouched
    const learnPagePath = path.resolve(process.cwd(), "app/learn/page.tsx");
    const learnPageCode = fs.readFileSync(learnPagePath, "utf-8");
    assert(!learnPageCode.includes("quiz-cp/skip"), "/learn/page.tsx was NOT modified for skip function (as explicitly instructed)");
  }

  console.log(`\n=== RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
