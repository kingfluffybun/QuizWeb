import React from "react";
import Link from "next/link";

interface GameOverCardProps {
    lives: number;
    score: number;
    totalQuizzes: number;
    completionDestination?: "home" | "input";
}

export default function GameOverCard({
    lives,
    score,
    totalQuizzes,
    completionDestination = "input",
}: GameOverCardProps) {
    const backHref = completionDestination === "home" ? "/home" : "/input";
    const backLabel = completionDestination === "home" ? "Back to Home" : "Back to Quiz Input";

    return (
        <div className="quiz-complete-card anim-enter">
            <h1>{lives === 0 ? "Game Over" : "Quiz Complete!"}</h1>
            <h2>Score: {score} / {totalQuizzes}</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>
                {lives === 0 ? "You ran out of lives. Try again to sharpen your skills!" : "Outstanding performance!"}
            </p>

            <button
                className="options footer-btn anim-pop"
                id="submit"
                style={{ margin: "0 auto" }}
                onClick={() => window.location.reload()}
            >
                Play Again
            </button>
            <Link
                href={backHref}
                className="options footer-btn back-to-input-btn"
            >
                {backLabel}
            </Link>
        </div>
    );
}