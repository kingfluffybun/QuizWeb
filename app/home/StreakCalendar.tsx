"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    type StreakData,
    getMonthActivity,
    recordUserActivity,
    getUserStreakData,
} from "@/app/actions/streak";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StreakCalendar({ initialData }: { initialData: StreakData }) {
    const [streakData, setStreakData] = useState<StreakData>(initialData);
    const [viewYear, setViewYear] = useState<number>(initialData.targetYear);
    const [viewMonth, setViewMonth] = useState<number>(initialData.targetMonth);
    const [activeDays, setActiveDays] = useState<number[]>(initialData.activeDatesInMonth);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isLogging, setIsLogging] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Sync client local date if different from server fallback
    useEffect(() => {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const localDate = `${year}-${month}-${day}`;

            if (localDate !== initialData.todayDate) {
                startTransition(async () => {
                    const freshData = await getUserStreakData(viewYear, viewMonth, localDate);
                    setStreakData(freshData);
                    setActiveDays(freshData.activeDatesInMonth);
                });
            }
        } catch {
            // Ignore date parsing errors
        }
    }, [initialData.todayDate, viewYear, viewMonth]);

    const handlePrevMonth = useCallback(async () => {
        const nextMonth = viewMonth === 1 ? 12 : viewMonth - 1;
        const nextYear = viewMonth === 1 ? viewYear - 1 : viewYear;

        setViewYear(nextYear);
        setViewMonth(nextMonth);

        startTransition(async () => {
            const res = await getMonthActivity(nextYear, nextMonth);
            if (res.success) {
                setActiveDays(res.activeDays);
            }
        });
    }, [viewMonth, viewYear]);

    const handleNextMonth = useCallback(async () => {
        const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
        const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;

        setViewYear(nextYear);
        setViewMonth(nextMonth);

        startTransition(async () => {
            const res = await getMonthActivity(nextYear, nextMonth);
            if (res.success) {
                setActiveDays(res.activeDays);
            }
        });
    }, [viewMonth, viewYear]);

    const handleTodayView = useCallback(async () => {
        const [todayYearStr, todayMonthStr] = streakData.todayDate.split("-");
        const tYear = Number(todayYearStr);
        const tMonth = Number(todayMonthStr);

        setViewYear(tYear);
        setViewMonth(tMonth);

        startTransition(async () => {
            const res = await getMonthActivity(tYear, tMonth);
            if (res.success) {
                setActiveDays(res.activeDays);
            }
        });
    }, [streakData.todayDate]);

    const handleManualCheckIn = async () => {
        setIsLogging(true);
        setFeedbackMessage(null);

        try {
            const res = await recordUserActivity({
                type: "daily_checkin",
                xp: 10,
                date: streakData.todayDate,
            });

            if (res.success) {
                const fresh = await getUserStreakData(viewYear, viewMonth, streakData.todayDate);
                setStreakData(fresh);
                setActiveDays(fresh.activeDatesInMonth);
                setFeedbackMessage("Daily streak recorded! +10 XP earned.");
            } else {
                setFeedbackMessage(res.error || "Failed to log activity.");
            }
        } catch {
            setFeedbackMessage("An unexpected error occurred.");
        } finally {
            setIsLogging(false);
        }
    };

    // Calculate calendar grid metrics for viewYear & viewMonth
    const firstDayOfWeek = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const totalDaysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const emptySlots = Array.from({ length: firstDayOfWeek });
    const monthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

    const isCurrentViewMonth = (() => {
        const [todayYearStr, todayMonthStr] = streakData.todayDate.split("-");
        return Number(todayYearStr) === viewYear && Number(todayMonthStr) === viewMonth;
    })();

    const todayDayNum = isCurrentViewMonth ? Number(streakData.todayDate.slice(8, 10)) : null;

    // Motivational text
    const motivationMessage = (() => {
        if (streakData.todayCompleted) {
            return "You're on a roll! Streak maintained for today!";
        }
        if (streakData.currentStreak > 0) {
            return `You're on a roll! Finish a lesson today to make it ${streakData.currentStreak + 1}.`;
        }
        return "Complete a lesson or quiz today to start your streak!";
    })();

    const isFlameActive = streakData.currentStreak > 0 || streakData.todayCompleted;

    return (
        <div className="card" id="streak-calendar">
            <div className="card-title">
                <h2>Streak Calendar</h2>
                <button type="button" className="quick-action quick-action-btn" onClick={() => setIsDetailsOpen(true)} aria-label="View streak details" > <h2 className="quick-action">View Details</h2> </button>
            </div>
            <div className="calendar-container">
                {/* Left column: streak summary & current week */}
                <div className="streak">
                    <div className="streak-status row">
                        <div
                            className={`streak-progress-bar col ${isFlameActive ? "active" : "inactive"}`}
                            title={isFlameActive ? `${streakData.currentStreak} day streak active!` : "Streak inactive"}
                        >
                            <svg width="547" height="624" viewBox="0 0 547 624" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M219.095 23.8317C212.459 64.1343 205.4 86.4878 190.467 114.633C170.255 152.704 143.015 186.52 102.712 223.565C44.8828 276.689 14.8066 323.839 2.89081 380.1C-0.668852 396.963 -1.00068 431.474 2.22715 448.88C13.8112 511.295 57.402 566.56 119.485 597.602C146.243 610.965 167.45 617.24 200.09 621.403C210.558 622.761 219.518 623.847 219.97 623.847C220.453 623.847 217.044 621.313 212.459 618.236C202.142 611.327 184.585 594.525 176.681 584.057C151.431 550.542 143.648 506.83 156.288 469.393C165.58 441.791 185.188 413.585 210.92 390.87C229.985 374.037 249.021 360.703 287.996 336.871L292.431 334.186L299.972 356.842C311.798 392.348 314.965 398.532 336.564 427.763C343.925 437.718 352.523 450.117 355.66 455.336C371.709 482.033 377.259 513.346 370.592 539.561C361.693 574.645 341.964 604.51 317.348 620.106C310.319 624.601 309.987 624.571 336.625 621.403C382.448 615.973 415.179 606.772 444.682 591.055C481.455 571.477 507.549 544.327 524.925 507.584C535.182 485.925 541.275 463.782 545.046 434.4C547.309 416.994 546.947 376.058 544.413 361.457C535.574 310.234 513.492 260.006 474.728 202.72C456.356 175.63 439.101 154.845 412.584 127.937L388.24 103.23L377.561 124.618C371.678 136.383 366.58 146.007 366.188 146.007C365.796 146.007 364.227 142.869 362.689 139.068C347.364 100.877 317.107 62.445 281.661 36.1698C274.119 30.589 224.827 0 223.379 0C223.198 0 221.267 10.7393 219.095 23.8317Z"
                                    fill={isFlameActive ? "#FF7504" : "var(--text-muted)"}
                                />
                            </svg>
                        </div>
                        <div className="streak-no-of-days col">
                            <h1 style={{ color: isFlameActive ? "#FF7504" : "var(--text-muted)" }}>
                                {streakData.currentStreak}
                            </h1>
                            <p>day streak!</p>
                        </div>
                    </div>
                    <p>{motivationMessage}</p>

                    {/* Streak Week indicators */}
                    <div className="streak-week">
                        {streakData.weekDays.map((day) => {
                            let dayClasses = "streak-day row";
                            if (day.isActive) {
                                dayClasses += " active";
                            } else if (day.isToday) {
                                dayClasses += " today";
                            }

                            const tooltip = `${day.dayName} (${day.date}): ${
                                day.isActive ? "Completed" : day.isToday ? "Today (Not finished yet)" : "No activity"
                            }`;

                            return (
                                <div key={day.date} className="streak-day-container col">
                                    <div className={dayClasses} title={tooltip} aria-label={tooltip}>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="lucide lucide-check preview-icon"
                                            aria-hidden="true"
                                        >
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                    </div>
                                    <p>{day.dayLetter}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right column: Month Calendar */}
                <div className="calendar" aria-label="Monthly activity calendar">
                    <div className="calendar-month">
                        <div className="calendar-month-header">
                            <p>{MONTH_NAMES[viewMonth - 1]} {viewYear}</p>
                            {!isCurrentViewMonth && (
                                <button
                                    type="button"
                                    className="calendar-today-btn"
                                    onClick={handleTodayView}
                                    title="Jump to current month"
                                >
                                    Today
                                </button>
                            )}
                        </div>
                        <div className="calendar-month-nav">
                            <button
                                type="button"
                                className="calendar-nav-btn"
                                onClick={handlePrevMonth}
                                disabled={isPending}
                                aria-label="Previous month"
                                title="Previous month"
                            >
                                &#9664;
                            </button>
                            <button
                                type="button"
                                className="calendar-nav-btn"
                                onClick={handleNextMonth}
                                disabled={isPending}
                                aria-label="Next month"
                                title="Next month"
                            >
                                &#9654;
                            </button>
                        </div>
                    </div>

                    {/* Day of Week Headers */}
                    {DAY_LABELS.map((label) => (
                        <div key={label} className="day-label">
                            <p>{label}</p>
                        </div>
                    ))}

                    {/* Empty Slots */}
                    {emptySlots.map((_, i) => (
                        <div key={`empty-${i}`} className="day-empty" aria-hidden="true" />
                    ))}

                    {/* Month Days */}
                    {monthDays.map((dayNum) => {
                        const isActive = activeDays.includes(dayNum);
                        const isToday = isCurrentViewMonth && dayNum === todayDayNum;

                        let dayClasses = "day col";
                        if (isActive) dayClasses += " active";
                        if (isToday) dayClasses += " today";

                        const dateString = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                        const titleText = `${MONTH_NAMES[viewMonth - 1]} ${dayNum}, ${viewYear}${
                            isActive ? " · Completed" : isToday ? " · Today" : ""
                        }`;

                        return (
                            <div
                                key={`day-${dayNum}`}
                                className={dayClasses}
                                title={titleText}
                                aria-label={titleText}
                                data-date={dateString}
                            >
                                <p>{dayNum}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Streak Details Modal */}
            {isDetailsOpen && (
                <div
                    className="streak-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="streak-modal-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsDetailsOpen(false);
                    }}
                >
                    <div className="streak-modal-card">
                        <div className="streak-modal-header">
                            <h2 id="streak-modal-title">Streak & Activity Overview</h2>
                            <button
                                type="button"
                                className="streak-modal-close"
                                onClick={() => setIsDetailsOpen(false)}
                                aria-label="Close dialog"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="streak-stats-grid">
                            <div className="streak-stat-item">
                                <span className="streak-stat-value">{streakData.currentStreak}</span>
                                <span className="streak-stat-label">Current Streak</span>
                            </div>
                            <div className="streak-stat-item">
                                <span className="streak-stat-value">{streakData.longestStreak}</span>
                                <span className="streak-stat-label">Longest Streak</span>
                            </div>
                            <div className="streak-stat-item">
                                <span className="streak-stat-value">{streakData.totalActiveDays}</span>
                                <span className="streak-stat-label">Total Days Active</span>
                            </div>
                        </div>

                        <div className="streak-status-banner">
                            {streakData.todayCompleted ? (
                                <p className="streak-status-success">
                                    &#10004; You have completed practice today ({streakData.todayDate})!
                                </p>
                            ) : (
                                <p className="streak-status-pending">
                                    You haven&apos;t recorded a lesson or quiz yet today ({streakData.todayDate}).
                                </p>
                            )}
                        </div>

                        {feedbackMessage && (
                            <div className="streak-feedback-message">
                                <p>{feedbackMessage}</p>
                            </div>
                        )}

                        <div className="streak-modal-actions">
                            {!streakData.todayCompleted && (
                                <button
                                    type="button"
                                    className="streak-action-btn primary"
                                    onClick={handleManualCheckIn}
                                    disabled={isLogging}
                                >
                                    {isLogging ? "Recording..." : "Check In Today (+10 XP)"}
                                </button>
                            )}
                            <Link
                                href="/learn"
                                className="streak-action-btn secondary"
                                onClick={() => setIsDetailsOpen(false)}
                            >
                                Start a Lesson
                            </Link>
                            <button
                                type="button"
                                className="streak-action-btn tertiary"
                                onClick={() => setIsDetailsOpen(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

