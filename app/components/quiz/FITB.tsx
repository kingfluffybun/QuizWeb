"use client";

import type { QuestionProps } from "@/app/quiz/types";

export default function FITB ({ value, onChange }: QuestionProps) {
    const answer = typeof value === "string" ? value : "";

    return (
        <div className="options-container row" id="ftb">
        <textarea className="answer-box"
            value={answer}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Type the missing word"
        />
        </div>
    );
}