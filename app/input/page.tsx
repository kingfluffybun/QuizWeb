import {
  getQuizMetadata,
  getQuizMetrics,
  getPendingQuizzes,
} from "@/app/actions/quiz";
import { Suspense } from "react";
import QuizInputForm from "./QuizInputForm";
import IncomingQuizCard from "@/app/components/IncomingQuizCard";
import "#css/input.css";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function QuizEditor() {
  const [metadata, metrics] = await Promise.all([
    getQuizMetadata(),
    getQuizMetrics(),
  ]);

  return (
    <QuizInputForm
      categories={metadata.categories}
      difficulties={metadata.difficulties}
      types={metadata.types}
      sections={metadata.sections ?? []}
      initialRecentQuizzes={[]}
      initialPage={1}
      initialTotalPages={1}
      initialTotalCount={0}
      initialMetrics={metrics}
      showRecentQuizzes={false}
      initialEditingQuiz={undefined}
    />
  );
}

async function IncomingQuizzes() {
  const incomingQuizzes = await getPendingQuizzes("all");
  return <IncomingQuizCard initialQuizzes={incomingQuizzes} />;
}

export default async function InputPage() {
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
        <Suspense fallback={<div className="admin-card">Loading quiz editor...</div>}>
          <QuizEditor />
        </Suspense>
        <Suspense fallback={<div className="admin-card">Loading incoming quizzes...</div>}>
          <IncomingQuizzes />
        </Suspense>
      </main>
    </div>
  );
}
