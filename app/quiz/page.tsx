"use client";

import Image from "next/image";
import { useState } from "react";
import "#css/quiz.css";
import "#css/sidebar.css"
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue, QuizData } from "@/app/quiz/types";
import QuizRender from "@/app/components/quiz/quizRender";

type AnswerResult = {
    correct: boolean;
    message: string;
    correctAnswer: string;
};

const correctMessages = ["That's correct!", "Excellent job!", "Well done!"];
const incorrectMessages = ["Hard luck!", "That’s incorrect.", "Not quite right."];

function getAnswer(quiz: QuizData) {
    const payload = quiz.quiz_payload;

    switch (quiz.type_name) {
        case "MCQ":
            return typeof payload.correct_index === "number"
                ? payload.options?.[payload.correct_index] ?? "No answer available"
                : "No answer available";
        case "FITB":
            return payload.answer?.trim() || "No answer available";
        case "Order":
            return payload.items?.reduce((answer, item, index, items) => {
                if (index === 0) return item;
                const touchesSymbol = item === ">" || item === "<"
                    || items[index - 1] === ">" || items[index - 1] === "<";
                return `${answer}${touchesSymbol ? "" : " "}${item}`;
            }, "") || "No answer available";
        case "Pair":
            return payload.pairs?.map(({ left, right }) => `${left} - ${right}`).join(", ")
                || "No answer available";
        default:
            return "No answer available";
    }
}

function evaluate(quiz: QuizData, value: AnswerValue): AnswerResult {
    const payload = quiz.quiz_payload;
    let correct = false;

    switch (quiz.type_name) {
        case "MCQ":
            correct = typeof value === "number" && value === payload.correct_index;
            break;
        case "FITB":
            const expected = payload.answer?.trim().toLowerCase();
            correct = typeof value === "string" && value.trim().toLowerCase() === expected;
            break;
        case "Order":
            correct = JSON.stringify(value) === JSON.stringify(payload.items);
            break;
        case "Pair":
            correct = value === (payload.pairs?.length ?? 0);
            break;
    }

    const messages = correct ? correctMessages : incorrectMessages;
    return {
        correct,
        message: messages[Math.floor(Math.random() * messages.length)],
        correctAnswer: getAnswer(quiz),
    };
}

export default function QuizPage() {
    // limit ko lang muna saglit to 10 ques para makita .progress-container - clarence
    // const {quizzes} = useQuizData();
    const {quizzes: allQuizzes} = useQuizData();
    const quizzes = allQuizzes.slice(0, 10);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [value, setValue] = useState<AnswerValue>(undefined);
    const [result, setResult] = useState<AnswerResult | null>(null);

    const quiz = quizzes[currentIndex];

    const resetState = () => {
        setValue(undefined);
        setResult(null);
    };

    const nextQuiz = () => {
        setCurrentIndex((index) => Math.min(index + 1, quizzes.length - 1));
        resetState();
    };

    const continueQuiz = () => {
        nextQuiz();
    };

    const submitAnswer = () => {
        if (!quiz) return;
        setResult(evaluate(quiz, value));
    };

    const handleAnswerChange = (nextValue: AnswerValue) => {
        setValue(nextValue);

        const pairCount = quiz?.quiz_payload.pairs?.length ?? 0;
        if (quiz?.type_name === "Pair" && nextValue === pairCount) {
            setResult(evaluate(quiz, nextValue));
        }
    };

    const handleQuestionKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLTextAreaElement && event.key === "Enter") {
            event.preventDefault();
            if (result) {
                continueQuiz();
            } else {
                submitAnswer();
            }
        }
    };

    const isPairIncomplete = quiz?.type_name === "Pair"
        && value !== (quiz.quiz_payload.pairs?.length ?? 0);

    const isAnswerIncomplete = (() => {
        if (!quiz) return true;

        switch (quiz.type_name) {
            case "MCQ":
                return typeof value !== "number";
            case "FITB":
                return typeof value !== "string" || value.trim() === "";
            case "Pair":
                return isPairIncomplete;
            default:
                return false;
        }
    })();

    return (
        <div className={`quiz-page${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
            <nav>
                <div className="navbar-header">
                    <Image src="/assets/QuizWeb-Logo.svg" width={52} height={52} alt=""/>
                    <div>
                        <h2>QuizWeb</h2>
                        <p>code made fun</p>
                    </div>
                </div>
            </nav>
            <div className="sidebar" id="quiz-sidebar">
                <div className="sidebar-nav">
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        <p>Home</p>
                    </div>
                    {/* toggle sidebar */}
                    <button
                        className="toggle-sidebar col"
                        type="button"
                        aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        aria-expanded={!isSidebarCollapsed}
                        aria-controls="quiz-sidebar"
                        onClick={() => setIsSidebarCollapsed((isCollapsed) => !isCollapsed)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                    </button>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-minus"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M9 10h6"/></svg>
                        <p>Learn</p>
                    </div>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-notebook-text"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5"/><path d="M9.5 12H16"/><path d="M9.5 16H14"/></svg>
                        <p>Cheat Sheet</p>
                    </div>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M12 7a5 5 0 1 0 5 5" /> <path d="M13 3.055a9 9 0 1 0 7.941 7.945" /> <path d="M15 6v3h3l3 -3h-3v-3z" /> <path d="M15 9l-3 3" /> </svg>
                        <p>Practice</p>
                    </div>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trophy"><path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/></svg>
                        <p>Leaderboard</p>
                    </div>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-user"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
                        <p>Profile</p>
                    </div>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                        <p>Setting</p>
                    </div>
                </div>
            </div>
            <main>
                <div className="quiz-header">
                    <div className="quiz-navigation">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        <div className="heart-container">
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                        </div>
                    </div>
                    <div className="progress-container">
                        {quizzes.map((_, index) => (
                            <div key={index} className={index <= currentIndex ? "active" : ""} />
                        ))}
                    </div>
                </div>

                <div style={{ maxWidth: "1080px", display: "flex", flexDirection: "column", gap: "20px", flex: "1", minHeight: "0" }}>
                    <div className="quiz-container" key={quiz?.quiz_id} onKeyDown={handleQuestionKeyDown}>
                        <h1>{quiz?.question_text ?? "Loading question..."}</h1>
                        {quiz && (
                            <QuizRender quiz={quiz} value={value} onChange={handleAnswerChange} />
                        )}
                    </div>
                </div>
            </main>

            <footer className={result ? (result.correct ? "correct" : "incorrect") : ""}>
                <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between" }}>
                    {/* dito sa div yung message */}
                    <div className="answer-message row">
                        <div className="answer-message-icon col">
                            <svg xmlns="http://www.w3.org/2000/svg" id="wrong" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" id="correct" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
                        </div>
                        <div id="answer-message-text">
                            <h2>{result?.message}</h2>
                            {!result?.correct && result && <p><b>Correct Answer:</b> {result.correctAnswer}</p>}
                        </div>
                    </div>
                    <button className="options" id="skip" onClick={nextQuiz} disabled={!quiz}>Skip</button>
                    <button
                        className="options"
                        id="submit"
                        onClick={result ? continueQuiz : submitAnswer}
                        disabled={!quiz || (!result && isAnswerIncomplete)}
                    >
                        {result ? "Continue" : "Submit"}
                    </button>
                </div>
            </footer>
        </div>
    )
}