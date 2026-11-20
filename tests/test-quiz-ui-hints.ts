import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildBackdropCutoutPath,
  computeArrowPath,
  computePopoverLayout,
  computeSpotlightRect,
} from "../lib/quiz-tutorial-geometry";
import {
  getQuizUiHint,
  QUIZ_UI_HINT_ORDER,
  QUIZ_UI_HINTS,
  resolveQuizHintMode,
} from "../lib/quiz-ui-hints";

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
  console.log("  ✓ Spotlight, popover layout, cutout & curved arrow geometry verified");

  // 5. Live DOM anchor integrity across component source files
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

  // 6. Overlay integration & pass-guard preservation
  const quizLanding = readSource("app/quiz/QuizLandingClient.tsx");
  assert.ok(
    quizLanding.includes("QuizTutorialOverlay") &&
      quizLanding.includes("useIsHydrated") &&
      quizLanding.includes("shouldAutoOpenTutorial") &&
      quizLanding.includes(
        "const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);",
      ),
    "QuizLandingClient wires QuizTutorialOverlay + hydration-safe auto-start + strict pass guard",
  );

  const cpRunner = readSource("app/quiz-cp/CodeProblemRunner.tsx");
  assert.ok(
    cpRunner.includes("QuizTutorialOverlay") &&
      cpRunner.includes('mode="CP"') &&
      cpRunner.includes("onPrepareStep={handlePrepareTutorialStep}"),
    "CodeProblemRunner wires QuizTutorialOverlay with mobile tab preparation",
  );
  console.log("  ✓ QuizLandingClient & CodeProblemRunner wiring verified");

  console.log("\n🎉 All interactive arrow tutorial tests passed!");
}

runTests();
