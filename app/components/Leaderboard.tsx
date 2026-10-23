"use client";

import { Fragment, useState } from "react";
import type { LeaderboardEntriesByPeriod, LeaderboardPeriod } from "@/app/actions/leaderboard";
import type { UserInfoResponse } from "@/app/api/db/user-info/route";

interface LeaderboardProps {
    entriesByPeriod: LeaderboardEntriesByPeriod;
    maxEntries?: number;
    showPeriodTitle?: boolean;
    initialPeriod?: LeaderboardPeriod;
    currentUserId?: string;
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

function getInitials(username: string): string {
    const name = username.toUpperCase().split(' ');
    return name.length > 1 
        ? `${name[0][0]}${name[name.length - 1][0]}`
        : name[0]?.substring(0, 1) || '?';
}


export default function Leaderboard({
    entriesByPeriod,
    maxEntries,
    showPeriodTitle = false,
    initialPeriod = "daily",
    currentUserId,
}: LeaderboardProps) {
    const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
    const entries = entriesByPeriod[period];
    const visibleEntries = maxEntries === undefined ? entries : entries.slice(0, maxEntries);
    const currentUserRank = currentUserId
        ? entries.findIndex((entry) => String(entry.userId) === currentUserId) + 1
        : 0;
    const currentUserEntry = currentUserRank > 3 ? entries[currentUserRank - 1] : undefined;

    const changePeriod = (nextPeriod: LeaderboardPeriod) => {
        setPeriod(nextPeriod);
    };

    const podium = [
        { entry: visibleEntries[1], rank: 2, rankClass: "second-place", rankLabel: "2nd" },
        { entry: visibleEntries[0], rank: 1, rankClass: "first-place", rankLabel: "1st" },
        { entry: visibleEntries[2], rank: 3, rankClass: "third-place", rankLabel: "3rd" },
    ];

    return (
        <div className="leaderboard" id="leaderboard">
            <div className="card">
                <div className="leaderboard-header">
                    <div className={`leaderboard-heading${showPeriodTitle ? "" : " card-title dashboard-leaderboard-title"}`}>
                        {showPeriodTitle && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar preview-icon" aria-hidden="true">
                                <path d="M8 2v3" />
                                <path d="M16 2v3" />
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9h18" />
                            </svg>
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
                                        onChange={() => changePeriod(optionPeriod)}
                                    />
                                    <label htmlFor={id}><p>{title}</p></label>
                                </Fragment>
                            );
                        })}
                    </div>
                </div>
                <div className="podium-stage">
                    <div className="podium">
                        {podium.map(({ entry, rank, rankClass, rankLabel }) => (
                            <div
                                className={`podium-place-container ${rankClass}${entry ? "" : " podium-place-empty"}`}
                                key={rank}
                            >
                                {entry && (
                                    <>

                                        <div
                                            style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    backgroundColor: entry.avatar_color,
                                                    fontWeight: 'bold',
                                                    fontSize: '1.25rem'
                                            }}
                                            className="player-icon"
                                            aria-label={`${entry.username}'s profile picture`}
                                        >
                                            {getInitials(entry.username)}
                                            {rank === 1 ? (
                                                <span className="crown" aria-hidden="true">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="m2 7 5 4 5-8 5 8 5-4-2 13H4L2 7Z" />
                                                        <path d="M4 17h16" />
                                                    </svg>
                                                </span>
                                            ) : (
                                                <span className="medal" aria-hidden="true">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M7.2 14.8 2.7 7.1a2 2 0 0 1 .1-2.2l1.6-2.1A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.1a2 2 0 0 1 .1 2.2l-4.5 7.7" />
                                                        <path d="m11 12-5.9-9.8M13 12l5.9-9.8M8 7h8" />
                                                        <circle cx="12" cy="17" r="5" />
                                                        <text x="12" y="19" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6">{rank}</text>
                                                    </svg>
                                                </span>
                                            )}
                                            <div className="podium-player-xp">
                                                <p>{entry.xp.toLocaleString()} XP</p>
                                            </div>
                                        </div>
                                        <p id="player-name">{entry.username}</p>
                                    </>
                                )}
                                <div className="podium-place" id={rankClass}>
                                    <h1>{rankLabel}</h1>
                                    <svg xmlns="http://www.w3.org/2000/svg" width={rank === 1 ? 72 : 48} height={rank === 1 ? 72 : 48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trophy preview-icon"><path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {visibleEntries.length === 0 && (
                    <p>No XP earned for this period yet.</p>
                )}
                <div className={`leaderboard-placement${currentUserEntry ? " has-current-user" : ""}`}>
                    <div className="leaderboard-placement-scroll">
                        {visibleEntries.slice(3).map((entry, index) => (
                            <div className="leaderboard-player row" key={entry.userId}>
                                <div className="player-details row">
                                    <p>{index + 4}</p>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            backgroundColor: entry.avatar_color,
                                            fontWeight: "bold",
                                            fontSize: "1rem",
                                        }}
                                        className="player-icon"
                                        aria-label={`${entry.username}'s profile picture`}
                                    >
                                        {getInitials(entry.username)}
                                    </div>
                                    <p className="leaderboard-entry-name">{entry.username}</p>
                                </div>
                                <p>{entry.xp.toLocaleString()} XP</p>
                            </div>
                        ))}
                    </div>
                    {currentUserEntry && (
                        <div
                            className="leaderboard-player row leaderboard-current-user"
                            role="group"
                            aria-label={`Your position: ${currentUserRank}, ${currentUserEntry.username}, ${currentUserEntry.xp.toLocaleString()} XP`}
                        >
                            <div className="player-details row">
                                <p>{currentUserRank}</p>
                                <div
                                    className="player-icon"
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        backgroundColor: currentUserEntry.avatar_color,
                                        fontWeight: "bold",
                                        fontSize: "1rem",
                                    }}
                                    aria-hidden="true"
                                >
                                    {getInitials(currentUserEntry.username)}
                                </div>
                                <p className="leaderboard-entry-name">{currentUserEntry.username} (You)</p>
                            </div>
                            <p>{currentUserEntry.xp.toLocaleString()} XP</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
