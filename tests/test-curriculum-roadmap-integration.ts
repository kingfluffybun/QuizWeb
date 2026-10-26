import fs from "node:fs";
import path from "node:path";
import type { ResultSetHeader } from "mysql2/promise";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runTests() {
  console.log("=== RUNNING CURRICULUM ROADMAP INTEGRATION TEST SUITE ===\n");

  const { db } = await import("../lib/db");
  const { CANONICAL_SECTIONS } = await import("../lib/curriculum");
  const {
    CANONICAL_SECTION_DESCRIPTIONS,
    getSectionDescription,
  } = await import("../lib/curriculum-descriptions");
  const { getCurriculumRoadmapData } = await import(
    "../app/actions/curriculum-roadmap"
  );

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
    // Test Suite 1: Canonical Section Descriptions
    // -------------------------------------------------------------
    console.log("[1] Verifying Canonical Section Descriptions...");
    const keys = Object.keys(CANONICAL_SECTION_DESCRIPTIONS);
    assert(
      keys.length === 16,
      `Exactly 16 section descriptions are defined (actual: ${keys.length})`,
    );

    const expectedDesc: Record<number, string> = {
      1: "Learn how an HTML page is built, from the doctype and the head/body skeleton to basic text like headings, paragraphs and lists.",
      2: "Connect pages to each other and to the outside world with links, then add images, audio, video and embedded content.",
      3: "Organize a page with meaningful semantic tags, and use div and span with classes and ids to group and label content.",
      4: "Learn how to pick elements with selectors, add CSS to a page in three ways, and style hover, focus and position states.",
      5: "Understand that every element is a box with content, padding, border and margin, and control how big those boxes are.",
      6: "Make a page look good with colors, backgrounds, gradients and opacity, plus fonts, text size, alignment and spacing.",
      7: "Control how elements sit on the page using display and position, then line them up with the basics of flexbox.",
      8: "Store data in variables, learn the main data types, and combine values with operators.",
      9: "Make decisions with if and switch, and repeat code with loops.",
      10: "Package code into reusable functions, then write them in shorter forms with function expressions and arrow functions.",
      11: "Use newer shortcuts such as template literals, destructuring, spread and rest to write cleaner code.",
      12: "Work with groups of data using arrays, array methods like map and filter, and objects.",
      13: "Build complex, responsive page structures with CSS Grid, multi-column layouts, and advanced flex alignments.",
      14: "Bring interfaces to life with smooth transitions, keyframe animations, transforms, and responsive finishing touches.",
      15: "Select page elements, change them with JavaScript, and respond to user actions like clicks and form input.",
      16: "Read and write JSON, fetch data from an API, and show that data on the page.",
    };

    let allDescriptionsMatch = true;
    for (let i = 1; i <= 16; i++) {
      const actual = getSectionDescription(i);
      const expected = expectedDesc[i];
      if (actual !== expected) {
        allDescriptionsMatch = false;
        console.error(`  ✗ Section ${i} description mismatch:`, { actual, expected });
      }
    }
    assert(
      allDescriptionsMatch,
      "All 16 descriptions match the exact pedagogical curriculum descriptions",
    );

    // Fallback for invalid secId
    const fallbackDesc = getSectionDescription(999);
    assert(
      typeof fallbackDesc === "string" && fallbackDesc.length > 0,
      "getSectionDescription(999) returns a non-empty fallback string",
    );

    // -------------------------------------------------------------
    // Test Suite 2: Live Database Curriculum Roadmap Data Structure
    // -------------------------------------------------------------
    console.log("\n[2] Verifying getCurriculumRoadmapData() for Guest / Fresh User...");
    const guestData = await getCurriculumRoadmapData();

    assert(
      guestData.sections.length === 16,
      `Returns exactly 16 canonical sections (actual: ${guestData.sections.length})`,
    );

    // Verify ordering
    const isOrdered = guestData.sections.every(
      (sec, idx) => sec.sec_id === CANONICAL_SECTIONS[idx].sec_id,
    );
    assert(isOrdered, "Sections are ordered strictly by canonical 16-section sequence");

    // Verify Section 1 statistics & units
    const sec1 = guestData.sections[0];
    assert(sec1.sec_id === 1, "Section 1 ID is 1");
    assert(sec1.sec_title === "Getting Started", 'Section 1 title is "Getting Started"');
    assert(sec1.cat_name === "HTML", 'Section 1 category is "HTML"');
    assert(sec1.difficulty_name === "Beginner", 'Section 1 difficulty is "Beginner"');
    assert(sec1.total_units === 2, `Section 1 total_units is 2 (actual: ${sec1.total_units})`);
    assert(sec1.total_slides === 15, `Section 1 total_slides is 15 (actual: ${sec1.total_slides})`);
    assert(sec1.total_questions === 23, `Section 1 total_questions is 23 (actual: ${sec1.total_questions})`);
    assert(sec1.is_locked === false, "Section 1 is unlocked for a fresh user");
    assert(sec1.units.length === 2, `Section 1 has 2 units (actual: ${sec1.units.length})`);

    const unit1 = sec1.units[0];
    const unit2 = sec1.units[1];
    assert(unit1.unit_id === 98, `Unit 1 is Unit 98 (actual: ${unit1.unit_id})`);
    assert(unit1.unit_title === "Document Structure", `Unit 1 title is Document Structure`);
    assert(unit1.slide_count === 7, `Unit 1 slide count is 7 (actual: ${unit1.slide_count})`);
    assert(unit1.quiz_count === 11, `Unit 1 quiz count is 11 (actual: ${unit1.quiz_count})`);
    assert(unit1.has_coding_assessment === true, "Unit 1 has a coding assessment");
    assert(unit1.is_locked === false, "Unit 1 is unlocked for fresh user");

    assert(unit2.unit_id === 103, `Unit 2 is Unit 103 (actual: ${unit2.unit_id})`);
    assert(unit2.unit_title === "Text Content", `Unit 2 title is Text Content`);
    assert(unit2.slide_count === 8, `Unit 2 slide count is 8 (actual: ${unit2.slide_count})`);
    assert(unit2.quiz_count === 12, `Unit 2 quiz count is 12 (actual: ${unit2.quiz_count})`);
    assert(unit2.has_coding_assessment === true, "Unit 2 has a coding assessment");
    assert(unit2.is_locked === true, "Unit 2 is locked until Unit 1 is completed");

    // Verify Section 2 lock state
    const sec2 = guestData.sections[1];
    assert(sec2.sec_id === 2, "Section 2 ID is 2");
    assert(sec2.is_locked === true, "Section 2 is locked until Section 1 is completed");
    assert(
      sec2.units.every((u) => u.is_locked),
      "All units in Section 2 are locked for fresh user",
    );

    // Verify userProgression
    assert(
      guestData.userProgression.activeSectionId === 1,
      "Active section ID is 1 for fresh user",
    );
    assert(
      guestData.userProgression.activeUnitId === 98,
      "Active unit ID is 98 for fresh user",
    );
    assert(
      guestData.userProgression.isStaff === false,
      "Guest user isStaff is false",
    );

    // -------------------------------------------------------------
    // Test Suite 3: Empty Sections (0 approved units)
    // -------------------------------------------------------------
    console.log("\n[3] Verifying Empty Sections Handling (e.g. CSS Section 2: Box Model)...");
    const emptySec = guestData.sections.find((s) => s.sec_id === 5); // CSS Sec 2
    assert(Boolean(emptySec), "Found CSS Section 2 (sec_id 5)");
    if (emptySec) {
      assert(emptySec.total_units === 0, "Empty section total_units is 0");
      assert(emptySec.total_slides === 0, "Empty section total_slides is 0");
      assert(emptySec.total_questions === 0, "Empty section total_questions is 0");
      assert(emptySec.units.length === 0, "Empty section units array is empty");
      assert(
        emptySec.description ===
          "Understand that every element is a box with content, padding, border and margin, and control how big those boxes are.",
        "Empty section retains its canonical description",
      );
    }

    // -------------------------------------------------------------
    // Test Suite 4: Progression with Completed Units
    // -------------------------------------------------------------
    console.log("\n[4] Verifying Dynamic User Progression State...");
    // Create temporary test user
    const [testUserRes] = await db.query<ResultSetHeader>(
      `INSERT INTO user_auth_tbl (email, password_hash, user_role)
       VALUES (?, ?, 'user')`,
      [
        `test_roadmap_${Date.now()}@example.com`,
        "hash_placeholder",
      ],
    );
    const testUserId = testUserRes.insertId;

    try {
      // 1. Initial fresh test user
      const initUserData = await getCurriculumRoadmapData(testUserId);
      assert(
        initUserData.sections[0].units[0].is_locked === false,
        "User: Unit 98 unlocked",
      );
      assert(
        initUserData.sections[0].units[1].is_locked === true,
        "User: Unit 103 locked",
      );

      // 2. Complete Unit 98
      await db.query(
        `INSERT INTO user_lesson_progress_tbl
           (user_id, unit_id, current_slide_order, total_slides, is_completed, completed_at, last_accessed_at)
         VALUES (?, 98, 7, 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [testUserId],
      );

      const step1Data = await getCurriculumRoadmapData(testUserId);
      const u1 = step1Data.sections[0].units[0];
      const u2 = step1Data.sections[0].units[1];
      assert(u1.is_completed === true, "User: Unit 98 marked complete");
      assert(u2.is_locked === false, "User: Unit 103 now unlocked after Unit 98 complete");
      assert(
        step1Data.sections[1].is_locked === true,
        "User: Section 2 still locked until Unit 103 complete",
      );

      // 3. Complete Unit 103 (completing Section 1)
      await db.query(
        `INSERT INTO user_lesson_progress_tbl
           (user_id, unit_id, current_slide_order, total_slides, is_completed, completed_at, last_accessed_at)
         VALUES (?, 103, 8, 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [testUserId],
      );

      const step2Data = await getCurriculumRoadmapData(testUserId);
      assert(
        step2Data.sections[0].is_completed === true,
        "User: Section 1 is now marked completed",
      );
      assert(
        step2Data.sections[1].is_locked === false,
        "User: Section 2 is now unlocked!",
      );
      const sec2Unit1 = step2Data.sections[1].units[0];
      assert(
        sec2Unit1.is_locked === false,
        `User: Section 2 Unit 1 (${sec2Unit1.unit_title}) is now unlocked`,
      );
    } finally {
      // Clean up test data
      await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [
        testUserId,
      ]);
      await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [testUserId]);
    }

    // -------------------------------------------------------------
    // Test Suite 5: Staff Member Bypass / Immunity
    // -------------------------------------------------------------
    console.log("\n[5] Verifying Staff Member Bypass / Immunity...");
    const [staffUserRes] = await db.query<ResultSetHeader>(
      `INSERT INTO user_auth_tbl (email, password_hash, user_role)
       VALUES (?, ?, 'admin')`,
      [
        `test_staff_${Date.now()}@example.com`,
        "hash_placeholder",
      ],
    );
    const staffUserId = staffUserRes.insertId;

    try {
      const staffData = await getCurriculumRoadmapData(staffUserId);
      assert(
        staffData.userProgression.isStaff === true,
        "Admin user identified as isStaff === true",
      );
      assert(
        staffData.sections.every((s) => !s.is_locked),
        "All 16 sections are immediately unlocked for admin",
      );
      const allUnits = staffData.sections.flatMap((s) => s.units);
      assert(
        allUnits.every((u) => !u.is_locked),
        "All units across all sections are immediately unlocked for admin",
      );
    } finally {
      await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [staffUserId]);
    }

    // -------------------------------------------------------------
    // Test Suite 6: Sub-Node Level Progression States & Invalidation Contract
    // -------------------------------------------------------------
    console.log("\n[6] Verifying Sub-Node Level Progression States & Invalidation Contract...");

    // Contract verification
    const learnUiSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/learn-ui/LearnRoadmapClient.tsx"),
      "utf8",
    );
    assert(
      learnUiSource.includes('className="curriculum-section"') &&
        learnUiSource.includes('data-section-id={section.sec_id}'),
      "LearnRoadmapClient attaches data-section-id to curriculum sections",
    );
    assert(
      learnUiSource.includes('className={`section-header') &&
        learnUiSource.includes('data-section-id={section.sec_id}'),
      "LearnRoadmapClient attaches data-section-id to section headers",
    );
    assert(
      learnUiSource.includes("updateActiveSectionOnScroll") ||
        learnUiSource.includes("IntersectionObserver"),
      "LearnRoadmapClient implements active section scroll synchronization",
    );

    const progressSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/actions/progress.ts"),
      "utf8",
    );
    assert(
      progressSource.includes('revalidatePath("/learn-ui")'),
      "app/actions/progress.ts revalidates /learn-ui path on progress update",
    );

    const quizSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/actions/quiz.ts"),
      "utf8",
    );
    assert(
      quizSource.includes('revalidatePath("/learn-ui")'),
      "app/actions/quiz.ts revalidates /learn-ui path in revalidateQuizPaths",
    );

    const pageSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/learn-ui/page.tsx"),
      "utf8",
    );
    assert(
      pageSource.includes('export const dynamic = "force-dynamic"'),
      "app/learn-ui/page.tsx is force-dynamic for real-time user progress",
    );

    // Functional sub-node state test
    const [subNodeUserRes] = await db.query<ResultSetHeader>(
      `INSERT INTO user_auth_tbl (email, password_hash, user_role)
       VALUES (?, ?, 'user')`,
      [`test_subnode_${Date.now()}@example.com`, "hash_placeholder"],
    );
    const subNodeUserId = subNodeUserRes.insertId;

    try {
      // Step A: Partial slide progress (slide 3 of 7)
      await db.query(
        `INSERT INTO user_lesson_progress_tbl
           (user_id, unit_id, current_slide_order, total_slides, is_completed, completed_at, last_accessed_at)
         VALUES (?, 98, 3, 7, 0, NULL, CURRENT_TIMESTAMP)`,
        [subNodeUserId],
      );

      const partialData = await getCurriculumRoadmapData(subNodeUserId);
      const partialUnit98 = partialData.sections[0].units[0];
      assert(
        partialUnit98.current_slide_order === 3,
        `Unit 98 slide order is 3 (actual: ${partialUnit98.current_slide_order})`,
      );
      assert(
        partialUnit98.is_completed === false,
        "Unit 98 is not completed when on slide 3 of 7",
      );

      // In client logic:
      // Lesson is in progress (not completed, not locked)
      const lessonDoneA =
        partialUnit98.is_completed ||
        (partialUnit98.slide_count > 0 &&
          partialUnit98.current_slide_order >= partialUnit98.slide_count);
      assert(
        lessonDoneA === false,
        "Lesson slides are NOT marked done when current_slide_order < slide_count",
      );

      // Step B: Finished all slides (slide 7 of 7) but quiz not completed yet
      await db.query(
        `UPDATE user_lesson_progress_tbl
         SET current_slide_order = 7
         WHERE user_id = ? AND unit_id = 98`,
        [subNodeUserId],
      );

      const slideDoneData = await getCurriculumRoadmapData(subNodeUserId);
      const slideDoneUnit98 = slideDoneData.sections[0].units[0];
      const lessonDoneB =
        slideDoneUnit98.is_completed ||
        (slideDoneUnit98.slide_count > 0 &&
          slideDoneUnit98.current_slide_order >= slideDoneUnit98.slide_count);
      assert(
        lessonDoneB === true,
        "Lesson slides are marked done when current_slide_order reaches slide_count (7/7)",
      );
      assert(
        slideDoneUnit98.is_completed === false,
        "Unit itself remains incomplete until Quiz is passed",
      );

      // Quiz unlocks once lesson slides are complete
      const quizLockedB =
        slideDoneUnit98.is_locked ||
        (!lessonDoneB && slideDoneUnit98.slide_count > 0);
      assert(
        quizLockedB === false,
        "Quiz is unlocked once lesson slides are complete!",
      );
    } finally {
      await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [
        subNodeUserId,
      ]);
      await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [subNodeUserId]);
    }
  } catch (error) {
    console.error("Test failed with error:", error);
    failed++;
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().then(() => process.exit(0));
