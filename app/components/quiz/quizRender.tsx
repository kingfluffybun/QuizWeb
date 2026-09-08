"use client";

import type { ComponentType } from "react";
import type { QuestionProps, QuizData } from "@/app/quiz/types";
import MCQ from "./MCQ";
import FITB from "./FITB";
import Order from "./Order";
import Pair from "./Pair";

const questionComponents: Record<string, ComponentType<QuestionProps>> = {
    MCQ: MCQ,
    FITB: FITB,
    Order: Order,
    Pair: Pair,
};

export default function QuizRender(props: QuestionProps & { quiz: QuizData }) {
    const Component = questionComponents[props.quiz.type_name];

    if (!Component) return <p>Unknown quiz type: {props.quiz.type_name}</p>;

    return <Component {...props} />;
}