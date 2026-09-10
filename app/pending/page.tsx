import Link from "next/link";
import { getPendingQuizzes } from "@/app/actions/quiz";
import PendingReview from "./PendingReview";
import "#css/pending.css";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const pendingQuizzes = await getPendingQuizzes("pending");

  return (
    <div>
      <header className="admin-header">
        <h1>Pending Quiz Review</h1>
        <Link href="/input" className="header-link">
          Back to Input
        </Link>
      </header>
      <main className="pending-container">
        <PendingReview initialQuizzes={pendingQuizzes} />
      </main>
    </div>
  );
}
