"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useEffectEvent, useRef, useMemo } from "react";
import type { AnimationEvent, ReactNode } from "react";
import "#css/quiz.css";
import "#css/nav.css";
import "#css/sidebar.css"
import { useQuizData } from "@/app/quiz/useQuizData";
import type { AnswerValue, QuizData } from "@/app/quiz/types";
import QuizRender from "@/app/components/quiz/quizRender";
import LessonCard, {
    LessonCodeFrame,
} from "@/app/components/LessonCard";
import Sidebar from "@/app/components/Sidebar";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";
import { useQuizSounds } from "@/app/quiz/useQuizSounds";
import {
    recordQuizCompletion,
    updatePlayerQuizStreak,
} from "@/app/actions/streak";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import { recordLessonSlideProgress } from "@/app/actions/progress";
import { unwrapCodeProblemAssessment } from "@/lib/cp-schema";
import { calculateEarnedXp, calculateQuizXp } from "@/lib/xp-calculation";
import { getClientLocalDate } from "@/lib/timezone";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";
import {
    getCachedUnit,
    markUnitCompletedLocally,
    preloadLearnSections,
    toQuizLandingQuizzes,
    updateUnitSlideProgressLocally,
} from "@/lib/learn-cache";
import type { DailyGoalData } from "@/lib/daily-goal";

type AnswerResult = {
    correct: boolean;
    message: string;
    correctAnswer: string;
    skipped?: boolean;
};

type SavedQuestionProgress = {
    value: AnswerValue;
    result: AnswerResult;
};

type UnitQuizData = QuizData & {
    unit_id?: number;
    unit_title?: string;
    unit_assessment?: unknown;
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

function renderInlineCode(text: string): ReactNode[] {
    return text.split(/(`[^`]+`)/g).map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={index}>{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

type QuizQuestionPart = { type: "text" | "code"; content: string };

function getQuizCodeLanguage(categoryId?: number, categoryName?: string): string {
    if (categoryId === 1) return "html";
    if (categoryId === 2) return "css";
    if (categoryId === 3) return "javascript";

    const normalizedCategory = categoryName?.trim().toLowerCase();
    return normalizedCategory === "js" || normalizedCategory?.includes("javascript")
        ? "javascript"
        : "html";
}

function parseQuizQuestion(text: string): QuizQuestionPart[] {
    const parts: { type: "text" | "code"; content: string }[] = [];
    const codeBlockPattern = /```[^\n`]*\r?\n([\s\S]*?)```/g;
    let lastIndex = 0;

    for (const match of text.matchAll(codeBlockPattern)) {
        const matchIndex = match.index ?? 0;
        if (matchIndex > lastIndex) {
            parts.push({ type: "text", content: text.slice(lastIndex, matchIndex) });
        }
        parts.push({ type: "code", content: match[1].replace(/\r?\n$/, "") });
        lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

function QuizQuestionPrompt({ parts }: { parts: QuizQuestionPart[] }) {
    const hasCode = parts.some((part) => part.type === "code");
    const textParts = parts.filter((part) => part.type === "text" && part.content.trim());

    if (!hasCode) {
        return <h1>{renderInlineCode(parts.map((part) => part.content).join(""))}</h1>;
    }

    return (
        <div className="quiz-question-prompt">
            {textParts.map((part, index) => (
                <p className="quiz-question-copy" key={index}>
                    {renderInlineCode(part.content)}
                </p>
            ))}
        </div>
    );
}

function QuizQuestionCodeBlocks({
    parts,
    codeLanguage,
}: {
    parts: QuizQuestionPart[];
    codeLanguage: string;
}) {
    return (
        <>
            {parts.filter((part) => part.type === "code").map((part, index) => (
                <LessonCodeFrame
                    className="quiz-question-code"
                    title={`Question code snippet ${index + 1}`}
                    source={part.content}
                    language={codeLanguage}
                    editorOnly
                    toggleable={false}
                    key={index}
                />
            ))}
        </>
    );
}

const correctMessages = ["That's correct!", "Excellent job!", "Well done!"];
const incorrectMessages = ["Hard luck!", "That’s incorrect.", "Not quite right."];

const accuracyMessages = {
    perfect: [
        "Perfect score! You answered every single question correctly, so keep that momentum going.",
        "Flawless run! You didn’t miss a single question, and that’s exactly how mastery is built.",
    ],
    good: [
        "Nice work! You’re getting the hang of this, and a little more practice will get you to a perfect score.",
        "Almost there! You got most of them right, so review the ones you missed and try for 100%.",
    ],
    low: [
        "Keep practicing! Every mistake is a chance to learn, so review your answers and give it another try.",
        "Don’t give up! You’re still building your skills, and each attempt gets you closer to mastering this lesson.",
    ],
};

function LessonSlideTransition({
    slideIndex,
    slideCount,
    slideHasCode,
    renderSlide,
}: {
    slideIndex: number;
    slideCount: number;
    slideHasCode: (index: number) => boolean;
    renderSlide: (index: number) => ReactNode;
}) {
    const [activeSlideIndex, setActiveSlideIndex] = useState(slideIndex);
    const incomingSlideIndex = activeSlideIndex === slideIndex ? null : slideIndex;
    const isMovingBackward = incomingSlideIndex !== null && incomingSlideIndex < activeSlideIndex;

    const finishTransition = (index: number, event: AnimationEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        if (incomingSlideIndex === index) {
            setActiveSlideIndex(index);
        }
    };

    return (
        <div className="lesson-slide-transition">
            {Array.from({ length: slideCount }, (_, index) => {
                const isEntering = incomingSlideIndex === index;
                const isExiting = incomingSlideIndex !== null && activeSlideIndex === index;
                const isExitingToText = isExiting
                    && incomingSlideIndex !== null
                    && !slideHasCode(incomingSlideIndex);
                const isHidden = !isEntering && !isExiting && index !== activeSlideIndex;

                return (
                    <div
                        key={`slide-${index}`}
                        className={`lesson-slide-layer${isEntering ? " is-entering" : ""}${isExiting ? " is-exiting" : ""}${isExitingToText ? " is-exiting-to-text" : ""}${isMovingBackward && (isEntering || isExiting) ? " is-backward" : ""}${isHidden ? " is-hidden" : ""}`}
                        aria-hidden={isHidden || isExiting}
                        onAnimationEnd={isEntering ? (event) => finishTransition(index, event) : undefined}
                    >
                        {renderSlide(index)}
                    </div>
                );
            })}
        </div>
    );
}

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

function getCorrectValue(quiz: QuizData): AnswerValue {
    switch (quiz.type_name) {
        case "MCQ":
            return quiz.quiz_payload.correct_index;
        case "FITB":
            return quiz.quiz_payload.answer ?? "";
        case "Order":
            return quiz.quiz_payload.items ?? [];
        case "Pair":
            return quiz.quiz_payload.pairs?.length ?? 0;
        default:
            return undefined;
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
    unitId,
    initialSlideOrder,
    startAtQuiz = false,
    nextUnit,
    dailyGoalData,
}: {
    initialQuizzes?: QuizData[];
    completionDestination?: "home" | "input";
    unitId?: number;
    initialSlideOrder?: number;
    startAtQuiz?: boolean;
    dailyGoalData?: DailyGoalData | null;
    nextUnit?: {
        unit_id: number;
        unit_title: string;
        sec_id?: number;
        sec_num?: number;
        cat_name?: string;
    } | null;
}) {
    const router = useRouter();
    const playQuizSound = useQuizSounds();
    const { quizzes: allQuizzes } = useQuizData();
    const cachedUnit = unitId != null ? getCachedUnit(unitId) : null;
    const cachedQuizzes = cachedUnit
        ? toQuizLandingQuizzes(cachedUnit).map(shuffleQuizOptions)
        : undefined;
    const quizzes =
        initialQuizzes && initialQuizzes.length > 0
            ? initialQuizzes
            : cachedQuizzes ?? allQuizzes;
    const resolvedNextUnit = nextUnit !== undefined ? nextUnit : cachedUnit?.nextUnit ?? null;
    const selectedQuizzes = quizzes as UnitQuizData[];
    const [questionOrder, setQuestionOrder] = useState<number[] | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [value, setValue] = useState<AnswerValue>(undefined);
    const [result, setResult] = useState<AnswerResult | null>(null);
    const [lives, setLives] = useState(5);
    const [score, setScore] = useState(0);
    const [baseXp, setBaseXp] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);
    const [dailyGoalStats, setDailyGoalStats] = useState(dailyGoalData);
    const [isFinished, setIsFinished] = useState(false);
    const [hasStartedQuiz, setHasStartedQuiz] = useState(
        initialQuizzes === undefined || startAtQuiz,
    );
    const [prevInitialSlideOrder, setPrevInitialSlideOrder] = useState(initialSlideOrder);
    const [lessonSlideIndex, setLessonSlideIndex] = useState(() =>
        typeof initialSlideOrder === "number" && initialSlideOrder > 0
            ? initialSlideOrder - 1
            : 0,
    );
    const [questionProgress, setQuestionProgress] = useState<Record<number, SavedQuestionProgress>>({});
    const [missedQuestionIndexes, setMissedQuestionIndexes] = useState<Set<number>>(
        () => new Set(),
    );
    const [accessibilityOpen, setAccessibilityOpen] = useState(false);
    const [accessibilityClosing, setAccessibilityClosing] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [lessonProgressState, setLessonProgressState] = useState<
        "idle" | "saving" | "saved" | "failed"
    >("idle");
    const [lessonProgressError, setLessonProgressError] = useState<string | null>(null);
    const [completionRetryCount, setCompletionRetryCount] = useState(0);
    const completionRecorded = useRef(false);
    const firstTryCorrectCount = quizzes.filter(
        (_, index) => !missedQuestionIndexes.has(index) && questionProgress[index]?.result?.correct,
    ).length;
    const allQuestionsCorrect = quizzes.length > 0 && firstTryCorrectCount === quizzes.length;
    const totalQuizXp = calculateQuizXp(baseXp, allQuestionsCorrect, currentStreak);
    const accuracy = quizzes.length > 0 ? Math.round((firstTryCorrectCount / quizzes.length) * 100) : 0;
    const completionSubmessage = useMemo(() => {
        if (!isFinished) return "";
        const options = accuracy === 100
            ? accuracyMessages.perfect
            : accuracy >= 70
                ? accuracyMessages.good
                : accuracyMessages.low;
        const messageIndex = (accuracy + elapsedSeconds) % options.length;
        return options[messageIndex];
    }, [isFinished, accuracy, elapsedSeconds]);

    const [animatedStats, setAnimatedStats] = useState({
        xp: 0,
        accuracy: 0,
        seconds: 0,
    });

    useEffect(() => {
        if (!isFinished) return;

        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const rafId = requestAnimationFrame(() => {
                setAnimatedStats({
                    xp: totalQuizXp,
                    accuracy,
                    seconds: elapsedSeconds,
                });
            });
            return () => cancelAnimationFrame(rafId);
        }

        const duration = 1000;
        const delay = 150;
        const startTime = performance.now();
        let animationFrameId: number;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            if (elapsed < delay) {
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            const progress = Math.min(1, (elapsed - delay) / duration);
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setAnimatedStats({
                xp: Math.round(totalQuizXp * easeOut),
                accuracy: Math.round(accuracy * easeOut),
                seconds: Math.round(elapsedSeconds * easeOut),
            });

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [isFinished, totalQuizXp, accuracy, elapsedSeconds]);

    const orderedQuestionIndexes = questionOrder
        ?? Array.from({ length: quizzes.length }, (_, index) => index);
    const activeQuizIndex = orderedQuestionIndexes[currentIndex] ?? currentIndex;
    const quiz = quizzes[activeQuizIndex];
    const selectedQuiz = selectedQuizzes[activeQuizIndex];
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

    if (initialSlideOrder !== prevInitialSlideOrder) {
        setPrevInitialSlideOrder(initialSlideOrder);
        if (typeof initialSlideOrder === "number" && initialSlideOrder > 0 && lessonSlides.length > 0) {
            setLessonSlideIndex(Math.min(lessonSlides.length - 1, Math.max(0, initialSlideOrder - 1)));
        }
    } else if (lessonSlides.length > 0 && lessonSlideIndex >= lessonSlides.length) {
        setLessonSlideIndex(lessonSlides.length - 1);
    } else if (lessonSlideIndex < 0) {
        setLessonSlideIndex(0);
    }

    const hasLesson = lessonSlides.some(
        (slide) => slide.lesson_title || slide.lesson_text || slide.lesson_code,
    );
    const isShowingLesson = hasLesson && !hasStartedQuiz;
    const totalProgressItems = (hasLesson ? lessonSlides.length : 0)
        + (isLessonOnlyUnit ? 0 : quizzes.length);
    const correctQuestionCount = Object.values(questionProgress).filter(
        (entry) => entry?.result?.correct,
    ).length;
    const activeProgressIndex = isShowingLesson
        ? lessonSlideIndex
        : (hasLesson ? lessonSlides.length : 0) + correctQuestionCount;
    const progressValue = isShowingLesson
        ? Math.min(activeProgressIndex + 1, totalProgressItems)
        : Math.min(activeProgressIndex, totalProgressItems);

    const resolvedUnitId = unitId ?? selectedQuiz?.unit_id ?? (quizzes[0] as UnitQuizData)?.unit_id;

    useEffect(() => {
        if (!hasStartedQuiz) return;
        updatePlayerQuizStreak(0, 0).then((response) => {
            if (!response.success) {
                console.error("Failed to reset player quiz streak:", response.error);
            }
        }).catch((error) => {
            console.error("Failed to reset player quiz streak:", error);
        });
    }, [hasStartedQuiz]);

    useEffect(() => {
        if (!isFinished) return;

        const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);
        if (!isPassed) return;

        if (completionRecorded.current) return;
        if (!resolvedUnitId) return;
        completionRecorded.current = true;

        recordLessonSlideProgress(
            resolvedUnitId,
            Math.max(1, lessonSlides.length),
            Math.max(1, lessonSlides.length),
            true,
        ).then((response) => {
            if (response.success && response.isCompleted) {
                markUnitCompletedLocally(resolvedUnitId);
                setLessonProgressState("saved");
                // If advancing into a new section, preload that section + its successor
                if (
                    resolvedNextUnit?.sec_id &&
                    selectedQuiz?.sec_id &&
                    resolvedNextUnit.sec_id !== selectedQuiz.sec_id
                ) {
                    preloadLearnSections(resolvedNextUnit.sec_id, true).catch(() => {});
                }
                return;
            }
            completionRecorded.current = false;
            setLessonProgressState("failed");
            setLessonProgressError(
                response.success
                    ? "The server did not confirm lesson completion. Please retry."
                    : response.error ?? "Lesson progress could not be saved.",
            );
        }).catch((err) => {
            completionRecorded.current = false;
            setLessonProgressState("failed");
            setLessonProgressError("Lesson progress could not be saved. Please retry.");
            console.error("Failed to record lesson completion progress:", err);
        });
        recordQuizCompletion({
            xpEarned: totalQuizXp,
            currentStreak,
            bestStreak,
            date: getClientLocalDate(),
        }).then((response) => {
            if (!response.success) {
                console.error("Failed to record quiz completion:", response.error);
                return;
            }
            void getDailyGoalData().then(setDailyGoalStats).catch((error) => {
                console.error("Failed to refresh daily XP progress after quiz completion:", error);
            });
        }).catch((error) => {
            console.error("Failed to record quiz completion:", error);
        });
    }, [isFinished, lives, score, quizzes.length, totalQuizXp, bestStreak, currentStreak, resolvedUnitId, lessonSlides.length, completionRetryCount, resolvedNextUnit, selectedQuiz]);


    useEffect(() => {
        if (!resolvedUnitId || !hasLesson || isFinished) return;
        const currentOrder = lessonSlideIndex + 1;
        const total = Math.max(1, lessonSlides.length);
        updateUnitSlideProgressLocally(resolvedUnitId, currentOrder);
        recordLessonSlideProgress(resolvedUnitId, currentOrder, total, false).then((response) => {
            if (!response.success) {
                console.error("Failed to record slide progress:", response.error);
            }
        }).catch((err) => {
            console.error("Failed to record slide progress:", err);
        });
    }, [resolvedUnitId, hasLesson, lessonSlideIndex, lessonSlides.length, isFinished]);

    useEffect(() => {
        if (!hasStartedQuiz || isFinished) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }
        timerRef.current = setInterval(() => {
            setElapsedSeconds((s) => s + 1);
        }, 1000);
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [hasStartedQuiz, isFinished]);

    const persistStreak = (nextCurrentStreak: number, nextBestStreak: number) => {
        updatePlayerQuizStreak(nextCurrentStreak, nextBestStreak).then((response) => {
            if (!response.success) {
                console.error("Failed to save player quiz streak:", response.error);
            }
        }).catch((error) => {
            console.error("Failed to save player quiz streak:", error);
        });
    };

    const finishLessonOnlyUnit = async () => {
        if (!resolvedUnitId || lessonProgressState === "saving") return;

        setLessonProgressState("saving");
        setLessonProgressError(null);
        try {
            const response = await recordLessonSlideProgress(
                resolvedUnitId,
                Math.max(1, lessonSlides.length),
                Math.max(1, lessonSlides.length),
                true,
            );
            if (!response.success || !response.isCompleted) {
                setLessonProgressState("failed");
                setLessonProgressError(
                    response.success
                        ? "The server did not confirm lesson completion. Please retry."
                        : response.error ?? "Lesson progress could not be saved.",
                );
                return;
            }

            setLessonProgressState("saved");
            playQuizSound("lesson-complete");
            router.push(completionDestination === "home" ? "/home" : "/learn");
        } catch (error) {
            console.error("Failed to record lesson completion progress:", error);
            setLessonProgressState("failed");
            setLessonProgressError("Lesson progress could not be saved. Please retry.");
        }
    };

    const questionParts = parseQuizQuestion(quiz?.question_text ?? "Loading question...");
    const questionHasCode = questionParts.some((part) => part.type === "code");
    const isLessonProgressSaved = !resolvedUnitId || lessonProgressState === "saved";
    const isLessonProgressPending =
        Boolean(resolvedUnitId) &&
        lessonProgressState === "idle" &&
        isFinished &&
        lives > 0 &&
        (quizzes.length === 0 || score >= quizzes.length);

    const handleIncorrectPair = () => {
        playQuizSound("wrong-answer");
        setLives(Math.max(0, lives - 1));
        if (lives <= 1) setIsFinished(true);
        setMissedQuestionIndexes((missed) => new Set(missed).add(activeQuizIndex));
        setCurrentStreak(0);
        persistStreak(0, bestStreak);
    };

    const openAccessibility = () => {
        setAccessibilityClosing(false);
        setAccessibilityOpen(true);
    };

    const closeAccessibility = () => setAccessibilityClosing(true);

    const finishClosingAccessibility = () => {
        setAccessibilityOpen(false);
        setAccessibilityClosing(false);
    };

    const findNextUnansweredQuestion = (
        order: number[],
        progress: Record<number, SavedQuestionProgress>,
        startIndex: number,
    ) => {
        for (let offset = 0; offset < order.length; offset += 1) {
            const index = (startIndex + offset) % order.length;
            if (!progress[order[index]]?.result.correct) return index;
        }
        return -1;
    };

    const nextQuiz = () => {
        if (lives <= 0) {
            setIsFinished(true);
            return;
        }

        const currentQuizIndex = orderedQuestionIndexes[currentIndex];
        let nextOrder = orderedQuestionIndexes;
        let searchStartIndex = currentIndex + 1;
        let savedProgress = questionProgress;

        if (result && !result.correct && currentQuizIndex !== undefined) {
            nextOrder = [
                ...orderedQuestionIndexes.filter((index) => index !== currentQuizIndex),
                currentQuizIndex,
            ];
            searchStartIndex = currentIndex % nextOrder.length;
            savedProgress = { ...questionProgress };
            delete savedProgress[currentQuizIndex];
            setQuestionOrder(nextOrder);
            setQuestionProgress(savedProgress);
        }

        const nextIndex = findNextUnansweredQuestion(
            nextOrder,
            savedProgress,
            searchStartIndex,
        );
        if (nextIndex === -1) {
            setIsFinished(true);
            return;
        }

        const nextQuizIndex = nextOrder[nextIndex];
        const nextProgress = savedProgress[nextQuizIndex];
        setCurrentIndex(nextIndex);
        setValue(nextProgress?.value);
        setResult(nextProgress?.result ?? null);
    };

    const handleBack = () => {
        if (isShowingLesson) {
            setLessonSlideIndex((index) => Math.max(0, index - 1));
            return;
        }

        if (currentIndex === 0) return;

        const previousIndex = currentIndex - 1;
        const previousQuizIndex = orderedQuestionIndexes[previousIndex];
        const savedProgress = questionProgress[previousQuizIndex];
        setCurrentIndex(previousIndex);
        setValue(savedProgress?.value);
        setResult(savedProgress?.result ?? null);
    };

    const continueQuiz = () => {
        if (
            hasLesson &&
            lives > 0 &&
            score === quizzes.length
        ) {
            playQuizSound("lesson-complete");
        }
        nextQuiz();
    };

    const skipQuestion = () => {
        if (!quiz || result) return;

        const skippedValue = getCorrectValue(quiz);
        const skippedResult: AnswerResult = {
            correct: false,
            skipped: true,
            message: "Skipped question",
            correctAnswer: getAnswer(quiz),
        };
        setValue(skippedValue);
        setQuestionProgress((progress) => ({
            ...progress,
            [activeQuizIndex]: { value: skippedValue, result: skippedResult },
        }));
        setMissedQuestionIndexes((missed) => new Set(missed).add(activeQuizIndex));
        setResult(skippedResult);
        setCurrentStreak(0);
        persistStreak(0, bestStreak);
        playQuizSound("skipped-answer");
    };

    const applyAnswer = (
        nextResult: AnswerResult,
        answerValue: AnswerValue,
        skipped = false,
    ) => {
        if (!quiz) return;
        const previousProgress = questionProgress[activeQuizIndex];
        setQuestionProgress((progress) => ({
            ...progress,
            [activeQuizIndex]: { value: answerValue, result: nextResult },
        }));
        setResult(nextResult);
        if (nextResult.correct) {
            if (!skipped) {
                if (quiz.type_name === "MCQ" || quiz.type_name === "FITB") {
                    playQuizSound("correct-answer1");
                } else if (quiz.type_name === "Order") {
                    playQuizSound("correct-answer3");
                } else if (quiz.type_name === "Pair") {
                    playQuizSound("correct-answer2");
                }
            }
            if (!previousProgress?.result.correct) {
                setScore((currentScore) => currentScore + 1);
                if (!missedQuestionIndexes.has(activeQuizIndex)) {
                    setBaseXp((earnedXp) =>
                        earnedXp + calculateEarnedXp(true, quiz.difficulty_id),
                    );
                }
            }
            const nextStreak = currentStreak + 1;
            const nextBestStreak = Math.max(bestStreak, nextStreak);
            setCurrentStreak(nextStreak);
            setBestStreak(nextBestStreak);
            persistStreak(nextStreak, nextBestStreak);
        } else {
            setMissedQuestionIndexes((missed) => new Set(missed).add(activeQuizIndex));
            if (!skipped) {
                playQuizSound("wrong-answer");
                const nextLives = Math.max(0, lives - 1);
                setLives(nextLives);
                if (nextLives === 0) setIsFinished(true);
            }
            setCurrentStreak(0);
            persistStreak(0, bestStreak);
        }
    };

    const submitAnswer = () => {
        if (!quiz || result) return;
        const nextResult = evaluate(quiz, value);
        applyAnswer(nextResult, value);
    };

    const handleAnswerChange = (nextValue: AnswerValue) => {
        if (result) return;

        setValue(nextValue);

        const pairCount = quiz?.quiz_payload.pairs?.length ?? 0;
        if (
            quiz?.type_name === "Pair"
            && nextValue === pairCount
            && !questionProgress[activeQuizIndex]?.result.correct
        ) {
            const nextResult = evaluate(quiz, nextValue);
            applyAnswer(nextResult, nextValue);
        }
    };

    const handleEnter = useEffectEvent(() => {
        if (result) {
            continueQuiz();
        } else {
            submitAnswer();
        }
    });

    useEffect(() => {
        const handleMcqKeyDown = (event: KeyboardEvent) => {
            if (
                event.key === "Enter" &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            ) {
                const target = event.target;
                if (
                    target instanceof HTMLElement &&
                    (target.isContentEditable ||
                        target.closest("button, a, select, input:not([type='radio'])"))
                ) {
                    return;
                }

                event.preventDefault();
                handleEnter();
                return;
            }

            if (
                quiz?.type_name !== "MCQ" ||
                result ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                !/^[1-5]$/.test(event.key) ||
                Number(event.key) > (quiz.quiz_payload.options?.length ?? 0)
            ) {
                return;
            }

            const target = event.target;
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    target.closest("textarea, select, input:not([type='radio'])"))
            ) {
                return;
            }

            event.preventDefault();
            setValue(Number(event.key) - 1);
        };

        window.addEventListener("keydown", handleMcqKeyDown);
        return () => window.removeEventListener("keydown", handleMcqKeyDown);
    }, [quiz, result]);

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
        const isPassed = lives > 0 && (quizzes.length === 0 || score >= quizzes.length);
        const backHref = completionDestination === "home" ? "/home" : "/input";
        const backLabel = completionDestination === "home" ? "Back to Home" : "Back to Quiz Input";
        const hasCodingAssessment = Boolean(
            unwrapCodeProblemAssessment(selectedQuizzes[0]?.unit_assessment),
        );
        const codingAssessmentHref = unitId
            ? `/quiz-cp/${unitId}`
            : "/quiz-cp";

        return (
            <div className="quiz-page quiz-no-footer-page">
                <Sidebar />
                <main className="quiz-completion-main">
                    <div className="completion-content">
                        <div className="quiz-complete-message">
                            {isPassed ? (
                                <div className="complete-check">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" > <path d="M20 6 9 17l-5-5" /> </svg>
                                </div>
                            ) : (
                                <div className="complete-check" style={{ backgroundColor: "#EF4444", borderBottomColor: "#DC2626" }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" > <path d="M18 6 6 18" /> <path d="m6 6 12 12" /> </svg>
                                </div>
                            )}
                            <h1>{isPassed ? "Quiz Complete!" : "Game Over"}</h1>
                            <div className="quiz-complete-submessage">
                                <p>{completionSubmessage}</p>
                            </div>
                        </div>
                        <div className="quiz-summary-stats">
                            {/* <p className="completion-header">Quiz Summary</p> */}
                            <div className="stats-card">
                                <div id="xp">
                                    <div>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-zap preview-icon"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/></svg>
                                        <h2>{animatedStats.xp}</h2>
                                    </div>
                                    <p>XP Gained</p>
                                </div>
                                <div id="accuracy">
                                    <div>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M11 12C11 12.2652 11.1054 12.5196 11.2929 12.7071C11.4804 12.8946 11.7348 13 12 13C12.2652 13 12.5196 12.8946 12.7071 12.7071C12.8946 12.5196 13 12.2652 13 12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M12 7C11.0111 7 10.0444 7.29324 9.22215 7.84265C8.39991 8.39206 7.75904 9.17295 7.3806 10.0866C7.00217 11.0002 6.90315 12.0055 7.09608 12.9755C7.289 13.9454 7.76521 14.8363 8.46447 15.5355C9.16373 16.2348 10.0546 16.711 11.0246 16.9039C11.9945 17.0969 12.9998 16.9978 13.9134 16.6194C14.827 16.241 15.6079 15.6001 16.1574 14.7779C16.7068 13.9556 17 12.9889 17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M13 3.05514C11.1461 2.84715 9.2733 3.22042 7.64079 4.12331C6.00827 5.0262 4.69667 6.41409 3.88743 8.095C3.07818 9.77591 2.81128 11.6667 3.12365 13.506C3.43601 15.3452 4.31221 17.0419 5.63103 18.3614C6.94985 19.6809 8.64611 20.5579 10.4852 20.8712C12.3242 21.1845 14.2152 20.9186 15.8965 20.1102C17.5779 19.3018 18.9664 17.9909 19.8701 16.3588C20.7738 14.7267 21.148 12.8542 20.941 11.0001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M15 6V9H18L21 6H18V3L15 6Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M15 9L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> </svg>
                                        <h2>{animatedStats.accuracy}%</h2>
                                    </div>
                                    <p>Accuracy</p>
                                </div>
                                <div id="time">
                                    <div>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-timer preview-icon"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>
                                        <h2>{`${Math.floor(animatedStats.seconds / 60)}:${String(animatedStats.seconds % 60).padStart(2, "0")}`}</h2>
                                    </div>
                                    <p>Time Spent</p>
                                </div>
                            </div>
                            {dailyGoalStats && (
                                <div className="daily-goal-stats">
                                    <div className="daily-goal-progress-bar">
                                        <span
                                            className="daily-goal-progress-bar-fill"
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    (dailyGoalStats.todayXp / dailyGoalStats.dailyGoal) * 100,
                                                )}%`,
                                            }}
                                        ></span>
                                    </div>
                                    <div className="daily-goal-progress-bar-label">
                                        <p>Daily Goal</p>
                                        <p>{dailyGoalStats.todayXp}/{dailyGoalStats.dailyGoal} XP</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        {isPassed && (hasCodingAssessment || nextUnit) && (
                            <div className="next-level-container">
                                {/* <p className="completion-header">Next Lesson</p> */}
                                <Link
                                    href={hasCodingAssessment ? codingAssessmentHref : (resolvedNextUnit ? `/quiz/${resolvedNextUnit.unit_id}` : `/quiz?unitId=${nextUnit?.unit_id}&source=quiz`)}
                                    className="next-level-card"
                                    aria-disabled={!isLessonProgressSaved}
                                    onClick={(event) => {
                                        if (!isLessonProgressSaved) event.preventDefault();
                                    }}
                                    style={{ textDecoration: "none" }}
                                >
                                    <div className="next-level-content">
                                        <div className="next-level-type">
                                            {hasCodingAssessment ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-code preview-icon"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open preview-icon"><path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/></svg>
                                            )}
                                        </div>
                                        <div className="next-level-title">
                                            <p>{hasCodingAssessment ? "Code Problem" : nextUnit?.sec_num != null ? `Section ${nextUnit.sec_num}` : nextUnit?.cat_name ?? "Next"}</p>
                                            <h2>{hasCodingAssessment ? (selectedQuiz?.unit_title ?? "Code Assessment") : nextUnit?.unit_title}</h2>
                                        </div>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right preview-icon"><path d="m9 18 6-6-6-6"/></svg>
                                </Link>
                            </div>
                        )}
                        {isPassed && resolvedUnitId && (
                            lessonProgressState === "saving" || isLessonProgressPending
                        ) && (
                            <p role="status">Saving lesson progress...</p>
                        )}
                        {isPassed && resolvedUnitId && lessonProgressState === "failed" && (
                            <div role="alert">
                                <p>{lessonProgressError}</p>
                                <button
                                    className="options"
                                    type="button"
                                    onClick={() => {
                                        setLessonProgressState("saving");
                                        setLessonProgressError(null);
                                        setCompletionRetryCount((count) => count + 1);
                                    }}
                                >
                                    Retry saving progress
                                </button>
                            </div>
                        )}
                        <div className="completion-action">
                            {isPassed ? (
                                <button
                                    className="options"
                                    id="submit"
                                    type="button"
                                    onClick={() => router.push("/learn")}
                                    disabled={!isLessonProgressSaved}
                                >
                                    <p>Continue</p>
                                </button>
                            ) : (
                                <button
                                    className="options"
                                    id="submit"
                                    type="button"
                                    onClick={() => window.location.reload()}
                                >
                                    <p>Try Again</p>
                                </button>
                            )}
                            <button
                                className="options"
                                id="back"
                                type="button"
                                onClick={() => router.push(backHref)}
                            >
                                <p>{backLabel}</p>
                            </button>
                        </div>
                    </div>
                    {/* <div className="quiz-complete-card">
                        <h1>{!isPassed ? "Game Over" : "Quiz Complete!"}</h1>
                        <h2>Score: {score} / {quizzes.length}</h2>
                        <p className="quiz-completion-message">
                            {!isPassed
                                ? "You ran out of lives. Try again to sharpen your skills!"
                                : hasCodingAssessment
                                  ? "Outstanding performance! Ready to tackle the Unit Coding Assessment?"
                                  : "Outstanding performance!"}
                        </p>
                        {isPassed && resolvedUnitId && (
                            lessonProgressState === "saving" || isLessonProgressPending
                        ) && (
                            <p role="status">Saving lesson progress...</p>
                        )}
                        {isPassed && resolvedUnitId && lessonProgressState === "failed" && (
                            <div role="alert">
                                <p>{lessonProgressError}</p>
                                <button
                                    className="options"
                                    type="button"
                                    onClick={() => {
                                        setLessonProgressState("saving");
                                        setLessonProgressError(null);
                                        setCompletionRetryCount((count) => count + 1);
                                    }}
                                >
                                    Retry saving progress
                                </button>
                            </div>
                        )}
                        {isPassed && resolvedUnitId && lessonProgressState === "saved" && (
                            <p role="status">Lesson progress saved.</p>
                        )}
                        {isPassed && hasCodingAssessment && (
                            <Link
                                href={codingAssessmentHref}
                                className="options"
                                id="submit"
                                aria-disabled={!isLessonProgressSaved}
                                onClick={(event) => {
                                    if (!isLessonProgressSaved) event.preventDefault();
                                }}
                                style={{ textDecoration: "none" }}
                            >
                                Code Problem
                            </Link>
                        )}
                        {isPassed && resolvedNextUnit && (
                            <Link
                                prefetch={true}
                                href={`/quiz/${resolvedNextUnit.unit_id}`}
                                className="options"
                                id={hasCodingAssessment ? undefined : "submit"}
                                aria-disabled={!isLessonProgressSaved}
                                onClick={(event) => {
                                    if (!isLessonProgressSaved) event.preventDefault();
                                }}
                                style={{
                                    textDecoration: "none",
                                    ...(hasCodingAssessment
                                        ? {
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              margin: "14px auto 0",
                                              minHeight: "54px",
                                              width: "240px",
                                              borderRadius: "16px",
                                              fontSize: "1.1rem",
                                          }
                                        : {}),
                                }}
                            >
                                Next Unit: {resolvedNextUnit.unit_title}
                            </Link>
                        )}
                        <button
                            className="options"
                            id={isPassed ? undefined : "submit"}
                            type="button"
                            onClick={() => window.location.reload()}
                            disabled={isPassed && !isLessonProgressSaved}
                            style={
                                isPassed
                                    ? {
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          margin: "14px auto 0",
                                          minHeight: "54px",
                                          width: "240px",
                                          borderRadius: "16px",
                                          fontSize: "1.1rem",
                                      }
                                    : undefined
                            }
                        >
                            {!isPassed ? "Try Again" : "Play Again"}
                        </button>
                        <Link href={backHref} className="options back-to-input-btn">
                            {backLabel}
                        </Link>
                    </div> */}
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
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
                    <div className="quiz-progress-row">
                        <button
                            type="button"
                            className="quiz-progress-back"
                            onClick={handleBack}
                            disabled={isShowingLesson ? lessonSlideIndex === 0 : currentIndex === 0}
                            aria-label={isShowingLesson
                                ? "Back to previous lesson slide"
                                : "Back to previous question"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left preview-icon"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <div
                            className="progress-container quiz-progress-bar"
                            role="progressbar"
                            aria-label="Quiz progress"
                            aria-valuemin={0}
                            aria-valuemax={Math.max(totalProgressItems, 1)}
                            aria-valuenow={progressValue}
                            aria-valuetext={
                                totalProgressItems > 0
                                    ? `Item ${progressValue} of ${totalProgressItems}`
                                    : "No progress items"
                            }
                        >
                            <span
                                className="quiz-progress-bar-fill"
                                style={{
                                    width: `${totalProgressItems > 0
                                        ? Math.min(100, (progressValue / totalProgressItems) * 100)
                                        : 0}%`,
                                }}
                            />
                        </div>
                    </div>
                    {accessibilityOpen && (
                        <AccessibilityPanel
                            isClosing={accessibilityClosing}
                            onClose={closeAccessibility}
                            onClosed={finishClosingAccessibility}
                        />
                    )}
                </div>

                <div className="quiz-content-region" style={{ maxWidth: "1080px", display: "flex", flexDirection: "column", gap: "20px", flex: "1", minHeight: "0" }}>
                    {hasLesson && !hasStartedQuiz ? (
                        <LessonSlideTransition
                            slideIndex={lessonSlideIndex}
                            slideCount={lessonSlides.length}
                            slideHasCode={(index) => Boolean(lessonSlides[index]?.lesson_code)}
                            renderSlide={(slideIndex) => (
                                <LessonCard
                                    key={`${selectedQuiz?.quiz_id ?? currentIndex}-${slideIndex}`}
                                    slides={lessonSlides}
                                    className="unit-meta"
                                    slideIndex={slideIndex}
                                    onSlideIndexChange={setLessonSlideIndex}
                                    showControls={false}
                                />
                            )}
                        />
                    ) : (
                        <div
                            className={`quiz-container${questionHasCode ? " has-code-block" : ""}`}
                            key={`${quiz?.quiz_id ?? "quiz"}-${currentIndex}`}
                        >
                            <QuizQuestionPrompt parts={questionParts} />
                            {questionHasCode ? (
                                <div className="quiz-question-layout">
                                    <div className="quiz-question-code-column">
                                        <QuizQuestionCodeBlocks
                                            parts={questionParts}
                                            codeLanguage={getQuizCodeLanguage(quiz?.cat_id, quiz?.cat_name)}
                                        />
                                    </div>
                                    <div className="quiz-question-answer-column">
                                        {quiz && (
                                            <QuizRender
                                                quiz={quiz}
                                                value={value}
                                                onChange={handleAnswerChange}
                                                disabled={areChoicesLocked}
                                                onPairMatched={() => playQuizSound("correct-answer1")}
                                                onIncorrectPair={handleIncorrectPair}
                                            />
                                        )}
                                    </div>
                                </div>
                            ) : quiz && (
                                <QuizRender
                                    quiz={quiz}
                                    value={value}
                                    onChange={handleAnswerChange}
                                    disabled={areChoicesLocked}
                                    onPairMatched={() => playQuizSound("correct-answer1")}
                                    onIncorrectPair={handleIncorrectPair}
                                />
                            )}
                        </div>
                    )}
                </div>
            </main>

            <footer className={!isShowingLesson && result ? (result.correct ? "correct" : "incorrect") : ""}>
                <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between" }}>
                    {lessonProgressError && !isFinished && (
                        <p role="alert">{lessonProgressError}</p>
                    )}
                    {/* dito sa div yung message */}
                    {hasLesson && !hasStartedQuiz ? (
                        <div className="lesson-footer-controls">
                            <button
                                type="button"
                                className="options"
                                id="skip"
                                onClick={() =>
                                    setLessonSlideIndex((index) => Math.max(0, index - 1))
                                }
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
                                    onClick={() => isLessonOnlyUnit
                                        ? void finishLessonOnlyUnit()
                                        : setHasStartedQuiz(true)}
                                    disabled={isLessonOnlyUnit && lessonProgressState === "saving"}
                                >
                                    {isLessonOnlyUnit && lessonProgressState === "saving"
                                        ? "Saving..."
                                        : isLessonOnlyUnit
                                          ? "Finish Lesson"
                                          : "Start Quiz"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="options"
                                    id="submit"
                                    onClick={() =>
                                        setLessonSlideIndex((index) =>
                                            Math.min(lessonSlides.length - 1, index + 1),
                                        )
                                    }
                                    aria-label="Next lesson slide"
                                >
                                    Next
                                </button>
                            )}
                        </div>
                    ) : <><div className="answer-message row">
                        <div
                            key={result ? `${currentIndex}-${result.correct}` : "answer-pending"}
                            className="answer-message-icon col"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" id="wrong" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" id="correct" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>
                        </div>
                        <div id="answer-message-text">
                            <h2>{result?.message}</h2>
                            {(!result?.correct || result.skipped) && result && <p><b>Correct Answer:</b> {result.correctAnswer}</p>}
                        </div>
                    </div>
                    <button className="options" id="skip" onClick={skipQuestion} disabled={!quiz || Boolean(result)} > Skip </button>
                    <button className="options" id="submit" onClick={result ? continueQuiz : submitAnswer} disabled={!quiz || (!result && isAnswerIncomplete)} > {result ? "Continue" : "Submit"} </button></>}
                </div>
            </footer>
        </div>
    )
}