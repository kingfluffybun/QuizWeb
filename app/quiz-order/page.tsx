"use client";

import { useEffect, useState, type CSSProperties } from "react";
import "#css/quiz.css";
import { useQuizData } from "@/app/quiz/useQuizData";

type SwapAnimation = {
  from: number;
  to: number;
  direction: "up" | "down";
  distance: number;
  phase: "start" | "settle";
} | null;

export default function QuizPage() {
  const quizzes = useQuizData("Order");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState([
    "<h2>Topic A Content Description</h2>",
    "<p>Paragraph text details about topic A...</p>",
    "<hr>",
    "<h2>Topic B Brand New Topic Heading</h2>",
    "<h2>Topic B Brand New Topic Heading</h2>",
  ]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [swapAnimation, setSwapAnimation] = useState<SwapAnimation>(null);
  const quiz = quizzes[currentIndex];

  useEffect(() => {
    if (quiz?.quiz_payload.items) setItems([...quiz.quiz_payload.items]);
  }, [quiz]);

  const nextQuiz = () => {
    setCurrentIndex((index) => Math.min(index + 1, quizzes.length - 1));
    setDraggedIdx(null);
    setDragOverIdx(null);
    setSwapAnimation(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

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
    setItems(updatedItems);
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
              {quizzes.map((_, index) => <div key={index} className={index <= currentIndex ? "active" : ""}></div>)}
            </div>
        </div>
        <div style={{ maxWidth: "1080px", display: "flex", flexDirection: "column", gap: "20px", flex: "1", minHeight: "0" }}>
            <div className="quiz-container">
                <h1>{quiz?.question_text ?? "Loading question..."}</h1>
                <div className="options-container row" id="order">
                    <div className="order-number col">
                        <div className="col"><h2>1.</h2></div>
                        <div className="col"><h2>2.</h2></div>
                        <div className="col"><h2>3.</h2></div>
                        <div className="col"><h2>4.</h2></div>    
                        <div className="col"><h2>5.</h2></div>            
                    </div>
                    <div className={`order-options col ${draggedIdx !== null ? "is-dragging" : ""}`}>
                      {items.map((item, index) => (
                        (() => {
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
                        })()
                      ))}
                    </div>
                </div>
            </div>
        </div>
      </main>
        <footer>
            <div style={{ width: "100%", maxWidth: "1080px", display: "flex", justifyContent: "space-between" }}>
                <button className="options" id="skip" onClick={nextQuiz} disabled={!quiz}> Skip </button>
                <button className="options" id="submit"> Submit </button>
            </div>
        </footer>
    </div>
  );
}