import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import type { DailyGoalData } from "@/lib/daily-goal";
import { getUnitById } from "@/app/actions/quiz";
import { getNextCurriculumUnit, isUnitUnlockedForUser } from "@/app/actions/progress";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
import QuizLandingClient from "../QuizLandingClient";
import { unwrapUnitQuizzes } from "../page";

export const revalidate = 3600;

interface UnitQuizPageProps {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ slide?: string; source?: string; start?: string }>;
}

export default async function UnitQuizPage({
  params,
  searchParams,
}: UnitQuizPageProps) {
  const { unitId } = await params;
  const { slide, source, start } = await searchParams;

  const selectedUnitId = Number(unitId);
  if (!Number.isFinite(selectedUnitId) || selectedUnitId <= 0) {
    redirect("/learn");
  }

  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : undefined;
  const isUnlocked = await isUnitUnlockedForUser(selectedUnitId, userId);
  if (!isUnlocked) {
    redirect("/learn");
  }

  const dailyGoalData: DailyGoalData | null = session?.user?.id
    ? await getDailyGoalData()
    : null;
  const initialSlideOrder = slide ? Math.max(1, parseInt(slide, 10)) : undefined;
  const selectedUnit = await getUnitById(selectedUnitId);
  const quizzesToDisplay = selectedUnit
    ? unwrapUnitQuizzes([selectedUnit]).map(shuffleQuizOptions)
    : [];
  const nextCurriculumUnit = await getNextCurriculumUnit(selectedUnitId);

  if (quizzesToDisplay.length === 0) {
    return (
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "32px 16px", textAlign: "center", gap: "16px" }}>
        <h2 style={{ fontSize: "1.4rem", color: "var(--text-main)" }}>No Quizzes Available</h2>
        <p style={{ maxWidth: "420px", color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.5" }}>
          This unit currently has no questions configured. Check back soon or browse other lessons.
        </p>
        <Link
          href="/learn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 24px",
            borderRadius: "12px",
            background: "var(--primary-color)",
            color: "#ffffff",
            fontWeight: 600,
            textDecoration: "none",
            minHeight: "44px",
          }}
        >
          Back to Curriculum
        </Link>
      </main>
    );
  }

  return (
    <QuizLandingClient
      key={unitId}
      initialQuizzes={quizzesToDisplay}
      completionDestination={source === "quiz" || source === "home" ? "home" : "input"}
      unitId={selectedUnitId}
      initialSlideOrder={initialSlideOrder}
      startAtQuiz={start === "quiz"}
      nextUnit={nextCurriculumUnit}
      dailyGoalData={dailyGoalData}
    />
  );
}
