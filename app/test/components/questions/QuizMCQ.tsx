import React from "react";
import { QuizStatus } from "../../types";

interface QuizMCQProps {
    options: { id: number; text: string }[];
    correctId: number;
    currentAnswer: number | null;
    onChange: (ans: number) => void;
    status: QuizStatus;
}

export default function QuizMCQ({ options, correctId, currentAnswer, onChange, status }: QuizMCQProps) {
    return (
        <>
            {options.map((opt, i) => {
                const isActualCorrect = status === "incorrect" && opt.id === correctId;
                return (
                    <label key={opt.id}>
                        <input 
                            type="radio" 
                            name="quiz_option" 
                            checked={currentAnswer === opt.id} 
                            onChange={() => onChange(opt.id)}
                            disabled={status !== "idle"}
                        />
                        <div className={`options ${isActualCorrect ? "highlight-correct" : ""}`}>
                            <div className="options-badge">{i + 1}</div>
                            <p>{opt.text}</p>
                        </div>
                    </label>
                );
            })}
        </>
    );
}