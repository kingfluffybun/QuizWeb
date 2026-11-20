export type QuizHintMode = "MCQ" | "FITB" | "Order" | "Pair" | "CP" | "Lesson";

export interface QuizHintStep {
  title: string;
  detail: string;
  device?: "all" | "desktop" | "mobile";
}

export interface QuizHintShortcut {
  keys: string[];
  label: string;
}

export interface QuizUiHintConfig {
  mode: QuizHintMode;
  badge: string;
  title: string;
  shortHint: string;
  summary: string;
  steps: QuizHintStep[];
  shortcuts: QuizHintShortcut[];
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
    title: "How to Answer Multiple Choice",
    shortHint: "Pick an option (or press 1–5), then click Submit or press Enter.",
    summary: "Choose the single best answer from the numbered cards below.",
    steps: [
      {
        title: "Select an option",
        detail:
          "Click or tap any numbered card, or press keys 1–5 on your keyboard to pick it immediately.",
      },
      {
        title: "Submit & continue",
        detail:
          "Click Submit (or press Enter) to check your answer, then click Continue (or press Enter) to move on.",
      },
      {
        title: "Hearts, Skip & Back",
        detail:
          "Wrong answers cost 1 heart; Skip reveals the answer without costing a heart (resets streak) and queues the question again later. Use ← at the top-left to review earlier questions.",
      },
    ],
    shortcuts: [
      { keys: ["1", "–", "5"], label: "Pick option" },
      { keys: ["Enter"], label: "Submit / Continue" },
      { keys: ["?"], label: "Toggle UI Guide" },
    ],
  },
  FITB: {
    mode: "FITB",
    badge: "Fill in the Blank",
    title: "How to Answer Fill in the Blank",
    shortHint:
      "Type the missing word or syntax (case-insensitive), then press Enter or Submit.",
    summary: "Type your exact answer into the response box to complete the prompt.",
    steps: [
      {
        title: "Type your answer",
        detail:
          "The text box focuses automatically when the question opens. Type the missing word, tag, or value.",
      },
      {
        title: "Forgiving formatting",
        detail:
          "Matching ignores capitalization and extra spaces at the start or end.",
      },
      {
        title: "Submit or Skip",
        detail:
          "Press Enter or click Submit to check your answer. Click Skip to see the answer and retry it later in the session.",
      },
    ],
    shortcuts: [{ keys: ["Enter"], label: "Submit / Continue" }],
  },
  Order: {
    mode: "Order",
    badge: "Reorder",
    title: "How to Reorder Items",
    shortHint:
      "Drag cards (or tap ↑ / ↓ arrows) to sort them from 1 to last, then Submit.",
    summary: "Arrange all items in the correct sequence from top (1.) to bottom.",
    steps: [
      {
        title: "Drag on desktop",
        detail:
          "Click and drag any item card directly onto another numbered slot to move it.",
        device: "desktop",
      },
      {
        title: "Drag on touch devices",
        detail:
          "Press and hold the grip handle (⋮⋮) on the left of a card, slide up or down, and release.",
        device: "mobile",
      },
      {
        title: "Arrow buttons (all devices)",
        detail:
          "Click or tap the ↑ and ↓ buttons on the right side of any item to nudge it one position up or down.",
      },
      {
        title: "Lock in your order",
        detail:
          "Click Submit or press Enter once every numbered slot is in order.",
      },
    ],
    shortcuts: [
      { keys: ["Enter"], label: "Submit / Continue" },
      { keys: ["?"], label: "Toggle UI Guide" },
    ],
  },
  Pair: {
    mode: "Pair",
    badge: "Match Pairs",
    title: "How to Match Pairs",
    shortHint:
      "Select one item from each column to match them — completes automatically!",
    summary:
      "Connect every item in the left column with its matching item on the right.",
    steps: [
      {
        title: "Pick a pair",
        detail:
          "Click or tap one card on the left and its match on the right (you can start from either column).",
      },
      {
        title: "Instant feedback",
        detail:
          "Correct pairs turn green and lock in place; mismatched pairs flash red and immediately cost 1 heart.",
      },
      {
        title: "Auto-completes",
        detail:
          "Once all pairs are matched, the question completes automatically — click Continue or press Enter to move forward.",
      },
    ],
    shortcuts: [
      { keys: ["Enter"], label: "Continue after matching" },
      { keys: ["?"], label: "Toggle UI Guide" },
    ],
  },
  CP: {
    mode: "CP",
    badge: "Code Problem",
    title: "How to Use the Code Problem Workspace",
    shortHint:
      "Follow the current step, switch HTML/CSS/JS tabs, then press Ctrl/Cmd+Enter or Submit Step.",
    summary:
      "Build and validate working HTML, CSS, and JavaScript step by step in the live editor.",
    steps: [
      {
        title: "Follow steps in order",
        detail:
          "Read the highlighted Current step in Instructions. Click a step's Hint button if available for a coding clue (separate from this UI guide).",
      },
      {
        title: "Switch files & edit",
        detail:
          "Use the index.html, style.css, and script.js tabs above the editor (dots mark files with code). Click ↺ Reset anytime to restore the step's starter code.",
      },
      {
        title: "Preview & Run JS safely",
        detail:
          "HTML and CSS update the Preview panel live. In script.js, click ▶ Run to test JavaScript and check output in the Console drawer without losing hearts. Use the Monitor/Phone switch to toggle preview width.",
      },
      {
        title: "Submit Step",
        detail:
          "Click Submit Step or press Ctrl/Cmd + Enter to check your code. Failed checks show line feedback and cost 1 heart.",
      },
      {
        title: "Mobile controls",
        detail:
          "Switch between Task, Code, and Preview tabs, and tap keys on the quick-symbol toolbar (Tab, <, >, {, }, etc.) above the bottom bar.",
        device: "mobile",
      },
    ],
    shortcuts: [
      { keys: ["Ctrl/Cmd", "Enter"], label: "Submit current step" },
      { keys: ["?"], label: "Toggle UI Guide (outside editor)" },
    ],
  },
  Lesson: {
    mode: "Lesson",
    badge: "Lesson Slide",
    title: "How to Navigate Lessons",
    shortHint:
      "Read the slide, toggle Code/Result on examples, then click Next or Start Quiz.",
    summary:
      "Review the lesson slides and live examples before starting the unit quiz.",
    steps: [
      {
        title: "Navigate slides",
        detail:
          "Use Previous / Next in the bottom bar (or ← in the header) to move through slides.",
      },
      {
        title: "Inspect live code",
        detail:
          "When a slide includes a code frame, switch between Code and Result in its top bar to preview rendered output.",
      },
      {
        title: "Begin the quiz",
        detail:
          "On the final slide, click Start Quiz (or Finish Lesson on lesson-only units).",
      },
    ],
    shortcuts: [{ keys: ["?"], label: "Toggle UI Guide" }],
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
