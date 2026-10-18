"use client";

import type { QuestionProps } from "@/app/quiz/types";

export default function FITB ({ value, onChange, disabled = false }: QuestionProps) {
    const answer = typeof value === "string" ? value : "";

    return (
        <div className={`options-container row${disabled ? " is-locked" : ""}`} id="ftb">
        <textarea className="answer-box"
            value={answer}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Type the missing word"
            spellCheck="false"
        />
        </div>
    );
}