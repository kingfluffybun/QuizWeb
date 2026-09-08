"use client";

import { useEffect, useState } from "react";
import { getQuizzes } from "@/app/actions/quiz";
import type { QuizData } from "@/app/quiz/types";

export function useQuizData() {
    const [quizzes, setQuizzes] = useState<QuizData[]>([]);

    useEffect(() => {
        getQuizzes().then((rows) => {
            setQuizzes(rows as QuizData[]);
        });
    }, []);

    return { quizzes, };
}