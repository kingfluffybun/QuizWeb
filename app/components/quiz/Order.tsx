"use client";

import { useState, type CSSProperties } from "react";
import type { QuestionProps } from "@/app/quiz/types";

type SwapAnimation = {
    from: number;
    to: number;
    direction: "up" | "down";
    distance: number;
    phase: "start" | "settle";
} | null;

export default function Order ({ quiz, value, onChange }: QuestionProps) {
    const correct = quiz.quiz_payload.items ?? [];
    const items: string[] = Array.isArray(value) ? value : correct;

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [swapAnimation, setSwapAnimation] = useState<SwapAnimation>(null);

    const handleDragStart = (index: number) => setDraggedIdx(index);

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (targetIndex: number) => {
        if (draggedIdx === null || draggedIdx === targetIndex) {
            setDraggedIdx(null);
            setDragOverIdx(null);
            return;
        }

        const updatedItems = [...items];
        const [movedItem] = updatedItems.splice(draggedIdx, 1);
        updatedItems.splice(targetIndex, 0, movedItem);
        const direction = draggedIdx < targetIndex ? "down" : "up";
        onChange(updatedItems);
        setSwapAnimation({
            from: draggedIdx,
            to: targetIndex,
            direction,
            distance: Math.abs(targetIndex - draggedIdx),
            phase: "start",
        });
        setDraggedIdx(null);
        setDragOverIdx(null);

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                setSwapAnimation((current) => current ? { ...current, phase: "settle" } : null);
            });
        });
        window.setTimeout(() => setSwapAnimation(null), 220);
    };

    return (
        <div className="options-container row" id="order">
            <div className="order-number col">
                {items.map((_, i) => (
                    <div className="col" key={i}><h2>{i + 1}.</h2></div>
                ))}
            </div>
            <div className={`order-options col ${draggedIdx !== null ? "is-dragging" : ""}`}>
                {items.map((item, index) => {
                    const isMoved = swapAnimation?.to === index;
                    const isShifted = swapAnimation && (
                        swapAnimation.direction === "down"
                        ? index >= swapAnimation.from && index < swapAnimation.to
                        : index > swapAnimation.to && index <= swapAnimation.from
                    );
                    const swapStyle = isMoved
                        ? ({ "--swap-distance": swapAnimation.distance } as CSSProperties)
                        : undefined;

                    return (
                        <div
                            key={`order-${item}-${index}`}
                            style={swapStyle}
                            className={`options draggable-item ${draggedIdx === index ? "is-dragging" : ""} ${dragOverIdx === index ? "is-over" : ""} ${swapAnimation?.phase === "start" ? "swap-animation-start" : ""} ${swapAnimation?.phase === "settle" ? "swap-animation-settle" : ""} ${isMoved ? `swap-moved-${swapAnimation.direction}` : ""} ${isShifted ? `swap-shifted-${swapAnimation.direction}` : ""}`}
                            draggable="true"
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={handleDragOver}
                            onDragEnter={() => setDragOverIdx(index)}
                            onDragLeave={() => setDragOverIdx(null)}
                            onDrop={() => handleDrop(index)}
                            onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                            <p>{item}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}