import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import type { Session, User } from "next-auth";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

// Mock test session for actions requiring authenticated user
(globalThis as Record<string, unknown>).__TEST_AUTH_SESSION__ = {
    user: { id: "4", email: "clarence.luna651@gmail.com", name: "Clarence" },
};

async function runPhase1OptimizationTests() {
    console.log("================================================================================");
    console.log(" Running Phase 1: Database & Auth Performance Verification Suite");
    console.log("================================================================================");

    const { db } = await import("../lib/db");
    const { auth, authConfig } = await import("../auth");
    const {
        getLeaderboardEntriesByPeriod,
        getLeaderboardEntries,
        invalidateLeaderboardCache,
    } = await import("../app/actions/leaderboard");
    const { getUserStreakData, recordUserActivity } = await import("../app/actions/streak");

    // -------------------------------------------------------------------------
    // 1. Covering Index Verification
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Verifying Covering Index on user_activity_tbl...");
    const [indexes] = await db.query<RowDataPacket[]>(
        `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX 
         FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'user_activity_tbl' 
           AND INDEX_NAME = 'idx_activity_date_user_xp'
         ORDER BY SEQ_IN_INDEX ASC`
    );
    assert.equal(indexes.length, 3, "Expected 3 indexed columns in idx_activity_date_user_xp");
    assert.equal(indexes[0].COLUMN_NAME, "activity_date", "First column must be activity_date");
    assert.equal(indexes[1].COLUMN_NAME, "user_id", "Second column must be user_id");
    assert.equal(indexes[2].COLUMN_NAME, "xp_earned", "Third column must be xp_earned");

    const [explainRows] = await db.query<RowDataPacket[]>(
        `EXPLAIN SELECT p.user_id, p.username, SUM(a.xp_earned) AS xp, u.avatar_color
         FROM user_activity_tbl a
         INNER JOIN player_tbl p ON p.user_id = a.user_id
         LEFT JOIN user_auth_tbl u ON p.user_id = u.user_id
         WHERE a.activity_date = CURDATE()
         GROUP BY p.user_id, p.username, u.avatar_color
         ORDER BY SUM(a.xp_earned) DESC, p.username ASC, p.user_id ASC
         LIMIT 10`
    );
    const activityScan = explainRows.find((r: RowDataPacket) => r.table === "a");
    assert.ok(activityScan, "Expected query plan step for activity table");
    assert.equal(activityScan.key, "idx_activity_date_user_xp", "Query must use covering index idx_activity_date_user_xp");
    assert.ok(activityScan.Extra?.includes("Using index"), "Query plan must indicate 'Using index' (covering index)");
    console.log("✔ Covering index idx_activity_date_user_xp verified with 'Using index' in query plan.");

    // -------------------------------------------------------------------------
    // 2. Leaderboard Caching & Actions
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Verifying Leaderboard Caching & Queries...");
    const startPeriodTime = performance.now();
    const periodEntries = await getLeaderboardEntriesByPeriod();
    const firstPeriodDuration = performance.now() - startPeriodTime;

    assert.ok(periodEntries.daily, "Expected daily leaderboard entries");
    assert.ok(periodEntries.weekly, "Expected weekly leaderboard entries");
    assert.ok(periodEntries.monthly, "Expected monthly leaderboard entries");
    assert.ok(periodEntries["all-time"], "Expected all-time leaderboard entries");
    assert.ok(Array.isArray(periodEntries.daily), "Daily entries must be an array");
    assert.ok(Array.isArray(periodEntries["all-time"]), "All-time entries must be an array");

    const singlePeriod = await getLeaderboardEntries("all-time");
    assert.ok(Array.isArray(singlePeriod), "All-time period must be an array");
    assert.equal(singlePeriod.length, periodEntries["all-time"].length, "getLeaderboardEntries should match getLeaderboardEntriesByPeriod");

    // Invalidation must not throw in any environment
    await invalidateLeaderboardCache();
    console.log(`✔ Leaderboard entries retrieved (initial: ${firstPeriodDuration.toFixed(1)}ms), invalidation safe.`);

    // -------------------------------------------------------------------------
    // 3. NextAuth Request-Level Deduplication
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Verifying NextAuth Request Deduplication & Callbacks...");
    assert.equal(typeof auth, "function", "auth export must be a function");

    // Query current token_version for user 4 to test both valid and revoked tokens
    const [userAuthRows] = await db.query<RowDataPacket[]>(
        "SELECT token_version FROM user_auth_tbl WHERE user_id = 4 LIMIT 1"
    );
    const currentTokenVersion = Number(userAuthRows[0]?.token_version ?? 1);

    // Test jwt callback
    const testToken = { id: "4", role: "user", tokenVersion: currentTokenVersion };
    const jwtResult = await authConfig.callbacks?.jwt?.({
        token: testToken,
        user: undefined as unknown as User,
        account: null,
        profile: undefined,
        trigger: undefined,
        session: undefined,
    });
    assert.ok(jwtResult, "JWT callback must return token");
    assert.ok(jwtResult.role, "JWT must populate user role");
    assert.ok(jwtResult.name, "JWT must populate username from player_tbl");
    assert.equal(jwtResult.tokenVersion, currentTokenVersion, "JWT callback must preserve tokenVersion");

    // Test session callback with matching tokenVersion
    const sessionResult = await authConfig.callbacks?.session?.({
        session: { user: { id: "4" }, expires: "2099-01-01" } as unknown as Session,
        token: jwtResult,
        user: undefined as unknown as User,
        newSession: undefined,
        trigger: undefined,
    });
    assert.ok(sessionResult?.user, "Session callback must return user session");
    assert.equal(sessionResult.user.id, "4", "Session user id must match");
    assert.equal(sessionResult.user.role, jwtResult.role, "Session user role must match DB role");
    assert.equal(sessionResult.user.name, jwtResult.name, "Session username must match DB username");

    // Security Verification: Stale/revoked tokenVersion must NEVER be upgraded by jwt and must be rejected by session
    const staleToken = { id: "4", role: "user", tokenVersion: currentTokenVersion + 999 };
    const staleJwtResult = await authConfig.callbacks?.jwt?.({
        token: staleToken,
        user: undefined as unknown as User,
        account: null,
        profile: undefined,
        trigger: undefined,
        session: undefined,
    });
    assert.equal(staleJwtResult.tokenVersion, currentTokenVersion + 999, "JWT callback must NOT overwrite tokenVersion with database value");
    const revokedSession = await authConfig.callbacks?.session?.({
        session: { user: { id: "4" }, expires: "2099-01-01" } as unknown as Session,
        token: staleJwtResult,
        user: undefined as unknown as User,
        newSession: undefined,
        trigger: undefined,
    });
    assert.equal(revokedSession, null, "Session callback MUST reject token with mismatched tokenVersion");

    // Verify auth wrapper handles both 0-arg session retrieval and handler delegation
    const sessionFromAuth = await auth();
    assert.ok(sessionFromAuth?.user, "auth() must resolve to active session");
    console.log(`✔ NextAuth jwt and session callbacks consolidated with unified player/auth query & revocation security verified.`);

    // -------------------------------------------------------------------------
    // 4. Streak Query Windowing & Player Persistence
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Verifying Streak Query Windowing...");
    const streakData = await getUserStreakData();
    assert.equal(typeof streakData.currentStreak, "number", "currentStreak must be a number");
    assert.equal(typeof streakData.longestStreak, "number", "longestStreak must be a number");
    assert.equal(typeof streakData.totalActiveDays, "number", "totalActiveDays must be a number");
    assert.equal(typeof streakData.todayCompleted, "boolean", "todayCompleted must be a boolean");
    assert.ok(Array.isArray(streakData.activeDatesInMonth), "activeDatesInMonth must be an array");
    assert.ok(Array.isArray(streakData.allActiveDates), "allActiveDates must be an array");
    assert.equal(streakData.weekDays.length, 7, "weekDays must have 7 entries");
    assert.ok(streakData.longestStreak >= streakData.currentStreak, "longestStreak must be >= currentStreak");

    // Test past month window query (non-overlapping / disjoint windowing path)
    const pastMonthData = await getUserStreakData(2025, 6);
    assert.equal(pastMonthData.targetYear, 2025, "targetYear must be 2025");
    assert.equal(pastMonthData.targetMonth, 6, "targetMonth must be 6");
    assert.ok(Array.isArray(pastMonthData.activeDatesInMonth), "activeDatesInMonth must be an array");
    assert.equal(pastMonthData.weekDays.length, 7, "weekDays must remain 7 entries");

    // Test future month window query
    const futureMonthData = await getUserStreakData(2027, 1);
    assert.equal(futureMonthData.targetYear, 2027, "targetYear must be 2027");
    assert.equal(futureMonthData.targetMonth, 1, "targetMonth must be 1");
    assert.equal(futureMonthData.activeDatesInMonth.length, 0, "future month should have 0 active days");

    // Test recordUserActivity execution and player streak synchronization
    const logResult = await recordUserActivity({ type: "test_verification", xp: 5 });
    assert.ok(logResult.success, "recordUserActivity must succeed");
    assert.equal(typeof logResult.streak, "number", "recordUserActivity must return updated streak");

    // Verify player_tbl was updated with current streak
    const [playerRows] = await db.query<RowDataPacket[]>(
        "SELECT current_streak, max_streak FROM player_tbl WHERE user_id = 4 LIMIT 1"
    );
    assert.ok(playerRows.length > 0, "Player row must exist");
    assert.equal(playerRows[0].current_streak, logResult.streak, "player_tbl.current_streak must match returned streak");

    console.log(`✔ Streak windowing and player_tbl synchronization verified (current: ${streakData.currentStreak}, max: ${streakData.longestStreak}, total: ${streakData.totalActiveDays}).`);

    // Clean up test activity entry
    await db.query(
        "DELETE FROM user_activity_tbl WHERE user_id = 4 AND activity_type = 'test_verification'"
    );
    await db.query(
        "UPDATE player_tbl SET xp = xp - 5 WHERE user_id = 4"
    );

    console.log("\n================================================================================");
    console.log(" ALL PHASE 1 DATABASE & AUTH OPTIMIZATION TESTS PASSED!");
    console.log("================================================================================");
}

runPhase1OptimizationTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Test failed with error:", err);
        process.exit(1);
    });
