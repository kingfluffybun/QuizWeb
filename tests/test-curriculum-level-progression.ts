import fs from "node:fs";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function runTests() {
  console.log("=== RUNNING CURRICULUM LEVEL PROGRESSION TEST SUITE ===\n");

  const { db } = await import("../lib/db");
  const {
    CANONICAL_SECTIONS,
    getNextSectionId,
    getNextAvailableSectionId,
    getCanonicalSortOrder,
    getPreviousSectionId,
    getSectionById,
    getCurriculumMetadata,
    computeCurriculumUnlockState,
  } = await import("../lib/curriculum");
  const {
    getUserLastActiveProgress,
    getUserSectionProgress,
    recordLessonSlideProgress,
    getNextCurriculumUnit,
    isUnitUnlockedForUser,
    getAvailableUnitsForUser,
  } = await import("../app/actions/progress");
  const { getAvailableUnits, getQuizMetadata } = await import("../app/actions/quiz");

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
    // Test Suite 1: Canonical 16-Section Hierarchy in Database
    // -------------------------------------------------------------
    console.log("[1] Verifying Canonical 16-Section Hierarchy in sec_tbl...");
    const [secRows] = await db.query<RowDataPacket[]>(
      `SELECT s.sec_id, s.cat_id, s.sec_num, s.sec_title, s.difficulty_id,
              d.difficulty_name, c.cat_name
       FROM sec_tbl s
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
       ORDER BY s.sec_id ASC`
    );

    assert(secRows.length === 16, `sec_tbl contains exactly 16 canonical sections (actual: ${secRows.length})`);

    const expectedSections = [
      { sec_id: 1, cat_name: "HTML", sec_num: 1, title: "Getting Started", diff: "Beginner" },
      { sec_id: 2, cat_name: "HTML", sec_num: 2, title: "Linking Your World", diff: "Beginner" },
      { sec_id: 3, cat_name: "HTML", sec_num: 3, title: "Structuring Pages", diff: "Beginner" },
      { sec_id: 4, cat_name: "CSS", sec_num: 1, title: "Styling Basics", diff: "Beginner" },
      { sec_id: 5, cat_name: "CSS", sec_num: 2, title: "The Box Model", diff: "Beginner" },
      { sec_id: 6, cat_name: "CSS", sec_num: 3, title: "Visual Styling", diff: "Beginner" },
      { sec_id: 7, cat_name: "CSS", sec_num: 4, title: "Layout Foundations", diff: "Beginner" },
      { sec_id: 8, cat_name: "JavaScript", sec_num: 1, title: "Programming Basics", diff: "Intermediate" },
      { sec_id: 9, cat_name: "JavaScript", sec_num: 2, title: "Control Flow", diff: "Intermediate" },
      { sec_id: 10, cat_name: "JavaScript", sec_num: 3, title: "Functions", diff: "Intermediate" },
      { sec_id: 11, cat_name: "JavaScript", sec_num: 4, title: "Modern JS Syntax", diff: "Intermediate" },
      { sec_id: 12, cat_name: "JavaScript", sec_num: 5, title: "Collections", diff: "Intermediate" },
      { sec_id: 13, cat_name: "CSS", sec_num: 5, title: "Advanced Layout", diff: "Advanced" },
      { sec_id: 14, cat_name: "CSS", sec_num: 6, title: "Motion & Polish", diff: "Advanced" },
      { sec_id: 15, cat_name: "JavaScript", sec_num: 6, title: "The DOM", diff: "Advanced" },
      { sec_id: 16, cat_name: "JavaScript", sec_num: 7, title: "Working with Data", diff: "Advanced" },
    ];

    let allSectionsMatch = true;
    for (const exp of expectedSections) {
      const match = secRows.find((r) => r.sec_id === exp.sec_id);
      if (
        !match ||
        match.cat_name !== exp.cat_name ||
        match.sec_num !== exp.sec_num ||
        match.sec_title !== exp.title ||
        match.difficulty_name !== exp.diff
      ) {
        allSectionsMatch = false;
        console.error(`  ✗ Section mismatch: expected ${JSON.stringify(exp)}, got ${JSON.stringify(match)}`);
      }
    }
    assert(allSectionsMatch, "All 16 sections match canonical category, number, title, and difficulty tier");

    // -------------------------------------------------------------
    // Test Suite 2: 20 Live Units Relational Mapping & Topics
    // -------------------------------------------------------------
    console.log("\n[2] Verifying 20 Live Units Relational Mapping & Topics...");
    const [unitRows] = await db.query<RowDataPacket[]>(
      `SELECT u.unit_id, u.unit_title, u.sec_id, u.unit_order, u.topics,
              s.sec_num, s.sec_title, c.cat_name, d.difficulty_name
       FROM unit_tbl u
       JOIN sec_tbl s ON u.sec_id = s.sec_id
       JOIN cat_tbl c ON s.cat_id = c.cat_id
       JOIN difficulty_tbl d ON s.difficulty_id = d.difficulty_id
       ORDER BY u.sec_id ASC, u.unit_order ASC`
    );

    assert(unitRows.length === 20, `unit_tbl contains 20 live units (actual: ${unitRows.length})`);

    const expectedUnitMap: Record<number, { title: string; sec_id: number; order: number; cat: string; sec_num: number; diff: string }> = {
      98: { title: "Document Structure", sec_id: 1, order: 1, cat: "HTML", sec_num: 1, diff: "Beginner" },
      103: { title: "Text Content", sec_id: 1, order: 2, cat: "HTML", sec_num: 1, diff: "Beginner" },
      105: { title: "Links", sec_id: 2, order: 1, cat: "HTML", sec_num: 2, diff: "Beginner" },
      104: { title: "Media", sec_id: 2, order: 2, cat: "HTML", sec_num: 2, diff: "Beginner" },
      101: { title: "Semantic HTML", sec_id: 3, order: 1, cat: "HTML", sec_num: 3, diff: "Beginner" },
      102: { title: "Divs & Spans", sec_id: 3, order: 2, cat: "HTML", sec_num: 3, diff: "Beginner" },
      109: { title: "Selectors", sec_id: 4, order: 1, cat: "CSS", sec_num: 1, diff: "Beginner" },
      110: { title: "Applying CSS", sec_id: 4, order: 2, cat: "CSS", sec_num: 1, diff: "Beginner" },
      111: { title: "Pseudo-classes & Elements", sec_id: 4, order: 3, cat: "CSS", sec_num: 1, diff: "Beginner" },
      112: { title: "Box Fundamentals", sec_id: 5, order: 1, cat: "CSS", sec_num: 2, diff: "Beginner" },
      113: { title: "Sizing", sec_id: 5, order: 2, cat: "CSS", sec_num: 2, diff: "Beginner" },
      116: { title: "Color & Background", sec_id: 6, order: 1, cat: "CSS", sec_num: 3, diff: "Beginner" },
      106: { title: "Flexbox in Practice", sec_id: 13, order: 1, cat: "CSS", sec_num: 5, diff: "Advanced" },
      108: { title: "Grid Basics", sec_id: 13, order: 2, cat: "CSS", sec_num: 5, diff: "Advanced" },
      107: { title: "Responsive Design", sec_id: 13, order: 3, cat: "CSS", sec_num: 5, diff: "Advanced" },
      115: { title: "Transitions", sec_id: 14, order: 1, cat: "CSS", sec_num: 6, diff: "Advanced" },
      114: { title: "Animations", sec_id: 14, order: 2, cat: "CSS", sec_num: 6, diff: "Advanced" },
      117: { title: "Selecting Elements", sec_id: 15, order: 1, cat: "JavaScript", sec_num: 6, diff: "Advanced" },
      118: { title: "Manipulating the Page", sec_id: 15, order: 2, cat: "JavaScript", sec_num: 6, diff: "Advanced" },
      119: { title: "Events", sec_id: 15, order: 3, cat: "JavaScript", sec_num: 6, diff: "Advanced" },
    };

    let allUnitsCorrect = true;
    let allTopicsPresent = true;
    for (const [idStr, exp] of Object.entries(expectedUnitMap)) {
      const uId = Number(idStr);
      const row = unitRows.find((r) => r.unit_id === uId);
      if (
        !row ||
        row.sec_id !== exp.sec_id ||
        row.unit_order !== exp.order ||
        row.cat_name !== exp.cat ||
        row.sec_num !== exp.sec_num ||
        row.difficulty_name !== exp.diff
      ) {
        allUnitsCorrect = false;
        console.error(`  ✗ Unit ${uId} mismatch: expected ${JSON.stringify(exp)}, got ${JSON.stringify(row)}`);
      }

      const topics = typeof row.topics === "string" ? JSON.parse(row.topics) : row.topics;
      if (!Array.isArray(topics) || topics.length === 0) {
        allTopicsPresent = false;
        console.error(`  ✗ Unit ${uId} missing valid topics array (got: ${JSON.stringify(row.topics)})`);
      }
    }

    assert(allUnitsCorrect, "All 20 units correctly mapped to canonical sections, order, category, and level");
    assert(allTopicsPresent, "All 20 units have populated JSON topics array");

    // Specific regression checks
    const selectorsUnit = unitRows.find((r) => r.unit_id === 109);
    assert(selectorsUnit?.cat_name === "CSS" && selectorsUnit?.sec_num === 1, "CSS Selectors correctly mapped to CSS Section 1 (not HTML Section 1)");

    const domEventsUnit = unitRows.find((r) => r.unit_id === 119);
    assert(domEventsUnit?.cat_name === "JavaScript" && domEventsUnit?.sec_num === 6, "DOM Events correctly mapped to JS Section 6 (The DOM)");

    const motionUnit = unitRows.find((r) => r.unit_id === 114);
    assert(motionUnit?.cat_name === "CSS" && motionUnit?.sec_num === 6, "Animations correctly mapped to CSS Section 6 (Motion & Polish)");

    // -------------------------------------------------------------
    // Test Suite 3: 100% Data Preservation of Relational Children
    // -------------------------------------------------------------
    console.log("\n[3] Verifying 100% Data Preservation of Slides, Quizzes, Assessments...");
    const [slides] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM lesson_slide_tbl");
    assert(Number(slides[0].c) >= 150, `lesson_slide_tbl preserved >= 150 records (actual: ${slides[0].c})`);

    const [quizzes] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM quiz_tbl");
    assert(Number(quizzes[0].c) >= 250, `quiz_tbl preserved >= 250 records (actual: ${quizzes[0].c})`);

    const [assessments] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM unit_assessment_tbl");
    assert(Number(assessments[0].c) >= 20, `unit_assessment_tbl preserved >= 20 records (actual: ${assessments[0].c})`);

    // -------------------------------------------------------------
    // Test Suite 4: lib/curriculum.ts Domain Helper Tests
    // -------------------------------------------------------------
    console.log("\n[4] Verifying lib/curriculum.ts Domain Logic...");
    assert(CANONICAL_SECTIONS.length === 16, "CANONICAL_SECTIONS has length 16");

    assert(getNextSectionId(1) === 2, "HTML Sec 1 (Getting Started) advances to HTML Sec 2 (2)");
    assert(getNextSectionId("1") === 2, "getNextSectionId('1') coerced string input advances to 2");
    assert(getNextSectionId(3) === 4, "HTML Sec 3 advances to CSS Sec 1 (4)");
    assert(getNextSectionId(7) === 8, "CSS Sec 4 advances to JS Sec 1 (8) - Beginner -> Intermediate tier transition");
    assert(getNextSectionId(12) === 13, "JS Sec 5 advances to CSS Sec 5 (13) - Intermediate -> Advanced tier transition");
    assert(getNextSectionId(14) === 15, "CSS Sec 6 advances to JS Sec 6 (15)");
    assert(getNextSectionId(16) === null, "JS Sec 7 (final section) has nextSectionId = null");
    assert(getNextSectionId(999) === null, "Invalid section ID returns null");
    assert(getNextSectionId("abc") === null, "Non-numeric section string returns null");

    assert(getPreviousSectionId(2) === 1, "getPreviousSectionId(2) returns 1");
    assert(getPreviousSectionId("2") === 1, "getPreviousSectionId('2') coerced string input returns 1");
    assert(getPreviousSectionId(1) === null, "getPreviousSectionId(1) returns null");

    const sec5 = getSectionById(5);
    assert(sec5?.sec_title === "The Box Model" && sec5.difficulty_name === "Beginner", "getSectionById(5) resolves The Box Model (Beginner)");
    const sec5Str = getSectionById("5");
    assert(sec5Str?.sec_title === "The Box Model", "getSectionById('5') resolves The Box Model with string input");

    const meta = getCurriculumMetadata();
    assert(meta.tiers.length === 3, "Curriculum metadata contains 3 tiers");
    assert(meta.tiers[0].name === "Beginner" && meta.tiers[0].sectionIds.length === 7, "Beginner tier contains 7 sections");
    assert(meta.tiers[1].name === "Intermediate" && meta.tiers[1].sectionIds.length === 5, "Intermediate tier contains 5 sections");
    assert(meta.tiers[2].name === "Advanced" && meta.tiers[2].sectionIds.length === 4, "Advanced tier contains 4 sections");

    // -------------------------------------------------------------
    // Test Suite 5: getUserSectionProgress Ordering & Metadata
    // -------------------------------------------------------------
    console.log("\n[5] Verifying getUserSectionProgress Ordering & Metadata...");
    const [testUserRows] = await db.query<RowDataPacket[]>("SELECT user_id FROM user_auth_tbl ORDER BY user_id ASC LIMIT 1");
    const testUserId = Number(testUserRows[0].user_id);

    const secProg1 = await getUserSectionProgress(testUserId, 1);
    assert(secProg1.section.sec_id === 1, "Section 1 sec_id matches");
    assert(secProg1.section.sec_title === "Getting Started", `Section 1 sec_title matches "${secProg1.section.sec_title}"`);
    assert(secProg1.section.difficulty_name === "Beginner", `Section 1 difficulty matches "${secProg1.section.difficulty_name}"`);
    assert(secProg1.units.length === 2, `Section 1 contains 2 units (actual: ${secProg1.units.length})`);
    assert(secProg1.units[0].unit_id === 98 && secProg1.units[0].unit_order === 1, "Section 1 Unit 1 is Document Structure (order 1)");
    assert(secProg1.units[1].unit_id === 103 && secProg1.units[1].unit_order === 2, "Section 1 Unit 2 is Text Content (order 2)");

    const secProg4 = await getUserSectionProgress(testUserId, 4);
    assert(secProg4.section.cat_name === "CSS" && secProg4.section.sec_num === 1, "Section 4 is CSS Section 1");
    assert(secProg4.units.length === 3, `Section 4 contains 3 units (actual: ${secProg4.units.length})`);
    assert(secProg4.units[0].unit_title === "Selectors" && secProg4.units[0].unit_order === 1, "First unit in CSS Sec 1 is Selectors (order 1)");
    assert(secProg4.units[1].unit_title === "Applying CSS" && secProg4.units[1].unit_order === 2, "Second unit in CSS Sec 1 is Applying CSS (order 2)");
    assert(secProg4.units[2].unit_title === "Pseudo-classes & Elements" && secProg4.units[2].unit_order === 3, "Third unit in CSS Sec 1 is Pseudo-classes (order 3)");

    const secProgStr = await getUserSectionProgress(testUserId, "4" as unknown as number);
    assert(secProgStr.section.sec_id === 4, "String '4' coerced cleanly in getUserSectionProgress");

    const secProg999 = await getUserSectionProgress(testUserId, 999);
    assert(secProg999.section.sec_id === 1, "Invalid section 999 falls back to section 1");
    assert(secProg999.units.length === 2, `Invalid section 999 loads fallback Section 1 units (actual: ${secProg999.units.length})`);
    assert(secProg999.units[0].unit_id === 98, "Fallback unit matches Section 1 Unit 1 (98)");

    // -------------------------------------------------------------
    // Test Suite 6: Automatic Section Progression via recordLessonSlideProgress
    // -------------------------------------------------------------
    console.log("\n[6] Verifying Automatic Section Progression...");
    const autoSecUser = 99995;
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [autoSecUser]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [autoSecUser]);
    await db.query("INSERT IGNORE INTO user_auth_tbl (user_id, email, password_hash) VALUES (?, 'autosec@test.com', 'hash')", [autoSecUser]);
    await db.query("INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'autosec_user', 1)", [autoSecUser]);

    // Step 6a: Complete Unit 98 (1 of 2 in Section 1)
    const res98 = await recordLessonSlideProgress(98, 6, 6, true, autoSecUser);
    assert(res98.success === true, "recordLessonSlideProgress(98) returned success");

    const [playerSecAfter98] = await db.query<RowDataPacket[]>("SELECT current_section FROM player_tbl WHERE user_id = ?", [autoSecUser]);
    assert(
      Number(playerSecAfter98[0].current_section) === 1,
      `User remains on Section 1 after completing only 1 of 2 units (actual: ${playerSecAfter98[0].current_section})`
    );

    // Step 6b: Complete Unit 103 (2 of 2 in Section 1 -> Should Auto-Advance to Section 2!)
    const res103 = await recordLessonSlideProgress(103, 6, 6, true, autoSecUser);
    assert(res103.success === true, "recordLessonSlideProgress(103) returned success");
    assert(res103.advancedSectionId === 2, "recordLessonSlideProgress indicates advancement to section 2");

    const [playerSecAfter103] = await db.query<RowDataPacket[]>("SELECT current_section FROM player_tbl WHERE user_id = ?", [autoSecUser]);
    assert(
      Number(playerSecAfter103[0].current_section) === 2,
      `User current_section auto-advanced to Section 2 (actual: ${playerSecAfter103[0].current_section})`
    );

    // Step 6c: Review non-regression: completing earlier unit does not regress current_section
    const reviewRes = await recordLessonSlideProgress(98, 1, 6, true, autoSecUser);
    assert(reviewRes.success === true, "Reviewing Unit 98 succeeded");
    const [playerSecAfterReview] = await db.query<RowDataPacket[]>("SELECT current_section FROM player_tbl WHERE user_id = ?", [autoSecUser]);
    assert(
      Number(playerSecAfterReview[0].current_section) === 2,
      `User current_section did NOT regress on review (actual: ${playerSecAfterReview[0].current_section})`
    );

    // Clean up test records
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [autoSecUser]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [autoSecUser]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [autoSecUser]);
    console.log("  ✓ Cleaned up test lesson progress records and test user");

    // -------------------------------------------------------------
    // Test Suite 7: getAvailableUnits Backward Compatibility
    // -------------------------------------------------------------
    console.log("\n[7] Verifying getAvailableUnits interface & metadata...");
    const available = await getAvailableUnits();
    assert(available.length === 20, `getAvailableUnits returned 20 units (actual: ${available.length})`);

    const selectorsAvail = available.find((u) => u.unit_id === 109);
    assert(selectorsAvail !== undefined, "Found Selectors unit in getAvailableUnits");
    assert(selectorsAvail?.category_name === "CSS", `Selectors category_name is CSS (actual: "${selectorsAvail?.category_name}")`);
    assert(selectorsAvail?.sec_num === "1", `Selectors sec_num is 1 (actual: "${selectorsAvail?.sec_num}")`);
    assert(selectorsAvail?.sec_title === "Styling Basics", `Selectors sec_title is Styling Basics (actual: "${selectorsAvail?.sec_title}")`);
    assert(selectorsAvail?.difficulty_name === "Beginner", `Selectors difficulty_name is Beginner (actual: "${selectorsAvail?.difficulty_name}")`);
    assert(selectorsAvail?.unit_order === 1, `Selectors unit_order is 1 (actual: ${selectorsAvail?.unit_order})`);

    const quizMeta = await getQuizMetadata();
    assert(quizMeta.sections.length === 16, `getQuizMetadata returned 16 sections (actual: ${quizMeta.sections.length})`);
    assert(typeof quizMeta.sections[0].sec_num === "string", `Section sec_num is string formatted (actual: ${typeof quizMeta.sections[0].sec_num})`);
    assert(quizMeta.sections[0].sec_title === "Getting Started", `First section has title "Getting Started"`);

    // -------------------------------------------------------------
    // Test Suite 8: Dynamic Progression Continuity & Forward Targets
    // -------------------------------------------------------------
    console.log("\n[8] Verifying Dynamic Progression Continuity & Forward Targets...");

    // 8.1 getNextAvailableSectionId skips empty sections
    const activeSections = new Set([1, 2, 3, 4, 5, 6, 13, 14, 15]);
    const skippedSec = getNextAvailableSectionId(6, activeSections);
    assert(skippedSec === 13, `getNextAvailableSectionId(6) skips empty sections (7..12) and returns 13 (actual: ${skippedSec})`);

    const finalSec = getNextAvailableSectionId(15, activeSections);
    assert(finalSec === null, `getNextAvailableSectionId(15) with no further active sections returns null (actual: ${finalSec})`);

    // 8.2 Canonical sort order weights
    const htmlOrder1 = getCanonicalSortOrder(1, 1);
    const htmlOrder2 = getCanonicalSortOrder(1, 2);
    const cssOrder1 = getCanonicalSortOrder(4, 1);
    const advCssOrder = getCanonicalSortOrder(13, 1);
    const jsOrder = getCanonicalSortOrder(15, 1);

    assert(htmlOrder1 < htmlOrder2, `HTML Sec 1 Unit 1 (${htmlOrder1}) < HTML Sec 1 Unit 2 (${htmlOrder2})`);
    assert(htmlOrder2 < cssOrder1, `HTML Sec 1 Unit 2 (${htmlOrder2}) < CSS Sec 1 Unit 1 (${cssOrder1})`);
    assert(cssOrder1 < advCssOrder, `CSS Sec 1 (${cssOrder1}) < CSS Sec 5 (${advCssOrder})`);
    assert(advCssOrder < jsOrder, `CSS Sec 5 (${advCssOrder}) < JS Sec 6 (${jsOrder})`);

    // 8.3 Forward-pointing resume target on user completion
    const testProgUser = 99998;
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testProgUser]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testProgUser]);
    await db.query("INSERT IGNORE INTO user_auth_tbl (user_id, email, password_hash) VALUES (?, 'prog@test.com', 'hash')", [testProgUser]);
    await db.query("INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'prog_user', 1)", [testProgUser]);

    // When user has no progress, points forward to first unit
    const initialProg = await getUserLastActiveProgress(testProgUser);
    assert(initialProg !== null, "getUserLastActiveProgress for new user returns initial start target");
    assert(initialProg?.resume_type === "up_next", `New user has resume_type = up_next (actual: ${initialProg?.resume_type})`);
    assert(initialProg?.next_unit_id === 98, `New user points to Unit 98 (actual: ${initialProg?.next_unit_id})`);

    // Complete Unit 98
    await recordLessonSlideProgress(98, 6, 6, true, testProgUser);
    const postProg = await getUserLastActiveProgress(testProgUser);
    assert(postProg !== null, "postProg is not null");
    assert(postProg?.resume_type === "up_next", `Completed unit resolves resume_type = up_next (actual: ${postProg?.resume_type})`);
    assert(postProg?.next_unit_id === 103, `Completed Unit 98 advances target to Unit 103 (actual: ${postProg?.next_unit_id})`);

    // In-progress unit returns in_progress
    await recordLessonSlideProgress(103, 3, 6, false, testProgUser);
    const inProgress = await getUserLastActiveProgress(testProgUser);
    assert(inProgress?.resume_type === "in_progress", `In-progress unit resolves resume_type = in_progress (actual: ${inProgress?.resume_type})`);
    assert(inProgress?.current_slide_order === 3, `In-progress slide matches 3 (actual: ${inProgress?.current_slide_order})`);

    // 8.4 getNextCurriculumUnit continuity
    const nextAfter98 = await getNextCurriculumUnit(98);
    assert(nextAfter98?.unit_id === 103, `getNextCurriculumUnit(98) is Unit 103 (actual: ${nextAfter98?.unit_id})`);

    const nextAfter116 = await getNextCurriculumUnit(116);
    assert(nextAfter116?.unit_id === 106, `getNextCurriculumUnit(116) bridges empty sections to Unit 106 (actual: ${nextAfter116?.unit_id})`);

    // Clean up test user
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [testProgUser]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [testProgUser]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [testProgUser]);
    console.log("  ✓ Cleaned up forward target test user");

    // -------------------------------------------------------------
    // Test Suite 9: Per-Unit and Section Unlock Progression
    // -------------------------------------------------------------
    console.log("\n[9] Verifying Strict Per-Unit and Section Unlock Progression...");

    // 9.1 Pure domain logic test with computeCurriculumUnlockState
    const mockUnits = [
      { unit_id: 1, unit_order: 1, sec_id: 1 },
      { unit_id: 2, unit_order: 2, sec_id: 1 },
      { unit_id: 3, unit_order: 1, sec_id: 2 },
      { unit_id: 4, unit_order: 2, sec_id: 2 },
      { unit_id: 5, unit_order: 1, sec_id: 3 },
    ];

    // State 0: No units completed
    const state0 = computeCurriculumUnlockState(mockUnits, new Set());
    assert(state0.unlockedSectionIds.has(1), "Initial state: Section 1 is unlocked");
    assert(!state0.unlockedSectionIds.has(2), "Initial state: Section 2 is locked");
    assert(state0.unlockedUnitIds.has(1), "Initial state: Unit 1 is unlocked");
    assert(!state0.unlockedUnitIds.has(2), "Initial state: Unit 2 is locked");
    assert(!state0.unlockedUnitIds.has(3), "Initial state: Unit 3 (Sec 2) is locked");

    // State 1: Unit 1 completed
    const state1 = computeCurriculumUnlockState(mockUnits, new Set([1]));
    assert(state1.unlockedSectionIds.has(1), "Unit 1 done: Section 1 is unlocked");
    assert(!state1.unlockedSectionIds.has(2), "Unit 1 done: Section 2 is STILL locked (Sec 1 not fully completed)");
    assert(state1.unlockedUnitIds.has(1), "Unit 1 done: Unit 1 is unlocked (reviewable)");
    assert(state1.unlockedUnitIds.has(2), "Unit 1 done: Unit 2 is now unlocked");
    assert(!state1.unlockedUnitIds.has(3), "Unit 1 done: Unit 3 is locked");

    // State 2: Unit 1 and Unit 2 completed (Section 1 fully done)
    const state2 = computeCurriculumUnlockState(mockUnits, new Set([1, 2]));
    assert(state2.completedSectionIds.has(1), "Sec 1 done: Section 1 is marked completed");
    assert(state2.unlockedSectionIds.has(2), "Sec 1 done: Section 2 is now unlocked");
    assert(!state2.unlockedSectionIds.has(3), "Sec 1 done: Section 3 is still locked");
    assert(state2.unlockedUnitIds.has(3), "Sec 1 done: Unit 3 (first unit of Sec 2) is unlocked");
    assert(!state2.unlockedUnitIds.has(4), "Sec 1 done: Unit 4 (second unit of Sec 2) is locked until Unit 3 completed");

    // 9.2 Live Database End-to-End Unlock State
    const unlockTestUser = 99997;
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [unlockTestUser]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [unlockTestUser]);
    await db.query("INSERT IGNORE INTO user_auth_tbl (user_id, email, password_hash) VALUES (?, 'unlock@test.com', 'hash')", [unlockTestUser]);
    await db.query("INSERT INTO player_tbl (user_id, username, current_section) VALUES (?, 'unlock_user', 1)", [unlockTestUser]);

    // Initial state: only Unit 98 is unlocked
    const is98UnlockedInit = await isUnitUnlockedForUser(98, unlockTestUser);
    const is103UnlockedInit = await isUnitUnlockedForUser(103, unlockTestUser);
    const is105UnlockedInit = await isUnitUnlockedForUser(105, unlockTestUser);
    assert(is98UnlockedInit === true, "Database: Fresh user has Unit 98 unlocked");
    assert(is103UnlockedInit === false, "Database: Fresh user has Unit 103 locked");
    assert(is105UnlockedInit === false, "Database: Fresh user has Unit 105 (Sec 2) locked");

    const availUnitsInit = await getAvailableUnitsForUser(unlockTestUser);
    const unlockedUnitsInit = availUnitsInit.filter((u) => !u.is_locked);
    const lockedUnitsInit = availUnitsInit.filter((u) => u.is_locked);
    assert(unlockedUnitsInit.length === 1, `Database: Fresh user has exactly 1 unlocked unit (actual: ${unlockedUnitsInit.length})`);
    assert(unlockedUnitsInit[0].unit_id === 98, "Database: Unlocked unit is Unit 98");
    assert(lockedUnitsInit.length === 19, `Database: Fresh user has exactly 19 locked units (actual: ${lockedUnitsInit.length})`);

    const secProgInit = await getUserSectionProgress(unlockTestUser, 1);
    assert(secProgInit.units[0].is_locked === false, "Dashboard: Unit 98 is unlocked");
    assert(secProgInit.units[1].is_locked === true, "Dashboard: Unit 103 is locked");

    // User completes Unit 98: Unit 103 unlocks, Section 2 remains locked
    await recordLessonSlideProgress(98, 6, 6, true, unlockTestUser);
    const is98Post = await isUnitUnlockedForUser(98, unlockTestUser);
    const is103Post = await isUnitUnlockedForUser(103, unlockTestUser);
    const is105Post = await isUnitUnlockedForUser(105, unlockTestUser);
    assert(is98Post === true, "After Unit 98: Unit 98 remains unlocked");
    assert(is103Post === true, "After Unit 98: Unit 103 is unlocked");
    assert(is105Post === false, "After Unit 98: Unit 105 (Sec 2) remains locked");

    const availUnitsStep1 = await getAvailableUnitsForUser(unlockTestUser);
    const unlockedUnitsStep1 = availUnitsStep1.filter((u) => !u.is_locked);
    assert(unlockedUnitsStep1.length === 2, `After Unit 98: Exactly 2 units unlocked (actual: ${unlockedUnitsStep1.length})`);

    // User completes Unit 103: Section 1 completes -> Section 2 unlocks -> Unit 105 unlocks -> Unit 104 is locked
    await recordLessonSlideProgress(103, 6, 6, true, unlockTestUser);
    const is105Step2 = await isUnitUnlockedForUser(105, unlockTestUser);
    const is104Step2 = await isUnitUnlockedForUser(104, unlockTestUser);
    const is101Step2 = await isUnitUnlockedForUser(101, unlockTestUser); // Sec 3 Unit 1
    assert(is105Step2 === true, "After Sec 1 complete: Unit 105 (Sec 2 Unit 1) is unlocked");
    assert(is104Step2 === false, "After Sec 1 complete: Unit 104 (Sec 2 Unit 2) is locked until Unit 105 is done");
    assert(is101Step2 === false, "After Sec 1 complete: Section 3 Unit 1 is locked");

    const availUnitsStep2 = await getAvailableUnitsForUser(unlockTestUser);
    const unlockedUnitsStep2 = availUnitsStep2.filter((u) => !u.is_locked);
    assert(unlockedUnitsStep2.length === 3, `After Sec 1 complete: Exactly 3 units unlocked (98, 103, 105) (actual: ${unlockedUnitsStep2.length})`);

    // Clean up test user
    await db.query("DELETE FROM user_lesson_progress_tbl WHERE user_id = ?", [unlockTestUser]);
    await db.query("DELETE FROM player_tbl WHERE user_id = ?", [unlockTestUser]);
    await db.query("DELETE FROM user_auth_tbl WHERE user_id = ?", [unlockTestUser]);
    console.log("  ✓ Cleaned up unlock test user");

    console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

runTests();
