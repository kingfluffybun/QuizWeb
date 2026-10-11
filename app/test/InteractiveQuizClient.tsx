"use client";

import React, { useState, useEffect } from "react";
import "#css/test_quiz.css";
import { QuizData, QuizStatus } from "./types";
import QuizHeader from "./components/QuizHeader";
import QuizFooter from "./components/QuizFooter";
import GameOverCard from "./components/GameOverCard";
import QuizMCQ from "./components/questions/QuizMCQ";
import QuizFITB from "./components/questions/QuizFITB";
import QuizOrder from "./components/questions/QuizOrder";
import QuizPair from "./components/questions/QuizPair";
import QuizCP from "./components/questions/QuizCP";
import LessonCard from "@/app/components/LessonCard";

function normalizeQuizType(typeName?: string) {
    return (typeName ?? "").trim().toLowerCase();
}

function resolveQuizType(quiz: QuizData | undefined): string {
    if (!quiz) return "";

    const key = normalizeQuizType(quiz.type_name);
    if (["mcq", "fitb", "order", "pair", "cp"].includes(key)) {
        return key.toUpperCase();
    }

    const payload = quiz.quiz_payload ?? {};
    if (Array.isArray(payload.options)) return "MCQ";
    if (Array.isArray(payload.items)) return "Order";
    if (Array.isArray(payload.pairs)) return "Pair";
    if (Array.isArray(payload.steps) || Array.isArray(payload.prompts) || payload.template !== undefined || payload.expected !== undefined) return "CP";
    if (payload.answer !== undefined) return "FITB";

    return "";
}

function getInitialQuizState(quiz: QuizData | undefined) {
    if (!quiz) return { answer: null, state: null };
    const payload = quiz.quiz_payload;
    const typeName = resolveQuizType(quiz);

    let answer: any = null;
    let state: any = null;

    if (typeName === "MCQ" && payload?.options) {
        const opts = payload.options.map((text, id) => ({ id, text }));
        state = {
            options: opts.sort(() => Math.random() - 0.5),
            correctId: payload.correct_index ?? 0
        };
        answer = null;
    } else if (typeName === "Order" && payload?.items) {
        answer = [...payload.items].sort(() => Math.random() - 0.5);
    } else if (typeName === "Pair" && payload?.pairs) {
        answer = {
            left: payload.pairs.map((p) => p.left).sort(() => Math.random() - 0.5),
            right: payload.pairs.map((p) => p.right).sort(() => Math.random() - 0.5)
        };
    } else if (typeName === "CP") {
        const steps = getCPSteps(quiz);
        answer = steps[0]?.template || payload?.template || "";
    } else if (typeName === "FITB") {
        answer = "";
    }

    return { answer, state };
}

function getCPSteps(quiz: QuizData | undefined) {
    if (!quiz || resolveQuizType(quiz) !== "CP") return [];
    const payload = quiz.quiz_payload;
    if (payload?.steps && payload.steps.length > 0) {
        return payload.steps.map((s) => ({
            prompt: s.prompt || quiz.question_text || "",
            template: s.template || payload.template || "",
            expected: s.expected || "",
        }));
    }
    if (payload?.prompts && payload.prompts.length > 0) {
        return payload.prompts.map((p) => ({
            prompt: p || quiz.question_text || "",
            template: payload.template || "",
            expected: payload.expected || "",
        }));
    }
    return [
        {
            prompt: quiz.question_text || payload?.prompt || "",
            template: payload?.template || "",
            expected: payload?.expected || "",
        },
    ];
}

export default function InteractiveQuizClient({ quizzes }: { quizzes: QuizData[] }) {
    const [isMounted, setIsMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [hasStartedQuiz, setHasStartedQuiz] = useState(false);
    const [lives, setLives] = useState(5);
    const [score, setScore] = useState(0);
    const [status, setStatus] = useState<QuizStatus>("idle");

    const [cpStepIndex, setCpStepIndex] = useState(0);
    const [stepMessage, setStepMessage] = useState<string | null>(null);

    const activeQuiz = quizzes[currentIndex];
    const payload = activeQuiz?.quiz_payload;
    const activeQuizType = resolveQuizType(activeQuiz);
    const unitTitle = (activeQuiz as any)?.unit_title ?? "";
    const unitLessonCard = (activeQuiz as any)?.unit_lesson_card ?? {};
    const unitAssessment = (activeQuiz as any)?.unit_assessment ?? {};
    const lessonSlides = typeof unitLessonCard === "object" && Array.isArray(unitLessonCard.lesson_slide)
        ? unitLessonCard.lesson_slide
        : [{ lesson_text: unitLessonCard.lesson_card?.lesson_text ?? unitLessonCard.lesson_text ?? "" }];
    const assessmentText = typeof unitAssessment === "object"
        ? unitAssessment.assessment ?? ""
        : String(unitAssessment ?? "");
    const hasLesson = Boolean(
        unitTitle ||
        lessonSlides.some(
            (slide: { lesson_text?: string; lesson_code?: string }) =>
                slide.lesson_text || slide.lesson_code,
        ),
    );

    const [currentAnswer, setCurrentAnswer] = useState<any>(null);
    const [quizState, setQuizState] = useState<any>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!activeQuiz) return;
        const initial = getInitialQuizState(activeQuiz);
        setCurrentAnswer(initial.answer);
        setQuizState(initial.state);
        setCpStepIndex(0);
        setStepMessage(null);
    }, [currentIndex, activeQuiz]);

    const cpSteps = getCPSteps(activeQuiz);
    const currentStep = cpSteps[cpStepIndex] || cpSteps[0];

    const handleCheckAnswer = () => {
        if (status !== "idle" || !activeQuiz || !payload) return;
        let isCorrect = false;

        switch (activeQuizType) {
            case "MCQ":
                isCorrect = currentAnswer === quizState?.correctId;
                break;
            case "FITB":
                isCorrect = currentAnswer?.toString().trim().toLowerCase() === payload.answer?.trim().toLowerCase();
                break;
            case "Order":
                isCorrect = JSON.stringify(currentAnswer) === JSON.stringify(payload.items);
                break;
            case "Pair":
                isCorrect = currentAnswer?.left?.every((leftVal: string, i: number) =>
                    payload.pairs?.some((p) => p.left === leftVal && p.right === currentAnswer.right[i])
                );
                break;
            case "CP": {
                const targetExpected = currentStep?.expected || payload.expected || "";
                isCorrect = currentAnswer?.replace(/\s+/g, "") === targetExpected.replace(/\s+/g, "");

                if (isCorrect) {
                    if (cpStepIndex < cpSteps.length - 1) {
                        setCpStepIndex((prev) => prev + 1);
                        setStepMessage(`✓ Step ${cpStepIndex + 1} completed! Proceed to Step ${cpStepIndex + 2}.`);
                        setStatus("idle");
                        return;
                    } else {
                        setStepMessage(null);
                    }
                }
                break;
            }
        }

        if (isCorrect) {
            setScore((prev) => prev + 1);
            setStatus("correct");
        } else {
            setLives((prev) => Math.max(0, prev - 1));
            setStatus("incorrect");
        }
    };

    const nextQuestion = () => {
        if (currentIndex < quizzes.length - 1 && lives > 0) {
            setCurrentIndex((prev) => prev + 1);
            setStatus("idle");
        } else if (assessmentText) {
            setStatus("assessment");
        } else {
            setStatus("finished");
        }
    };

    if (!isMounted || !activeQuiz) return null;

    if (status === "assessment") {
        return (
            <div className="test-page">
                <nav />
                <div className="sidebar" />
                <main>
                    <div className="main-content">
                        <QuizHeader lives={lives} totalQuizzes={quizzes.length} currentIndex={currentIndex} />
                        <div className="unit-meta anim-enter" style={{ marginBottom: "24px", padding: "16px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                <strong>Assessment:</strong> {assessmentText}
                            </div>
                        </div>
                    </div>
                </main>
                <footer>
                    <div className="footer-content" style={{ justifyContent: "flex-end" }}>
                        <button
                            className="options footer-btn anim-pop"
                            id="submit"
                            onClick={() => setStatus("finished")}
                        >
                            Continue
                        </button>
                    </div>
                </footer>
            </div>
        );
    }

    if (status === "finished") {
        return (
            <div className="test-page">
                <main>
                    <GameOverCard
                        lives={lives}
                        score={score}
                        totalQuizzes={quizzes.length}
                    />
                </main>
            </div>
        );
    }

    if (hasLesson && !hasStartedQuiz) {
        return (
            <div className="test-page">
                <nav />
                <div className="sidebar" />
                <main>
                    <div className="main-content">
                        <QuizHeader lives={lives} totalQuizzes={quizzes.length} currentIndex={currentIndex} />
                        <LessonCard
                            key={activeQuiz?.quiz_id ?? currentIndex}
                            title={unitTitle}
                            slides={lessonSlides}
                            className="unit-meta"
                        />
                    </div>
                </main>
                <footer>
                    <div className="footer-content lesson-footer-content">
                        <button
                            className="options footer-btn"
                            id="submit"
                            onClick={() => setHasStartedQuiz(true)}
                        >
                            Start Quiz
                        </button>
                    </div>
                </footer>
            </div>
        );
    }

    return (
        <div className="test-page">
            <nav />
            <div className="sidebar" />
            <main>
                <div className="main-content">
                    <QuizHeader lives={lives} totalQuizzes={quizzes.length} currentIndex={currentIndex} />

                    <div key={currentIndex} className={`quiz-container anim-enter ${status === "incorrect" ? "anim-shake" : ""} ${status === "correct" ? "anim-pop" : ""}`}>
                        <h1 className="quiz-question-title">{activeQuiz.question_text}</h1>

                        <div className="options-container">
                            {activeQuizType === "MCQ" && quizState?.options && (
                                <QuizMCQ options={quizState.options} correctId={quizState.correctId} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuizType === "FITB" && (
                                <QuizFITB payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuizType === "Order" && currentAnswer && (
                                <QuizOrder payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuizType === "Pair" && currentAnswer && (
                                <QuizPair payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuizType === "CP" && (
                                <QuizCP
                                    payload={payload}
                                    currentStepIndex={cpStepIndex}
                                    totalSteps={cpSteps.length}
                                    stepPrompt={currentStep?.prompt || activeQuiz.question_text}
                                    stepExpected={currentStep?.expected || payload.expected || ""}
                                    currentAnswer={currentAnswer}
                                    onChange={setCurrentAnswer}
                                    status={status}
                                    stepMessage={stepMessage}
                                />
                            )}

                            {!activeQuizType && (
                                <div className="options" style={{ padding: "16px 24px" }}>
                                    <strong>Raw payload</strong>
                                    <pre style={{ whiteSpace: "pre-wrap", marginTop: "12px" }}>
                                        {JSON.stringify(payload ?? {}, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {status === "correct" && <div className="feedback-msg feedback-correct anim-enter">Correct! Excellent work.</div>}
                            {status === "incorrect" && (
                                <div className="feedback-msg feedback-incorrect anim-enter">
                                    <span>
                                        Incorrect! Review expected answer for Step {cpStepIndex + 1} highlighted above.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <QuizFooter status={status} onSkip={nextQuestion} onSubmit={handleCheckAnswer} onContinue={nextQuestion} />
        </div>
    );
}