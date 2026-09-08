import { getQuizzesByType } from "@/app/actions/quiz";
import InteractiveQuizClient from "@/app/test/InteractiveQuizClient";
import type { QuizData } from "@/app/test/types";

type QuizType = "MCQ" | "FITB" | "Order" | "Pair";

export default async function QuizTypePage({ type }: { type: QuizType }) {
    const quizzes = await getQuizzesByType(type);

    if (quizzes.length === 0) {
        return (
            <main style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
                <div className="empty-state">No {type} quizzes available.</div>
            </main>
        );
    }

    return <InteractiveQuizClient quizzes={quizzes as QuizData[]} />;
}