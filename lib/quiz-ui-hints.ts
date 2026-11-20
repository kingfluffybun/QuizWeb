export type QuizHintMode = "MCQ" | "FITB" | "Order" | "Pair" | "CP" | "Lesson";

export type TutorialPlacement = "top" | "bottom" | "left" | "right";

export interface QuizHintShortcut {
  keys: string[];
  label: string;
}

export interface QuizTutorialStep {
  id: string;
  title: string;
  whatToDo: string;
  actionLabel: string;
  targetSelectors: string[];
  preferredPlacement?: TutorialPlacement;
  optionalIfMissing?: boolean;
  cpMobileTab?: "task" | "code" | "preview";
  device?: "all" | "desktop" | "mobile";
  shortcuts?: QuizHintShortcut[];
}

export interface QuizUiHintConfig {
  mode: QuizHintMode;
  badge: string;
  title: string;
  shortHint: string;
  summary: string;
  steps: QuizTutorialStep[];
}

export const QUIZ_UI_HINT_ORDER: readonly QuizHintMode[] = [
  "MCQ",
  "FITB",
  "Order",
  "Pair",
  "CP",
  "Lesson",
];

export const QUIZ_UI_HINTS: Record<QuizHintMode, QuizUiHintConfig> = {
  MCQ: {
    mode: "MCQ",
    badge: "Multiple Choice",
    title: "Multiple Choice Walkthrough",
    shortHint: "Pick an option (or press 1–5), then click Submit or press Enter.",
    summary: "Choose the single best answer from the numbered choice cards.",
    steps: [
      {
        id: "mcq-prompt",
        title: "Read the Question",
        whatToDo:
          "Read the prompt carefully. If a code snippet appears alongside it, inspect every line before picking an option.",
        actionLabel: "Review the prompt highlighted above",
        targetSelectors: ['[data-tutorial="quiz-prompt"]'],
        preferredPlacement: "bottom",
      },
      {
        id: "mcq-options",
        title: "Pick One Answer",
        whatToDo:
          "Click or tap the numbered option card you think is right — or press keys 1–5 on your keyboard for instant selection.",
        actionLabel: "Click an option card or press 1–5",
        targetSelectors: ['[data-tutorial="mcq-options"]'],
        preferredPlacement: "top",
        shortcuts: [{ keys: ["1", "–", "5"], label: "Select option" }],
      },
      {
        id: "mcq-submit",
        title: "Check Your Answer",
        whatToDo:
          "Click Submit (or press Enter) to check your choice. Once feedback appears, click Continue or press Enter to advance.",
        actionLabel: "Click Submit or press Enter",
        targetSelectors: ['[data-tutorial="quiz-submit"]'],
        preferredPlacement: "top",
        shortcuts: [{ keys: ["Enter"], label: "Submit / Continue" }],
      },
      {
        id: "mcq-skip",
        title: "Skip Without Losing Hearts",
        whatToDo:
          "Unsure about a question? Click Skip to reveal the correct answer without losing a heart — it resets your streak and returns later in the session.",
        actionLabel: "Use Skip anytime before submitting",
        targetSelectors: ['[data-tutorial="quiz-skip"]'],
        preferredPlacement: "top",
      },
      {
        id: "mcq-hearts",
        title: "Watch Your Hearts & Replay",
        whatToDo:
          "Wrong answers cost 1 heart (out of 5). You can replay this arrow tutorial anytime using the ? button in the header or pressing ?.",
        actionLabel: "Keep hearts above 0 to pass the unit",
        targetSelectors: ['[data-tutorial="quiz-hearts"]'],
        preferredPlacement: "bottom",
        shortcuts: [{ keys: ["?"], label: "Replay tutorial" }],
      },
    ],
  },
  FITB: {
    mode: "FITB",
    badge: "Fill in the Blank",
    title: "Fill in the Blank Walkthrough",
    shortHint:
      "Type the missing word or syntax (case-insensitive), then press Enter or Submit.",
    summary: "Type the missing keyword, value, or syntax into the response box.",
    steps: [
      {
        id: "fitb-input",
        title: "Type Your Answer Here",
        whatToDo:
          "Type directly inside this auto-focused box. Evaluation is case-insensitive and automatically ignores leading or trailing spaces.",
        actionLabel: "Click and type the missing word or token",
        targetSelectors: ['[data-tutorial="fitb-input"]'],
        preferredPlacement: "top",
      },
      {
        id: "fitb-submit",
        title: "Submit With Click or Enter",
        whatToDo:
          "Click Submit or press Enter right from the input box to check your answer immediately.",
        actionLabel: "Press Enter or click Submit",
        targetSelectors: ['[data-tutorial="quiz-submit"]'],
        preferredPlacement: "top",
        shortcuts: [{ keys: ["Enter"], label: "Submit / Continue" }],
      },
      {
        id: "fitb-skip",
        title: "Reveal & Retry Later",
        whatToDo:
          "If you are stuck, click Skip to see the expected answer without losing a heart and retry this question later in the run.",
        actionLabel: "Click Skip if you want to see the answer first",
        targetSelectors: ['[data-tutorial="quiz-skip"]'],
        preferredPlacement: "top",
      },
      {
        id: "fitb-progress",
        title: "Track Progress & Review Back",
        whatToDo:
          "The bar shows completed questions across the unit, and ← lets you review previous questions in this session.",
        actionLabel: "Replay this guide via the ? header button",
        targetSelectors: ['[data-tutorial="quiz-progress"]'],
        preferredPlacement: "bottom",
      },
    ],
  },
  Order: {
    mode: "Order",
    badge: "Reorder",
    title: "Reorder Sequence Walkthrough",
    shortHint:
      "Drag cards (or tap ↑ / ↓ arrows) to sort them from 1 to last, then Submit.",
    summary: "Arrange every step or token into its exact top-to-bottom sequence.",
    steps: [
      {
        id: "order-list",
        title: "Arrange Numbered Slots Top to Bottom",
        whatToDo:
          "Each card sits beside a numbered slot starting at 1. On desktop, click anywhere on a card and drag it over another slot to swap positions.",
        actionLabel: "Drag cards vertically to sort slots 1 → N",
        targetSelectors: ['[data-tutorial="order-list"]'],
        preferredPlacement: "top",
        device: "desktop",
      },
      {
        id: "order-grip",
        title: "Drag Handle for Touch & Mouse",
        whatToDo:
          "On touchscreens or mouse, press and hold the grip dots (⋮⋮) on the left of a card, slide up or down to the target slot, and release.",
        actionLabel: "Hold the ⋮⋮ grip handle and slide into place",
        targetSelectors: ['[data-tutorial="order-grip"]'],
        preferredPlacement: "right",
        device: "mobile",
      },
      {
        id: "order-arrows",
        title: "Or Move With ↑ / ↓ Buttons",
        whatToDo:
          "Prefer precise taps instead of dragging? Use the ↑ and ↓ arrow buttons on the right side of any item to move it one slot up or down.",
        actionLabel: "Tap ↑ or ↓ to nudge an item one slot",
        targetSelectors: ['[data-tutorial="order-move-btns"]'],
        preferredPlacement: "left",
      },
      {
        id: "order-submit",
        title: "Lock In Your Sequence",
        whatToDo:
          "When slots 1 through the end match the correct order, click Submit (or press Enter) to validate the whole sequence.",
        actionLabel: "Click Submit or press Enter",
        targetSelectors: ['[data-tutorial="quiz-submit"]'],
        preferredPlacement: "top",
        shortcuts: [{ keys: ["Enter"], label: "Submit / Continue" }],
      },
      {
        id: "order-hearts",
        title: "Hearts & Skip Rules",
        whatToDo:
          "An incorrect sequence costs 1 heart, while Skip shows the exact order without losing a heart. Press ? anytime to replay this walkthrough.",
        actionLabel: "Protect your hearts or use Skip if needed",
        targetSelectors: ['[data-tutorial="quiz-hearts"]'],
        preferredPlacement: "bottom",
        shortcuts: [{ keys: ["?"], label: "Replay tutorial" }],
      },
    ],
  },
  Pair: {
    mode: "Pair",
    badge: "Match Pairs",
    title: "Match Pairs Walkthrough",
    shortHint:
      "Select one item from each column to match them — completes automatically!",
    summary:
      "Connect each item on the left column with its matching pair on the right column.",
    steps: [
      {
        id: "pair-left",
        title: "Step 1: Pick a Left Card",
        whatToDo:
          "Click or tap any card in the left column to select it (you can also start on the right column if you prefer).",
        actionLabel: "Select an unmatched card on the left",
        targetSelectors: ['[data-tutorial="pair-left"]'],
        preferredPlacement: "right",
      },
      {
        id: "pair-right",
        title: "Step 2: Pick Its Match on the Right",
        whatToDo:
          "Now click the matching card on the right column. Correct matches turn green and lock permanently in place!",
        actionLabel: "Tap the matching partner on the right",
        targetSelectors: ['[data-tutorial="pair-right"]'],
        preferredPlacement: "left",
      },
      {
        id: "pair-hearts",
        title: "Mismatches Cost 1 Heart Immediately",
        whatToDo:
          "Be careful — selecting two cards that do not belong together flashes red and removes 1 heart right away.",
        actionLabel: "Double-check each pair before clicking the second card",
        targetSelectors: ['[data-tutorial="quiz-hearts"]'],
        preferredPlacement: "bottom",
      },
      {
        id: "pair-continue",
        title: "Auto-Completes & Continue",
        whatToDo:
          "Once every pair is matched, the question completes automatically without clicking Submit — just press Enter or click Continue.",
        actionLabel: "Match all pairs, then press Continue / Enter",
        targetSelectors: ['[data-tutorial="quiz-submit"]'],
        preferredPlacement: "top",
        shortcuts: [
          { keys: ["Enter"], label: "Continue when matched" },
          { keys: ["?"], label: "Replay tutorial" },
        ],
      },
    ],
  },
  CP: {
    mode: "CP",
    badge: "Code Problem",
    title: "Code Problem Workspace Walkthrough",
    shortHint:
      "Follow the current step, switch HTML/CSS/JS tabs, then press Ctrl/Cmd+Enter or Submit Step.",
    summary:
      "Build and validate working HTML, CSS, and JavaScript code step by step.",
    steps: [
      {
        id: "cp-instructions",
        title: "Read the Highlighted Current Step",
        whatToDo:
          "Start here: follow the purple-highlighted Current step. You must solve steps in order — and if a step offers a Hint button, click it for a coding clue.",
        actionLabel: "Complete the active Current step first",
        targetSelectors: ['[data-tutorial="cp-instructions"]'],
        preferredPlacement: "right",
        cpMobileTab: "task",
      },
      {
        id: "cp-files",
        title: "Switch index.html, style.css & script.js",
        whatToDo:
          "Use these file tabs to switch between HTML, CSS, and JavaScript. A small dot marks files that already contain starter or written code.",
        actionLabel: "Click the file tab required by the current step",
        targetSelectors: ['[data-tutorial="cp-file-tabs"]'],
        preferredPlacement: "bottom",
        cpMobileTab: "code",
      },
      {
        id: "cp-editor",
        title: "Write Code in the Live Editor",
        whatToDo:
          "Edit the template inside the Monaco code editor. On mobile screens, a quick-symbol bar above the bottom buttons inserts Tab, tags, quotes, and braces.",
        actionLabel: "Replace placeholders or write the step's code here",
        targetSelectors: ['[data-tutorial="cp-editor"]'],
        preferredPlacement: "left",
        cpMobileTab: "code",
      },
      {
        id: "cp-preview",
        title: "Inspect Live Preview & Console",
        whatToDo:
          "Your HTML and CSS render live here! Use the Desktop/Mobile toggle at the top-right to test responsive layouts, and expand Console at the bottom for JS logs.",
        actionLabel: "Check your visual output and Console logs",
        targetSelectors: ['[data-tutorial="cp-preview"]'],
        preferredPlacement: "left",
        cpMobileTab: "preview",
      },
      {
        id: "cp-reset-run",
        title: "Reset Starter Code or Run JS Safely",
        whatToDo:
          "Click Reset (↺) to restore the step's starter code anytime. When editing script.js, click Run (▶) to execute your JS in the preview and Console without losing hearts.",
        actionLabel: "Test freely with ▶ Run or restore with ↺ Reset",
        targetSelectors: [
          '[data-tutorial="cp-reset-run"]',
          '[data-tutorial="cp-mobile-reset-run"]',
        ],
        preferredPlacement: "top",
        cpMobileTab: "code",
      },
      {
        id: "cp-submit",
        title: "Submit Step for Validation",
        whatToDo:
          "Ready to check your work? Click Submit Step or press Ctrl/Cmd + Enter. Failed checks highlight the exact line and issue while deducting 1 heart.",
        actionLabel: "Click Submit Step or press Ctrl/Cmd + Enter",
        targetSelectors: [
          '[data-tutorial="cp-submit"]',
          '[data-tutorial="cp-mobile-submit"]',
        ],
        preferredPlacement: "top",
        cpMobileTab: "code",
        shortcuts: [{ keys: ["Ctrl/Cmd", "Enter"], label: "Submit step" }],
      },
      {
        id: "cp-hearts",
        title: "Hearts & Replay Tutorial",
        whatToDo:
          "Keep at least 1 heart while completing every step in the assessment. Click ? in the header or press ? (outside the editor) anytime to replay this guide.",
        actionLabel: "Click ? in the top bar anytime to replay",
        targetSelectors: ['[data-tutorial="quiz-hearts"]'],
        preferredPlacement: "bottom",
        shortcuts: [{ keys: ["?"], label: "Replay tutorial (outside editor)" }],
      },
    ],
  },
  Lesson: {
    mode: "Lesson",
    badge: "Lesson Slide",
    title: "Lesson Slide Walkthrough",
    shortHint:
      "Read the slide, toggle Code/Result on examples, then click Next or Start Quiz.",
    summary:
      "Walk through lesson concepts and interactive code previews before starting the quiz.",
    steps: [
      {
        id: "lesson-content",
        title: "Study the Lesson Slide",
        whatToDo:
          "Read each explanation card carefully — key concepts and highlighted inline tags prepare you directly for the quiz questions ahead.",
        actionLabel: "Read through the slide explanation",
        targetSelectors: ['[data-tutorial="lesson-content"]'],
        preferredPlacement: "bottom",
      },
      {
        id: "lesson-code-toggle",
        title: "Toggle Live Code & Result",
        whatToDo:
          "When a slide includes a code frame, click Result to see how the browser renders the example live, then switch back to Code to inspect the source.",
        actionLabel: "Switch between Code and Result tabs",
        targetSelectors: ['[data-tutorial="lesson-code-toggle"]'],
        preferredPlacement: "bottom",
        optionalIfMissing: true,
      },
      {
        id: "lesson-nav",
        title: "Navigate Slides & Start Quiz",
        whatToDo:
          "Use Previous and Next to move between slides. On the final slide, click Start Quiz (or Finish Lesson on lesson-only units) to begin.",
        actionLabel: "Click Next or Start Quiz in the bottom bar",
        targetSelectors: ['[data-tutorial="lesson-nav"]'],
        preferredPlacement: "top",
      },
      {
        id: "lesson-progress",
        title: "Track Unit Progress & Replay",
        whatToDo:
          "The progress bar tracks all slides plus quiz items in the unit. Click ? anytime or press ? to replay this interactive walkthrough.",
        actionLabel: "Click ? anytime to replay this walkthrough",
        targetSelectors: ['[data-tutorial="quiz-progress"]'],
        preferredPlacement: "bottom",
        shortcuts: [{ keys: ["?"], label: "Replay tutorial" }],
      },
    ],
  },
};

export function resolveQuizHintMode(
  typeName?: string | null,
  isShowingLesson = false,
): QuizHintMode {
  if (isShowingLesson) return "Lesson";

  const normalized = typeName?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "mcq":
    case "multiple choice":
      return "MCQ";
    case "fitb":
    case "ftb":
    case "fill in the blank":
      return "FITB";
    case "order":
    case "reorder":
      return "Order";
    case "pair":
    case "match":
    case "match pairs":
      return "Pair";
    case "cp":
    case "code_problem":
    case "code problem":
      return "CP";
    case "lesson":
      return "Lesson";
    default:
      return "MCQ";
  }
}

export function getQuizUiHint(mode: QuizHintMode): QuizUiHintConfig {
  return QUIZ_UI_HINTS[mode] ?? QUIZ_UI_HINTS.MCQ;
}

export const ONBOARDING_TUTORIAL_SECTION_ID = 1;
export const ONBOARDING_TUTORIAL_UNIT_ORDER = 1;
export const ONBOARDING_TUTORIAL_FALLBACK_UNIT_ID = 98;

function parsePositiveInt(value?: number | string | null): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function isOnboardingTutorialUnit({
  secId,
  unitOrder,
  unitId,
  isSkipMode = false,
}: {
  secId?: number | string | null;
  unitOrder?: number | string | null;
  unitId?: number | string | null;
  isSkipMode?: boolean;
}): boolean {
  if (isSkipMode) return false;
  const parsedSecId = parsePositiveInt(secId);
  const parsedUnitOrder = parsePositiveInt(unitOrder);
  if (parsedSecId !== null && parsedUnitOrder !== null) {
    return (
      parsedSecId === ONBOARDING_TUTORIAL_SECTION_ID &&
      parsedUnitOrder === ONBOARDING_TUTORIAL_UNIT_ORDER
    );
  }
  const parsedUnitId = parsePositiveInt(unitId);
  return (
    parsedUnitId === ONBOARDING_TUTORIAL_FALLBACK_UNIT_ID &&
    (parsedSecId === null || parsedSecId === ONBOARDING_TUTORIAL_SECTION_ID)
  );
}
