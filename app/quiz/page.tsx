import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import { getQuizOrUnitById } from "@/app/actions/quiz";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
import { isOnboardingTutorialUnit } from "@/lib/quiz-ui-hints";
import { ensureUnit1AllQuizTypes } from "@/lib/unit1-onboarding-quizzes";
import type { UnitQuizData } from "./evaluate";
import { unwrapUnitQuizzes } from "./unwrap";
import EmptyQuizState from "./components/EmptyQuizState";
import QuizLandingClient from "./QuizLandingClient";

export const revalidate = 3600;

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    quizId?: string;
    unitId?: string;
    source?: string;
    slide?: string;
  }>;
}) {
  const { quizId, unitId, source, slide } = await searchParams;
  if (unitId) {
    const queryParams = new URLSearchParams();
    if (slide) queryParams.set("slide", slide);
    if (source) queryParams.set("source", source);
    const qs = queryParams.toString();
    redirect(`/quiz/${unitId}${qs ? `?${qs}` : ""}`);
  }
  if (!quizId) {
    redirect("/learn");
  }

  const selectedQuizId = Number(quizId);
  const initialSlideOrder = slide ? Math.max(1, parseInt(slide, 10)) : undefined;
  const session = await auth();

  const [dailyGoalData, selectedPayload] = await Promise.all([
    session?.user?.id ? getDailyGoalData().catch(() => null) : Promise.resolve(null),
    Number.isFinite(selectedQuizId) && selectedQuizId > 0
      ? getQuizOrUnitById(selectedQuizId)
      : Promise.resolve(null),
  ]);

  const selectedMeta = selectedPayload as
    | { unit_id?: number; sec_id?: number; unit_order?: number }
    | null;
  const unwrappedQuizzes = selectedPayload
    ? unwrapUnitQuizzes([selectedPayload])
    : [];
  const enrichedQuizzes = selectedPayload
    ? ensureUnit1AllQuizTypes(unwrappedQuizzes, {
        secId: selectedMeta?.sec_id,
        unitOrder: selectedMeta?.unit_order,
        unitId: selectedMeta?.unit_id,
      })
    : [];
  const quizzesToDisplay = enrichedQuizzes.map((quiz, index) =>
    shuffleQuizOptions(quiz, index !== 0),
  );
  const firstQuiz = quizzesToDisplay[0] as UnitQuizData | undefined;
  const isTutorialUnit = isOnboardingTutorialUnit({
    secId: selectedMeta?.sec_id ?? firstQuiz?.sec_id,
    unitOrder: selectedMeta?.unit_order ?? firstQuiz?.unit_order,
    unitId: selectedMeta?.unit_id ?? firstQuiz?.unit_id,
  });

  if (quizzesToDisplay.length === 0) {
    return <EmptyQuizState />;
  }

  return (
    <QuizLandingClient
      key={quizId}
      initialQuizzes={quizzesToDisplay}
      completionDestination={
        source === "quiz" || source === "home" ? "home" : "input"
      }
      unitId={Number.isFinite(selectedQuizId) ? selectedQuizId : undefined}
      initialSlideOrder={initialSlideOrder}
      dailyGoalData={dailyGoalData}
      isTutorialUnit={isTutorialUnit}
    />
  );
}
