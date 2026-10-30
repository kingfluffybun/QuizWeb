"use client";

import { useState, type CSSProperties } from "react";
import type { QuestionProps } from "@/app/quiz/types";
import { shuffleItems } from "@/app/quiz/shuffle";

type SwapAnimation = {
    from: number;
    to: number;
    direction: "up" | "down";
    distance: number;
    phase: "start" | "settle";
} | null;

export default function Order ({ quiz, value, onChange, disabled = false }: QuestionProps) {
    const correct = quiz.quiz_payload.items ?? [];
    const [initialItems] = useState(() => shuffleItems(correct));
    const items: string[] = Array.isArray(value) ? value : initialItems;

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [swapAnimation, setSwapAnimation] = useState<SwapAnimation>(null);

    const moveItem = (fromIndex: number, toIndex: number) => {
        if (disabled || fromIndex === toIndex) return;
        if (toIndex < 0 || toIndex >= items.length) return;

        const updatedItems = [...items];
        const [movedItem] = updatedItems.splice(fromIndex, 1);
        updatedItems.splice(toIndex, 0, movedItem);
        const direction = fromIndex < toIndex ? "down" : "up";
        onChange(updatedItems);
        setSwapAnimation({
            from: fromIndex,
            to: toIndex,
            direction,
            distance: Math.abs(toIndex - fromIndex),
            phase: "start",
        });

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                setSwapAnimation((current) => current ? { ...current, phase: "settle" } : null);
            });
        });
        window.setTimeout(() => setSwapAnimation(null), 220);
    };

    const handleDragStart = (index: number) => {
        if (!disabled) setDraggedIdx(index);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (disabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (targetIndex: number) => {
        if (disabled) return;
        const fromIndex = draggedIdx;
        setDraggedIdx(null);
        setDragOverIdx(null);
        if (fromIndex === null || fromIndex === targetIndex) return;
        moveItem(fromIndex, targetIndex);
    };

    // Touch / pen support: HTML5 drag-and-drop never fires on touchscreens, so the
    // grip handle drives a pointer-based drag. Mouse input keeps native DnD.
    const handleGripPointerDown = (event: React.PointerEvent<HTMLSpanElement>, index: number) => {
        if (disabled || event.pointerType === "mouse") return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggedIdx(index);
        setDragOverIdx(index);
    };

    const handleGripPointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
        if (draggedIdx === null || event.pointerType === "mouse") return;
        const target = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest("[data-order-index]");
        if (target) setDragOverIdx(Number(target.getAttribute("data-order-index")));
    };

    const handleGripPointerEnd = (event: React.PointerEvent<HTMLSpanElement>) => {
        if (draggedIdx === null || event.pointerType === "mouse") return;
        const fromIndex = draggedIdx;
        const toIndex = dragOverIdx;
        setDraggedIdx(null);
        setDragOverIdx(null);
        if (event.type === "pointerup" && toIndex !== null) moveItem(fromIndex, toIndex);
    };

    return (
        <div className={`options-container row${disabled ? " is-locked" : ""}`} id="order">
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
                        <div className="order-slot" key={index}>
                            <span className="order-slot-number">{index + 1}.</span>
                            <div
                                data-order-index={index}
                                style={swapStyle}
                                className={`options draggable-item ${draggedIdx === index ? "is-dragging" : ""} ${dragOverIdx === index ? "is-over" : ""} ${swapAnimation?.phase === "start" ? "swap-animation-start" : ""} ${swapAnimation?.phase === "settle" ? "swap-animation-settle" : ""} ${isMoved ? `swap-moved-${swapAnimation.direction}` : ""} ${isShifted ? `swap-shifted-${swapAnimation.direction}` : ""}`}
                                draggable={!disabled}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={handleDragOver}
                                onDragEnter={() => setDragOverIdx(index)}
                                onDragLeave={() => setDragOverIdx(null)}
                                onDrop={() => handleDrop(index)}
                                onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                            >
                                <span
                                    className="order-grip"
                                    onPointerDown={(event) => handleGripPointerDown(event, index)}
                                    onPointerMove={handleGripPointerMove}
                                    onPointerUp={handleGripPointerEnd}
                                    onPointerCancel={handleGripPointerEnd}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                                </span>
                                <p>{item}</p>
                                <span className="order-move-btns">
                                    <button
                                        type="button"
                                        className="order-move-btn"
                                        aria-label={`Move "${item}" up`}
                                        disabled={disabled || index === 0}
                                        onClick={() => moveItem(index, index - 1)}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        className="order-move-btn"
                                        aria-label={`Move "${item}" down`}
                                        disabled={disabled || index === items.length - 1}
                                        onClick={() => moveItem(index, index + 1)}
                                    >
                                        ↓
                                    </button>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}