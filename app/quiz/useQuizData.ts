"use client";

import { useEffect, useState } from "react";
import { getQuizzes } from "@/app/actions/quiz";
import type { QuizData } from "@/app/quiz/types";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";

export function useQuizData() {
    const [quizzes, setQuizzes] = useState<QuizData[]>([]);

    useEffect(() => {
        getQuizzes().then((rows) => {
            setQuizzes((rows as QuizData[]).map(shuffleQuizOptions));
        });
    }, []);

    return { quizzes };
}