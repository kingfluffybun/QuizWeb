"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import type { QuestionProps } from "@/app/quiz/types";
import { shuffleItems } from "@/app/quiz/shuffle";

type SwapAnimation = {
  from: number;
  to: number;
  direction: "up" | "down";
  distance: number;
  phase: "start" | "settle";
} | null;

export default function Order({
  quiz,
  value,
  onChange,
  disabled = false,
  shuffleChoices = true,
}: QuestionProps) {
  const correct = quiz.quiz_payload.items ?? [];
  const [initialItems] = useState(() =>
    shuffleChoices
      ? shuffleItems(correct, (quiz.quiz_id ?? 1) * 97 + correct.length)
      : correct,
  );
  const items: string[] = Array.isArray(value) ? value : initialItems;

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [swapAnimation, setSwapAnimation] = useState<SwapAnimation>(null);

  const swapTimerRef = useRef<number | null>(null);
  const swapRafsRef = useRef<[number | null, number | null]>([null, null]);

  const clearSwapTimers = () => {
    if (swapTimerRef.current !== null) {
      window.clearTimeout(swapTimerRef.current);
      swapTimerRef.current = null;
    }
    if (swapRafsRef.current[0] !== null) {
      window.cancelAnimationFrame(swapRafsRef.current[0]);
      swapRafsRef.current[0] = null;
    }
    if (swapRafsRef.current[1] !== null) {
      window.cancelAnimationFrame(swapRafsRef.current[1]);
      swapRafsRef.current[1] = null;
    }
  };

  useEffect(() => {
    return () => clearSwapTimers();
  }, []);

  // Ensure initial sequence is committed so an unmoved Order question evaluates cleanly
  const syncInitialValue = useEffectEvent(() => {
    if (!disabled && !Array.isArray(value) && initialItems.length > 0) {
      onChange(initialItems);
    }
  });

  useEffect(() => {
    syncInitialValue();
  }, [quiz.quiz_id]);

  const itemOccurrences = new Map<string, number>();
  const keyedItems = items.map((item) => {
    const occurrence = itemOccurrences.get(item) ?? 0;
    itemOccurrences.set(item, occurrence + 1);
    return { item, key: `${item}-${occurrence}` };
  });

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (disabled || fromIndex === toIndex) return;
    if (toIndex < 0 || toIndex >= items.length) return;

    const updatedItems = [...items];
    const [movedItem] = updatedItems.splice(fromIndex, 1);
    updatedItems.splice(toIndex, 0, movedItem);
    const direction = fromIndex < toIndex ? "down" : "up";

    clearSwapTimers();
    onChange(updatedItems);
    setSwapAnimation({
      from: fromIndex,
      to: toIndex,
      direction,
      distance: Math.abs(toIndex - fromIndex),
      phase: "start",
    });

    swapRafsRef.current[0] = window.requestAnimationFrame(() => {
      swapRafsRef.current[1] = window.requestAnimationFrame(() => {
        setSwapAnimation((current) =>
          current ? { ...current, phase: "settle" } : null,
        );
      });
    });
    swapTimerRef.current = window.setTimeout(() => setSwapAnimation(null), 220);
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

  const handleGripPointerDown = (
    event: React.PointerEvent<HTMLSpanElement>,
    index: number,
  ) => {
    if (disabled || event.pointerType === "mouse") return;
    event.preventDefault();
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
    if (event.type === "pointerup" && toIndex !== null) {
      moveItem(fromIndex, toIndex);
    }
  };

  return (
    <div className={`options-container row${disabled ? " is-locked" : ""}`} id="order">
      <div className={`order-options col ${draggedIdx !== null ? "is-dragging" : ""}`}>
        {keyedItems.map(({ item, key }, index) => {
          const isMoved = swapAnimation?.to === index;
          const isShifted =
            swapAnimation &&
            (swapAnimation.direction === "down"
              ? index >= swapAnimation.from && index < swapAnimation.to
              : index > swapAnimation.to && index <= swapAnimation.from);
          const swapStyle = isMoved
            ? ({ "--swap-distance": swapAnimation.distance } as CSSProperties)
            : undefined;

          return (
            <div className="order-slot" key={key}>
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
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
              >
                <span
                  className="order-grip"
                  onPointerDown={(event) => handleGripPointerDown(event, index)}
                  onPointerMove={handleGripPointerMove}
                  onPointerUp={handleGripPointerEnd}
                  onPointerCancel={handleGripPointerEnd}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-grip-vertical"
                    onDragStart={(event) => event.preventDefault()}
                  >
                    <circle cx="9" cy="12" r="1" />
                    <circle cx="9" cy="5" r="1" />
                    <circle cx="9" cy="19" r="1" />
                    <circle cx="15" cy="12" r="1" />
                    <circle cx="15" cy="5" r="1" />
                    <circle cx="15" cy="19" r="1" />
                  </svg>
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
