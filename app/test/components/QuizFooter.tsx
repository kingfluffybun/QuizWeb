import React from "react";
import { QuizStatus } from "../types";

interface QuizFooterProps {
    status: QuizStatus;
    onSkip: () => void;
    onSubmit: () => void;
    onContinue: () => void;
}

export default function QuizFooter({ status, onSkip, onSubmit, onContinue }: QuizFooterProps) {
    return (
        <footer>
            <div className="footer-content">
                <button 
                    className={`options footer-btn ${status !== "idle" ? "disabled" : ""}`} 
                    id="skip" 
                    onClick={status === "idle" ? onSkip : undefined}
                >
                    Skip
                </button>
                {status === "idle" ? (
                    <button className="options footer-btn" id="submit" onClick={onSubmit}>
                        Submit
                    </button>
                ) : (
                    <button 
                        className={`options footer-btn anim-pop ${status === "correct" ? "btn-correct anim-pulse" : "btn-incorrect"}`} 
                        id="submit" 
                        onClick={onContinue}
                    >
                        Continue
                    </button>
                )}
            </div>
        </footer>
    );
}