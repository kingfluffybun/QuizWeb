import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/app/components/Sidebar";
import { CodeProblemRunner } from "../../page";

interface SkipQuizCPPageProps {
  params: Promise<{ targetSecId: string }>;
}

export default async function SkipQuizCPPage({ params }: SkipQuizCPPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/learn");
  }

  const { targetSecId } = await params;
  const parsedTargetSecId = Number(targetSecId);

  // Section 1 is the starting level and cannot be skipped; minimum skip target is Section 3
  if (!Number.isFinite(parsedTargetSecId) || parsedTargetSecId <= 2) {
    redirect("/learn");
  }

  return (
    <Suspense
      fallback={
        <div className="quiz-page" id="code-problem">
          <Sidebar />
          <main style={{ justifyContent: "center", alignItems: "center" }}>
            <p>Loading Section Skip Challenge...</p>
          </main>
        </div>
      }
    >
      <CodeProblemRunner skipTargetSecId={parsedTargetSecId} />
    </Suspense>
  );
}
