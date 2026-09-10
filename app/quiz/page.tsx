"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import "#css/quiz.css";
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue } from "@/app/quiz/types";
import QuizRender from "@/app/components/quiz/quizRender";
import { submitAnswer } from "@/app/actions/quiz";

function QuizContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const catParam = searchParams.get("cat") || undefined;
    const secParam = searchParams.get("sec") || undefined;
    const diffParam = searchParams.get("diff") || undefined;
    const typeParam = searchParams.get("type") || undefined;

    const { quizzes, loading } = useQuizData({
        cat_name: catParam,
        sec_num: secParam,
        difficulty_name: diffParam,
        type_name: typeParam,
    });

    const [currentIndex, setCurrentIndex] = useState(0);
    const [value, setValue] = useState<AnswerValue>(undefined);
    const [message, setMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastResult, setLastResult] = useState<{ correct: boolean; xpGained?: number; streak?: number } | null>(null);
    const [heartsLeft, setHeartsLeft] = useState<number>(5);
    const [sessionXp, setSessionXp] = useState<number>(0);
    const [isCompleted, setIsCompleted] = useState<boolean>(false);

    const quiz = quizzes[currentIndex];

    const resetState = () => {
        setValue(undefined);
        setMessage(null);
        setLastResult(null);
    };

    const nextQuiz = () => {
        if (currentIndex + 1 >= quizzes.length) {
            setIsCompleted(true);
        } else {
            setCurrentIndex((index) => index + 1);
            resetState();
        }
    };

    const handleSubmit = async () => {
        if (!quiz || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const selectedValue =
                quiz.type_name === "MCQ" && typeof value === "number"
                    ? quiz.quiz_payload.options?.[value]
                    : value;
            const res = await submitAnswer(quiz.quiz_id, selectedValue);

            if (res.error) {
                setMessage(res.error);
                setLastResult(null);
            } else {
                setMessage(res.message ?? null);
                const isCorrect = !!res.correct;
                const xp = res.progress?.xpGained ?? (isCorrect ? 15 : 0);
                const streak = res.progress?.currentStreak ?? 1;

                if (typeof res.progress?.heartsLeft === "number") {
                    setHeartsLeft(res.progress.heartsLeft);
                }

                if (isCorrect) {
                    setSessionXp((prev) => prev + xp);
                }

                setLastResult({
                    correct: isCorrect,
                    xpGained: xp,
                    streak,
                });
            }
        } catch {
            setMessage("Failed to evaluate answer. Please try again.");
            setLastResult(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="quiz-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚡</div>
                    <p style={{ fontWeight: "700", color: "var(--text-muted)" }}>Loading questions...</p>
                </div>
            </div>
        );
    }

    if (quizzes.length === 0) {
        return (
            <div className="quiz-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ textAlign: "center", maxWidth: "480px", padding: "2rem", backgroundColor: "var(--bg-card)", borderRadius: "24px", border: "2px solid var(--border-main)" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎯</div>
                    <h2 style={{ marginBottom: "12px" }}>No Questions Found</h2>
                    <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                        There are currently no questions matching this specific filter.
                    </p>
                    <Link
                        href="/dashboard"
                        className="options"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            textDecoration: "none",
                            padding: "12px 24px",
                            backgroundColor: "var(--primary-color)",
                            color: "#fff",
                            borderRadius: "16px",
                            fontWeight: "700",
                        }}
                    >
                        Return to Learning Path
                    </Link>
                </div>
            </div>
        );
    }

    // Session Complete screen
    if (isCompleted) {
        return (
            <div className="quiz-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
                <div style={{ textAlign: "center", maxWidth: "520px", width: "90%", padding: "40px", backgroundColor: "var(--bg-card)", borderRadius: "32px", border: "3px solid var(--border-main)", boxShadow: "0 20px 40px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
                    <h1 style={{ fontSize: "2rem", fontWeight: "800", marginBottom: "12px", color: "var(--text-main)" }}>Checkpoint Complete!</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", marginBottom: "28px" }}>
                        You finished all {quizzes.length} questions in this checkpoint!
                    </p>

                    <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "32px" }}>
                        <div style={{ padding: "16px 24px", borderRadius: "20px", backgroundColor: "rgba(234, 179, 8, 0.12)", border: "2px solid #eab308" }}>
                            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#ca8a04" }}>+{sessionXp} XP</div>
                            <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Total XP</div>
                        </div>
                        <div style={{ padding: "16px 24px", borderRadius: "20px", backgroundColor: "rgba(249, 115, 22, 0.12)", border: "2px solid #f97316" }}>
                            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#ea580c" }}>🔥 100%</div>
                            <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Accuracy</div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        style={{
                            width: "100%",
                            padding: "16px",
                            backgroundColor: "var(--selected-color, #7c3aed)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "20px",
                            fontSize: "1.2rem",
                            fontWeight: "800",
                            cursor: "pointer",
                            boxShadow: "0 6px 0 #5b21b6",
                            transition: "all 0.15s ease",
                        }}
                    >
                        CONTINUE TO PATH
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="quiz-page">
            <nav></nav>
            <div className="sidebar"></div>
            <main>
                <div className="quiz-header">
                    <div className="quiz-navigation">
                        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", color: "inherit", textDecoration: "none" }} aria-label="Exit to Dashboard">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </Link>

                        {/* Title details */}
                        <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text-muted)", marginLeft: "8px" }}>
                            {catParam ? `${catParam} • Section ${secParam ?? "1"} • ${diffParam ?? "All"}` : "Quiz Web Challenge"}
                        </div>

                        {/* Animated Hearts HUD */}
                        <div className="heart-container" role="status" aria-label={`${heartsLeft} lives remaining`}>
                            {Array.from({ length: 5 }, (_, i) => (
                                <svg
                                    key={i}
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="32"
                                    height="32"
                                    viewBox="0 0 24 24"
                                    fill={i < heartsLeft ? "#EE5555" : "#cbd5e1"}
                                    stroke={i < heartsLeft ? "#dc2626" : "#94a3b8"}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{
                                        transition: "transform 0.2s ease, fill 0.3s ease",
                                        transform: i < heartsLeft ? "scale(1)" : "scale(0.85)",
                                    }}
                                >
                                    <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
                                </svg>
                            ))}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                        className="progress-container"
                        role="progressbar"
                        aria-valuenow={currentIndex + 1}
                        aria-valuemin={1}
                        aria-valuemax={quizzes.length || 1}
                        aria-valuetext={`Question ${currentIndex + 1} of ${quizzes.length || 1}`}
                    >
                        {quizzes.map((_, index) => (
                            <div key={index} className={index <= currentIndex ? "active" : ""} />
                        ))}
                    </div>
                </div>

                <div style={{ maxWidth: "1080px", width: "100%", display: "flex", flexDirection: "column", gap: "20px", flex: "1", minHeight: "0" }}>
                    <div className="quiz-container" key={quiz?.quiz_id} style={{ minWidth: 0, width: "100%" }}>
                        <h1 style={{ fontSize: "clamp(1.2rem, 2vw, 1.8rem)", fontWeight: "800", color: "var(--text-main)" }}>
                            {quiz?.question_text ?? "Loading question..."}
                        </h1>

                        {quiz && (
                            <QuizRender quiz={quiz} value={value} onChange={setValue} />
                        )}

                        {/* Interactive Result Feedback Banner */}
                        {lastResult && (
                            <div
                                style={{
                                    marginTop: "16px",
                                    padding: "14px 20px",
                                    borderRadius: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    backgroundColor: lastResult.correct ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                    border: `2px solid ${lastResult.correct ? "#22c55e" : "#ef4444"}`,
                                    color: lastResult.correct ? "#15803d" : "#b91c1c",
                                    fontWeight: "700",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "1.4rem" }}>{lastResult.correct ? "🎉" : "💡"}</span>
                                    <span>{message}</span>
                                </div>
                                {lastResult.correct && lastResult.xpGained ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#22c55e", color: "#fff", padding: "4px 12px", borderRadius: "12px", fontSize: "0.9rem" }}>
                                        <span>+{lastResult.xpGained} XP</span>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {!lastResult && message && (
                            <p role="status" aria-live="polite" style={{ color: "#ef4444", fontWeight: "600", marginTop: "12px" }}>
                                {message}
                            </p>
                        )}
                    </div>
                </div>
            </main>

            <footer>
                <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between", gap: "16px" }}>
                    <button className="options" id="skip" onClick={nextQuiz} disabled={!quiz}>
                        {lastResult ? "Next Question →" : "Skip"}
                    </button>
                    {!lastResult ? (
                        <button className="options" id="submit" onClick={handleSubmit} disabled={!quiz || isSubmitting}>
                            {isSubmitting ? "Checking..." : "Submit"}
                        </button>
                    ) : (
                        <button
                            className="options"
                            id="submit"
                            onClick={nextQuiz}
                            style={{
                                backgroundColor: lastResult.correct ? "var(--success-color, #22c55e)" : "var(--primary-color)",
                                borderBottomColor: lastResult.correct ? "#16a34a" : "#6b36da",
                            }}
                        >
                            Continue
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}

export default function QuizPage() {
    return (
        <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading learning session...</div>}>
            <QuizContent />
        </Suspense>
    );
}