"use client";

import { useState } from "react";
import "#css/quiz.css";
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
    const {quizzes} = useQuizData();
    const [currentIndex, setCurrentIndex] = useState(0);
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

    const isPairIncomplete = quiz?.type_name === "Pair"
        && value !== (quiz.quiz_payload.pairs?.length ?? 0);

    return (
        <div className="quiz-page">
            <nav></nav>
            <div className="sidebar"></div>
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
                    <div className="quiz-container" key={quiz?.quiz_id}>
                        <h1>{quiz?.question_text ?? "Loading question..."}</h1>
                        {quiz && (
                            <QuizRender quiz={quiz} value={value} onChange={setValue} />
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
                        disabled={!quiz || (!result && isPairIncomplete)}
                    >
                        {result ? "Continue" : "Submit"}
                    </button>
                </div>
            </footer>
        </div>
    )
}