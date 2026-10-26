import { Suspense } from "react";
import Sidebar from "@/app/components/Sidebar";
import { CodeProblemRunner } from "../../page";

interface SkipQuizCPPageProps {
  params: Promise<{ targetSecId: string }>;
}

export default async function SkipQuizCPPage({ params }: SkipQuizCPPageProps) {
  const { targetSecId } = await params;
  const parsedTargetSecId = Number(targetSecId);

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
      <CodeProblemRunner
        skipTargetSecId={
          Number.isFinite(parsedTargetSecId) ? parsedTargetSecId : undefined
        }
      />
    </Suspense>
  );
}
