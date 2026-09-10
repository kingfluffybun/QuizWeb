"use client";

import { useState } from "react";
import type { QuestionProps } from "@/app/quiz/types";

function shuffleItems(items: string[]) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
}

export default function PairQuestion({ quiz, onChange }: QuestionProps) {
    const pairs = quiz.quiz_payload.pairs ?? [];
    const [leftItems] = useState(() => shuffleItems(pairs.map((p) => p.left)));
    const [rightItems] = useState(() => shuffleItems(pairs.map((p) => p.right)));
    const correctPairs: Record<string, string> = Object.fromEntries(
        pairs.map((p) => [p.left, p.right])
    );

    const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
    const [selectedRight, setSelectedRight] = useState<string | null>(null);
    const [matchedLeft, setMatchedLeft] = useState<string[]>([]);
    const [matchedRight, setMatchedRight] = useState<string[]>([]);
    const [settledLeft, setSettledLeft] = useState<string[]>([]);
    const [settledRight, setSettledRight] = useState<string[]>([]);
    const [incorrectPair, setIncorrectPair] = useState<{ left: string; right: string } | null>(null);

    const reportProgress = (matched: string[]) => onChange(matched.length);

    const completePair = (left: string, right: string) => {
        if (correctPairs[left] === right) {
            const nextLeft = [...matchedLeft, left];
            setMatchedLeft(nextLeft);
            setMatchedRight((current) => [...current, right]);
            reportProgress(nextLeft);
            setSelectedLeft(null);
            setSelectedRight(null);
            setTimeout(() => {
                setSettledLeft((current) => [...current, left]);
                setSettledRight((current) => [...current, right]);
            }, 500);
            return;
        }
        setIncorrectPair({ left, right });
        setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
        setIncorrectPair(null);
        }, 500);
    };

    const handleLeftClick = (item: string) => {
        if (matchedLeft.includes(item) || incorrectPair) return;

        if (selectedRight === null) {
            setSelectedLeft(item);
            return;
        }

        completePair(item, selectedRight);
    };

    const handleRightClick = (item: string) => {
        if (matchedRight.includes(item) || incorrectPair) return;

        if (selectedLeft === null) {
            setSelectedRight(item);
            return;
        }

        completePair(selectedLeft, item);
    };

    const getButtonStyle = (side: "left" | "right", item: string) => {
        const isMatched = side === "left" ? matchedLeft.includes(item) : matchedRight.includes(item);
        const isSettled = side === "left" ? settledLeft.includes(item) : settledRight.includes(item);
        const isIncorrect = incorrectPair?.[side] === item;

        if (isMatched) {
            if (isSettled) {
                return {
                    color: "#e0e0e0",
                    cursor: "default",
                };
            }
            return {
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                borderColor: "#22c55e",
                color: "#16a34a",
                cursor: "default",
            };
        }
        if (isIncorrect) {
            return {
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderColor: "#ef4444",
                color: "#dc2626",
            };
        }
        return undefined;
    };

    return (
        <div className="options-container row" id="pair">
            <div className="pair-left-column col">
                {leftItems.map((item) => (
                    <label
                        key={item}
                        htmlFor={`pair-left-${item}`}
                        className={matchedLeft.includes(item) ? "pair-option-disabled" : ""}
                    >
                        <input
                            id={`pair-left-${item}`}
                            type="radio"
                            name="pair-left"
                            checked={selectedLeft === item}
                            disabled={matchedLeft.includes(item)}
                            onChange={() => handleLeftClick(item)}
                        />
                        <div className="options" style={getButtonStyle("left", item)}>
                            <p>{item}</p>
                        </div>
                    </label>
                ))}
            </div>
            <div className="pair-right-column col">
                {rightItems.map((item) => (
                    <label
                        key={item}
                        htmlFor={`pair-right-${item}`}
                        className={matchedRight.includes(item) ? "pair-option-disabled" : ""}
                    >
                        <input
                            id={`pair-right-${item}`}
                            type="radio"
                            name="pair-right"
                            checked={selectedRight === item}
                            disabled={matchedRight.includes(item)}
                            onChange={() => handleRightClick(item)}
                        />
                        <div className="options" style={getButtonStyle("right", item)}>
                            <p>{item}</p>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    )
}