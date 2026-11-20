import type { AnswerValue, QuizData } from "@/app/quiz/types";

export type AnswerResult = {
  correct: boolean;
  message: string;
  correctAnswer: string;
  skipped?: boolean;
};

export type SavedQuestionProgress = {
  value: AnswerValue;
  result: AnswerResult;
};

export type UnitLessonSlide = {
  lesson_title?: string;
  lesson_text?: string;
  lesson_code?: string;
};

export type UnitQuizData = QuizData & {
  unit_id?: number;
  unit_order?: number;
  unit_title?: string;
  unit_assessment?: unknown;
  unit_lesson_card?: {
    lesson_slide?: UnitLessonSlide[];
    lesson_slides?: UnitLessonSlide[];
    lesson_card?: { lesson_text?: string };
    lesson_text?: string;
  };
};

const CORRECT_MESSAGES = ["That's correct!", "Excellent job!", "Well done!"];
const INCORRECT_MESSAGES = ["Hard luck!", "That’s incorrect.", "Not quite right."];

export const QUIZ_ACCURACY_MESSAGES = {
  perfect: [
    "Perfect score! You answered every single question correctly, so keep that momentum going.",
    "Flawless run! You didn’t miss a single question, and that’s exactly how mastery is built.",
  ],
  good: [
    "Nice work! You’re getting the hang of this, and a little more practice will get you to a perfect score.",
    "Almost there! You got most of them right, so review the ones you missed and try for 100%.",
  ],
  low: [
    "Keep practicing! Every mistake is a chance to learn, so review your answers and give it another try.",
    "Don’t give up! You’re still building your skills, and each attempt gets you closer to mastering this lesson.",
  ],
};

export function getAnswer(quiz: QuizData): string {
  const payload = quiz.quiz_payload;

  switch (quiz.type_name) {
    case "MCQ":
      return typeof payload.correct_index === "number"
        ? payload.options?.[payload.correct_index] ?? "No answer available"
        : "No answer available";
    case "FITB":
      return payload.answer?.trim() || "No answer available";
    case "Order":
      return (
        payload.items?.reduce((answer, item, index, items) => {
          if (index === 0) return item;
          const touchesSymbol =
            item === ">" ||
            item === "<" ||
            items[index - 1] === ">" ||
            items[index - 1] === "<";
          return `${answer}${touchesSymbol ? "" : " "}${item}`;
        }, "") || "No answer available"
      );
    case "Pair":
      return (
        payload.pairs?.map(({ left, right }) => `${left} - ${right}`).join(", ") ||
        "No answer available"
      );
    default:
      return "No answer available";
  }
}

export function getCorrectValue(quiz: QuizData): AnswerValue {
  switch (quiz.type_name) {
    case "MCQ":
      return quiz.quiz_payload.correct_index;
    case "FITB":
      return quiz.quiz_payload.answer ?? "";
    case "Order":
      return quiz.quiz_payload.items ?? [];
    case "Pair":
      return quiz.quiz_payload.pairs?.length ?? 0;
    default:
      return undefined;
  }
}

export function isQuizAnswerIncomplete(
  quiz: QuizData | undefined,
  value: AnswerValue,
): boolean {
  if (!quiz) return true;

  switch (quiz.type_name) {
    case "MCQ":
      return typeof value !== "number";
    case "FITB":
      return typeof value !== "string" || value.trim() === "";
    case "Order":
      return !Array.isArray(value) || value.length === 0;
    case "Pair":
      return value !== (quiz.quiz_payload.pairs?.length ?? 0);
    default:
      return false;
  }
}

export function evaluateQuizAnswer(
  quiz: QuizData,
  value: AnswerValue,
): AnswerResult {
  const payload = quiz.quiz_payload;
  let correct = false;

  switch (quiz.type_name) {
    case "MCQ":
      correct = typeof value === "number" && value === payload.correct_index;
      break;
    case "FITB": {
      const expected = payload.answer?.trim().toLowerCase();
      correct =
        typeof value === "string" && value.trim().toLowerCase() === expected;
      break;
    }
    case "Order":
      correct = JSON.stringify(value) === JSON.stringify(payload.items);
      break;
    case "Pair":
      correct = value === (payload.pairs?.length ?? 0);
      break;
  }

  const messages = correct ? CORRECT_MESSAGES : INCORRECT_MESSAGES;
  return {
    correct,
    message: messages[Math.floor(Math.random() * messages.length)],
    correctAnswer: getAnswer(quiz),
  };
}
