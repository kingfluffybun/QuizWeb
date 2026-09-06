"use client";

import { useState } from "react";
import "#css/quiz.css";

export default function QuizPage() {
    const leftItems = ["p", "body", "h1", "button"];
    const rightItems = [
        "All paragraphs",
        "All level one headings",
        "The body elements",
        "All buttons",
    ];
    const correctPairs: Record<string, string> = {
        p: "All paragraphs",
        body: "The body elements",
        h1: "All level one headings",
        button: "All buttons",
    };
    const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
    const [selectedRight, setSelectedRight] = useState<string | null>(null);
    const [matchedLeft, setMatchedLeft] = useState<string[]>([]);
    const [matchedRight, setMatchedRight] = useState<string[]>([]);
    const [settledLeft, setSettledLeft] = useState<string[]>([]);
    const [settledRight, setSettledRight] = useState<string[]>([]);
    const [incorrectPair, setIncorrectPair] = useState<{ left: string; right: string } | null>(null);

    const completePair = (left: string, right: string) => {
        if (correctPairs[left] === right) {
            setMatchedLeft((current) => [...current, left]);
            setMatchedRight((current) => [...current, right]);
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
    <div className="quiz-page">
      <nav></nav>
      <div className="sidebar"></div>
      <main>
        <div className="quiz-header">
            <div className="quiz-navigation">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              <div className="heart-container">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#EE5555" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-heart-icon lucide-heart"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" /></svg>
              </div>
            </div>
            <div className="progress-container">
              <div className="active"></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
        </div>
        <div style={{ maxWidth: "1080px", display: "flex", flexDirection: "column", gap: "20px", flex: "1", minHeight: "0" }}>
            <div className="quiz-container">
                <h1>Match each selector with what it targets.</h1>
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
            </div>
        </div>
      </main>
        <footer>
            <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between" }}>
                <button className="options" id="skip"> Skip </button>
                <button className="options" id="submit"> Submit </button>
            </div>
        </footer>
    </div>
  );
}