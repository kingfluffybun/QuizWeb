import Link from "next/link";
import { getPendingQuizzes, getPaginatedRecentQuizzes, getQuizMetadata } from "@/app/actions/quiz";
import PendingReview from "./PendingReview";
import RecentQuizzesCard from "@/app/components/RecentQuizzesCard";
import "#css/input.css";
import "#css/pending.css";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const [pendingQuizzes, recentQuizPage, metadata] = await Promise.all([
    getPendingQuizzes("pending"),
    getPaginatedRecentQuizzes(),
    getQuizMetadata(),
  ]);

  return (
    <div>
      <header className="admin-header">
        <h1>Pending Quiz Review</h1>
        <Link href="/input" className="header-link">
          Back to Input
        </Link>
      </header>
      <main className="pending-container">
        <div className="pending-layout">
          <PendingReview
            initialQuizzes={pendingQuizzes}
          />
          <RecentQuizzesCard
            initialQuizzes={recentQuizPage.quizzes}
            initialPage={recentQuizPage.currentPage}
            initialTotalPages={recentQuizPage.totalPages}
            initialTotalCount={recentQuizPage.totalCount}
            categories={metadata.categories}
            difficulties={metadata.difficulties}
            types={metadata.types}
            sections={metadata.sections ?? []}
          />
        </div>
      </main>
    </div>
  );
}
