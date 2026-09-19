import { getQuizMetadata, getUnits } from "@/app/actions/quiz";
import { Suspense } from "react";
import UnitInputForm from "./UnitInputForm";
import "#css/input.css";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function QuizEditor() {
  const [metadata, units] = await Promise.all([getQuizMetadata(), getUnits()]);

  return (
    <UnitInputForm sections={metadata.sections ?? []} initialUnits={units} />
  );
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
        <Suspense
          fallback={<div className="admin-card">Loading unit editor...</div>}
        >
          <QuizEditor />
        </Suspense>
      </main>
    </div>
  );
}
