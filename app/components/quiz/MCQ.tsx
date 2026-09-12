"use client";

import type { QuestionProps } from "@/app/quiz/types";

export default function MCQ ({ quiz, value, onChange }: QuestionProps) {
    const options = quiz.quiz_payload.options ?? [];
    const selected = typeof value === "number" ? value : null;

    return (
        <div className="options-container" id="multiple-choice">
            {options.map((option, index) => (
                <label key={`${option}-${index}`}>
                <input
                    type="radio"
                    name={`option-${quiz.quiz_id}`}
                    checked={selected === index}
                    onChange={() => onChange(index)}
                />
                <div className="options">
                    <div>{index + 1}</div>
                    <p>{option}</p>
                </div>
                </label>
            ))}
        </div>
    );
}