import React from "react";

interface QuizHeaderProps {
    lives: number;
    totalQuizzes: number;
    currentIndex: number;
}

export default function QuizHeader({ lives, totalQuizzes, currentIndex }: QuizHeaderProps) {
    return (
        <div className="quiz-header">
            <div className="quiz-navigation">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                
                <div className="heart-container">
                    {[...Array(5)].map((_, i) => (
                        <svg 
                            key={i} 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="34" height="34" 
                            viewBox="0 0 24 24" 
                            fill={i < lives ? "#ef4444" : "none"} 
                            stroke={i < lives ? "#ef4444" : "currentColor"} 
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={`heart-icon ${i >= lives ? "heart-lost" : ""}`}
                        >
                            <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>
                        </svg>
                    ))}
                </div>
            </div>
            
            <div className="progress-container">
                {[...Array(totalQuizzes)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`progress-bar-segment ${i <= currentIndex ? "active" : ""}`} 
                    />
                ))}
            </div>
        </div>
    );
}