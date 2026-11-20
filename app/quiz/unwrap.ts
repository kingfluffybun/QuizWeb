import type { QuizData } from "@/app/quiz/types";

export function inferQuizTypeName(
  explicitType: string | undefined,
  payload: Record<string, unknown>,
): string {
  if (explicitType) return explicitType;
  if (Array.isArray(payload.options)) return "MCQ";
  if (Array.isArray(payload.items)) return "Order";
  if (Array.isArray(payload.pairs)) return "Pair";
  if (payload.answer !== undefined) return "FITB";
  return "";
}

export function unwrapUnitQuizzes(quizzes: unknown[]): QuizData[] {
  return quizzes.flatMap((quiz) => {
    const quizRecord = quiz as Partial<QuizData>;
    const payload = quizRecord.quiz_payload ?? {};
    const unitTitle =
      typeof payload.title === "string"
        ? payload.title
        : quizRecord.question_text ?? "";

    if (Array.isArray(payload.quizzes) && payload.quizzes.length > 0) {
      const parentRecord = quizRecord as Partial<QuizData> & {
        unit_id?: number;
        unit_order?: number;
      };
      return payload.quizzes.map((entry, index) => {
        const entryRecord = entry as Partial<QuizData> & {
          type?: string;
          unit_id?: number;
          unit_order?: number;
        };
        const entryPayload = (entryRecord.quiz_payload ?? {}) as Record<string, unknown>;
        const inferredType = inferQuizTypeName(
          entryRecord.type_name ?? entryRecord.type,
          entryPayload,
        );

        return {
          ...entry,
          unit_id: entryRecord.unit_id ?? parentRecord.unit_id,
          unit_order: entryRecord.unit_order ?? parentRecord.unit_order,
          unit_title: unitTitle,
          unit_lesson_card: payload.lesson_card ?? {},
          unit_assessment: payload.assessment ?? {},
          quiz_id: entryRecord.quiz_id ?? quizRecord.quiz_id ?? -(index + 1),
          question_text:
            entryRecord.question_text ??
            quizRecord.question_text ??
            `Question ${index + 1}`,
          cat_id: entryRecord.cat_id ?? quizRecord.cat_id,
          cat_name: entryRecord.cat_name ?? quizRecord.cat_name,
          sec_id: entryRecord.sec_id ?? parentRecord.sec_id,
          sec_num: entryRecord.sec_num ?? parentRecord.sec_num,
          type_name: inferredType,
          quiz_payload: entryPayload as QuizData["quiz_payload"],
        };
      });
    }

    return [
      {
        ...quizRecord,
        unit_title: unitTitle,
        unit_lesson_card: payload.lesson_card ?? {},
        unit_assessment: payload.assessment ?? {},
        question_text: quizRecord.question_text ?? "Quiz",
        type_name: quizRecord.type_name ?? "",
        quiz_payload: quizRecord.quiz_payload ?? {},
      } as QuizData,
    ];
  });
}
