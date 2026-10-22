"use client";

import { useEffect, useState } from "react";
import { getDailyGoalData } from "@/app/actions/daily-goal";
import { DAILY_XP_GOAL_THRESHOLDS } from "@/lib/daily-goal";
import type { DailyGoalData } from "@/lib/daily-goal";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CHART_TICKS = [0, 75, 150, 225, 300];
const CHART_HEIGHT_PX = 148;

function getBarHeight(xp: number): number {
    const value = Math.min(Math.max(xp, 0), CHART_TICKS[CHART_TICKS.length - 1]);
    const upperTickIndex = CHART_TICKS.findIndex((tick) => tick >= value);

    if (upperTickIndex <= 0) {
        return 0;
    }

    const lowerTick = CHART_TICKS[upperTickIndex - 1];
    const upperTick = CHART_TICKS[upperTickIndex];
    const intervalProgress = (value - lowerTick) / (upperTick - lowerTick);
    const scaleProgress = (upperTickIndex - 1 + intervalProgress) / (CHART_TICKS.length - 1);

    return scaleProgress * CHART_HEIGHT_PX;
}

export default function DailyGoalCard({ initialData }: { initialData: DailyGoalData }) {
    const [goalData, setGoalData] = useState(initialData);

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

    const todayXp = Math.max(0, goalData.todayXp);
    const goal = DAILY_XP_GOAL_THRESHOLDS.find((threshold) => todayXp < threshold)
        ?? DAILY_XP_GOAL_THRESHOLDS[DAILY_XP_GOAL_THRESHOLDS.length - 1];
    const todayProgress = Math.min(todayXp / goal, 1) * 100;
    const chartTicks = [...CHART_TICKS].reverse();

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
                        aria-label={`XP earned this week: ${DAY_LABELS.map((day, index) => `${day} ${goalData.weekXp[index]}`).join(", ")}`}
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
                            {DAY_LABELS.map((day, index) => (
                                <div key={day}>
                                    {goalData.weekXp[index] > 0 && (
                                        <div
                                            className="graph-y-bar"
                                            style={{ height: `${getBarHeight(goalData.weekXp[index])}px` }}
                                            title={`${goalData.weekXp[index]} XP on ${goalData.weekDates[index]}`}
                                        />
                                    )}
                                    <p>{day}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
