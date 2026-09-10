"use client";

import { useEffect, useState } from "react";
import { getQuizzes } from "@/app/actions/quiz";
import type { QuizData } from "@/app/quiz/types";

function shuffleQuizOptions(quiz: QuizData): QuizData {
    const options = quiz.quiz_payload.options;

    if (quiz.type_name !== "MCQ" || !options || options.length < 2) {
        return quiz;
    }

    const shuffled = [...options];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return {
        ...quiz,
        quiz_payload: {
            ...quiz.quiz_payload,
            options: shuffled,
        },
    };
}

export function useQuizData() {
    const [quizzes, setQuizzes] = useState<QuizData[]>([]);

    useEffect(() => {
        getQuizzes().then((rows) => {
            setQuizzes((rows as QuizData[]).map(shuffleQuizOptions));
        });
    }, []);

    return { quizzes, };
}