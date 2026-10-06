import { getRecentQuizzes } from "@/app/actions/quiz";
import InteractiveQuizClient from "./InteractiveQuizClient";

export const revalidate = 3600;

function unwrapUnitQuizzes(quizzes: any[]) {
    return quizzes.flatMap((quiz) => {
        const payload = quiz?.quiz_payload && typeof quiz.quiz_payload === "object" ? quiz.quiz_payload : {};

        if (Array.isArray(payload.quizzes) && payload.quizzes.length > 0) {
            return payload.quizzes.map((entry: any, index: number) => ({
                ...entry,
                unit_title: payload.title ?? quiz?.question_text ?? "",
                unit_lesson_card: payload.lesson_card ?? {},
                unit_assessment: payload.assessment ?? {},
                quiz_id: entry?.quiz_id ?? quiz?.quiz_id ?? index,
                question_text: entry?.question_text ?? quiz?.question_text ?? `Question ${index + 1}`,
                type_name: entry?.type_name ?? quiz?.type_name ?? "",
                quiz_payload: entry?.quiz_payload ?? {},
            }));
        }

        return [{
            ...quiz,
            unit_title: payload.title ?? quiz?.question_text ?? "",
            unit_lesson_card: payload.lesson_card ?? {},
            unit_assessment: payload.assessment ?? {},
        }];
    });
}

export default async function InteractiveQuizPage({
    searchParams,
}: {
    searchParams: Promise<{ quizId?: string }>;
}) {
    const quizzes = unwrapUnitQuizzes(await getRecentQuizzes());
    const { quizId } = await searchParams;
    const selectedQuizId = Number(quizId);
    const selectedQuiz = quizzes.find((quiz) => quiz.quiz_id === selectedQuizId);
    const quizzesToDisplay = quizId ? (selectedQuiz ? [selectedQuiz] : []) : quizzes;

    if (quizzesToDisplay.length === 0) {
        return (
            <main style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
                <div className="empty-state">No quizzes available.</div>
            </main>
        );
    }

    return <InteractiveQuizClient quizzes={quizzesToDisplay} />;
}