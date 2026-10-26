import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runTests() {
  console.log("=== RUNNING STAFF UNIT TRACKING IMMUNITY TEST SUITE ===");
  const { db } = await import("../lib/db");
  const {
    getUserCurriculumUnlockState,
    isUnitUnlockedForUser,
    getAvailableUnitsForUser,
    getUserSectionProgress,
    recordLessonSlideProgress,
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

  const userTestId = 99981;
  const maintainerTestId = 99982;
  const adminTestId = 99983;

  try {
    // -------------------------------------------------------------
    // Setup 3 test accounts: 1 regular user, 1 maintainer, 1 admin
    // -------------------------------------------------------------
    console.log("\n[1] Setting up test users in user_auth_tbl & player_tbl...");
    const userIds = [userTestId, maintainerTestId, adminTestId];
    for (const uid of userIds) {
      await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [uid]);
      await db.query("DELETE FROM player_tbl WHERE user_id = ?", [uid]);
      await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [uid]);
    }

    await db.query(
      "INSERT INTO user_auth_tbl (user_id, email, password_hash, user_role) VALUES (?, 'reg_user@test.com', 'hash', 'user')",
      [userTestId],
    );
    await db.query(
      "INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'regular_player', 1)",
      [userTestId],
    );

    await db.query(
      "INSERT INTO user_auth_tbl (user_id, email, password_hash, user_role) VALUES (?, 'maintainer@test.com', 'hash', 'maintainer')",
      [maintainerTestId],
    );
    await db.query(
      "INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'maintainer_user', 1)",
      [maintainerTestId],
    );

    await db.query(
      "INSERT INTO user_auth_tbl (user_id, email, password_hash, user_role) VALUES (?, 'admin@test.com', 'hash', 'admin')",
      [adminTestId],
    );
    await db.query(
      "INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'admin_user', 1)",
      [adminTestId],
    );

    // -------------------------------------------------------------
    // Test 2: Regular user is subject to strict unit tracking limitations
    // -------------------------------------------------------------
    console.log("\n[2] Verifying standard user limitations...");
    const userUnlock = await getUserCurriculumUnlockState(userTestId);
    testAssert(userUnlock.unlockedUnitIds.has(98), "User: Unit 98 is unlocked initially");
    testAssert(!userUnlock.unlockedUnitIds.has(103), "User: Unit 103 is locked initially");
    testAssert(!userUnlock.unlockedUnitIds.has(105), "User: Unit 105 (Section 2) is locked initially");
    testAssert(userUnlock.unlockedSectionIds.has(1), "User: Section 1 is unlocked initially");
    testAssert(!userUnlock.unlockedSectionIds.has(2), "User: Section 2 is locked initially");

    const user98Unlocked = await isUnitUnlockedForUser(98, userTestId);
    const user103Unlocked = await isUnitUnlockedForUser(103, userTestId);
    const user105Unlocked = await isUnitUnlockedForUser(105, userTestId);
    testAssert(user98Unlocked === true, "User: isUnitUnlockedForUser(98) === true");
    testAssert(user103Unlocked === false, "User: isUnitUnlockedForUser(103) === false");
    testAssert(user105Unlocked === false, "User: isUnitUnlockedForUser(105) === false");

    const userAvail = await getAvailableUnitsForUser(userTestId);
    const userLockedUnits = userAvail.filter((u) => u.is_locked);
    testAssert(userLockedUnits.length > 0, `User: has locked units in /learn (count: ${userLockedUnits.length})`);

    const userProgressBlocked = await recordLessonSlideProgress(105, 1, 5, false, userTestId);
    testAssert(
      userProgressBlocked.success === false &&
        userProgressBlocked.error === "Unit is locked in the curriculum",
      "User: recordLessonSlideProgress on locked unit 105 is blocked",
    );

    // -------------------------------------------------------------
    // Test 3: Maintainer is immune/exempted from unit tracking limitations
    // -------------------------------------------------------------
    console.log("\n[3] Verifying maintainer immunity from unit tracking limitations...");
    const maintainerUnlock = await getUserCurriculumUnlockState(maintainerTestId);
    testAssert(maintainerUnlock.unlockedUnitIds.has(98), "Maintainer: Unit 98 is unlocked");
    testAssert(maintainerUnlock.unlockedUnitIds.has(103), "Maintainer: Unit 103 is unlocked with 0 units completed");
    testAssert(maintainerUnlock.unlockedUnitIds.has(105), "Maintainer: Unit 105 (Sec 2) is unlocked with 0 units completed");
    testAssert(maintainerUnlock.unlockedSectionIds.has(1), "Maintainer: Section 1 is unlocked");
    testAssert(maintainerUnlock.unlockedSectionIds.has(2), "Maintainer: Section 2 is unlocked");

    const maint98Unlocked = await isUnitUnlockedForUser(98, maintainerTestId);
    const maint103Unlocked = await isUnitUnlockedForUser(103, maintainerTestId);
    const maint105Unlocked = await isUnitUnlockedForUser(105, maintainerTestId);
    testAssert(maint98Unlocked === true, "Maintainer: isUnitUnlockedForUser(98) === true");
    testAssert(maint103Unlocked === true, "Maintainer: isUnitUnlockedForUser(103) === true");
    testAssert(maint105Unlocked === true, "Maintainer: isUnitUnlockedForUser(105) === true");

    const maintAvail = await getAvailableUnitsForUser(maintainerTestId);
    const maintLockedUnits = maintAvail.filter((u) => u.is_locked);
    testAssert(maintLockedUnits.length === 0, "Maintainer: 0 locked units in /learn (all units available)");

    const maintSec2Progress = await getUserSectionProgress(maintainerTestId, 2);
    testAssert(maintSec2Progress.section.is_locked === false, "Maintainer: Section 2 is_locked === false");
    const maintSec2Locked = maintSec2Progress.units.filter((u) => u.is_locked);
    testAssert(maintSec2Locked.length === 0, "Maintainer: all units in Section 2 is_locked === false");

    const maintProgressAllowed = await recordLessonSlideProgress(105, 1, 5, false, maintainerTestId);
    testAssert(maintProgressAllowed.success === true, "Maintainer: recordLessonSlideProgress on unit 105 succeeded");

    // -------------------------------------------------------------
    // Test 4: Admin is immune/exempted from unit tracking limitations
    // -------------------------------------------------------------
    console.log("\n[4] Verifying admin immunity from unit tracking limitations...");
    const adminUnlock = await getUserCurriculumUnlockState(adminTestId);
    testAssert(adminUnlock.unlockedUnitIds.has(98), "Admin: Unit 98 is unlocked");
    testAssert(adminUnlock.unlockedUnitIds.has(103), "Admin: Unit 103 is unlocked with 0 units completed");
    testAssert(adminUnlock.unlockedUnitIds.has(105), "Admin: Unit 105 (Sec 2) is unlocked with 0 units completed");
    testAssert(adminUnlock.unlockedSectionIds.has(1), "Admin: Section 1 is unlocked");
    testAssert(adminUnlock.unlockedSectionIds.has(2), "Admin: Section 2 is unlocked");

    const admin98Unlocked = await isUnitUnlockedForUser(98, adminTestId);
    const admin103Unlocked = await isUnitUnlockedForUser(103, adminTestId);
    const admin105Unlocked = await isUnitUnlockedForUser(105, adminTestId);
    testAssert(admin98Unlocked === true, "Admin: isUnitUnlockedForUser(98) === true");
    testAssert(admin103Unlocked === true, "Admin: isUnitUnlockedForUser(103) === true");
    testAssert(admin105Unlocked === true, "Admin: isUnitUnlockedForUser(105) === true");

    const adminAvail = await getAvailableUnitsForUser(adminTestId);
    const adminLockedUnits = adminAvail.filter((u) => u.is_locked);
    testAssert(adminLockedUnits.length === 0, "Admin: 0 locked units in /learn (all units available)");

    const adminSec2Progress = await getUserSectionProgress(adminTestId, 2);
    testAssert(adminSec2Progress.section.is_locked === false, "Admin: Section 2 is_locked === false");
    const adminSec2Locked = adminSec2Progress.units.filter((u) => u.is_locked);
    testAssert(adminSec2Locked.length === 0, "Admin: all units in Section 2 is_locked === false");

    const adminProgressAllowed = await recordLessonSlideProgress(105, 1, 5, false, adminTestId);
    testAssert(adminProgressAllowed.success === true, "Admin: recordLessonSlideProgress on unit 105 succeeded");

    // -------------------------------------------------------------
    // Cleanup test accounts
    // -------------------------------------------------------------
    console.log("\n[5] Cleaning up test accounts...");
    for (const uid of userIds) {
      await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [uid]);
      await db.query("DELETE FROM player_tbl WHERE user_id = ?", [uid]);
      await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [uid]);
    }
    console.log("  ✓ Test accounts cleaned up");

    console.log(`\nRESULTS: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
