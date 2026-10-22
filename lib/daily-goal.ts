export const DAILY_XP_GOAL_THRESHOLDS = [75, 150, 225, 300] as const;

export interface DailyGoalData {
    todayXp: number;
    weekXp: number[];
    weekDates: string[];
}
