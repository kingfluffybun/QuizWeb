"use client";

import type { QuestionProps } from "@/app/quiz/types";

export default function MCQ ({ quiz, value, onChange, disabled = false }: QuestionProps) {
    const options = quiz.quiz_payload.options ?? [];
    const selected = typeof value === "number" ? value : null;

    return (
        <div
            className={`options-container${disabled ? " is-locked" : ""}`}
            id="multiple-choice"
        >
            {options.map((option, index) => (
                <label
                    key={option}
                    className={[
                        selected === index ? "selected" : "",
                        disabled && selected === index && index === quiz.quiz_payload.correct_index
                            ? "answer-correct"
                            : "",
                        disabled && selected === index && index !== quiz.quiz_payload.correct_index
                            ? "answer-incorrect"
                            : "",
                    ].filter(Boolean).join(" ")}
                >
                <input
                    type="radio"
                    name={`option-${quiz.quiz_id}`}
                    checked={selected === index}
                    disabled={disabled}
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