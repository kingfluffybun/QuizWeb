import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import { getQuizOrUnitById } from "@/app/actions/quiz";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
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

  const quizzesToDisplay = selectedPayload
    ? unwrapUnitQuizzes([selectedPayload]).map((quiz, index) =>
        shuffleQuizOptions(quiz, index !== 0),
      )
    : [];

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
    />
  );
}
