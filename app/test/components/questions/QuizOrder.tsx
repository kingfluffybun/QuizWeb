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

    const moveItem = (fromIndex: number, toIndex: number) => {
        if (status !== "idle" || fromIndex === toIndex || !Array.isArray(currentAnswer)) return;
        if (toIndex < 0 || toIndex >= currentAnswer.length) return;
        const updated = [...currentAnswer];
        const [movedItem] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, movedItem);
        onChange(updated);
    };

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
        const fromIndex = draggedIdx;
        setDraggedIdx(null);
        setDragOverIdx(null);
        if (status !== "idle" || fromIndex === null) return;
        moveItem(fromIndex, targetIndex);
    };

    // Touch / pen support: native HTML5 DnD never fires on touchscreens, so the
    // badge handle drives a pointer-based drag. Mouse input keeps native DnD.
    const handleGripPointerDown = (e: React.PointerEvent<HTMLElement>, index: number) => {
        if (status !== "idle" || e.pointerType === "mouse") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraggedIdx(index);
        setDragOverIdx(index);
    };

    const handleGripPointerMove = (e: React.PointerEvent<HTMLElement>) => {
        if (draggedIdx === null || e.pointerType === "mouse") return;
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-order-index]");
        if (target) setDragOverIdx(Number(target.getAttribute("data-order-index")));
    };

    const handleGripPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
        if (draggedIdx === null || e.pointerType === "mouse") return;
        const fromIndex = draggedIdx;
        const toIndex = dragOverIdx;
        setDraggedIdx(null);
        setDragOverIdx(null);
        if (e.type === "pointerup" && toIndex !== null) moveItem(fromIndex, toIndex);
    };

    const rawItems = status === "incorrect" ? payload?.items : currentAnswer;
    const displayItems = Array.isArray(rawItems) ? rawItems : (payload?.items ?? []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Drag items (or use the arrows) to arrange them in sequential order:</p>
            {displayItems.map((item: string, i: number) => (
                <div 
                    key={`order-${item}-${i}`} 
                    data-order-index={i}
                    className={`options draggable-item ${draggedIdx === i ? "is-dragging" : ""} ${dragOverIdx === i ? "is-over" : ""} ${status === "incorrect" ? "highlight-correct" : ""}`} 
                    draggable={status === "idle"}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={handleDragOver}
                    onDragEnter={() => setDragOverIdx(i)}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                >
                    <span
                        className="options-badge order-grip"
                        onPointerDown={(e) => handleGripPointerDown(e, i)}
                        onPointerMove={handleGripPointerMove}
                        onPointerUp={handleGripPointerEnd}
                        onPointerCancel={handleGripPointerEnd}
                    >
                        {i + 1}
                    </span>
                    <p>{item}</p>
                    <span className="order-move-btns">
                        <button
                            type="button"
                            className="order-move-btn"
                            aria-label={`Move "${item}" up`}
                            disabled={status !== "idle" || i === 0}
                            onClick={() => moveItem(i, i - 1)}
                        >
                            ↑
                        </button>
                        <button
                            type="button"
                            className="order-move-btn"
                            aria-label={`Move "${item}" down`}
                            disabled={status !== "idle" || i === displayItems.length - 1}
                            onClick={() => moveItem(i, i + 1)}
                        >
                            ↓
                        </button>
                    </span>
                </div>
            ))}
        </div>
    );
}
