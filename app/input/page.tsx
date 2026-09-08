import {
    getQuizMetadata,
    getPaginatedRecentQuizzes,
    getQuizMetrics,
} from "@/app/actions/quiz";
import QuizInputForm from "./QuizInputForm";
import "#css/input.css";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InputPage() {
    const [metadata, recentQuizPage, metrics] = await Promise.all([
        getQuizMetadata(),
        getPaginatedRecentQuizzes(),
        getQuizMetrics(),
    ]);

    return (
        <div>
            <header className="admin-header">
                <h1>QuizWeb Admin Panel</h1>
                <Link href="/quiz" className="header-link">
                    Go to Quiz Page &rarr;
                </Link>
            </header>

            <main className="admin-container">
                <QuizInputForm 
                    categories={metadata.categories} 
                    difficulties={metadata.difficulties} 
                    types={metadata.types}
                    sections={metadata.sections ?? []}
                    initialRecentQuizzes={recentQuizPage.quizzes}
                    initialPage={recentQuizPage.currentPage}
                    initialTotalPages={recentQuizPage.totalPages}
                    initialTotalCount={recentQuizPage.totalCount}
                    initialMetrics={metrics}
                />
            </main>
        </div>
    );
}
