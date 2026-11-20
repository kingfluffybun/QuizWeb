import type { UnitQuizData } from "@/app/quiz/evaluate";
import type { QuizData } from "@/app/quiz/types";
import {
  isOnboardingTutorialUnit,
  resolveQuizHintMode,
} from "@/lib/quiz-ui-hints";

export const REQUIRED_UNIT1_QUIZ_TYPES = [
  "MCQ",
  "FITB",
  "Order",
  "Pair",
] as const;

export type RequiredUnit1QuizType = (typeof REQUIRED_UNIT1_QUIZ_TYPES)[number];

export interface Unit1OnboardingContext {
  secId?: number | string | null;
  unitOrder?: number | string | null;
  unitId?: number | string | null;
  isSkipMode?: boolean;
}

const ONBOARDING_QUIZ_TEMPLATES: Record<
  RequiredUnit1QuizType,
  {
    quiz_id: number;
    quiz_type_id: number;
    question_text: string;
    quiz_payload: QuizData["quiz_payload"];
  }
> = {
  MCQ: {
    quiz_id: -101,
    quiz_type_id: 1,
    question_text:
      "Which HTML tag creates the largest, main heading on a webpage?",
    quiz_payload: {
      options: ["<h1>", "<head>", "<title>", "<p>"],
      correct_index: 0,
    },
  },
  FITB: {
    quiz_id: -102,
    quiz_type_id: 2,
    question_text:
      "Type the HTML tag name (without angle brackets) used to create a paragraph: <___>Hello</___>.",
    quiz_payload: {
      answer: "p",
    },
  },
  Order: {
    quiz_id: -103,
    quiz_type_id: 3,
    question_text:
      "Arrange the parts of a complete HTML heading element in order from start to finish.",
    quiz_payload: {
      items: ["<h1>", "Welcome to HTML", "</h1>"],
    },
  },
  Pair: {
    quiz_id: -104,
    quiz_type_id: 4,
    question_text:
      "Match each fundamental HTML tag on the left with what it creates on the right.",
    quiz_payload: {
      pairs: [
        { left: "<h1>", right: "Main heading" },
        { left: "<p>", right: "Paragraph text" },
        { left: "<a>", right: "Hyperlink" },
      ],
    },
  },
};

function buildUnit1FallbackQuiz(
  typeName: RequiredUnit1QuizType,
  sample: UnitQuizData | undefined,
  context?: Unit1OnboardingContext,
): UnitQuizData {
  const template = ONBOARDING_QUIZ_TEMPLATES[typeName];
  const resolvedUnitId =
    sample?.unit_id ??
    (typeof context?.unitId === "number" ? context.unitId : Number(context?.unitId) || 98);
  const resolvedSecId =
    sample?.sec_id ??
    (typeof context?.secId === "number" ? context.secId : Number(context?.secId) || 1);
  const resolvedUnitOrder =
    sample?.unit_order ??
    (typeof context?.unitOrder === "number"
      ? context.unitOrder
      : Number(context?.unitOrder) || 1);

  return {
    unit_id: resolvedUnitId,
    unit_title: sample?.unit_title ?? "Getting Started with HTML",
    unit_order: resolvedUnitOrder,
    unit_lesson_card: sample?.unit_lesson_card,
    unit_assessment: sample?.unit_assessment,
    quiz_id: template.quiz_id,
    cat_id: sample?.cat_id ?? 1,
    cat_name: sample?.cat_name ?? "HTML",
    sec_id: resolvedSecId,
    sec_num: sample?.sec_num ?? "1",
    difficulty_id: sample?.difficulty_id ?? 1,
    difficulty_name: sample?.difficulty_name ?? "Beginner",
    quiz_type_id: template.quiz_type_id,
    type_name: typeName,
    question_text: template.question_text,
    quiz_payload: structuredClone(template.quiz_payload),
  };
}

/**
 * Ensures Unit 1 of Section 1 includes one playable question for every
 * interactive quiz type (MCQ, FITB, Order, Pair) so onboarding covers them all.
 */
export function ensureUnit1AllQuizTypes<T extends UnitQuizData>(
  quizzes: T[],
  context?: Unit1OnboardingContext,
): T[] {
  const sample = quizzes[0];
  const isTargetUnit = isOnboardingTutorialUnit({
    secId: context?.secId ?? sample?.sec_id,
    unitOrder: context?.unitOrder ?? sample?.unit_order,
    unitId: context?.unitId ?? sample?.unit_id,
    isSkipMode: context?.isSkipMode,
  });

  if (!isTargetUnit) {
    return quizzes;
  }

  const presentTypes = new Set<string>();
  for (const quiz of quizzes) {
    presentTypes.add(resolveQuizHintMode(quiz.type_name));
  }

  const missingTypes = REQUIRED_UNIT1_QUIZ_TYPES.filter(
    (requiredType) => !presentTypes.has(requiredType),
  );

  if (missingTypes.length === 0) {
    return quizzes;
  }

  const additions = missingTypes.map(
    (typeName) => buildUnit1FallbackQuiz(typeName, sample, context) as T,
  );
  return [...quizzes, ...additions];
}
