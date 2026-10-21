"use client";

import { Fragment, useRef, useState } from "react";
import { getLeaderboardEntries, type LeaderboardEntry, type LeaderboardPeriod } from "@/app/actions/leaderboard";

interface LeaderboardProps {
    initialEntries: LeaderboardEntry[];
    showPeriodTitle?: boolean;
}

const periodTitles: Record<LeaderboardPeriod, string> = {
    daily: "Daily Leaderboard",
    weekly: "Weekly Leaderboard",
    monthly: "Monthly Leaderboard",
    "all-time": "All-Time Leaderboard",
};

const periodOptions: { period: LeaderboardPeriod; title: string }[] = [
    { period: "daily", title: "Day" },
    { period: "weekly", title: "Week" },
    { period: "monthly", title: "Month" },
    { period: "all-time", title: "All Time" },
];

export default function Leaderboard({ initialEntries, showPeriodTitle = false }: LeaderboardProps) {
    const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
    const [entries, setEntries] = useState(initialEntries);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const requestId = useRef(0);

    const changePeriod = async (nextPeriod: LeaderboardPeriod) => {
        setPeriod(nextPeriod);
        setIsLoading(true);
        setError("");
        const currentRequestId = ++requestId.current;

        try {
            const nextEntries = await getLeaderboardEntries(nextPeriod);
            if (currentRequestId === requestId.current) {
                setEntries(nextEntries);
            }
        } catch (err) {
            console.error("Failed to load leaderboard:", err);
            if (currentRequestId === requestId.current) {
                setError("Unable to load the leaderboard. Please try again.");
            }
        } finally {
            if (currentRequestId === requestId.current) {
                setIsLoading(false);
            }
        }
    };

    const podium = [
        { entry: entries[1], place: 2, placeId: "second-place" },
        { entry: entries[0], place: 1, placeId: "first-place" },
        { entry: entries[2], place: 3, placeId: "third-place" },
    ].filter(({ entry }) => entry !== undefined);

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
                        {periodOptions.map(({ period: optionPeriod, title }) => {
                            const id = `lb-${optionPeriod}`;
                            return (
                                <Fragment key={optionPeriod}>
                                    <input
                                        type="radio"
                                        name="leaderboard-time"
                                        id={id}
                                        checked={period === optionPeriod}
                                        onChange={() => void changePeriod(optionPeriod)}
                                    />
                                    <label htmlFor={id}><p>{title}</p></label>
                                </Fragment>
                            );
                        })}
                    </div>
                </div>
                {error && <p role="alert">{error}</p>}
                {isLoading && <p aria-live="polite">Loading leaderboard...</p>}
                {entries.length === 0 ? (
                    <p>No XP earned for this period yet.</p>
                ) : (
                    <>
                        <div className="podium-stage">
                            <div className="podium">
                                {podium.map(({ entry, place, placeId }) => (
                                    <div className="podium-place-container" key={entry.userId}>
                                        <div className="player-icon">
                                            <div className="podium-player-xp"><p>{entry.xp.toLocaleString()} XP</p></div>
                                        </div>
                                        <p id="player-name">{entry.username}</p>
                                        <div className="podium-place" id={placeId}><h1>{place}</h1></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="leaderboard-placement">
                            {entries.slice(3).map((entry, index) => (
                                <div className="leaderboard-player row" id="nth-place" key={entry.userId}>
                                    <div className="player-details row">
                                        <p>{index + 4}</p>
                                        <div className="player-icon"></div>
                                        <p id="player-name">{entry.username}</p>
                                    </div>
                                    <p>{entry.xp.toLocaleString()} XP</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
