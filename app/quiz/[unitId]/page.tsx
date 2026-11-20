import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import { getUnitById } from "@/app/actions/quiz";
import {
  getNextCurriculumUnit,
  isLessonCompletedForUser,
  isUnitUnlockedForUser,
} from "@/app/actions/progress";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
import { isOnboardingTutorialUnit } from "@/lib/quiz-ui-hints";
import { getCanonicalCurriculumUnitSequence } from "@/lib/server/progress/catalog";
import { ensureUnit1AllQuizTypes } from "@/lib/unit1-onboarding-quizzes";
import type { UnitQuizData } from "../evaluate";
import { unwrapUnitQuizzes } from "../unwrap";
import EmptyQuizState from "../components/EmptyQuizState";
import QuizLandingClient from "../QuizLandingClient";

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

  const initialSlideOrder = slide ? Math.max(1, parseInt(slide, 10)) : undefined;

  // Parallel data loading after authorization & unlock gate
  const [
    dailyGoalData,
    selectedUnit,
    nextCurriculumUnit,
    isLessonDone,
    canonicalSequence,
  ] = await Promise.all([
    session?.user?.id ? getDailyGoalData().catch(() => null) : Promise.resolve(null),
    getUnitById(selectedUnitId),
    getNextCurriculumUnit(selectedUnitId),
    start === "quiz"
      ? isLessonCompletedForUser(selectedUnitId, userId)
      : Promise.resolve(false),
    getCanonicalCurriculumUnitSequence().catch(() => []),
  ]);

  const canonicalFirstUnitId = canonicalSequence[0]?.unit_id;
  const selectedMeta = selectedUnit as
    | { sec_id?: number; unit_order?: number; unit_id?: number }
    | null;
  const unwrappedQuizzes = selectedUnit ? unwrapUnitQuizzes([selectedUnit]) : [];
  const enrichedQuizzes = selectedUnit
    ? ensureUnit1AllQuizTypes(unwrappedQuizzes, {
        secId: selectedMeta?.sec_id,
        unitOrder: selectedMeta?.unit_order,
        unitId: selectedUnitId,
        canonicalFirstUnitId,
      })
    : [];
  const quizzesToDisplay = enrichedQuizzes.map((quiz, index) =>
    shuffleQuizOptions(quiz, index !== 0),
  );
  const firstQuiz = quizzesToDisplay[0] as UnitQuizData | undefined;
  const isTutorialUnit = isOnboardingTutorialUnit({
    secId: selectedMeta?.sec_id ?? firstQuiz?.sec_id,
    unitOrder: selectedMeta?.unit_order ?? firstQuiz?.unit_order,
    unitId: selectedUnitId,
    canonicalFirstUnitId,
  });

  if (quizzesToDisplay.length === 0) {
    return <EmptyQuizState />;
  }

  const shouldStartAtQuiz = start === "quiz" && isLessonDone;

  return (
    <QuizLandingClient
      key={unitId}
      initialQuizzes={quizzesToDisplay}
      completionDestination={
        source === "quiz" || source === "home" ? "home" : "input"
      }
      unitId={selectedUnitId}
      initialSlideOrder={initialSlideOrder}
      startAtQuiz={shouldStartAtQuiz}
      nextUnit={nextCurriculumUnit}
      dailyGoalData={dailyGoalData}
      isTutorialUnit={isTutorialUnit}
    />
  );
}
