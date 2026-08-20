import React, { useState, useCallback } from "react";
import { QuizPayload, QuizStatus } from "../../types";

interface QuizPairProps {
    payload: QuizPayload;
    currentAnswer: { left: string[]; right: string[] };
    onChange: (ans: { left: string[]; right: string[] }) => void;
    status: QuizStatus;
}

export default function QuizPair({ payload, currentAnswer, onChange, status }: QuizPairProps) {
    const [draggedSide, setDraggedSide] = useState<"left" | "right" | null>(null);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, side: "left" | "right", index: number) => {
        if (status !== "idle") return;
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => { setDraggedSide(side); setDraggedIdx(index); }, 0);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

    const handleDrop = (side: "left" | "right", targetIndex: number) => {
        if (status !== "idle" || draggedSide !== side || draggedIdx === null || draggedIdx === targetIndex) {
            setDragOverIdx(null);
            return;
        }
        const updatedColumn = [...currentAnswer[side]];
        const [movedItem] = updatedColumn.splice(draggedIdx, 1);
        updatedColumn.splice(targetIndex, 0, movedItem);
        onChange({ ...currentAnswer, [side]: updatedColumn });
        setDraggedIdx(null);
        setDraggedSide(null);
        setDragOverIdx(null);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Reorder items in either column to align corresponding pairs:</p>
            <div className="pair-grid">
                {(["left", "right"] as const).map((side) => {
                    const itemsToRender = status === "incorrect" ? payload.pairs?.map(p => p[side]) : currentAnswer?.[side];
                    return (
                        <div key={side} className="pair-col">
                            {itemsToRender?.map((item: string, i: number) => (
                                <div 
                                    key={`pair-${side}-${item}-${i}`} 
                                    className={`options draggable-item ${draggedSide === side && draggedIdx === i ? "is-dragging" : ""} ${draggedSide === side && dragOverIdx === i ? "is-over" : ""} ${status === "incorrect" ? "highlight-correct" : ""}`}
                                    draggable={status === "idle"}
                                    onDragStart={(e) => handleDragStart(e, side, i)}
                                    onDragOver={handleDragOver}
                                    onDragEnter={() => setDragOverIdx(i)}
                                    onDragLeave={() => setDragOverIdx(null)}
                                    onDrop={() => handleDrop(side, i)}
                                    onDragEnd={() => { setDraggedIdx(null); setDraggedSide(null); setDragOverIdx(null); }}
                                    style={{ justifyContent: "center" }}
                                >
                                    <p style={{ textAlign: "center" }}>{item}</p>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}