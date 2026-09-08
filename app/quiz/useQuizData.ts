"use client";

import { useEffect, useState } from "react";
import { getQuizzesByType } from "@/app/actions/quiz";
import type { QuizData } from "@/app/test/types";

export function useQuizData(type: "MCQ" | "FITB" | "Order" | "Pair") {
    const [quizzes, setQuizzes] = useState<QuizData[]>([]);

    useEffect(() => {
        getQuizzesByType(type).then((rows) => setQuizzes(rows as QuizData[]));
    }, [type]);

    return quizzes;
}