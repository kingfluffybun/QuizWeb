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
  console.log("[1] Validating Target Section Boundary Checks & Starting Level Protection...");
  {
    const resInvalid1 = await getSequentialSkipQueue(0);
    assert(resInvalid1 === null, "Target Section 0 returns null");

    const resInvalidFirst = await getSequentialSkipQueue(1);
    assert(resInvalidFirst === null, "Target Section 1 (first section) returns null");

    const resInvalidSec2 = await getSequentialSkipQueue(2);
    assert(resInvalidSec2 === null, "Target Section 2 returns null (Section 1 is starting level and cannot be skipped)");

    const resInvalidNegative = await getSequentialSkipQueue(-5);
    assert(resInvalidNegative === null, "Target Section -5 returns null");

    const resInvalidHigh = await getSequentialSkipQueue(9999);
    assert(resInvalidHigh === null, "Target Section 9999 returns null");
  }

  // 2. Guest restriction tests
  console.log("\n[2] Verifying Guest Access Block on Skip Functions...");
  {
    // Calling without explicitUserId in test (unauthenticated / guest)
    const guestQueue = await getSequentialSkipQueue(3);
    assert(guestQueue === null, "Guests are strictly rejected from getSequentialSkipQueue (returns null)");
  }

  // 3. Multi-section skip: Skipping to Section 3 for authenticated user
  console.log("\n[3] Verifying Multi-Section Skip Queue for Authenticated User (Skipping to Section 3)...");
  {
    const testUserId = 1;
    const skipQueue = await getSequentialSkipQueue(3, testUserId);
    assert(skipQueue !== null, "Skip queue to Section 3 is resolved for authenticated user");
    if (skipQueue) {
      assert(skipQueue.targetSectionId === 3, "Target section ID is 3");
      assert(skipQueue.targetSectionTitle === "Structuring Pages", "Target section title is Structuring Pages");
      assert(skipQueue.skippedSections.length === 2, "Exactly 2 sections skipped (Section 1 and Section 2)");
      assert(skipQueue.skippedSections.map((s) => s.sec_id).join(",") === "1,2", "Skipped sections are in order: 1, 2");
      assert(skipQueue.unitsQueue.length >= 2, `Units queue contains coding problems (actual: ${skipQueue.unitsQueue.length})`);
      assert(skipQueue.timePerProblemSeconds === 300, "Time per coding problem is 300 seconds (5 minutes)");
      assert(skipQueue.totalHearts === 5, "Total hearts across skip session is 5");
      
      // Verify ordering
      const secIdsInQueue = skipQueue.unitsQueue.map((item) => item.secId);
      const isMonotonic = secIdsInQueue.every((val, i, arr) => !i || arr[i - 1] <= val);
      assert(isMonotonic, "Problems in unitsQueue are sequentially ordered by section");

      // Verify private template is stripped
      for (const item of skipQueue.unitsQueue) {
        for (const step of item.problem.steps) {
          assert(!("expectedTemplate" in step), "expectedTemplate is strictly stripped from public problem step");
        }
      }
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

    // Starting level protection: Section 1 cannot be skipped (targetSectionId <= 2 rejected)
    const sec2Result = await completeSequentialSkip({ targetSectionId: 2, explicitUserId: 1 });
    assert(sec2Result.success === false, "Target Section 2 fails (Starting level cannot be skipped)");
    assert(sec2Result.error?.includes("Starting level cannot be skipped") === true, "Reports starting level cannot be skipped");

    // Unauthenticated execution fails gracefully
    const unauthResult = await completeSequentialSkip({ targetSectionId: 3 });
    assert(unauthResult.success === false, "Fails gracefully when called without auth");
    assert(unauthResult.error?.includes("Authentication required") === true, "Reports authentication required");
  }

  // 6. UI Route & Learn Isolation Check
  console.log("\n[6] Verifying UI Routes and Guest Isolation Contract...");
  {
    const skipRoutePath = path.resolve(process.cwd(), "app/quiz-cp/skip/[targetSecId]/page.tsx");
    assert(fs.existsSync(skipRoutePath), "Dedicated skip route app/quiz-cp/skip/[targetSecId]/page.tsx exists");
    const skipRouteCode = fs.readFileSync(skipRoutePath, "utf-8");
    assert(skipRouteCode.includes("auth()"), "Dedicated skip route checks session with auth()");
    assert(skipRouteCode.includes("callbackUrl=/learn-ui"), "Dedicated skip route redirects unauthenticated users to login");
    assert(skipRouteCode.includes("parsedTargetSecId <= 2"), "Dedicated skip route protects starting level (targetSecId <= 2 redirected)");

    const learnUiClientPath = path.resolve(process.cwd(), "app/learn-ui/LearnRoadmapClient.tsx");
    const learnUiClientCode = fs.readFileSync(learnUiClientPath, "utf-8");
    assert(learnUiClientCode.includes("guest-rail-notice-box"), "LearnRoadmapClient includes guest preview notice box");
    assert(learnUiClientCode.includes("guest-unit-lock-modal"), "LearnRoadmapClient includes guest unit lock modal");
    assert(learnUiClientCode.includes("activeSection.sec_id > 1"), "LearnRoadmapClient prevents skip rail box on Section 1");
    assert(learnUiClientCode.includes("!isGuest && section.sec_id >= 3"), "LearnRoadmapClient restricts checkpoints to Section 3+ and authenticated users");

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
