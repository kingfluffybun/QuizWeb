import React from "react";
import { QuizPayload, QuizStatus } from "../../types";

interface QuizCPProps {
    payload: QuizPayload;
    currentAnswer: string;
    onChange: (ans: string) => void;
    status: QuizStatus;
}

export default function QuizCP({ payload, currentAnswer, onChange, status }: QuizCPProps) {
    return (
        <div 
            className={`options ${status === "incorrect" ? "highlight-correct" : ""}`} 
            style={{ height: "auto", padding: "18px 24px", alignItems: "flex-start" }}
        >
            <textarea
                className="cp-textarea"
                value={status === "incorrect" ? payload.expected : (currentAnswer || "")}
                onChange={(e) => onChange(e.target.value)}
                disabled={status !== "idle"}
                placeholder="Write your code solution..."
                style={status === "incorrect" ? { color: "var(--success-color)" } : {}}
            />
        </div>
    );
}