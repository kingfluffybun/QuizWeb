import { getRecentQuizzes } from "@/app/actions/quiz";
import InteractiveQuizClient from "./InteractiveQuizClient";

export const revalidate = 3600;

export default async function InteractiveQuizPage() {
    const quizzes = await getRecentQuizzes();

    if (!quizzes || quizzes.length === 0) {
        return (
            <main style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
                <div className="empty-state">No quizzes available.</div>
            </main>
        );
    }

    return <InteractiveQuizClient quizzes={quizzes} />;
}