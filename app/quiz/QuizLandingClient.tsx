"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css"
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue, QuizData } from "@/app/quiz/types";
import QuizRender from "@/app/components/quiz/quizRender";
import LessonCard from "@/app/components/LessonCard";
import Sidebar from "@/app/components/Sidebar";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";

type AnswerResult = {
    correct: boolean;
    message: string;
    correctAnswer: string;
};

type SavedQuestionProgress = {
    value: AnswerValue;
    result: AnswerResult;
};

type UnitQuizData = QuizData & {
    unit_title?: string;
    unit_lesson_card?: {
        lesson_slide?: Array<{
            lesson_title?: string;
            lesson_text?: string;
            lesson_code?: string;
        }>;
        lesson_slides?: Array<{
            lesson_title?: string;
            lesson_text?: string;
            lesson_code?: string;
        }>;
        lesson_card?: { lesson_text?: string };
        lesson_text?: string;
    };
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

export default function QuizLandingClient({
    initialQuizzes,
    completionDestination = "input",
}: {
    initialQuizzes?: QuizData[];
    completionDestination?: "home" | "input";
}) {
    const router = useRouter();
    const { quizzes: allQuizzes } = useQuizData();
    const quizzes = initialQuizzes ?? allQuizzes.slice(0, 10);
    const selectedQuizzes = quizzes as UnitQuizData[];
    const [currentIndex, setCurrentIndex] = useState(0);
    const [value, setValue] = useState<AnswerValue>(undefined);
    const [result, setResult] = useState<AnswerResult | null>(null);
    const [lives, setLives] = useState(5);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [hasStartedQuiz, setHasStartedQuiz] = useState(initialQuizzes === undefined);
    const [lessonSlideIndex, setLessonSlideIndex] = useState(0);
    const [questionProgress, setQuestionProgress] = useState<Record<number, SavedQuestionProgress>>({});
    const [accessibilityOpen, setAccessibilityOpen] = useState(false);
    const [accessibilityClosing, setAccessibilityClosing] = useState(false);

    const openAccessibility = () => {
        setAccessibilityClosing(false);
        setAccessibilityOpen(true);
    };

    const closeAccessibility = () => setAccessibilityClosing(true);

    const finishClosingAccessibility = () => {
        setAccessibilityOpen(false);
        setAccessibilityClosing(false);
    };

    const quiz = quizzes[currentIndex];
    const selectedQuiz = selectedQuizzes[currentIndex];
    const isLessonOnlyUnit = Boolean(
        initialQuizzes &&
        initialQuizzes.length === 1 &&
        selectedQuiz?.type_name === "Unit",
    );
    const unitLessonCard = selectedQuiz?.unit_lesson_card ?? {};
    const lessonSlides = Array.isArray(unitLessonCard.lesson_slide)
        ? unitLessonCard.lesson_slide
        : Array.isArray(unitLessonCard.lesson_slides)
            ? unitLessonCard.lesson_slides
        : [{
            lesson_text: unitLessonCard.lesson_card?.lesson_text ?? unitLessonCard.lesson_text ?? "",
            }];
    const hasLesson = lessonSlides.some(
        (slide) => slide.lesson_title || slide.lesson_text || slide.lesson_code,
    );
    const isShowingLesson = hasLesson && !hasStartedQuiz;
    const totalProgressItems = (hasLesson ? lessonSlides.length : 0)
        + (isLessonOnlyUnit ? 0 : quizzes.length);
    const activeProgressIndex = isShowingLesson
        ? lessonSlideIndex
        : (hasLesson ? lessonSlides.length : 0) + currentIndex;

    const resetState = () => {
        setValue(undefined);
        setResult(null);
    };

    const nextQuiz = () => {
        if (lives <= 0 || currentIndex >= quizzes.length - 1) {
            setIsFinished(true);
            return;
        }

        setLessonSlideIndex(0);
        setCurrentIndex((index) => index + 1);
        resetState();
    };

    const previousQuiz = () => {
        if (currentIndex > 0) {
            const previousIndex = currentIndex - 1;
            const savedProgress = questionProgress[previousIndex];
            setCurrentIndex(previousIndex);
            setValue(savedProgress?.value);
            setResult(savedProgress?.result ?? null);
            setLessonSlideIndex(0);
            return;
        }

        if (hasLesson && hasStartedQuiz) {
            setHasStartedQuiz(false);
            setLessonSlideIndex(lessonSlides.length - 1);
            const savedProgress = questionProgress[0];
            setValue(savedProgress?.value);
            setResult(savedProgress?.result ?? null);
        }
    };

    const continueQuiz = () => {
        nextQuiz();
    };

    const submitAnswer = () => {
        if (!quiz || questionProgress[currentIndex]) return;
        const nextResult = evaluate(quiz, value);
        setQuestionProgress((progress) => ({
            ...progress,
            [currentIndex]: { value, result: nextResult },
        }));
        setResult(nextResult);
        if (nextResult.correct) {
            setScore((currentScore) => currentScore + 1);
        } else {
            setLives((currentLives) => Math.max(0, currentLives - 1));
        }
    };

    const handleAnswerChange = (nextValue: AnswerValue) => {
        if (result) return;

        setValue(nextValue);

        const pairCount = quiz?.quiz_payload.pairs?.length ?? 0;
        if (quiz?.type_name === "Pair" && nextValue === pairCount && !questionProgress[currentIndex]) {
            const nextResult = evaluate(quiz, nextValue);
            setQuestionProgress((progress) => ({
                ...progress,
                [currentIndex]: { value: nextValue, result: nextResult },
            }));
            setResult(nextResult);
            if (nextResult.correct) {
                setScore((currentScore) => currentScore + 1);
            } else {
                setLives((currentLives) => Math.max(0, currentLives - 1));
            }
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
    const areChoicesLocked = Boolean(result);

    if (isFinished) {
        const backHref = completionDestination === "home" ? "/home" : "/input";
        const backLabel = completionDestination === "home" ? "Back to Home" : "Back to Quiz Input";

        return (
            <div className="quiz-page">
                <Sidebar />
                <main className="quiz-completion-main">
                    <div className="quiz-complete-card">
                        <h1>{lives === 0 ? "Game Over" : "Quiz Complete!"}</h1>
                        <h2>Score: {score} / {quizzes.length}</h2>
                        <p className="quiz-completion-message">
                            {lives === 0
                                ? "You ran out of lives. Try again to sharpen your skills!"
                                : "Outstanding performance!"}
                        </p>
                        <button
                            className="options"
                            id="submit"
                            type="button"
                            onClick={() => window.location.reload()}
                        >
                            Play Again
                        </button>
                        <Link href={backHref} className="options back-to-input-btn">
                            {backLabel}
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="quiz-page">
            <Sidebar />
            <main>
                <div className="quiz-header">
                    <div className="quiz-navigation">
                        <button type="button" className="quiz-settings-button" data-accessibility-trigger aria-label={accessibilityOpen ? "Close accessibility options" : "Open accessibility options"} onClick={accessibilityOpen ? closeAccessibility : openAccessibility}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></svg>
                        <button
                            type="button"
                            className="quiz-close-button"
                            aria-label="Close quiz"
                            onClick={() => router.push("/home")}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                        {hasLesson && selectedQuiz?.unit_title && (
                        <h1 className="quiz-unit-title">{selectedQuiz.unit_title}</h1>
                        )}
                        <div className="heart-container" data-lives={lives}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                        </div>
                    </div>
                    <div className="progress-container">
                        {Array.from({ length: totalProgressItems }, (_, index) => (
                            <div key={index} className={index <= activeProgressIndex ? "active" : ""} />
                        ))}
                    </div>
                    {accessibilityOpen && (
                        <AccessibilityPanel
                            isClosing={accessibilityClosing}
                            onClose={closeAccessibility}
                            onClosed={finishClosingAccessibility}
                        />
                    )}
                </div>

                <div style={{ maxWidth: "1080px", display: "flex", flexDirection: "column", gap: "20px", flex: "1", minHeight: "0" }}>
                    {hasLesson && !hasStartedQuiz ? (
                        <LessonCard
                            key={selectedQuiz?.quiz_id ?? currentIndex}
                            slides={lessonSlides}
                            className="unit-meta"
                            slideIndex={lessonSlideIndex}
                            onSlideIndexChange={setLessonSlideIndex}
                            showControls={false}
                        />
                    ) : (
                        <div className="quiz-container" key={quiz?.quiz_id} onKeyDown={handleQuestionKeyDown}>
                            <h1>{quiz?.question_text ?? "Loading question..."}</h1>
                            {quiz && (
                                <QuizRender
                                    quiz={quiz}
                                    value={value}
                                    onChange={handleAnswerChange}
                                    disabled={areChoicesLocked}
                                />
                            )}
                        </div>
                    )}
                </div>
            </main>

            <footer className={result ? (result.correct ? "correct" : "incorrect") : ""}>
                <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between" }}>
                    {/* dito sa div yung message */}
                    {hasLesson && !hasStartedQuiz ? (
                        <div className="lesson-footer-controls">
                            <button
                                type="button"
                                className="options"
                                id="skip"
                                onClick={() => setLessonSlideIndex((index) => Math.max(0, index - 1))}
                                disabled={lessonSlideIndex === 0}
                                aria-label="Previous lesson slide"
                            >
                                Previous
                            </button>
                            {lessonSlideIndex === lessonSlides.length - 1 ? (
                                <button
                                    type="button"
                                    className="options"
                                    id="submit"
                                    onClick={() => {
                                        if (isLessonOnlyUnit) {
                                            router.push("/learn");
                                        } else {
                                            setHasStartedQuiz(true);
                                        }
                                    }}
                                >
                                    {isLessonOnlyUnit ? "Finish Lesson" : "Start Quiz"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="options"
                                    id="submit"
                                    onClick={() => setLessonSlideIndex((index) => Math.min(lessonSlides.length - 1, index + 1))}
                                    aria-label="Next lesson slide"
                                >
                                    Next
                                </button>
                            )}
                        </div>
                    ) : <><div className="answer-message row">
                        <div className="answer-message-icon col">
                            <svg xmlns="http://www.w3.org/2000/svg" id="wrong" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" id="correct" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
                        </div>
                        <div id="answer-message-text">
                            <h2>{result?.message}</h2>
                            {!result?.correct && result && <p><b>Correct Answer:</b> {result.correctAnswer}</p>}
                        </div>
                    </div>
                    <button
                        className="options"
                        id="skip"
                        onClick={previousQuiz}
                        disabled={!quiz || (currentIndex === 0 && !hasLesson)}
                    >
                        Previous
                    </button>
                    <button
                        className="options"
                        id="submit"
                        onClick={result ? continueQuiz : submitAnswer}
                        disabled={!quiz || (!result && isAnswerIncomplete)}
                    >
                        {result ? "Continue" : "Submit"}
                    </button></>}
                </div>
            </footer>
        </div>
    )
}