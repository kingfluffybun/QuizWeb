"use client";

import { useEffect, useState } from "react";
import { getQuizzes, getSkipChallengeQuizzes } from "@/app/actions/quiz";
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

export interface QuizFilters {
    cat_id?: number;
    sec_id?: number;
    difficulty_id?: number;
    type_name?: string;
    cat_name?: string;
    sec_num?: number | string;
    difficulty_name?: string;
    mode?: string;
    targetSec?: number | string;
    targetDiff?: string;
}

export function useQuizData(filters?: QuizFilters) {
    const [state, setState] = useState<{ quizzes: QuizData[]; loading: boolean }>({
        quizzes: [],
        loading: true,
    });

    const filterKey = JSON.stringify(filters || {});

    useEffect(() => {
        let isMounted = true;
        const fetchQuizzes = async () => {
            if (filters?.mode === "skip") {
                const targetSec = Number(filters.targetSec || 1);
                const targetDiff = filters.targetDiff || "Easy";
                return getSkipChallengeQuizzes(filters.cat_name || "HTML", targetSec, targetDiff);
            }
            return getQuizzes(filters);
        };

        fetchQuizzes().then((rows) => {
            if (isMounted) {
                setState({
                    quizzes: (rows as QuizData[]).map(shuffleQuizOptions),
                    loading: false,
                });
            }
        });

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    return state;
}