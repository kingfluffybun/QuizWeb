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

function getInitialQuizState(quiz: QuizData | undefined) {
    if (!quiz) return { answer: null, state: null };
    const payload = quiz.quiz_payload;

    let answer: any = null;
    let state: any = null;

    if (quiz.type_name === "MCQ" && payload?.options) {
        const opts = payload.options.map((text, id) => ({ id, text }));
        state = {
            options: opts.sort(() => Math.random() - 0.5),
            correctId: payload.correct_index ?? 0
        };
        answer = null;
    } else if (quiz.type_name === "Order" && payload?.items) {
        answer = [...payload.items].sort(() => Math.random() - 0.5);
    } else if (quiz.type_name === "Pair" && payload?.pairs) {
        answer = {
            left: payload.pairs.map((p) => p.left).sort(() => Math.random() - 0.5),
            right: payload.pairs.map((p) => p.right).sort(() => Math.random() - 0.5)
        };
    } else if (quiz.type_name === "CP" && payload?.template) {
        answer = payload.template;
    } else if (quiz.type_name === "FITB") {
        answer = "";
    }

    return { answer, state };
}

export default function InteractiveQuizClient({ quizzes }: { quizzes: QuizData[] }) {
    const [isMounted, setIsMounted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lives, setLives] = useState(5);
    const [score, setScore] = useState(0);
    const [status, setStatus] = useState<QuizStatus>("idle");

    const activeQuiz = quizzes[currentIndex];
    const payload = activeQuiz?.quiz_payload;

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
    }, [currentIndex, activeQuiz]);

    const handleCheckAnswer = () => {
        if (status !== "idle" || !activeQuiz || !payload) return;
        let isCorrect = false;

        switch (activeQuiz.type_name) {
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
            case "CP":
                isCorrect = currentAnswer?.replace(/\s+/g, "") === payload.expected?.replace(/\s+/g, "");
                break;
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
        } else {
            setStatus("finished");
        }
    };

    if (!isMounted || !activeQuiz) return null;

    if (status === "finished") {
        return (
            <div className="test-page">
                <main><GameOverCard lives={lives} score={score} totalQuizzes={quizzes.length} /></main>
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
                            {activeQuiz.type_name === "MCQ" && quizState?.options && (
                                <QuizMCQ options={quizState.options} correctId={quizState.correctId} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuiz.type_name === "FITB" && (
                                <QuizFITB payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuiz.type_name === "Order" && currentAnswer && (
                                <QuizOrder payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuiz.type_name === "Pair" && currentAnswer && (
                                <QuizPair payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}
                            {activeQuiz.type_name === "CP" && (
                                <QuizCP payload={payload} currentAnswer={currentAnswer} onChange={setCurrentAnswer} status={status} />
                            )}

                            {status === "correct" && <div className="feedback-msg feedback-correct anim-enter">Correct! Excellent work.</div>}
                            {status === "incorrect" && <div className="feedback-msg feedback-incorrect anim-enter"><span>Incorrect! Review the highlighted correct answer above.</span></div>}
                        </div>
                    </div>
                </div>
            </main>
            <QuizFooter status={status} onSkip={nextQuestion} onSubmit={handleCheckAnswer} onContinue={nextQuestion} />
        </div>
    );
}