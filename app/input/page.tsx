import Link from "next/link";
import {
  getPaginatedRecentQuizzes,
  getQuizMetadata,
  getQuizMetrics,
  getUnits,
} from "@/app/actions/quiz";
import QuizInputForm from "./QuizInputForm";
import "#css/input.css";

export const dynamic = "force-dynamic";

export default async function InputPage() {
  const [metadata, recentQuizPage, metrics, units] = await Promise.all([
    getQuizMetadata(),
    getPaginatedRecentQuizzes(),
    getQuizMetrics(),
    getUnits(),
  ]);

  return (
    <div>
      <header className="admin-header">
        <h1>QuizWeb Admin Panel</h1>
        <div className="admin-header-links">
          <Link href="/pending" className="header-link">
            Review Pending
          </Link>
          <Link href="/pending" className="header-link">
            Go to Quiz Page &rarr;
          </Link>
        </div>
      </header>

      <main className="admin-container">
        <QuizInputForm
          categories={metadata.categories}
          difficulties={metadata.difficulties}
          types={metadata.types}
          sections={metadata.sections}
          initialRecentQuizzes={recentQuizPage.quizzes}
          initialPage={recentQuizPage.currentPage}
          initialTotalPages={recentQuizPage.totalPages}
          initialTotalCount={recentQuizPage.totalCount}
          initialMetrics={metrics}
          initialUnits={units}
        />
      </main>
    </div>
  );
}
