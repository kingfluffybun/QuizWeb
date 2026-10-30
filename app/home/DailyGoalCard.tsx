"use client";

import { useEffect, useState } from "react";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import { DAILY_XP_GOAL_THRESHOLDS } from "@/lib/daily-goal";
import type { DailyGoalData } from "@/lib/daily-goal";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CHART_HEIGHT_PX = 148;
const MAX_CHART_XP = 300;

interface DailyGoalPreview {
    weekXp: number[];
    previousWeekXp: number;
}

function getBarHeight(xp: number, maximumXp: number): number {
    const value = Math.min(Math.max(xp, 0), maximumXp);
    return (value / maximumXp) * CHART_HEIGHT_PX;
}

export default function DailyGoalCard({
    initialData,
    canPreview = false,
}: {
    initialData: DailyGoalData;
    canPreview?: boolean;
}) {
    const [goalData, setGoalData] = useState(initialData);
    const [previewData, setPreviewData] = useState<DailyGoalPreview | null>(null);

    useEffect(() => {
        let isActive = true;

        const refreshGoalData = async () => {
            try {
                const latestData = await getDailyGoalData();
                if (isActive) {
                    setGoalData(latestData);
                }
            } catch (error) {
                console.error("Failed to refresh daily XP progress:", error);
            }
        };

        const refreshWhenVisible = () => {
            if (document.visibilityState === "visible") {
                void refreshGoalData();
            }
        };

        void refreshGoalData();
        window.addEventListener("focus", refreshWhenVisible);
        document.addEventListener("visibilitychange", refreshWhenVisible);

        return () => {
            isActive = false;
            window.removeEventListener("focus", refreshWhenVisible);
            document.removeEventListener("visibilitychange", refreshWhenVisible);
        };
    }, []);

    const previewWeekXp = (canPreview ? previewData?.weekXp : undefined) ?? goalData.weekXp;
    const previousWeekXp = (canPreview ? previewData?.previousWeekXp : undefined) ?? goalData.previousWeekXp;
    const todayIndex = goalData.weekDates.indexOf(new Date().toISOString().slice(0, 10));
    const todayXp = Math.max(
        0,
        canPreview && previewData && todayIndex >= 0 ? previewWeekXp[todayIndex] : goalData.todayXp,
    );
    const goal = goalData.dailyGoal;
    const todayProgress = Math.min(todayXp / goal, 1) * 100;
    const highestWeekXp = Math.max(0, ...previewWeekXp);
    const chartMaximumXp = Math.max(
        MAX_CHART_XP,
        Math.ceil(highestWeekXp / MAX_CHART_XP) * MAX_CHART_XP,
    );
    const chartTicks = [0, ...DAILY_XP_GOAL_THRESHOLDS]
        .map((value) => Math.round((value / MAX_CHART_XP) * chartMaximumXp))
        .reverse();

    const updatePreviewDay = (index: number, value: number) => {
        const currentPreview = previewData ?? {
            weekXp: goalData.weekXp,
            previousWeekXp: goalData.previousWeekXp,
        };

        setPreviewData({
            ...currentPreview,
            weekXp: currentPreview.weekXp.map((xp, dayIndex) => (
                dayIndex === index ? Math.max(0, Math.floor(value || 0)) : xp
            )),
        });
    };

    const updatePreviousWeekXp = (value: number) => {
        const currentPreview = previewData ?? {
            weekXp: goalData.weekXp,
            previousWeekXp: goalData.previousWeekXp,
        };

        setPreviewData({
            ...currentPreview,
            previousWeekXp: Math.max(0, Math.floor(value || 0)),
        });
    };

    return (
        <>
            <div className="card">
                <div className="card-title">
                    <h2>Daily Goal</h2>
                </div>
                <div className="daily-goal-xp">
                    <p>XP Progress</p>
                    <div className="daily-progress-bar-container row">
                        <div
                            className="daily-progress-bar"
                            role="progressbar"
                            aria-label="Today's XP progress"
                            aria-valuemin={0}
                            aria-valuemax={goal}
                            aria-valuenow={Math.min(todayXp, goal)}
                        >
                            <div className="progress-bar-fill" style={{ width: `${todayProgress}%` }} />
                        </div>
                        <div>
                            <p>{todayXp}/{goal}</p>
                        </div>
                    </div>
                    <div
                        className="daily-prograss-graph daily-goal-chart"
                        role="img"
                        aria-label={`XP earned this week: ${DAY_LABELS.map((day, index) => `${day} ${previewWeekXp[index]}`).join(", ")}`}
                    >
                        <div className="graph-x-axis-container">
                            {chartTicks.map((value, index) => (
                                <div className="graph-x-axis" key={`${value}-${index}`}>
                                    <p>{value}</p>
                                    <div className="x-axis-line" />
                                </div>
                            ))}
                        </div>
                        <div className="graph-y-axis">
                            {DAY_LABELS.map((day, index) => {
                                const xp = Math.max(0, previewWeekXp[index]);
                                const hasActivity = xp > 0;

                                return (
                                    <div key={day}>
                                        <div
                                            className={`graph-y-bar${hasActivity ? "" : " graph-y-bar-empty"}`}
                                            style={{
                                                height: hasActivity
                                                    ? `${getBarHeight(xp, chartMaximumXp)}px`
                                                    : "2px",
                                            }}
                                            title={`${xp} XP on ${goalData.weekDates[index]}`}
                                        />
                                        <p>{day}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {canPreview && (
                        <details className="daily-goal-preview-hub">
                            <summary>Daily Goal Preview Hub</summary>
                            <p className="daily-goal-preview-note">
                                Preview changes only. They won’t be saved to your XP activity.
                            </p>
                            <label className="daily-goal-preview-previous">
                                Previous week total XP
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={previousWeekXp}
                                    onChange={(event) => updatePreviousWeekXp(Number(event.currentTarget.value))}
                                />
                            </label>
                            <div className="daily-goal-preview-days">
                                {DAY_LABELS.map((day, index) => (
                                    <label key={day}>
                                        {day} XP
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={previewWeekXp[index]}
                                            onChange={(event) => updatePreviewDay(index, Number(event.currentTarget.value))}
                                        />
                                    </label>
                                ))}
                            </div>
                            {previewData && (
                                <button
                                    className="daily-goal-preview-reset"
                                    type="button"
                                    onClick={() => setPreviewData(null)}
                                >
                                    Reset preview
                                </button>
                            )}
                        </details>
                    )}
                </div>
            </div>
        </>
    );
}
