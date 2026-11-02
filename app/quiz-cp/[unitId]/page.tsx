import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/app/components/Sidebar";
import { isCodeProblemUnlockedForUser } from "@/app/actions/progress";
import { CodeProblemRunner } from "../page";

interface UnitQuizCPPageProps {
  params: Promise<{ unitId: string }>;
}

export default async function UnitQuizCPPage({ params }: UnitQuizCPPageProps) {
  const { unitId } = await params;
  const parsedUnitId = Number(unitId);

  if (!Number.isFinite(parsedUnitId) || parsedUnitId <= 0) {
    redirect("/learn");
  }

  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : undefined;
  const isUnlocked = await isCodeProblemUnlockedForUser(parsedUnitId, userId);
  if (!isUnlocked) {
    redirect(`/quiz/${parsedUnitId}?start=quiz`);
  }

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
      <CodeProblemRunner unitId={parsedUnitId} />
    </Suspense>
  );
}
