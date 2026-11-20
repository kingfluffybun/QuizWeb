import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPublicCodeProblem } from "@/app/actions/cp-engine";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import {
  getNextCurriculumUnit,
  isCodeProblemUnlockedForUser,
} from "@/app/actions/progress";
import { isOnboardingTutorialUnit } from "@/lib/quiz-ui-hints";
import { CodeProblemRunner } from "../CodeProblemRunner";
import CpSuspenseShell from "../components/CpSuspenseShell";

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

  // Parallel server prefetch eliminates client mount waterfall for /quiz-cp/[unitId]
  const [initialProblem, initialDailyGoal, initialNextUnit] = await Promise.all([
    getPublicCodeProblem(parsedUnitId),
    getDailyGoalData().catch(() => null),
    getNextCurriculumUnit(parsedUnitId).catch(() => null),
  ]);

  const isTutorialUnit = isOnboardingTutorialUnit({
    secId: initialProblem?.sec_id,
    unitOrder: initialProblem?.unit_order,
    unitId: parsedUnitId,
  });

  return (
    <Suspense fallback={<CpSuspenseShell />}>
      <CodeProblemRunner
        unitId={parsedUnitId}
        initialProblem={initialProblem}
        initialDailyGoal={initialDailyGoal}
        initialNextUnit={initialNextUnit}
        isTutorialUnit={isTutorialUnit}
      />
    </Suspense>
  );
}
