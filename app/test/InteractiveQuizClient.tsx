"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import "#css/test_quiz.css";
import "#css/nav.css";
import {
    QuizAnswer,
    QuizCustomState,
    QuizData,
    QuizStatus,
    PairAnswer,
    McqOption,
} from "./types";

const emptySubscribe = () => () => {};
import QuizHeader from "./components/QuizHeader";
import QuizFooter from "./components/QuizFooter";
import GameOverCard from "./components/GameOverCard";
import QuizMCQ from "./components/questions/QuizMCQ";
import QuizFITB from "./components/questions/QuizFITB";
import QuizOrder from "./components/questions/QuizOrder";
import QuizPair from "./components/questions/QuizPair";
import QuizCP from "./components/questions/QuizCP";
import LessonCard from "@/app/components/LessonCard";
import { useQuizSounds } from "@/app/quiz/useQuizSounds";
import { validateSingleTabTemplate } from "@/lib/cp-validator";
import { recordUserActivity } from "@/app/actions/streak";
import { shuffleItems } from "@/app/quiz/shuffle";

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

function getInitialQuizState(quiz: QuizData | undefined): { answer: QuizAnswer; state: QuizCustomState } {
    if (!quiz) return { answer: null, state: null };
    const payload = quiz.quiz_payload;
    const typeName = resolveQuizType(quiz);

    let answer: QuizAnswer = null;
    let state: QuizCustomState = null;

    if (typeName === "MCQ" && payload?.options) {
        const opts: McqOption[] = payload.options.map((text, id) => ({ id, text }));
        state = {
            options: shuffleItems(opts),
            correctId: payload.correct_index ?? 0
        };
        answer = null;
    } else if (typeName === "Order" && payload?.items) {
        answer = shuffleItems(payload.items);
    } else if (typeName === "Pair" && payload?.pairs) {
        answer = {
            left: shuffleItems(payload.pairs.map((p) => p.left)),
            right: shuffleItems(payload.pairs.map((p) => p.right))
        };
    } else if (typeName === "CP") {
        const steps = getCPSteps(quiz);
        answer = steps[0]?.template || (typeof payload?.template === "string" ? payload.template : "");
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

export default function InteractiveQuizClient({
    quizzes,
    completionDestination = "input",
}: {
    quizzes: QuizData[];
    completionDestination?: "home" | "input";
}) {
    const playQuizSound = useQuizSounds();
    const isMounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false,
    );
    const [currentIndex, setCurrentIndex] = useState(0);
    const [hasStartedQuiz, setHasStartedQuiz] = useState(false);
    const [lives, setLives] = useState(5);
    const [score, setScore] = useState(0);
    const [status, setStatus] = useState<QuizStatus>("idle");

    useEffect(() => {
        if (status === "finished" && lives > 0) {
            recordUserActivity({
                type: "quiz",
                xp: Math.max(10, score * 10),
            }).catch((e) => {
                console.error("Failed to record activity:", e);
            });
        }
    }, [status, lives, score]);

    const [cpStepIndex, setCpStepIndex] = useState(0);
    const [stepMessage, setStepMessage] = useState<string | null>(null);

    const activeQuiz = quizzes[currentIndex];
    const payload = activeQuiz?.quiz_payload;
    const activeQuizType = resolveQuizType(activeQuiz);
    const unitTitle = activeQuiz?.unit_title ?? "";
    const unitLessonCard = activeQuiz?.unit_lesson_card ?? {};
    const unitAssessment = activeQuiz?.unit_assessment ?? {};
    const lessonSlides = typeof unitLessonCard === "object" && Array.isArray(unitLessonCard.lesson_slide)
        ? unitLessonCard.lesson_slide
        : [{ lesson_text: unitLessonCard.lesson_card?.lesson_text ?? unitLessonCard.lesson_text ?? "" }];
    const assessmentText = typeof unitAssessment === "object"
        ? (typeof unitAssessment.assessment === "string" ? unitAssessment.assessment : "")
        : String(unitAssessment ?? "");
    const assessmentTitle = typeof unitAssessment === "object"
        ? (typeof unitAssessment.title === "string" ? unitAssessment.title : "")
        : "";
    const assessmentDescription = typeof unitAssessment === "object"
        ? (typeof unitAssessment.description === "string" ? unitAssessment.description : "")
        : "";
    const savedAssessmentSteps = typeof unitAssessment === "object" && Array.isArray(unitAssessment.steps)
        ? unitAssessment.steps.filter((step: unknown): step is string => typeof step === "string" && step.trim().length > 0)
        : [];
    const assessmentSteps = savedAssessmentSteps.length > 0
        ? savedAssessmentSteps
        : assessmentText.split(/\n\s*\n/).filter((step: string) => step.trim().length > 0);
    const expectedOutcome = typeof unitAssessment === "object" && typeof unitAssessment.expected_outcome === "string"
        ? unitAssessment.expected_outcome
        : "";
    const hasAssessment = Boolean(
        assessmentTitle || assessmentDescription || assessmentSteps.length > 0 || expectedOutcome,
    );
    const hasLesson = Boolean(
        unitTitle ||
        lessonSlides.some(
            (slide: { lesson_title?: string; lesson_text?: string; lesson_code?: string }) =>
                slide.lesson_title || slide.lesson_text || slide.lesson_code,
        ),
    );

    const [prevActiveQuiz, setPrevActiveQuiz] = useState<QuizData | undefined>(activeQuiz);
    const [currentAnswer, setCurrentAnswer] = useState<QuizAnswer>(() => getInitialQuizState(quizzes[0]).answer);
    const [quizState, setQuizState] = useState<QuizCustomState>(() => getInitialQuizState(quizzes[0]).state);

    if (prevActiveQuiz !== activeQuiz) {
        setPrevActiveQuiz(activeQuiz);
        const initial = getInitialQuizState(activeQuiz);
        setCurrentAnswer(initial.answer);
        setQuizState(initial.state);
        setCpStepIndex(0);
        setStepMessage(null);
    }

    const cpSteps = getCPSteps(activeQuiz);
    const currentStep = cpSteps[cpStepIndex] || cpSteps[0];

    const handleCheckAnswer = () => {
        if (status !== "idle" || !activeQuiz || !payload) return;
        let isCorrect = false;

        switch (activeQuizType) {
            case "MCQ":
                isCorrect = currentAnswer === quizState?.correctId;
                break;
            case "FITB": {
                const ansStr = currentAnswer !== null && currentAnswer !== undefined ? String(currentAnswer).trim().toLowerCase() : "";
                const expectedStr = typeof payload.answer === "string" ? payload.answer.trim().toLowerCase() : "";
                isCorrect = ansStr === expectedStr;
                break;
            }
            case "Order":
                isCorrect = JSON.stringify(currentAnswer) === JSON.stringify(payload.items);
                break;
            case "Pair": {
                const pairAns = currentAnswer && typeof currentAnswer === "object" && !Array.isArray(currentAnswer) && "left" in currentAnswer && "right" in currentAnswer
                    ? (currentAnswer as PairAnswer)
                    : null;
                isCorrect = Boolean(pairAns?.left?.every((leftVal: string, i: number) =>
                    payload.pairs?.some((p) => p.left === leftVal && p.right === pairAns.right[i])
                ));
                break;
            }
            case "CP": {
                const targetExpected = currentStep?.expected || (typeof payload.expected === "string" ? payload.expected : "");
                const ansStr = typeof currentAnswer === "string" ? currentAnswer : "";
                const cpCheck = validateSingleTabTemplate(ansStr, targetExpected, "html");
                isCorrect = cpCheck.passed;

                if (isCorrect) {
                    if (cpStepIndex < cpSteps.length - 1) {
                        setCpStepIndex((prev) => prev + 1);
                        setStepMessage(`✓ Step ${cpStepIndex + 1} completed! Proceed to Step ${cpStepIndex + 2}.`);
                        setStatus("idle");
                        return;
                    } else {
                        setStepMessage(null);
                    }
                } else {
                    setStepMessage(cpCheck.message);
                }
                break;
            }
        }

        if (isCorrect) {
            if (activeQuizType === "MCQ" || activeQuizType === "FITB") {
                playQuizSound("correct-answer1");
            } else if (activeQuizType === "Order") {
                playQuizSound("correct-answer3");
            } else if (activeQuizType === "Pair") {
                playQuizSound("correct-answer2");
            }
            setScore((prev) => prev + 1);
            setStatus("correct");
        } else {
            if (["MCQ", "FITB", "Order", "Pair"].includes(activeQuizType)) {
                playQuizSound("wrong-answer");
            }
            setLives((prev) => Math.max(0, prev - 1));
            setStatus("incorrect");
        }
    };

    const nextQuestion = (isContinue = false) => {
        if (currentIndex < quizzes.length - 1 && lives > 0) {
            setCurrentIndex((prev) => prev + 1);
            setStatus("idle");
        } else if (hasAssessment) {
            setStatus("assessment");
        } else {
            if (isContinue && hasLesson && lives > 0) {
                playQuizSound("lesson-complete");
            }
            setStatus("finished");
        }
    };

    const finishAssessment = () => {
        if (hasLesson && lives > 0) {
            playQuizSound("lesson-complete");
        }
        setStatus("finished");
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
                            <h2 style={{ marginTop: 0 }}>
                                {assessmentTitle || "Assessment"}
                            </h2>
                            {assessmentDescription && (
                                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                    {assessmentDescription}
                                </p>
                            )}
                            {assessmentSteps.length > 0 && (
                                <ol style={{ paddingLeft: "24px", lineHeight: 1.6 }}>
                                    {assessmentSteps.map((step: string, index: number) => (
                                        <li key={index} style={{ whiteSpace: "pre-wrap", marginBottom: "10px" }}>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            )}
                            {expectedOutcome && (
                                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                    <strong>Expected outcome:</strong> {expectedOutcome}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
                <footer>
                    <div className="footer-content" style={{ justifyContent: "flex-end" }}>
                        <button
                            className="options footer-btn anim-pop"
                            id="submit"
                            onClick={finishAssessment}
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
                        completionDestination={completionDestination}
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
                                <QuizMCQ
                                    options={quizState.options}
                                    correctId={quizState.correctId}
                                    currentAnswer={typeof currentAnswer === "number" ? currentAnswer : null}
                                    onChange={(ans) => setCurrentAnswer(ans)}
                                    status={status}
                                />
                            )}
                            {activeQuizType === "FITB" && (
                                <QuizFITB
                                    payload={payload}
                                    currentAnswer={typeof currentAnswer === "string" ? currentAnswer : ""}
                                    onChange={(ans) => setCurrentAnswer(ans)}
                                    status={status}
                                />
                            )}
                            {activeQuizType === "Order" && Array.isArray(currentAnswer) && (
                                <QuizOrder
                                    payload={payload}
                                    currentAnswer={currentAnswer}
                                    onChange={(ans) => setCurrentAnswer(ans)}
                                    status={status}
                                />
                            )}
                            {activeQuizType === "Pair" && currentAnswer && typeof currentAnswer === "object" && !Array.isArray(currentAnswer) && (
                                <QuizPair
                                    payload={payload}
                                    currentAnswer={currentAnswer as PairAnswer}
                                    onChange={(ans) => setCurrentAnswer(ans)}
                                    status={status}
                                />
                            )}
                            {activeQuizType === "CP" && (
                                <QuizCP
                                    payload={payload}
                                    currentStepIndex={cpStepIndex}
                                    totalSteps={cpSteps.length}
                                    stepPrompt={currentStep?.prompt || activeQuiz.question_text}
                                    stepExpected={currentStep?.expected || (typeof payload.expected === "string" ? payload.expected : "")}
                                    currentAnswer={typeof currentAnswer === "string" ? currentAnswer : ""}
                                    onChange={(ans) => setCurrentAnswer(ans)}
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
            <QuizFooter
                status={status}
                onSkip={() => nextQuestion()}
                onSubmit={handleCheckAnswer}
                onContinue={() => nextQuestion(true)}
            />
        </div>
    );
}