import Link from "next/link";
import { redirect } from "next/navigation";
import { getQuizOrUnitById, getUnitById } from "@/app/actions/quiz";
import type { QuizData } from "@/app/quiz/types";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
import QuizLandingClient from "./QuizLandingClient";

export const revalidate = 3600;

function unwrapUnitQuizzes(quizzes: unknown[]): QuizData[] {
    return quizzes.flatMap((quiz) => {
        const quizRecord = quiz as Partial<QuizData>;
        const payload = quizRecord.quiz_payload ?? {};

        if (Array.isArray(payload.quizzes) && payload.quizzes.length > 0) {
            return payload.quizzes.map((entry, index) => {
                const entryRecord = entry as Partial<QuizData> & { type?: string };
                const entryPayload = entryRecord.quiz_payload ?? {};
                const inferredType = entryRecord.type_name
                    ?? entryRecord.type
                    ?? (Array.isArray(entryPayload.options)
                        ? "MCQ"
                        : Array.isArray(entryPayload.items)
                            ? "Order"
                            : Array.isArray(entryPayload.pairs)
                                ? "Pair"
                                : entryPayload.answer !== undefined
                                    ? "FITB"
                                    : "");

                return {
                    ...entry,
                    unit_title: typeof payload.title === "string" ? payload.title : quizRecord.question_text ?? "",
                    unit_lesson_card: payload.lesson_card ?? {},
                    unit_assessment: payload.assessment ?? {},
                    quiz_id: entryRecord.quiz_id ?? quizRecord.quiz_id ?? index,
                    question_text: entryRecord.question_text ?? quizRecord.question_text ?? `Question ${index + 1}`,
                    cat_id: entryRecord.cat_id ?? quizRecord.cat_id,
                    cat_name: entryRecord.cat_name ?? quizRecord.cat_name,
                    type_name: inferredType,
                    quiz_payload: entryPayload,
                };
            });
        }

        return [{
            ...quizRecord,
            unit_title: typeof payload.title === "string" ? payload.title : quizRecord.question_text ?? "",
            unit_lesson_card: payload.lesson_card ?? {},
            unit_assessment: payload.assessment ?? {},
            question_text: quizRecord.question_text ?? "Quiz",
            type_name: quizRecord.type_name ?? "",
            quiz_payload: quizRecord.quiz_payload ?? {},
        }];
    });
}

export default async function QuizPage({
    searchParams,
}: {
    searchParams: Promise<{ quizId?: string; unitId?: string; source?: string; slide?: string }>;
}) {
    const { quizId, unitId, source, slide } = await searchParams;
    if (!quizId && !unitId) {
        redirect("/learn");
    }

    const selectedUnitId = unitId ? Number(unitId) : null;
    const selectedQuizId = quizId ? Number(quizId) : null;
    const initialSlideOrder = slide ? Math.max(1, parseInt(slide, 10)) : undefined;
    const selectedUnit = selectedUnitId
        ? await getUnitById(selectedUnitId)
        : null;
    const selectedQuiz = !selectedUnit && selectedQuizId
        ? await getQuizOrUnitById(selectedQuizId)
        : null;
    const selectedPayload = selectedUnit ?? selectedQuiz;
    const quizzesToDisplay = selectedPayload
        ? unwrapUnitQuizzes([selectedPayload]).map(shuffleQuizOptions)
        : [];

    if (unitId || quizId) {
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
                key={unitId ?? quizId}
                initialQuizzes={quizzesToDisplay}
                completionDestination={source === "quiz" || source === "home" ? "home" : "input"}
                unitId={selectedUnitId ?? selectedQuizId ?? undefined}
                initialSlideOrder={initialSlideOrder}
            />
        );
    }

    return <QuizLandingClient key="landing" />;
}
