import Link from "next/link";
import {
  getPaginatedRecentUnits,
  getQuizMetadata,
  getQuizMetrics,
} from "@/app/actions/quiz";
import QuizInputForm from "./QuizInputForm";
import "#css/input.css";

export const dynamic = "force-dynamic";

export default async function InputPage() {
  const [metadata, recentUnitPage, metrics] = await Promise.all([
    getQuizMetadata(),
    getPaginatedRecentUnits(),
    getQuizMetrics(),
  ]);

  return (
    <div className="quiz-input-studio-page">
      <header className="admin-header">
        <div>
          <h1>QuizWeb Unit &amp; Assessment Studio</h1>
        </div>
        <div className="admin-header-links" style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
          <Link href="/maintainer" className="header-link">
            &larr; Maintainer Studio
          </Link>
          <Link href="/pending" className="header-link">
            Review Pending
          </Link>
          <Link href="/learn" className="header-link">
            Curriculum &rarr;
          </Link>
        </div>
      </header>

      <main className="admin-container">
        <QuizInputForm
          categories={metadata.categories}
          difficulties={metadata.difficulties}
          types={metadata.types}
          sections={metadata.sections}
          initialRecentUnits={recentUnitPage.units}
          initialPage={recentUnitPage.currentPage}
          initialTotalPages={recentUnitPage.totalPages}
          initialTotalCount={recentUnitPage.totalCount}
          initialMetrics={metrics}
        />
      </main>
    </div>
  );
}
