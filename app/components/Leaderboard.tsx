"use client";

import { useState } from "react";

type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all-time";

const periodTitles: Record<LeaderboardPeriod, string> = {
    daily: "Daily Leaderboard",
    weekly: "Weekly Leaderboard",
    monthly: "Monthly Leaderboard",
    "all-time": "All-Time Leaderboard",
};

interface LeaderboardProps {
    showPeriodTitle?: boolean;
}

export default function Leaderboard({ showPeriodTitle = false }: LeaderboardProps) {
    const [period, setPeriod] = useState<LeaderboardPeriod>("daily");

    return (
        <div className="leaderboard" id="leaderboard">
            <div className="card">
                <div className="leaderboard-header">
                    <div className={`leaderboard-heading${showPeriodTitle ? "" : " card-title dashboard-leaderboard-title"}`}>
                        {showPeriodTitle && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar preview-icon" aria-hidden="true"> <path d="M8 2v3"/> <path d="M16 2v3"/> <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M3 9h18"/> </svg>
                        )}
                        <h2 className={showPeriodTitle ? "card-title" : undefined}>
                            {showPeriodTitle ? periodTitles[period] : "Leaderboard"}
                        </h2>
                        {!showPeriodTitle && (
                            <a href="/leaderboard"><h2 className="quick-action">View All</h2></a>
                        )}
                    </div>
                    <div className="sort-by-time">
                        <input type="radio" name="leaderboard-time" id="lb-daily" checked={period === "daily"} onChange={() => setPeriod("daily")} />
                        <label htmlFor="lb-daily"><p>Day</p></label>
                        <input type="radio" name="leaderboard-time" id="lb-weekly" checked={period === "weekly"} onChange={() => setPeriod("weekly")} />
                        <label htmlFor="lb-weekly"><p>Week</p></label>
                        <input type="radio" name="leaderboard-time" id="lb-monthly" checked={period === "monthly"} onChange={() => setPeriod("monthly")} />
                        <label htmlFor="lb-monthly"><p>Month</p></label>
                        <input type="radio" name="leaderboard-time" id="lb-alltime" checked={period === "all-time"} onChange={() => setPeriod("all-time")} />
                        <label htmlFor="lb-alltime"><p>All Time</p></label>
                    </div>
                </div>
                <div className="podium-stage">
                    <div className="podium">
                        <div className="podium-place-container">
                            <div className="player-icon">
                                <div className="podium-player-xp"><p>200 XP</p></div>
                            </div>
                            <p id="player-name">Jerald A.</p>
                            <div className="podium-place" id="second-place"><h1>2</h1></div>
                        </div>
                        <div className="podium-place-container">
                            <div className="player-icon">
                                <div className="podium-player-xp"><p>300 XP</p></div>
                            </div>
                            <p id="player-name">Talon G.</p>
                            <div className="podium-place" id="first-place"><h1>1</h1></div>
                        </div>
                        <div className="podium-place-container">
                            <div className="player-icon">
                                <div className="podium-player-xp"><p>150 XP</p></div>
                            </div>
                            <p id="player-name">Caitlyn H.</p>
                            <div className="podium-place" id="third-place"><h1>3</h1></div>
                        </div>
                    </div>
                </div>
                <div className="leaderboard-placement">
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>4</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Clarence Luna</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>5</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Kevenly Luistro</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>6</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Ricky Parica</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>7</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Harvy Bautista</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>8</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Jomari Wamil</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>9</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Christian Panti</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                    <div className="leaderboard-player row" id="nth-place">
                        <div className="player-details row">
                            <p>10</p>
                            <div className="player-icon"></div>
                            <p id="player-name">Rommel</p>
                        </div>
                        <p>100 XP</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
