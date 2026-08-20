import React from "react";
import { QuizPayload, QuizStatus } from "../../types";

interface QuizFITBProps {
    payload: QuizPayload;
    currentAnswer: string;
    onChange: (ans: string) => void;
    status: QuizStatus;
}

export default function QuizFITB({ payload, currentAnswer, onChange, status }: QuizFITBProps) {
    return (
        <div 
            className={`options ${status === "incorrect" ? "highlight-correct" : ""}`} 
            style={{ padding: "0 24px" }}
        >
            <input
                type="text"
                className="fitb-input"
                placeholder="Type your answer here..."
                value={status === "incorrect" ? payload.answer : (currentAnswer || "")}
                onChange={(e) => onChange(e.target.value)}
                disabled={status !== "idle"}
                autoFocus
                style={status === "incorrect" ? { color: "var(--success-color)" } : {}}
            />
        </div>
    );
}