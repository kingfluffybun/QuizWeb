import assert from "node:assert/strict";
import {
    getLeaderboardDateRange,
    type ActivityLeaderboardPeriod,
} from "../lib/leaderboard-period";

const cases: {
    period: ActivityLeaderboardPeriod;
    asOfDate: string;
    expected: { startDate: string; endDate: string };
}[] = [
    {
        period: "daily",
        asOfDate: "2026-10-28",
        expected: { startDate: "2026-10-28", endDate: "2026-10-28" },
    },
    {
        period: "weekly",
        asOfDate: "2026-10-28",
        expected: { startDate: "2026-10-26", endDate: "2026-10-28" },
    },
    {
        period: "weekly",
        asOfDate: "2026-11-01",
        expected: { startDate: "2026-10-26", endDate: "2026-11-01" },
    },
    {
        period: "monthly",
        asOfDate: "2026-10-28",
        expected: { startDate: "2026-10-01", endDate: "2026-10-28" },
    },
    {
        period: "monthly",
        asOfDate: "2026-11-01",
        expected: { startDate: "2026-11-01", endDate: "2026-11-01" },
    },
];

for (const { period, asOfDate, expected } of cases) {
    assert.deepEqual(getLeaderboardDateRange(period, asOfDate), expected);
}

console.log(`Passed ${cases.length} leaderboard period date-range cases.`);
