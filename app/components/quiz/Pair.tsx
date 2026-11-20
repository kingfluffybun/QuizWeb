"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionProps } from "@/app/quiz/types";
import { shuffleItems } from "@/app/quiz/shuffle";

export default function PairQuestion({
  quiz,
  value,
  onChange,
  disabled = false,
  shuffleChoices = true,
  onPairMatched,
  onIncorrectPair,
}: QuestionProps & {
  onPairMatched?: () => void;
  onIncorrectPair?: () => void;
}) {
  const pairs = quiz.quiz_payload.pairs ?? [];
  const seedBase = (quiz.quiz_id ?? 1) * 131 + pairs.length;
  const [leftItems] = useState(() => {
    const items = pairs.map((pair) => pair.left);
    return shuffleChoices ? shuffleItems(items, seedBase + 17) : items;
  });
  const [rightItems] = useState(() => {
    const items = pairs.map((pair) => pair.right);
    return shuffleChoices ? shuffleItems(items, seedBase + 53) : items;
  });
  const correctPairs: Record<string, string> = Object.fromEntries(
    pairs.map((p) => [p.left, p.right]),
  );

  const isRestoredComplete =
    disabled && typeof value === "number" && value >= pairs.length && pairs.length > 0;

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedLeft, setMatchedLeft] = useState<string[]>(() =>
    isRestoredComplete ? pairs.map((p) => p.left) : [],
  );
  const [matchedRight, setMatchedRight] = useState<string[]>(() =>
    isRestoredComplete ? pairs.map((p) => p.right) : [],
  );
  const [settledLeft, setSettledLeft] = useState<string[]>(() =>
    isRestoredComplete ? pairs.map((p) => p.left) : [],
  );
  const [settledRight, setSettledRight] = useState<string[]>(() =>
    isRestoredComplete ? pairs.map((p) => p.right) : [],
  );
  const [incorrectPair, setIncorrectPair] = useState<{
    left: string;
    right: string;
  } | null>(null);

  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timerId) => window.clearTimeout(timerId));
      activeTimers.clear();
    };
  }, []);

  const resolvedMatchedLeft = isRestoredComplete ? leftItems : matchedLeft;
  const resolvedMatchedRight = isRestoredComplete ? rightItems : matchedRight;
  const resolvedSettledLeft = isRestoredComplete ? leftItems : settledLeft;
  const resolvedSettledRight = isRestoredComplete ? rightItems : settledRight;

  const scheduleTimeout = (fn: () => void, delayMs: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, delayMs);
    timersRef.current.add(id);
  };

  const completePair = (left: string, right: string) => {
    if (correctPairs[left] === right) {
      const nextLeft = [...matchedLeft, left];
      if (nextLeft.length < pairs.length) {
        onPairMatched?.();
      }
      setMatchedLeft(nextLeft);
      setMatchedRight((current) => [...current, right]);
      onChange(nextLeft.length);
      setSelectedLeft(null);
      setSelectedRight(null);
      scheduleTimeout(() => {
        setSettledLeft((current) => [...current, left]);
        setSettledRight((current) => [...current, right]);
      }, 500);
      return;
    }

    onIncorrectPair?.();
    setIncorrectPair({ left, right });
    scheduleTimeout(() => {
      setSelectedLeft(null);
      setSelectedRight(null);
      setIncorrectPair(null);
    }, 500);
  };

  const handleLeftClick = (item: string) => {
    if (disabled || resolvedMatchedLeft.includes(item) || incorrectPair) return;
    if (selectedRight === null) {
      setSelectedLeft(item);
      return;
    }
    completePair(item, selectedRight);
  };

  const handleRightClick = (item: string) => {
    if (disabled || resolvedMatchedRight.includes(item) || incorrectPair) return;
    if (selectedLeft === null) {
      setSelectedRight(item);
      return;
    }
    completePair(selectedLeft, item);
  };

  const getButtonClassName = (side: "left" | "right", item: string) => {
    const matched = side === "left" ? resolvedMatchedLeft : resolvedMatchedRight;
    const settled = side === "left" ? resolvedSettledLeft : resolvedSettledRight;
    const isMatched = matched.includes(item);
    const isSettled = settled.includes(item);
    const isIncorrect = incorrectPair?.[side] === item;

    if (isMatched) {
      return isSettled ? "pair-option-settled" : "pair-option-matched";
    }
    if (isIncorrect) {
      return "pair-option-incorrect";
    }
    return "";
  };

  return (
    <div className={`options-container row${disabled ? " is-locked" : ""}`} id="pair">
      <div className="pair-left-column col" data-tutorial="pair-left">
        {leftItems.map((item, index) => {
          const inputId = `pair-left-${quiz.quiz_id ?? 0}-${index}`;
          const isItemMatched = resolvedMatchedLeft.includes(item);
          return (
            <label
              key={`${item}-${index}`}
              htmlFor={inputId}
              className={isItemMatched ? "pair-option-disabled" : ""}
              style={{ gridRow: index + 1, gridColumn: 1 }}
            >
              <input
                id={inputId}
                type="radio"
                name="pair-left"
                checked={selectedLeft === item}
                disabled={disabled || isItemMatched}
                onChange={() => handleLeftClick(item)}
              />
              <div className={`options ${getButtonClassName("left", item)}`}>
                <p>{item}</p>
              </div>
            </label>
          );
        })}
      </div>
      <div className="pair-right-column col" data-tutorial="pair-right">
        {rightItems.map((item, index) => {
          const inputId = `pair-right-${quiz.quiz_id ?? 0}-${index}`;
          const isItemMatched = resolvedMatchedRight.includes(item);
          return (
            <label
              key={`${item}-${index}`}
              htmlFor={inputId}
              className={isItemMatched ? "pair-option-disabled" : ""}
              style={{ gridRow: index + 1, gridColumn: 2 }}
            >
              <input
                id={inputId}
                type="radio"
                name="pair-right"
                checked={selectedRight === item}
                disabled={disabled || isItemMatched}
                onChange={() => handleRightClick(item)}
              />
              <div className={`options ${getButtonClassName("right", item)}`}>
                <p>{item}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
