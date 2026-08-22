import { getRecentQuizzes } from "@/app/actions/quiz";
import InteractiveQuizClient from "./InteractiveQuizClient";

export const revalidate = 3600;

export default async function InteractiveQuizPage({
    searchParams,
}: {
    searchParams: Promise<{ quizId?: string }>;
}) {
    const quizzes = await getRecentQuizzes();
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