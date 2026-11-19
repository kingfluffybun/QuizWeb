import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireStaff } from "@/lib/rbac";
import { getPaginatedRecentUnits, getQuizMetadata } from "@/app/actions/quiz";
import QuizInputForm from "./QuizInputForm";
import "#css/input.css";

export const dynamic = "force-dynamic";

export default async function InputPage() {
  const staff = await requireStaff();
  if (!staff) {
    const session = await auth();
    if (!session?.user) {
      redirect("/login?callbackUrl=/input");
    }
    redirect("/home");
  }

  const [metadata, recentUnitPage] = await Promise.all([
    getQuizMetadata(),
    getPaginatedRecentUnits(),
  ]);

  return (
    <div className="quiz-input-studio-page">
      <header className="admin-header">
        <div>
          <h1>QuizWeb Unit &amp; Assessment Studio</h1>
        </div>
        <div
          className="admin-header-links"
          style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}
        >
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
        />
      </main>
    </div>
  );
}
