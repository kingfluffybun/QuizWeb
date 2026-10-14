/**
 * =============================================================================
 * Milestone 3 Adversarial Challenge Harness: tests/test-m3-adversarial.ts
 * =============================================================================
 * Focus: SEC-04 (Insecure OAuth Account Linking & Account Takeover Defense)
 * Author: m3_challenger_2
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import argon2 from "argon2";

const projectRoot = process.cwd();
const mainNodeModules = "/home/sankobite/QuizWeb/node_modules";
const localNodeModules = path.join(projectRoot, "node_modules");

if (!fs.existsSync(localNodeModules) && fs.existsSync(mainNodeModules)) {
    try {
        fs.symlinkSync(mainNodeModules, localNodeModules, "junction");
    } catch {
        if (!process.env.NODE_PATH) {
            process.env.NODE_PATH = mainNodeModules;
        }
    }
}

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test_secret_32_characters_minimum_length_for_jwt";
process.env.AUTH_GITHUB_ID = process.env.AUTH_GITHUB_ID || "test_github_client_id";
process.env.AUTH_GITHUB_SECRET = process.env.AUTH_GITHUB_SECRET || "test_github_client_secret";

interface UserAuthRow {
    user_id: number;
    email: string;
    password_hash: string | null;
    user_role: string;
    token_version: number;
    is_email_verified: number;
}

interface PlayerRow {
    player_id: number;
    user_id: number;
    username: string;
}

interface UserOAuthRow {
    oauth_id: number;
    user_id: number;
    provider_name: string;
    provider_account_id: string;
}

interface MockDatabaseState {
    users: UserAuthRow[];
    players: PlayerRow[];
    oauths: UserOAuthRow[];
    nextUserId: number;
    nextPlayerId: number;
    nextOAuthId: number;
}

let mockDb: MockDatabaseState;

async function resetMockDb() {
    const passwordHash = await argon2.hash("ValidPassword123!");
    mockDb = {
        users: [
            {
                user_id: 1,
                email: "admin@quizweb.dev",
                password_hash: passwordHash,
                user_role: "admin",
                token_version: 1,
                is_email_verified: 1,
            },
            {
                user_id: 2,
                email: "attacker@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
            {
                user_id: 3,
                email: "victim@quizweb.dev",
                password_hash: passwordHash,
                user_role: "user",
                token_version: 1,
                is_email_verified: 1,
            },
        ],
        players: [
            { player_id: 1, user_id: 1, username: "admin_user" },
            { player_id: 2, user_id: 2, username: "attacker_user" },
            { player_id: 3, user_id: 3, username: "victim_user" },
        ],
        oauths: [
            {
                oauth_id: 1,
                user_id: 2,
                provider_name: "github",
                provider_account_id: "attacker-gh-200",
            },
        ],
        nextUserId: 10,
        nextPlayerId: 10,
        nextOAuthId: 10,
    };
}

import { db } from "../lib/db";

db.query = (async (sql: string, params: unknown[] = []) => {
    // 1. SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ?
    if (sql.includes("SELECT user_id, user_role, token_version FROM user_auth_tbl WHERE email = ?")) {
        const email = String(params[0]);
        const user = mockDb.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return [[]];
        return [[{
            user_id: user.user_id,
            user_role: user.user_role,
            token_version: user.token_version,
        }]];
    }

    // 2. SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ?
    if (sql.includes("SELECT oauth_id, user_id FROM user_oauth_tbl WHERE provider_name = ? AND provider_account_id = ?")) {
        const providerName = String(params[0]);
        const providerAccountId = String(params[1]);
        const oauth = mockDb.oauths.find(
            (o) => o.provider_name === providerName && o.provider_account_id === providerAccountId
        );
        if (!oauth) return [[]];
        return [[{ oauth_id: oauth.oauth_id, user_id: oauth.user_id }]];
    }

    // 3. SELECT token_version FROM user_auth_tbl WHERE user_id = ?
    if (sql.includes("SELECT token_version FROM user_auth_tbl WHERE user_id = ?")) {
        const userId = Number(params[0]);
        const user = mockDb.users.find((u) => u.user_id === userId);
        if (!user) return [[]];
        return [[{ token_version: user.token_version }]];
    }

    // 4. INSERT INTO user_oauth_tbl
    if (sql.includes("INSERT INTO user_oauth_tbl")) {
        const userId = Number(params[0]);
        const providerName = String(params[1]);
        const providerAccountId = String(params[2]);
        const dup = mockDb.oauths.find(
            (o) => o.provider_name === providerName && o.provider_account_id === providerAccountId
        );
        if (dup) {
            const err = new Error(`ER_DUP_ENTRY: Duplicate entry '${providerName}-${providerAccountId}' for key 'idx_provider_account'`);
            (err as { code?: string }).code = "ER_DUP_ENTRY";
            throw err;
        }

        const newId = mockDb.nextOAuthId++;
        mockDb.oauths.push({
            oauth_id: newId,
            user_id: userId,
            provider_name: providerName,
            provider_account_id: providerAccountId,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 5. INSERT INTO user_auth_tbl
    if (sql.includes("INSERT INTO user_auth_tbl")) {
        const email = String(params[0]);
        const newId = mockDb.nextUserId++;
        mockDb.users.push({
            user_id: newId,
            email,
            password_hash: null,
            user_role: "user",
            token_version: 1,
            is_email_verified: 1,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    // 6. INSERT INTO player_tbl
    if (sql.includes("INSERT INTO player_tbl")) {
        const userId = Number(params[0]);
        const username = String(params[1]);
        const newId = mockDb.nextPlayerId++;
        mockDb.players.push({
            player_id: newId,
            user_id: userId,
            username,
        });
        return [{ affectedRows: 1, insertId: newId }];
    }

    return [{ affectedRows: 1, insertId: 999 }];
}) as unknown as typeof db.query;

interface TestFinding {
    id: string;
    description: string;
    vulnerabilityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "PASSED";
    reproduced: boolean;
    evidence: string;
}

const findings: TestFinding[] = [];

async function main() {
    console.log("\n========================================================");
    console.log(" Milestone 3 Adversarial Challenge: OAuth SEC-04 Defenses");
    console.log(" Standards: OWASP ASVS v4.0.3 Chapter 3 (V3.2.1, V3.6.1)");
    console.log("========================================================\n");

    const authModule = await import("../auth");
    const { authConfig } = authModule;
    const signInCallback = authConfig.callbacks!.signIn!;

    // -------------------------------------------------------------------------
    // Probe 1: Unauthenticated OAuth signIn for an existing email account
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
        const userObj = { id: "", email: "victim@quizweb.dev", name: "Attacker" };
        const accountObj = { provider: "google", providerAccountId: "unlinked-google-123" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const passed = res === false && mockDb.oauths.length === 1;
        findings.push({
            id: "PROBE-1",
            description: "Unauthenticated OAuth signIn for existing email account must be rejected",
            vulnerabilityLevel: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `signIn returned ${res}, oauth rows: ${mockDb.oauths.length}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 1: Unauthenticated OAuth signIn for existing email -> ${passed ? "REJECTED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 2: Authenticated OAuth signIn for an existing email account (self-linking)
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = {
            user: { id: "3", email: "victim@quizweb.dev" },
        };
        const userObj = { id: "", email: "victim@quizweb.dev", name: "Victim Real" };
        const accountObj = { provider: "google", providerAccountId: "victim-google-999" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const found = mockDb.oauths.find((o) => o.provider_account_id === "victim-google-999");
        const passed = res === true && found !== undefined && found.user_id === 3;
        findings.push({
            id: "PROBE-2",
            description: "Authenticated OAuth signIn for existing email account (self-linking) must be allowed and linked",
            vulnerabilityLevel: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `signIn returned ${res}, linked user_id: ${found?.user_id}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 2: Authenticated OAuth self-linking -> ${passed ? "LINKED (PASSED)" : "FAILED"}`);
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
    }

    // -------------------------------------------------------------------------
    // Probe 3: New user OAuth signIn (email does not exist in DB)
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
        const userObj = { id: "", email: "brandnew@quizweb.dev", name: "Brand New" };
        const accountObj = { provider: "github", providerAccountId: "brandnew-gh-555" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const newUser = mockDb.users.find((u) => u.email === "brandnew@quizweb.dev");
        const newPlayer = mockDb.players.find((p) => p.user_id === newUser?.user_id);
        const newOAuth = mockDb.oauths.find((o) => o.provider_account_id === "brandnew-gh-555");
        const passed = res === true && newUser !== undefined && newPlayer !== undefined && newOAuth?.user_id === newUser.user_id;
        findings.push({
            id: "PROBE-3",
            description: "New user OAuth signIn (email does not exist in DB) must be allowed and create new user",
            vulnerabilityLevel: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `signIn returned ${res}, created user: ${newUser?.user_id}, oauth user: ${newOAuth?.user_id}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 3: New user OAuth registration -> ${passed ? "CREATED & LINKED (PASSED)" : "FAILED"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 4: Adversarial cross-user linking attempt while authenticated
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = {
            user: { id: "2", email: "attacker@quizweb.dev" },
        };
        const userObj = { id: "", email: "victim@quizweb.dev", name: "Impersonator" };
        const accountObj = { provider: "google", providerAccountId: "attacker-google-new" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const found = mockDb.oauths.find((o) => o.provider_account_id === "attacker-google-new");
        const passed = res === false && found === undefined;
        findings.push({
            id: "PROBE-4",
            description: "Adversarial cross-user linking attempt while authenticated (User A claims User B's email) must be rejected",
            vulnerabilityLevel: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `signIn returned ${res}, oauth row created: ${Boolean(found)}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 4: Adversarial cross-user authenticated linking -> ${passed ? "BLOCKED (PASSED)" : "ALLOWED (FAILED)"}`);
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;
    }

    // -------------------------------------------------------------------------
    // Probe 5: Adversarial OAuth Account Takeover via Existing OAuth Link Collision
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // Attacker (user_id: 2) owns OAuth provider_account_id 'attacker-gh-200' linked in user_oauth_tbl.
        // Attacker initiates unauthenticated OAuth sign-in presenting Admin's email 'admin@quizweb.dev' (user_id: 1).
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "admin@quizweb.dev", name: "Sneaky Attacker" };
        const accountObj = { provider: "github", providerAccountId: "attacker-gh-200" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });

        // SEC-04 Vulnerability Test:
        // Does auth.ts permit login as User 1 (Admin) because existingOAuth was found in user_oauth_tbl,
        // without verifying that existingOAuth[0].user_id === userId?
        const takeoverSucceeded = (res === true && userObj.id === "1");
        findings.push({
            id: "PROBE-5",
            description: "Adversarial OAuth Hijack: OAuth account bound to User 2 must NOT permit unauthenticated login as User 1 (Admin)",
            vulnerabilityLevel: takeoverSucceeded ? "CRITICAL" : "PASSED",
            reproduced: takeoverSucceeded,
            evidence: `OAuth account 'attacker-gh-200' bound to user_id: 2. When presented with email 'admin@quizweb.dev', signIn returned ${res} and set user.id = '${userObj.id}' (role: ${(userObj as { role?: string }).role})`,
        });

        if (takeoverSucceeded) {
            console.log(`  \x1b[31m✖\x1b[0m Probe 5: Adversarial OAuth hijack -> VULNERABLE! Attacker logged in as User 1 (Admin) via User 2's OAuth link!`);
        } else {
            console.log(`  \x1b[32m✔\x1b[0m Probe 5: Adversarial OAuth hijack -> PREVENTED (PASSED)`);
        }
    }

    // -------------------------------------------------------------------------
    // Probe 6: Returning OAuth user with legitimate matching link
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // User 2 logs in with their own legitimate linked OAuth account
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "attacker@quizweb.dev", name: "Attacker User" };
        const accountObj = { provider: "github", providerAccountId: "attacker-gh-200" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const passed = res === true && userObj.id === "2";
        findings.push({
            id: "PROBE-6",
            description: "Returning OAuth user with matching own link allows sign-in",
            vulnerabilityLevel: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `signIn returned ${res}, user.id set to '${userObj.id}'`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 6: Legitimate returning OAuth sign-in -> ${passed ? "PERMITTED (PASSED)" : "FAILED"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 7: Provider Isolation (same providerAccountId on different provider)
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // 'attacker-gh-200' is linked on provider 'github'.
        // Attempt sign in with provider 'google' using same account ID.
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "attacker@quizweb.dev", name: "Attacker User" };
        const accountObj = { provider: "google", providerAccountId: "attacker-gh-200" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const passed = res === false; // Must be blocked as unlinked google provider
        findings.push({
            id: "PROBE-7",
            description: "Provider isolation: Provider account ID must not cross-authenticate across different OAuth providers",
            vulnerabilityLevel: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `signIn returned ${res} for cross-provider request`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 7: Provider isolation check -> ${passed ? "ISOLATED (PASSED)" : "FAILED"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 8: Type Coercion Resilience (String vs Number user_id in DB response)
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // Add an OAuth row where user_id is returned as string from DB driver
        mockDb.oauths.push({
            oauth_id: 20,
            user_id: "2" as unknown as number, // String type from driver
            provider_name: "github",
            provider_account_id: "string-coercion-user-2",
        });
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "attacker@quizweb.dev", name: "User 2" };
        const accountObj = { provider: "github", providerAccountId: "string-coercion-user-2" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        // Must succeed because String(existingOAuth[0].user_id) === String(userId) ("2" === "2")
        const passed = res === true && userObj.id === "2";
        findings.push({
            id: "PROBE-8",
            description: "Type coercion: String vs number user_id in DB record matches legitimately",
            vulnerabilityLevel: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `signIn returned ${res}, user.id: ${userObj.id}`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 8: Type coercion resilience (string vs number user_id) -> ${passed ? "MATCHED & PERMITTED (PASSED)" : "FAILED"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 9: Boundary Condition: Missing or Empty providerAccountId
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "admin@quizweb.dev", name: "Empty Account ID" };
        const accountObj = { provider: "github", providerAccountId: "" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        // Empty providerAccountId is not linked, and unauthenticated -> must fail closed
        const passed = res === false;
        findings.push({
            id: "PROBE-9",
            description: "Boundary condition: Empty providerAccountId with existing email must fail-closed",
            vulnerabilityLevel: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `signIn returned ${res} for empty providerAccountId`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 9: Empty providerAccountId boundary check -> ${passed ? "FAIL-CLOSED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 10: Strict Numeric/String Identity Check (No Prefix / Loose Bypass)
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // User 1 (Admin) exists. Add User 10 with email user10@quizweb.dev and OAuth link.
        mockDb.users.push({
            user_id: 10,
            email: "user10@quizweb.dev",
            password_hash: null,
            user_role: "user",
            token_version: 1,
            is_email_verified: 1,
        });
        mockDb.oauths.push({
            oauth_id: 10,
            user_id: 10,
            provider_name: "github",
            provider_account_id: "user10-gh",
        });
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        // Attacker owning user 10's OAuth link presents user 1's email (admin@quizweb.dev)
        const userObj = { id: "", email: "admin@quizweb.dev", name: "Prefix Attacker" };
        const accountObj = { provider: "github", providerAccountId: "user10-gh" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        // String("10") !== String("1") -> must reject
        const passed = res === false && userObj.id !== "1";
        findings.push({
            id: "PROBE-10",
            description: "Strict identity: User ID 10 OAuth link cannot take over User ID 1",
            vulnerabilityLevel: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `signIn returned ${res}, user.id set to '${userObj.id}'`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 10: Strict ID distinction ('10' vs '1') -> ${passed ? "PREVENTED (PASSED)" : "HIJACKED (FAILED)"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 11: Stolen OAuth Collision on Brand New Account Registration
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // Attacker presents OAuth credentials already bound to user 2 ('attacker-gh-200'),
        // but uses a non-existent new email 'brandnew-unlinked@quizweb.dev'
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "brandnew-unlinked@quizweb.dev", name: "Brand New" };
        const accountObj = { provider: "github", providerAccountId: "attacker-gh-200" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        // DB ER_DUP_ENTRY must be caught and signIn must return false
        const passed = res === false;
        findings.push({
            id: "PROBE-11",
            description: "OAuth collision: Re-registering existing OAuth link under brand new email fails closed",
            vulnerabilityLevel: passed ? "PASSED" : "HIGH",
            reproduced: !passed,
            evidence: `signIn returned ${res} on duplicate OAuth registration`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 11: Duplicate OAuth registration collision -> ${passed ? "FAIL-CLOSED (PASSED)" : "ALLOWED (FAILED)"}`);
    }

    // -------------------------------------------------------------------------
    // Probe 12: Case-Insensitive Email Hijack Resistance
    // -------------------------------------------------------------------------
    await resetMockDb();
    {
        // Target is admin@quizweb.dev (user_id: 1).
        // Attacker presents uppercase ADMIN@QUIZWEB.DEV with user 2's OAuth link.
        (globalThis as unknown as { __TEST_AUTH_SESSION__?: unknown }).__TEST_AUTH_SESSION__ = null;

        const userObj = { id: "", email: "ADMIN@QUIZWEB.DEV", name: "Case Attacker" };
        const accountObj = { provider: "github", providerAccountId: "attacker-gh-200" };

        const res = await signInCallback({ user: userObj, account: accountObj as never });
        const passed = res === false && userObj.id !== "1";
        findings.push({
            id: "PROBE-12",
            description: "Case-insensitive email: Uppercase email presentation with mismatched OAuth link is blocked",
            vulnerabilityLevel: passed ? "PASSED" : "CRITICAL",
            reproduced: !passed,
            evidence: `signIn returned ${res}, user.id set to '${userObj.id}'`,
        });
        console.log(`  ${passed ? "\x1b[32m✔\x1b[0m" : "\x1b[31m✖\x1b[0m"} Probe 12: Case-insensitive email hijack attempt -> ${passed ? "PREVENTED (PASSED)" : "HIJACKED (FAILED)"}`);
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log("\n========================================================");
    const criticals = findings.filter((f) => f.vulnerabilityLevel === "CRITICAL");
    const passedCount = findings.filter((f) => f.vulnerabilityLevel === "PASSED").length;

    console.log(` Verification Summary: ${passedCount}/${findings.length} Probes Passed`);
    if (criticals.length > 0) {
        console.log(` \x1b[31mVERDICT: DEFECTS_FOUND\x1b[0m (${criticals.length} Critical Defect(s) Identified)`);
        for (const crit of criticals) {
            console.log(`\n \x1b[31m[CRITICAL DEFECT] ${crit.id}\x1b[0m: ${crit.description}`);
            console.log(`   Evidence: ${crit.evidence}`);
        }
    } else {
        console.log(` \x1b[32mVERDICT: CONFIRM_CORRECTNESS\x1b[0m`);
    }
    console.log("========================================================\n");
}

main().catch((err) => {
    console.error("Adversarial harness fatal error:", err);
    process.exit(1);
});
