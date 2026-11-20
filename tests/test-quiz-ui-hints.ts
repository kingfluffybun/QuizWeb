import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
  console.log("=== Running Per-Quiz-Type UI Interaction Hints Test Suite ===");

  // 1. All 6 modes exist and have complete structured guidance
  assert.deepEqual(
    QUIZ_UI_HINT_ORDER,
    ["MCQ", "FITB", "Order", "Pair", "CP", "Lesson"],
    "Expected all 6 quiz hint modes in order",
  );

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
      config.steps.length >= 2,
      `${mode} has at least 2 detailed UI steps`,
    );
    for (const step of config.steps) {
      assert.ok(step.title.trim().length > 0, `${mode} step title non-empty`);
      assert.ok(step.detail.trim().length > 0, `${mode} step detail non-empty`);
    }
  }
  console.log("  ✓ All 6 quiz hint modes validated for structure and completeness");

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

  // 3. Domain-accurate UI interaction coverage per quiz type
  const mcqText = `${QUIZ_UI_HINTS.MCQ.shortHint} ${QUIZ_UI_HINTS.MCQ.steps.map((s) => s.detail).join(" ")}`;
  assert.ok(mcqText.includes("1–5"), "MCQ guidance documents 1-5 shortcuts");

  const fitbText = `${QUIZ_UI_HINTS.FITB.shortHint} ${QUIZ_UI_HINTS.FITB.steps.map((s) => s.detail).join(" ")}`;
  assert.ok(
    fitbText.toLowerCase().includes("case-insensitive") ||
      fitbText.toLowerCase().includes("ignores capitalization"),
    "FITB guidance explains case-insensitive matching",
  );

  const orderText = `${QUIZ_UI_HINTS.Order.shortHint} ${QUIZ_UI_HINTS.Order.steps.map((s) => s.detail).join(" ")}`;
  assert.ok(
    orderText.toLowerCase().includes("drag") &&
      orderText.includes("↑") &&
      orderText.includes("↓"),
    "Order guidance covers drag-and-drop and arrow controls",
  );

  const pairText = `${QUIZ_UI_HINTS.Pair.shortHint} ${QUIZ_UI_HINTS.Pair.steps.map((s) => `${s.title} ${s.detail}`).join(" ")}`;
  assert.ok(
    pairText.toLowerCase().includes("column") &&
      pairText.toLowerCase().includes("auto"),
    "Pair guidance covers column selection and automatic completion",
  );

  const cpText = `${QUIZ_UI_HINTS.CP.shortHint} ${QUIZ_UI_HINTS.CP.steps.map((s) => s.detail).join(" ")}`;
  assert.ok(
    cpText.includes("index.html") &&
      cpText.includes("style.css") &&
      cpText.includes("script.js") &&
      cpText.includes("Ctrl/Cmd + Enter"),
    "CP guidance documents HTML/CSS/JS tabs and Ctrl/Cmd + Enter shortcut",
  );
  console.log("  ✓ Per-type UI interaction details verified");

  // 4. Component wiring & existing pass-guard preservation checks
  const quizHeader = readSource("app/quiz/components/QuizHeader.tsx");
  assert.ok(
    quizHeader.includes("quiz-help-button") &&
      quizHeader.includes("onToggleHelp"),
    "QuizHeader wires help button trigger",
  );

  const quizQuestionView = readSource(
    "app/quiz/components/QuizQuestionView.tsx",
  );
  assert.ok(
    quizQuestionView.includes("QuizUiHintBar") &&
      quizQuestionView.includes("resolveQuizHintMode"),
    "QuizQuestionView renders QuizUiHintBar for active question type",
  );

  const quizLandingClient = readSource("app/quiz/QuizLandingClient.tsx");
  assert.ok(
    quizLandingClient.includes("QuizUiHintModal") &&
      quizLandingClient.includes("QuizUiHintBar") &&
      quizLandingClient.includes(
        "const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);",
      ),
    "QuizLandingClient wires hints modal/bar while preserving strict pass guard",
  );

  const cpHeader = readSource("app/quiz-cp/components/CpHeader.tsx");
  assert.ok(
    cpHeader.includes("quiz-help-button") && cpHeader.includes("onToggleHelp"),
    "CpHeader wires help button trigger",
  );

  const cpInstructions = readSource(
    "app/quiz-cp/components/CpInstructionsPane.tsx",
  );
  assert.ok(
    cpInstructions.includes('<QuizUiHintBar mode="CP"'),
    "CpInstructionsPane renders compact QuizUiHintBar for CP mode",
  );

  const cpRunner = readSource("app/quiz-cp/CodeProblemRunner.tsx");
  assert.ok(
    cpRunner.includes("QuizUiHintModal") &&
      cpRunner.includes('activeMode="CP"'),
    "CodeProblemRunner wires QuizUiHintModal for CP mode",
  );
  console.log("  ✓ Component integration checks passed");

  console.log("\n🎉 All quiz UI interaction hint tests passed!");
}

runTests();
