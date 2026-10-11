import { getQuizOrUnitById, getUnitById } from "@/app/actions/quiz";
import type { QuizData } from "@/app/quiz/types";
import QuizLandingClient from "./QuizLandingClient";

export const revalidate = 3600;

function unwrapUnitQuizzes(quizzes: unknown[]): QuizData[] {
    return quizzes.flatMap((quiz) => {
        const quizRecord = quiz as Partial<QuizData>;
        const payload = quizRecord.quiz_payload ?? {};

        if (Array.isArray(payload.quizzes) && payload.quizzes.length > 0) {
            return payload.quizzes.map((entry, index) => {
                const entryRecord = entry as Partial<QuizData> & { type?: string };
                const entryPayload = entryRecord.quiz_payload ?? {};
                const inferredType = entryRecord.type_name
                    ?? entryRecord.type
                    ?? (Array.isArray(entryPayload.options)
                        ? "MCQ"
                        : Array.isArray(entryPayload.items)
                            ? "Order"
                            : Array.isArray(entryPayload.pairs)
                                ? "Pair"
                                : entryPayload.answer !== undefined
                                    ? "FITB"
                                    : "");

                return {
                    ...entry,
                    unit_title: typeof payload.title === "string" ? payload.title : quizRecord.question_text ?? "",
                    unit_lesson_card: payload.lesson_card ?? {},
                    unit_assessment: payload.assessment ?? {},
                    quiz_id: entryRecord.quiz_id ?? quizRecord.quiz_id ?? index,
                    question_text: entryRecord.question_text ?? quizRecord.question_text ?? `Question ${index + 1}`,
                    type_name: inferredType,
                    quiz_payload: entryPayload,
                };
            });
        }

        return [{
            ...quizRecord,
            unit_title: typeof payload.title === "string" ? payload.title : quizRecord.question_text ?? "",
            unit_lesson_card: payload.lesson_card ?? {},
            unit_assessment: payload.assessment ?? {},
            question_text: quizRecord.question_text ?? "Quiz",
            type_name: quizRecord.type_name ?? "",
            quiz_payload: quizRecord.quiz_payload ?? {},
        }];
    });
}

export default async function QuizPage({
    searchParams,
}: {
    searchParams: Promise<{ quizId?: string; unitId?: string; source?: string }>;
}) {
    const { quizId, unitId } = await searchParams;
    const selectedUnitId = unitId ? Number(unitId) : null;
    const selectedQuizId = quizId ? Number(quizId) : null;
    const selectedUnit = selectedUnitId
        ? await getUnitById(selectedUnitId)
        : null;
    const selectedQuiz = !selectedUnit && selectedQuizId
        ? await getQuizOrUnitById(selectedQuizId)
        : null;
    const selectedPayload = selectedUnit ?? selectedQuiz;
    const quizzesToDisplay = selectedPayload
        ? unwrapUnitQuizzes([selectedPayload])
        : [];

    if (unitId || quizId) {
        if (quizzesToDisplay.length === 0) {
            return (
                <main style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
                    <div className="empty-state">No quizzes available.</div>
                </main>
            );
        }

        return <QuizLandingClient initialQuizzes={quizzesToDisplay} />;
    }

    return <QuizLandingClient />;
}
