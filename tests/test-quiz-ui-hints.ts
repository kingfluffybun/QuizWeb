import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildBackdropCutoutPath,
  computeArrowPath,
  computePopoverLayout,
  computeSpotlightRect,
  easeOutCubic,
  lerp,
  lerpRect,
} from "../lib/quiz-tutorial-geometry";
import {
  getQuizUiHint,
  isOnboardingTutorialUnit,
  ONBOARDING_TUTORIAL_FALLBACK_UNIT_ID,
  ONBOARDING_TUTORIAL_SECTION_ID,
  ONBOARDING_TUTORIAL_UNIT_ORDER,
  QUIZ_UI_HINT_ORDER,
  QUIZ_UI_HINTS,
  resolveQuizHintMode,
} from "../lib/quiz-ui-hints";
import {
  ensureUnit1AllQuizTypes,
  REQUIRED_UNIT1_QUIZ_TYPES,
} from "../lib/unit1-onboarding-quizzes";
import { evaluateQuizAnswer, getCorrectValue } from "../app/quiz/evaluate";
import type { QuizData } from "../app/quiz/types";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function runTests() {
  console.log("=== Running Interactive Arrow Tutorial Test Suite ===");

  // 1. Validate all 6 modes and walkthrough steps
  assert.deepEqual(
    QUIZ_UI_HINT_ORDER,
    ["MCQ", "FITB", "Order", "Pair", "CP", "Lesson"],
    "Expected all 6 quiz hint modes in order",
  );

  const seenStepIds = new Set<string>();
  const referencedTutorialKeys = new Set<string>();

  for (const mode of QUIZ_UI_HINT_ORDER) {
    const config = getQuizUiHint(mode);
    assert.equal(config.mode, mode, `${mode} config.mode matches key`);
    assert.ok(config.badge.trim().length > 0, `${mode} badge is non-empty`);
    assert.ok(config.title.trim().length > 0, `${mode} title is non-empty`);
    assert.ok(
      config.shortHint.trim().length > 0,
      `${mode} shortHint is non-empty`,
    );
    assert.ok(config.summary.trim().length > 0, `${mode} summary is non-empty`);
    assert.ok(
      config.steps.length >= 4,
      `${mode} walkthrough should have at least 4 guided steps (got ${config.steps.length})`,
    );

    for (const step of config.steps) {
      assert.ok(step.id.trim().length > 0, `${mode} step.id non-empty`);
      assert.ok(!seenStepIds.has(step.id), `Duplicate step id: ${step.id}`);
      seenStepIds.add(step.id);

      assert.ok(step.title.trim().length > 0, `${step.id} title non-empty`);
      assert.ok(step.whatToDo.trim().length > 0, `${step.id} whatToDo non-empty`);
      assert.ok(
        step.actionLabel.trim().length > 0,
        `${step.id} actionLabel non-empty`,
      );
      assert.ok(
        step.targetSelectors.length >= 1,
        `${step.id} defines at least one target selector`,
      );

      for (const selector of step.targetSelectors) {
        const match = /^\[data-tutorial="([^"]+)"\]$/.exec(selector);
        assert.ok(
          match,
          `${step.id} uses clean data-tutorial selector format: ${selector}`,
        );
        referencedTutorialKeys.add(match[1]);
      }
    }
  }
  console.log(
    `  ✓ Validated all 6 modes (${seenStepIds.size} unique walkthrough steps)`,
  );

  // 2. Mode normalization, aliases, fallback, and Lesson override
  assert.equal(resolveQuizHintMode("mcq"), "MCQ");
  assert.equal(resolveQuizHintMode("Multiple Choice"), "MCQ");
  assert.equal(resolveQuizHintMode("FITB"), "FITB");
  assert.equal(resolveQuizHintMode("ftb"), "FITB");
  assert.equal(resolveQuizHintMode("order"), "Order");
  assert.equal(resolveQuizHintMode("Pair"), "Pair");
  assert.equal(resolveQuizHintMode("code_problem"), "CP");
  assert.equal(resolveQuizHintMode("cp"), "CP");
  assert.equal(resolveQuizHintMode("lesson"), "Lesson");
  assert.equal(resolveQuizHintMode("unknown"), "MCQ");
  assert.equal(resolveQuizHintMode(undefined), "MCQ");
  assert.equal(resolveQuizHintMode(null), "MCQ");
  assert.equal(resolveQuizHintMode("MCQ", true), "Lesson");
  console.log("  ✓ Mode normalization, aliases, fallback, and Lesson override passed");

  // 3. Domain-accurate UI interaction details
  assert.ok(
    QUIZ_UI_HINTS.MCQ.steps.some((s) => s.whatToDo.includes("1–5")),
    "MCQ tutorial covers 1-5 shortcuts",
  );
  assert.ok(
    QUIZ_UI_HINTS.FITB.steps.some((s) =>
      s.whatToDo.toLowerCase().includes("case-insensitive"),
    ),
    "FITB tutorial explains case-insensitive evaluation",
  );
  assert.ok(
    QUIZ_UI_HINTS.Order.steps.some((s) => s.whatToDo.includes("⋮⋮")) &&
      QUIZ_UI_HINTS.Order.steps.some(
        (s) => s.whatToDo.includes("↑") && s.whatToDo.includes("↓"),
      ),
    "Order tutorial covers drag handle and ↑/↓ arrow controls",
  );
  assert.ok(
    QUIZ_UI_HINTS.Pair.steps.some((s) =>
      s.whatToDo.toLowerCase().includes("automatically"),
    ),
    "Pair tutorial explains automatic completion",
  );
  assert.ok(
    QUIZ_UI_HINTS.CP.steps.some(
      (s) => s.title.includes("index.html") || s.whatToDo.includes("index.html"),
    ) &&
      QUIZ_UI_HINTS.CP.steps.some((s) => s.whatToDo.includes("Ctrl/Cmd + Enter")),
    "CP tutorial covers file tabs and Ctrl/Cmd + Enter",
  );
  console.log("  ✓ Domain-accurate per-mode walkthrough guidance verified");

  // 4. Spotlight, Popover & Arrow Geometry Math
  const desktopSpotlight = computeSpotlightRect(
    { left: 200, top: 140, width: 320, height: 120 },
    1280,
    720,
    8,
  );
  assert.deepEqual(desktopSpotlight, {
    left: 192,
    top: 132,
    width: 336,
    height: 136,
  });

  const clampedSpotlight = computeSpotlightRect(
    { left: 0, top: 0, width: 2000, height: 1000 },
    375,
    667,
    8,
  );
  assert.ok(
    clampedSpotlight.left >= 4 &&
      clampedSpotlight.top >= 4 &&
      clampedSpotlight.left + clampedSpotlight.width <= 371 &&
      clampedSpotlight.top + clampedSpotlight.height <= 663,
    "computeSpotlightRect clamps cleanly inside viewport bounds",
  );

  const bottomLayout = computePopoverLayout(
    desktopSpotlight,
    380,
    260,
    1280,
    720,
    "bottom",
  );
  assert.equal(bottomLayout.placement, "bottom");
  assert.ok(
    bottomLayout.top >= desktopSpotlight.top + desktopSpotlight.height,
    "Bottom popover sits cleanly below spotlight without overlap",
  );

  const mobileLayout = computePopoverLayout(
    { left: 20, top: 520, width: 335, height: 80 },
    380,
    280,
    375,
    667,
    "bottom",
  );
  assert.ok(
    mobileLayout.left >= 12 &&
      mobileLayout.top >= 12 &&
      mobileLayout.left + mobileLayout.width <= 363 &&
      mobileLayout.top + 280 <= 655,
    "Mobile popover stays completely within 375x667 viewport",
  );

  const arrow = computeArrowPath(
    {
      left: bottomLayout.left,
      top: bottomLayout.top,
      width: bottomLayout.width,
      height: 260,
    },
    desktopSpotlight,
    bottomLayout.placement,
  );
  assert.ok(
    arrow.path.startsWith("M ") && arrow.path.includes(" Q "),
    `Expected quadratic Bezier SVG arrow path, got: ${arrow.path}`,
  );
  assert.ok(
    arrow.end.y < arrow.start.y,
    "Bottom-placed card arrow points upward toward spotlight",
  );

  const cutoutPath = buildBackdropCutoutPath(1280, 720, desktopSpotlight);
  assert.ok(
    cutoutPath.startsWith("M 0 0 H 1280 V 720 H 0 Z M "),
    "buildBackdropCutoutPath constructs full-screen outer + rounded hole cutout",
  );

  // Interpolation helpers for smooth 60fps spotlight gliding
  assert.equal(lerp(10, 110, 0), 10);
  assert.equal(lerp(10, 110, 1), 110);
  assert.equal(lerp(10, 110, 0.25), 35);
  assert.equal(easeOutCubic(-0.5), 0);
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.equal(easeOutCubic(1.5), 1);
  assert.ok(
    easeOutCubic(0.5) > 0.5 && easeOutCubic(0.5) < 1,
    "easeOutCubic accelerates early and decelerates smoothly",
  );
  const midRect = lerpRect(
    { left: 100, top: 200, width: 300, height: 80 },
    { left: 201, top: 301, width: 400, height: 120 },
    0.5,
  );
  assert.deepEqual(
    midRect,
    { left: 150.5, top: 250.5, width: 350, height: 100 },
    "lerpRect preserves sub-pixel fractional precision",
  );
  console.log(
    "  ✓ Spotlight, popover layout, cutout, arrow & interpolation math verified",
  );

  // 5. Non-repeating first step on FITB / Order / Pair
  assert.equal(QUIZ_UI_HINTS.FITB.steps.length, 4);
  assert.equal(QUIZ_UI_HINTS.FITB.steps[0].id, "fitb-input");
  assert.equal(QUIZ_UI_HINTS.Order.steps.length, 5);
  assert.equal(QUIZ_UI_HINTS.Order.steps[0].id, "order-list");
  assert.equal(QUIZ_UI_HINTS.Pair.steps.length, 4);
  assert.equal(QUIZ_UI_HINTS.Pair.steps[0].id, "pair-left");
  for (const mode of ["FITB", "Order", "Pair"] as const) {
    assert.ok(
      !QUIZ_UI_HINTS[mode].steps.some((step) =>
        step.targetSelectors.includes('[data-tutorial="quiz-prompt"]'),
      ),
      `${mode} starts on type-specific UI without repeating generic prompt hint`,
    );
  }
  console.log("  ✓ Non-duplicate first-step progression verified for FITB/Order/Pair");

  // 6. Unit 1 / Section 1 eligibility gating helper
  assert.equal(ONBOARDING_TUTORIAL_SECTION_ID, 1);
  assert.equal(ONBOARDING_TUTORIAL_UNIT_ORDER, 1);
  assert.equal(ONBOARDING_TUTORIAL_FALLBACK_UNIT_ID, 98);

  assert.equal(isOnboardingTutorialUnit({ secId: 1, unitOrder: 1 }), true);
  assert.equal(isOnboardingTutorialUnit({ secId: "1", unitOrder: "1" }), true);
  assert.equal(isOnboardingTutorialUnit({ unitId: 98 }), true);
  assert.equal(isOnboardingTutorialUnit({ secId: 1, unitOrder: 2 }), false);
  assert.equal(isOnboardingTutorialUnit({ secId: 2, unitOrder: 1 }), false);
  assert.equal(
    isOnboardingTutorialUnit({ secId: 2, unitOrder: 1, unitId: 98 }),
    false,
  );
  assert.equal(
    isOnboardingTutorialUnit({ secId: 1, unitOrder: 1, isSkipMode: true }),
    false,
  );
  assert.equal(isOnboardingTutorialUnit({ unitId: 103 }), false);
  console.log("  ✓ Unit 1 Section 1 strict eligibility helper verified");

  // 7. Unit 1 runtime all-quiz-type guarantee + evaluation validity
  const singleMcq: QuizData[] = [
    {
      quiz_id: 9001,
      cat_id: 1,
      sec_id: 1,
      type_name: "MCQ",
      question_text: "Which element defines HTML content?",
      quiz_payload: {
        options: ["<html>", "<css>"],
        correct_index: 0,
      },
    },
  ];
  const augmentedUnit1 = ensureUnit1AllQuizTypes(singleMcq, {
    secId: 1,
    unitOrder: 1,
    unitId: 98,
  });
  const augmentedModes = new Set(
    augmentedUnit1.map((q) => resolveQuizHintMode(q.type_name)),
  );
  for (const requiredType of REQUIRED_UNIT1_QUIZ_TYPES) {
    assert.ok(
      augmentedModes.has(requiredType),
      `Unit 1 augmented list includes ${requiredType}`,
    );
  }
  assert.equal(augmentedUnit1[0].quiz_id, 9001, "Preserves original DB quiz first");
  for (const item of augmentedUnit1) {
    const evalResult = evaluateQuizAnswer(item, getCorrectValue(item));
    assert.equal(
      evalResult.correct,
      true,
      `Unit 1 quiz type ${item.type_name} evaluates cleanly with its correct answer`,
    );
  }

  // No-op when all types already exist
  assert.equal(
    ensureUnit1AllQuizTypes(augmentedUnit1, { secId: 1, unitOrder: 1 }),
    augmentedUnit1,
    "Does not duplicate quiz types when Unit 1 already has all 4",
  );
  // No-op for Unit 2+, Section 2+, or skip mode
  assert.equal(
    ensureUnit1AllQuizTypes(singleMcq, { secId: 1, unitOrder: 2 }),
    singleMcq,
  );
  assert.equal(
    ensureUnit1AllQuizTypes(singleMcq, { secId: 2, unitOrder: 1 }),
    singleMcq,
  );
  assert.equal(
    ensureUnit1AllQuizTypes(singleMcq, {
      secId: 1,
      unitOrder: 1,
      isSkipMode: true,
    }),
    singleMcq,
  );
  console.log("  ✓ Unit 1 runtime all-quiz-type coverage & scoping verified");

  // 8. Live DOM anchor integrity across component source files
  const anchoredSources = [
    "app/quiz/components/QuizHeader.tsx",
    "app/components/quiz/InlineCodeText.tsx",
    "app/quiz/components/QuizFooter.tsx",
    "app/components/quiz/HeartsDisplay.tsx",
    "app/components/quiz/MCQ.tsx",
    "app/components/quiz/FITB.tsx",
    "app/components/quiz/Order.tsx",
    "app/components/quiz/Pair.tsx",
    "app/components/LessonCard.tsx",
    "app/quiz-cp/components/CpInstructionsPane.tsx",
    "app/quiz-cp/components/CpEditorPane.tsx",
    "app/quiz-cp/components/CpPreviewPane.tsx",
    "app/quiz-cp/components/CpMobileChrome.tsx",
  ]
    .map(readSource)
    .join("\n");

  for (const key of referencedTutorialKeys) {
    assert.ok(
      anchoredSources.includes(`"${key}"`),
      `Missing live component anchor for data-tutorial="${key}"`,
    );
  }
  console.log(
    `  ✓ All ${referencedTutorialKeys.size} live component data-tutorial anchors verified`,
  );

  // 9. Smooth overlay animation, Unit 1 gating & pass-guard preservation
  const overlaySource = readSource("app/components/quiz/QuizTutorialOverlay.tsx");
  assert.ok(
    overlaySource.includes("easeOutCubic") &&
      overlaySource.includes("lerpRect") &&
      overlaySource.includes("is-ready") &&
      overlaySource.includes("settleAndRevealInitial"),
    "QuizTutorialOverlay implements settle-before-reveal + 60fps easeOutCubic lerpRect transitions",
  );

  const quizCssSource = readSource("public/css/quiz.css");
  assert.ok(
    quizCssSource.includes(".quiz-tutorial-overlay.is-ready") &&
      quizCssSource.includes("html[data-motion=\"reduce\"] .quiz-tutorial-overlay"),
    "public/css/quiz.css gates overlay opacity on .is-ready and respects reduced motion",
  );

  const quizLanding = readSource("app/quiz/QuizLandingClient.tsx");
  assert.ok(
    quizLanding.includes("QuizTutorialOverlay") &&
      quizLanding.includes("useIsHydrated") &&
      quizLanding.includes("shouldAutoOpenTutorial") &&
      quizLanding.includes("resolvedIsTutorialUnit") &&
      quizLanding.includes("showHelpButton={resolvedIsTutorialUnit}") &&
      quizLanding.includes("showHintBar={resolvedIsTutorialUnit && !isTutorialOpen}") &&
      quizLanding.includes("isTutorialOpen && (") &&
      quizLanding.includes("key={activeHintMode}") &&
      quizLanding.includes(
        "const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);",
      ),
    "QuizLandingClient wires Unit 1 gating, clean overlay remount, hidden hint bar during overlay & strict pass guard",
  );

  const cpRunner = readSource("app/quiz-cp/CodeProblemRunner.tsx");
  assert.ok(
    cpRunner.includes("QuizTutorialOverlay") &&
      cpRunner.includes('mode="CP"') &&
      cpRunner.includes("onPrepareStep={handlePrepareTutorialStep}") &&
      cpRunner.includes("resolvedIsTutorialUnit") &&
      cpRunner.includes("showHelpButton={resolvedIsTutorialUnit}") &&
      cpRunner.includes("showHintBar={resolvedIsTutorialUnit && !isTutorialOpen}") &&
      cpRunner.includes("isTutorialOpen && ("),
    "CodeProblemRunner wires Unit 1 gating + mobile tab preparation + clean overlay mount",
  );

  const skipPage = readSource("app/quiz-cp/skip/[targetSecId]/page.tsx");
  assert.ok(
    skipPage.includes("isTutorialUnit={false}"),
    "Skip section CP route explicitly disables onboarding tutorial",
  );

  // 10. Migration 017 validation
  const migrationUp = readSource("migrations/017_unit1_all_quiz_types.sql");
  const migrationRollback = readSource(
    "migrations/017_unit1_all_quiz_types_rollback.sql",
  );
  assert.ok(
    !migrationUp.toUpperCase().includes("DELIMITER"),
    "Migration 017 avoids DELIMITER syntax for mysql2 multi-statement compatibility",
  );
  assert.ok(
    migrationUp.includes("quiz_mcq_option_tbl") &&
      migrationUp.includes("quiz_fitb_tbl") &&
      migrationUp.includes("quiz_order_item_tbl") &&
      migrationUp.includes("quiz_pair_tbl") &&
      migrationUp.includes("unit_assessment_tbl") &&
      migrationUp.includes("assessment_step_tbl") &&
      migrationUp.includes("'017_unit1_all_quiz_types.sql'"),
    "Migration 017 idempotently provisions MCQ, FITB, Order, Pair, CP & _migrations entry",
  );
  assert.ok(
    migrationRollback.includes("DELETE FROM `quiz_tbl`") &&
      migrationRollback.includes("'017_unit1_all_quiz_types.sql'"),
    "Rollback 017 cleans up synthetic onboarding rows cleanly",
  );
  console.log("  ✓ Overlay animation, Unit 1 route gating & Migration 017 verified");

  console.log("\n🎉 All interactive arrow tutorial tests passed!");
}

runTests();
