import { getAdjacentDate } from "@/lib/timezone";

export type ActivityLeaderboardPeriod = "daily" | "weekly" | "monthly";

export interface LeaderboardDateRange {
    startDate: string;
    endDate: string;
}

export function getLeaderboardDateRange(
    period: ActivityLeaderboardPeriod,
    asOfDate: string,
): LeaderboardDateRange {
    if (period === "daily") {
        return { startDate: asOfDate, endDate: asOfDate };
    }

    if (period === "weekly") {
        const weekday = new Date(`${asOfDate}T00:00:00.000Z`).getUTCDay();
        const daysSinceMonday = (weekday + 6) % 7;
        return {
            startDate: getAdjacentDate(asOfDate, -daysSinceMonday),
            endDate: asOfDate,
        };
    }

    return {
        startDate: `${asOfDate.slice(0, 7)}-01`,
        endDate: asOfDate,
    };
}
