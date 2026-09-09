"use client";

import { useState } from "react";
import "#css/quiz.css";
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue, QuizData } from "@/app/quiz/types";
import QuizRender from "@/app/components/quiz/quizRender";

function evaluate(quiz: QuizData, value: AnswerValue) {
    const payload = quiz.quiz_payload;

    switch (quiz.type_name) {
        case "MCQ":
            if (typeof value !== "number") return "Please select an answer.";
            return value === payload.correct_index ? "Correct" : "Incorrect";
        case "FITB":
            const expected = payload.answer?.trim().toLowerCase();
            return typeof value === "string" && value.trim().toLowerCase() === expected
                ? "Correct!"
                : "Incorrect.";
        case "Order":
            return JSON.stringify(value) === JSON.stringify(payload.items)
                ? "Correct!"
                : "Incorrect";
        case "Pair":
            return value === (payload.pairs?.length ?? 0)
                ? "Correct!"
                : "Match all pairs before submitting.";
        default:
            return "Unknown question type.";
    }
}

export default function QuizPage() {
    const {quizzes} = useQuizData();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [value, setValue] = useState<AnswerValue>(undefined);
    const [message, setMessage] = useState<string | null>(null);

    const quiz = quizzes[currentIndex];

    const resetState = () => {
        setValue(undefined);
        setMessage(null);
    };

    const nextQuiz = () => {
        setCurrentIndex((index) => Math.min(index + 1, quizzes.length - 1));
        resetState();
    };

    const submitAnswer = () => {
        if (!quiz) return;
        setMessage(evaluate(quiz, value));
    };

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
                        {message && <p>{message}</p>}
                    </div>
                </div>
            </main>

            <footer>
                <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between" }}>
                    <button className="options" id="skip" onClick={nextQuiz} disabled={!quiz}>Skip</button>
                    <button className="options" id="submit" onClick={submitAnswer} disabled={!quiz}>Submit</button>
                </div>
            </footer>
        </div>
    )
}