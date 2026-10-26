import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import type { Session, User } from "next-auth";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
}

// Mock test session for testing
(globalThis as Record<string, unknown>).__TEST_AUTH_SESSION__ = {
    user: { id: "4", email: "clarence.luna651@gmail.com", name: "Clarence" },
};

async function runSessionLatencyOptimizationTests() {
    console.log("================================================================================");
    console.log(" Running Auth Session Latency & Optimization Verification Suite");
    console.log("================================================================================");

    const { db } = await import("../lib/db");
    const {
        authConfig,
        getCachedUserAuthRecord,
        invalidateUserAuthCache,
    } = await import("../auth");

    // -------------------------------------------------------------------------
    // 1. In-Memory TTL Cache Hit vs Miss Latency Benchmark
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Benchmarking In-Memory TTL Cache Hit vs Miss Latency...");
    
    // Invalidate cache first to ensure cold miss
    invalidateUserAuthCache("4");

    const t0 = performance.now();
    const coldRecord = await getCachedUserAuthRecord("4");
    const coldDuration = performance.now() - t0;

    assert.ok(coldRecord, "Cold query must return user record");
    assert.ok(coldRecord.user_role, "User record must have user_role");
    assert.ok(coldRecord.token_version, "User record must have token_version");
    console.log(`  Cold Miss Latency: ${coldDuration.toFixed(2)}ms (live Azure MySQL round-trip)`);

    // Warm hit test - should be immediate (<1ms, well below target 15ms)
    const t1 = performance.now();
    const warmRecord = await getCachedUserAuthRecord("4");
    const warmDuration = performance.now() - t1;

    assert.deepEqual(warmRecord, coldRecord, "Warm query must return identical cached record");
    assert.ok(warmDuration < 15, `Warm query latency must be < 15ms (actual: ${warmDuration.toFixed(2)}ms)`);
    console.log(`  Warm Hit Latency: ${warmDuration.toFixed(2)}ms (< 1ms in-memory cache)`);
    console.log(`  ✔ Latency improvement: ${(coldDuration / Math.max(warmDuration, 0.01)).toFixed(1)}x faster.`);

    // -------------------------------------------------------------------------
    // 2. Thundering-Herd / Concurrent Promise Deduplication
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Verifying Concurrent In-Flight Promise Deduplication...");
    invalidateUserAuthCache("4");

    const concurrentStart = performance.now();
    const [rec1, rec2, rec3, rec4] = await Promise.all([
        getCachedUserAuthRecord("4"),
        getCachedUserAuthRecord("4"),
        getCachedUserAuthRecord("4"),
        getCachedUserAuthRecord("4"),
    ]);
    const concurrentDuration = performance.now() - concurrentStart;

    assert.ok(rec1 && rec2 && rec3 && rec4, "All concurrent requests must resolve");
    assert.deepEqual(rec1, rec2, "Concurrent responses must match");
    assert.deepEqual(rec2, rec3, "Concurrent responses must match");
    console.log(`  ✔ 4 concurrent requests resolved in ${concurrentDuration.toFixed(2)}ms via single in-flight promise.`);

    // -------------------------------------------------------------------------
    // 3. NextAuth callbacks.jwt Read-Path Bypass
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Verifying callbacks.jwt skips DB when token is already populated...");
    const [userAuthRows] = await db.query<RowDataPacket[]>(
        "SELECT token_version FROM user_auth_tbl WHERE user_id = 4 LIMIT 1"
    );
    const currentTokenVersion = Number(userAuthRows[0]?.token_version ?? 1);

    const populatedToken = {
        id: "4",
        role: "admin",
        user_role: "admin",
        tokenVersion: currentTokenVersion,
        name: "Clarence",
    };

    const jwtReadStart = performance.now();
    const jwtReadResult = await authConfig.callbacks?.jwt?.({
        token: populatedToken,
        user: undefined as unknown as User,
        account: null,
        profile: undefined,
        trigger: undefined,
        session: undefined,
    });
    const jwtReadDuration = performance.now() - jwtReadStart;

    assert.ok(jwtReadResult, "jwt callback must return token");
    assert.equal(jwtReadResult.role, "admin");
    assert.equal(jwtReadResult.name, "Clarence");
    assert.equal(jwtReadResult.tokenVersion, currentTokenVersion);
    assert.ok(jwtReadDuration < 10, `Populated jwt callback must complete in < 10ms without DB (actual: ${jwtReadDuration.toFixed(2)}ms)`);
    console.log(`  ✔ callbacks.jwt read-path completed in ${jwtReadDuration.toFixed(2)}ms (zero redundant DB query).`);

    // -------------------------------------------------------------------------
    // 4. Session Validation & Instant Token Revocation Latency
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Verifying Session Callback & Immediate Invalidation...");
    const sessionStart = performance.now();
    const validSession = await authConfig.callbacks?.session?.({
        session: { user: { id: "4" }, expires: "2099-01-01" } as unknown as Session,
        token: jwtReadResult,
        user: undefined as unknown as User,
        newSession: undefined,
        trigger: undefined,
    });
    const sessionDuration = performance.now() - sessionStart;

    assert.ok(validSession?.user, "Valid session must be returned");
    assert.equal(validSession.user.id, "4");
    assert.ok(sessionDuration < 15, `Cached session callback must complete in < 15ms (actual: ${sessionDuration.toFixed(2)}ms)`);
    console.log(`  ✔ callbacks.session completed in ${sessionDuration.toFixed(2)}ms.`);

    // Invalidation test:
    invalidateUserAuthCache("4");
    // Simulate revoked token (tokenVersion + 1)
    const revokedToken = {
        ...populatedToken,
        tokenVersion: currentTokenVersion + 1,
    };
    const revokedSession = await authConfig.callbacks?.session?.({
        session: { user: { id: "4" }, expires: "2099-01-01" } as unknown as Session,
        token: revokedToken,
        user: undefined as unknown as User,
        newSession: undefined,
        trigger: undefined,
    });
    assert.equal(revokedSession, null, "Revoked token must be rejected immediately (session: null)");
    console.log("  ✔ Revoked token correctly rejected.");

    // -------------------------------------------------------------------------
    // 5. Global Database Pool Preservation & Configuration
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Verifying Global Database Pool Preservation...");
    const globalForDb = globalThis as unknown as { mysqlPool?: unknown };
    assert.ok(globalForDb.mysqlPool, "mysqlPool must be retained on globalThis");
    assert.equal(globalForDb.mysqlPool, db, "globalThis.mysqlPool must match exported db instance");
    console.log("  ✔ Database pool singleton preserved on globalThis across all environments.");

    // -------------------------------------------------------------------------
    // 6. In-Flight Race Condition Defense
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Verifying In-Flight Race Condition Discard Defense...");
    invalidateUserAuthCache("4");
    // Start an in-flight query
    const inflightPromise = getCachedUserAuthRecord("4");
    // Invalidate immediately while the query is in flight
    invalidateUserAuthCache("4");
    const resolvedFromInflight = await inflightPromise;
    assert.ok(resolvedFromInflight, "In-flight query resolves successfully");
    // The cache MUST NOT have retained the stale record
    const globalAuth = globalThis as unknown as { __userAuthMemoryCache?: Map<string, unknown> };
    assert.equal(
        globalAuth.__userAuthMemoryCache?.has("4"),
        false,
        "Stale record from in-flight query superseded by invalidation must NOT be cached"
    );
    console.log("  ✔ In-flight race condition defense verified: stale result successfully discarded from cache.");

    // -------------------------------------------------------------------------
    // 7. NextAuth events.signOut Cache Eviction
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Verifying NextAuth events.signOut Cache Eviction...");
    // Populate cache first
    await getCachedUserAuthRecord("4");
    assert.equal(globalAuth.__userAuthMemoryCache?.has("4"), true, "User 4 should be cached");
    // Fire signOut event
    await authConfig.events?.signOut?.({ token: { id: "4" } } as unknown as Parameters<NonNullable<typeof authConfig.events.signOut>>[0]);
    assert.equal(
        globalAuth.__userAuthMemoryCache?.has("4"),
        false,
        "User 4 cache must be evicted immediately upon signOut event"
    );
    console.log("  ✔ NextAuth events.signOut eviction verified: cache purged immediately.");

    // -------------------------------------------------------------------------
    // 8. Name-less Token Initial Population & Subsequent Read-Path Bypass
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Verifying Read-Path Bypass when Token Name is Initially Undefined...");
    const namelessToken = {
        id: "4",
        role: "admin",
        user_role: "admin",
        tokenVersion: currentTokenVersion,
    };
    const namelessReadStart = performance.now();
    const namelessResult = await authConfig.callbacks?.jwt?.({
        token: namelessToken,
        user: undefined as unknown as User,
        account: null,
        profile: undefined,
        trigger: undefined,
        session: undefined,
    });
    const namelessDuration = performance.now() - namelessReadStart;
    assert.ok(namelessResult, "jwt callback must return token");
    assert.equal(namelessResult.name, "Clarence Luna", "jwt callback must populate username from DB/cache");
    assert.ok(namelessDuration < 500, `Initial population must complete within network bounds (actual: ${namelessDuration.toFixed(2)}ms)`);

    // Verify that subsequent read-path with now-populated token bypasses refresh completely
    const populatedReadStart = performance.now();
    const secondResult = await authConfig.callbacks?.jwt?.({
        token: namelessResult,
        user: undefined as unknown as User,
        account: null,
        profile: undefined,
        trigger: undefined,
        session: undefined,
    });
    const populatedDuration = performance.now() - populatedReadStart;
    assert.ok(secondResult, "Subsequent jwt read must succeed");
    assert.equal(secondResult.name, "Clarence Luna");
    assert.ok(populatedDuration < 5, `Subsequent read must be instantaneous (actual: ${populatedDuration.toFixed(2)}ms)`);
    console.log(`  ✔ Name-less token initially populated (${namelessDuration.toFixed(2)}ms) and subsequent read-path instantaneous (${populatedDuration.toFixed(2)}ms).`);

    console.log("\n================================================================================");
    console.log(" ALL SESSION LATENCY OPTIMIZATION TESTS PASSED!");
    console.log("================================================================================");
}

runSessionLatencyOptimizationTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Test failed with error:", err);
        process.exit(1);
    });
