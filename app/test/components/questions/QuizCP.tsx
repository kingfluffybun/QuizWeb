import React from "react";
import { QuizPayload, QuizStatus } from "../../types";

interface QuizCPProps {
    payload: QuizPayload;
    currentStepIndex: number;
    totalSteps: number;
    stepPrompt: string;
    stepExpected: string;
    currentAnswer: string;
    onChange: (ans: string) => void;
    status: QuizStatus;
    stepMessage?: string | null;
}

export default function QuizCP({
    payload,
    currentStepIndex,
    totalSteps,
    stepPrompt,
    stepExpected,
    currentAnswer,
    onChange,
    status,
    stepMessage,
}: QuizCPProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            {totalSteps > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {Array.from({ length: totalSteps }, (_, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "20px",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                backgroundColor:
                                    i === currentStepIndex
                                        ? "var(--selected-color, #7c3aed)"
                                        : i < currentStepIndex
                                        ? "var(--success-color, #22c55e)"
                                        : "var(--border-main, #e2e8f0)",
                                color: i <= currentStepIndex ? "#ffffff" : "var(--text-muted, #64748b)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {i < currentStepIndex ? `✓ Step ${i + 1}` : `Step ${i + 1}`}
                        </div>
                    ))}
                </div>
            )}

            {stepPrompt && totalSteps > 1 && (
                <div
                    style={{
                        padding: "14px 18px",
                        backgroundColor: "var(--bg-card, #ffffff)",
                        border: "2px solid var(--border-main, #e2e8f0)",
                        borderRadius: "14px",
                        fontWeight: "600",
                        color: "var(--text-main, #0f172a)",
                        fontSize: "1.05rem",
                    }}
                >
                    <span style={{ color: "var(--selected-color, #7c3aed)", fontWeight: "700", marginRight: "8px" }}>
                        Step {currentStepIndex + 1}:
                    </span>
                    {stepPrompt}
                </div>
            )}

            {stepMessage && (
                <div
                    style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        border: "1px solid var(--success-color, #22c55e)",
                        color: "var(--success-color, #166534)",
                        fontSize: "0.95rem",
                        fontWeight: "600",
                    }}
                >
                    {stepMessage}
                </div>
            )}

            <div
                className={`options ${status === "incorrect" ? "highlight-correct" : ""}`}
                style={{ height: "auto", padding: "18px 24px", alignItems: "flex-start", width: "100%" }}
            >
                <textarea
                    className="cp-textarea"
                    value={status === "incorrect" ? stepExpected : (currentAnswer || "")}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={status !== "idle"}
                    placeholder={`Write your code for Step ${currentStepIndex + 1}...`}
                    style={status === "incorrect" ? { color: "var(--success-color)" } : {}}
                />
            </div>
        </div>
    );
}