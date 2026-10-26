import { Suspense } from "react";
import Sidebar from "@/app/components/Sidebar";
import { CodeProblemRunner } from "../page";

interface UnitQuizCPPageProps {
  params: Promise<{ unitId: string }>;
}

export default async function UnitQuizCPPage({ params }: UnitQuizCPPageProps) {
  const { unitId } = await params;
  const parsedUnitId = Number(unitId);

  return (
    <Suspense
      fallback={
        <div className="quiz-page" id="code-problem">
          <Sidebar />
          <main style={{ justifyContent: "center", alignItems: "center" }}>
            <p>Loading coding assessment...</p>
          </main>
        </div>
      }
    >
      <CodeProblemRunner unitId={Number.isFinite(parsedUnitId) ? parsedUnitId : undefined} />
    </Suspense>
  );
}
