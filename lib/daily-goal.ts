export type DailyXpGoalThresholds = readonly [number, number, number, number];

export const DAILY_XP_GOAL_THRESHOLDS: DailyXpGoalThresholds = [75, 150, 225, 300];

export function getDailyXpGoalThresholds(previousWeekXp: number): DailyXpGoalThresholds {
    if (!Number.isFinite(previousWeekXp) || previousWeekXp <= 0) {
        return DAILY_XP_GOAL_THRESHOLDS;
    }

    const totalXp = Math.floor(previousWeekXp);
    if (totalXp <= 0) {
        return DAILY_XP_GOAL_THRESHOLDS;
    }

    return [
        Math.ceil(totalXp / 4),
        Math.ceil(totalXp / 2),
        Math.ceil((totalXp * 3) / 4),
        totalXp,
    ];
}

export interface DailyGoalData {
    todayXp: number;
    weekXp: number[];
    weekDates: string[];
    previousWeekXp: number;
}
