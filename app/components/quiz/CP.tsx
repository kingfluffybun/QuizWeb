"use client";

import React, { useState, useMemo } from "react";
import type { QuestionProps } from "@/app/quiz/types";

export default function CP({ quiz, value, onChange }: QuestionProps) {
    // Normalize steps from payload
    const steps = useMemo(() => {
        const payload = quiz.quiz_payload || {};
        if (Array.isArray(payload.steps) && payload.steps.length > 0) {
            return payload.steps;
        }
        return [
            {
                prompt: payload.prompt || quiz.question_text || "Write your solution below:",
                template: payload.template || "",
                expected: payload.expected || "",
            },
        ];
    }, [quiz.quiz_payload, quiz.question_text]);

    const [activeStep, setActiveStep] = useState(0);
    const currentStep = steps[activeStep] || steps[0];

    // Local code state
    const [localCode, setLocalCode] = useState<string | null>(null);
    const code = typeof value === "string" ? value : (localCode ?? currentStep?.template ?? "");

    // Update parent onChange whenever code changes
    const handleCodeChange = (newCode: string) => {
        setLocalCode(newCode);
        onChange(newCode);
    };

    // When step changes, load template if code is empty or template is provided
    const handleSelectStep = (idx: number) => {
        setActiveStep(idx);
        const step = steps[idx];
        if (step?.template) {
            handleCodeChange(step.template);
        }
    };

    const lineCount = useMemo(() => {
        const lines = code.split("\n").length;
        return Math.max(lines, 12);
    }, [code]);

    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px", minHeight: "520px" }}>
            {/* Step navigation indicator */}
            {steps.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {steps.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleSelectStep(i)}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "20px",
                                fontSize: "0.85rem",
                                fontWeight: "700",
                                border: "none",
                                cursor: "pointer",
                                backgroundColor:
                                    i === activeStep
                                        ? "var(--selected-color, #7c3aed)"
                                        : i < activeStep
                                        ? "var(--success-color, #22c55e)"
                                        : "var(--border-main, #e2e8f0)",
                                color: i <= activeStep ? "#ffffff" : "var(--text-muted, #64748b)",
                                transition: "all 0.2s ease",
                            }}
                        >
                            {i < activeStep ? `✓ Step ${i + 1}` : `Step ${i + 1}`}
                        </button>
                    ))}
                </div>
            )}

            <div className="code-problem-layout" style={{ minHeight: "480px", borderRadius: "16px", overflow: "hidden", border: "2px solid var(--border-main)" }}>
                {/* 1. Instructions Panel */}
                <div id="instructions" style={{ backgroundColor: "var(--bg-card)", minWidth: "240px" }}>
                    <div className="header">
                        <div className="active">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>
                            <h2>Step {activeStep + 1} of {steps.length}</h2>
                        </div>
                    </div>
                    <div className="instruction-container" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px" }}>
                        <div className="instruction correct" style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                            <div className="check-circle" style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "24px", height: "24px" }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <p style={{ margin: 0, fontWeight: "600", fontSize: "0.95rem", lineHeight: "1.4" }}>
                                {currentStep.prompt}
                            </p>
                        </div>

                        {steps.length > 1 && (
                            <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", gap: "8px" }}>
                                <button
                                    type="button"
                                    disabled={activeStep === 0}
                                    onClick={() => handleSelectStep(activeStep - 1)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "8px",
                                        border: "1px solid var(--border-main)",
                                        backgroundColor: "var(--bg-main)",
                                        cursor: activeStep === 0 ? "not-allowed" : "pointer",
                                        opacity: activeStep === 0 ? 0.5 : 1,
                                        fontSize: "0.85rem",
                                        fontWeight: "600",
                                    }}
                                >
                                    ← Prev Step
                                </button>
                                <button
                                    type="button"
                                    disabled={activeStep === steps.length - 1}
                                    onClick={() => handleSelectStep(activeStep + 1)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "8px",
                                        border: "1px solid var(--border-main)",
                                        backgroundColor: "var(--bg-main)",
                                        cursor: activeStep === steps.length - 1 ? "not-allowed" : "pointer",
                                        opacity: activeStep === steps.length - 1 ? 0.5 : 1,
                                        fontSize: "0.85rem",
                                        fontWeight: "600",
                                    }}
                                >
                                    Next Step →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Code Editor Panel */}
                <div id="tab" style={{ backgroundColor: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
                    <div className="header">
                        <div className="active">
                            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="18" height="18"><path d="M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z"/></svg>
                            <h2>Solution Editor</h2>
                        </div>
                    </div>
                    <div className="code-editor-container row" style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: "380px" }}>
                        <div className="line-number" style={{ userSelect: "none" }}>
                            {Array.from({ length: lineCount }, (_, i) => (
                                <p key={i + 1}>{i + 1}</p>
                            ))}
                        </div>
                        <textarea
                            className="code-editor"
                            spellCheck="false"
                            value={code}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            placeholder="Write your code here..."
                            style={{ flex: 1, resize: "none", outline: "none", border: "none" }}
                        />
                    </div>
                </div>

                {/* 3. Live Preview Panel */}
                <div id="preview" style={{ backgroundColor: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
                    <div className="header">
                        <div className="active">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                            <h2>Live Output</h2>
                        </div>
                    </div>
                    <div className="canvas-container col" style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column" }}>
                        <iframe
                            title="Code Preview"
                            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:8px;margin:0;color:#1e293b;}</style></head><body>${code}</body></html>`}
                            sandbox="allow-scripts"
                            style={{ width: "100%", height: "100%", minHeight: "320px", border: "1px dashed var(--border-main)", borderRadius: "8px", backgroundColor: "#ffffff" }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
