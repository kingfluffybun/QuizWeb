import { getQuizOrUnitById, getUnitById } from "@/app/actions/quiz";
import InteractiveQuizClient from "./InteractiveQuizClient";
import { QuizData, UnitLessonCardData } from "./types";

export const revalidate = 3600;

function unwrapUnitQuizzes(quizzes: QuizData[]): QuizData[] {
    return quizzes.flatMap((quiz) => {
        const payload = quiz?.quiz_payload && typeof quiz.quiz_payload === "object" ? quiz.quiz_payload : {};
        const title = typeof payload.title === "string" ? payload.title : quiz?.question_text ?? "";
        const lessonCard = (payload.lesson_card && typeof payload.lesson_card === "object" ? payload.lesson_card : {}) as UnitLessonCardData;
        const assessment = (payload.assessment && (typeof payload.assessment === "object" || typeof payload.assessment === "string") ? payload.assessment : {}) as Record<string, unknown> | string;

        if (Array.isArray(payload.quizzes) && payload.quizzes.length > 0) {
            return (payload.quizzes as QuizData[]).map((entry, index: number): QuizData => ({
                ...entry,
                unit_title: title,
                unit_lesson_card: lessonCard,
                unit_assessment: assessment,
                quiz_id: entry?.quiz_id ?? quiz?.quiz_id ?? index,
                question_text: entry?.question_text ?? quiz?.question_text ?? `Question ${index + 1}`,
                type_name: entry?.type_name ?? quiz?.type_name ?? "",
                quiz_payload: entry?.quiz_payload ?? {},
            }));
        }

        return [{
            ...quiz,
            unit_title: title,
            unit_lesson_card: lessonCard,
            unit_assessment: assessment,
        }];
    });
}

export default async function InteractiveQuizPage({
    searchParams,
}: {
    searchParams: Promise<{ quizId?: string; unitId?: string; source?: string }>;
}) {
    const { quizId, unitId, source } = await searchParams;
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
        ? unwrapUnitQuizzes([selectedPayload as QuizData])
        : [];

    if (quizzesToDisplay.length === 0) {
        return (
            <main style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
                <div className="empty-state">No quizzes available.</div>
            </main>
        );
    }

    return (
        <InteractiveQuizClient
            quizzes={quizzesToDisplay}
            completionDestination={source === "quiz" ? "home" : "input"}
        />
    );
}