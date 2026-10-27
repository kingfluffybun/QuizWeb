import "./env-loader";
import { getCurriculumRoadmapData } from "../app/actions/curriculum-roadmap";
import { isUnitUnlockedForUser } from "../app/actions/progress";

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

async function runGuestTests() {
  console.log("=== RUNNING GUEST LEARN-UI SPECIAL CASE TEST SUITE ===\n");

  console.log("[1] Verifying Guest Curriculum Unlock Progression State...");
  const roadmapData = await getCurriculumRoadmapData(undefined);

  assert(roadmapData !== null, "getCurriculumRoadmapData returns valid data for guest");
  assert(roadmapData.userProgression.userId === undefined, "Guest userId is undefined");
  assert(roadmapData.userProgression.isStaff === false, "Guest isStaff is false");

  // First section (Section 1: Getting Started)
  const sec1 = roadmapData.sections[0];
  assert(sec1.sec_id === 1, "First section is Section 1");
  assert(sec1.is_locked === false, "Section 1 is unlocked for guest");
  assert(sec1.units.length >= 2, "Section 1 has at least 2 units");

  // First unit (Unit 98: Document Structure) must be UNLOCKED for guest
  const unit1 = sec1.units[0];
  assert(unit1.unit_id === 98, "First unit is Unit 98 (Document Structure)");
  assert(unit1.is_locked === false, "Unit 1 is UNLOCKED for guest preview");

  // Subsequent units in Section 1 (Unit 103) must be LOCKED for guest
  const unit2 = sec1.units[1];
  assert(unit2.unit_id === 103, "Second unit is Unit 103 (Text Content)");
  assert(unit2.is_locked === true, "Unit 2 is LOCKED for guest");

  // Subsequent sections (Section 2: Linking Your World) must be LOCKED for guest
  const sec2 = roadmapData.sections[1];
  assert(sec2.sec_id === 2, "Second section is Section 2");
  assert(sec2.is_locked === true, "Section 2 is LOCKED for guest");
  assert(sec2.units.every((u) => u.is_locked === true), "All units in Section 2 are LOCKED for guest");

  console.log("\n[2] Verifying isUnitUnlockedForUser Guest Permission Boundary...");
  const isUnit1Unlocked = await isUnitUnlockedForUser(98, undefined);
  assert(isUnit1Unlocked === true, "isUnitUnlockedForUser allows Unit 98 for guest (preview)");

  const isUnit2Unlocked = await isUnitUnlockedForUser(103, undefined);
  assert(isUnit2Unlocked === false, "isUnitUnlockedForUser blocks Unit 103 for guest");

  const isUnit3Unlocked = await isUnitUnlockedForUser(104, undefined);
  assert(isUnit3Unlocked === false, "isUnitUnlockedForUser blocks Unit 104 for guest");

  console.log(`\n=== RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runGuestTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
