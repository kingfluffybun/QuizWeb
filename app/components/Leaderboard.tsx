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

function getProfileInitials(username: string): string {
    return username
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((namePart) => Array.from(namePart)[0]?.toLocaleUpperCase() ?? "")
        .join("");
}

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
                <div className="podium-stage">
                    <div className="podium">
                        <div className="podium-place-container second-place">
                            <div className="player-icon">
                                <span className="medal"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M7.20996 15L2.65996 7.14C2.46376 6.80087 2.37149 6.41159 2.3946 6.02048C2.41771 5.62937 2.55518 5.25366 2.78996 4.94L4.39996 2.8C4.58625 2.55161 4.82782 2.35 5.10553 2.21115C5.38324 2.07229 5.68947 2 5.99996 2H18C18.3104 2 18.6167 2.07229 18.8944 2.21115C19.1721 2.35 19.4137 2.55161 19.6 2.8L21.2 4.94C21.4363 5.25265 21.5755 5.62784 21.6004 6.01897C21.6253 6.4101 21.5347 6.79992 21.34 7.14L16.79 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M11.0001 12.0002L5.12012 2.2002" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M13 12.0002L18.88 2.2002" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M8 7H16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M17 17C17 19.7614 14.7614 22 12 22C9.23858 22 7 19.7614 7 17C7 14.2386 9.23858 12 12 12C14.7614 12 17 14.2386 17 17Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M10.7998 16.0375C10.7998 14.9875 13.1998 14.9875 13.1998 16.0375C13.1998 16.7676 11.4293 17.3501 10.9297 18.2603C10.7968 18.5023 11.0237 18.7375 11.2998 18.7375H13.1998" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> </svg></span>
                                <div className="podium-player-xp"><p>200 XP</p></div>
                            </div>
                            <p id="player-name">Jerald A.</p>
                            <div className="podium-place" id="second-place"><h1>2nd</h1></div>
                        </div>
                        <div className="podium-place-container first-place">
                            <div className="player-icon">
                                <span className="crown"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crown preview-icon"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg></span>
                                <div className="podium-player-xp"><p>300 XP</p></div>
                            </div>
                            <p id="player-name">Talon G.</p>
                            <div className="podium-place" id="first-place"><h1>1st</h1></div>
                        </div>
                        <div className="podium-place-container third-place">
                            <div className="player-icon">
                                <span className="medal"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M7.20996 15L2.65996 7.14C2.46376 6.80087 2.37149 6.41159 2.3946 6.02048C2.41771 5.62937 2.55518 5.25366 2.78996 4.94L4.39996 2.8C4.58625 2.55161 4.82782 2.35 5.10553 2.21115C5.38324 2.07229 5.68947 2 5.99996 2H18C18.3104 2 18.6167 2.07229 18.8944 2.21115C19.1721 2.35 19.4137 2.55161 19.6 2.8L21.2 4.94C21.4363 5.25265 21.5755 5.62784 21.6004 6.01897C21.6253 6.4101 21.5347 6.79992 21.34 7.14L16.79 15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M11.0001 12.0002L5.12012 2.2002" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M13 12.0002L18.88 2.2002" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M8 7H16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M17 17C17 19.7614 14.7614 22 12 22C9.23858 22 7 19.7614 7 17C7 14.2386 9.23858 12 12 12C14.7614 12 17 14.2386 17 17Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> <path d="M10.7998 15.65C11.0998 15.37 11.4498 15.25 11.8998 15.25C12.6998 15.25 13.1998 15.55 13.1998 16.1C13.1998 16.65 12.6998 16.9937 11.8998 16.9937C12.6998 16.9937 13.1998 17.3375 13.1998 17.8875C13.1998 18.4375 12.6998 18.7375 11.8998 18.7375C11.4498 18.7375 11.0998 18.6175 10.7998 18.3375" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke="currentColor"/> </svg></span>
                                <div className="podium-player-xp"><p>150 XP</p></div>
                            </div>
                            <p id="player-name">Caitlyn H.</p>
                            <div className="podium-place" id="third-place"><h1>3rd</h1></div>
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
                                        <div
                                            className="player-icon"
                                            aria-label={`${entry.username}'s profile`}
                                            style={{ display: "grid", placeItems: "center", color: "white", fontWeight: 700, backgroundColor: "var(--primary-color)" }}
                                        >
                                            {getProfileInitials(entry.username)}
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
                                        <div
                                            className="player-icon"
                                            aria-label={`${entry.username}'s profile`}
                                            style={{ display: "grid", placeItems: "center", color: "white", fontWeight: 700, backgroundColor: "var(--primary-color)" }}
                                        >
                                            {getProfileInitials(entry.username)}
                                        </div>
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
