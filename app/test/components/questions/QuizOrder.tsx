import React, { useState, useRef, useCallback } from "react";
import { QuizPayload, QuizStatus } from "../../types";

interface QuizOrderProps {
    payload: QuizPayload;
    currentAnswer: string[];
    onChange: (ans: string[]) => void;
    status: QuizStatus;
}

export default function QuizOrder({ payload, currentAnswer, onChange, status }: QuizOrderProps) {
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const dragNodeRef = useRef<HTMLElement | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        if (status !== "idle") return;
        dragNodeRef.current = e.currentTarget;
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => setDraggedIdx(index), 0);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDrop = (targetIndex: number) => {
        if (status !== "idle" || draggedIdx === null || draggedIdx === targetIndex || !Array.isArray(currentAnswer)) {
            setDragOverIdx(null);
            return;
        }
        const updated = [...currentAnswer];
        const [movedItem] = updated.splice(draggedIdx, 1);
        updated.splice(targetIndex, 0, movedItem);
        onChange(updated);
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const rawItems = status === "incorrect" ? payload?.items : currentAnswer;
    const displayItems = Array.isArray(rawItems) ? rawItems : (payload?.items ?? []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Drag items to arrange them in sequential order:</p>
            {displayItems.map((item: string, i: number) => (
                <div 
                    key={`order-${item}-${i}`} 
                    className={`options draggable-item ${draggedIdx === i ? "is-dragging" : ""} ${dragOverIdx === i ? "is-over" : ""} ${status === "incorrect" ? "highlight-correct" : ""}`} 
                    draggable={status === "idle"}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={handleDragOver}
                    onDragEnter={() => setDragOverIdx(i)}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                >
                    <div className="options-badge">{i + 1}</div>
                    <p>{item}</p>
                </div>
            ))}
        </div>
    );
}