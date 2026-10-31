"use client";

import { useEffect, useState } from "react";
import { getQuizzes } from "@/app/actions/quiz";
import type { QuizData } from "@/app/quiz/types";
import { shuffleQuizOptions } from "@/app/quiz/shuffle";

export function useQuizData(enabled = true) {
    const [quizzes, setQuizzes] = useState<QuizData[]>([]);

    useEffect(() => {
        if (!enabled) return;

        getQuizzes().then((rows) => {
            setQuizzes((rows as QuizData[]).map((quiz, index) =>
                shuffleQuizOptions(quiz, index !== 0),
            ));
        });
    }, [enabled]);

    return { quizzes };
}