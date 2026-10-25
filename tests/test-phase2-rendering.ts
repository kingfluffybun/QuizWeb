import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

console.log("================================================================================");
console.log(" Running Phase 2: Next.js Rendering & Static Acceleration Verification Suite");
console.log("================================================================================");

const repoRoot = path.resolve(__dirname, "..");

// -----------------------------------------------------------------------------
// Test 1: Google Font Optimization in app/layout.tsx
// -----------------------------------------------------------------------------
console.log("\n[Test 1] Verifying Google Font Optimization in app/layout.tsx...");

const layoutPath = path.join(repoRoot, "app", "layout.tsx");
assert(fs.existsSync(layoutPath), "app/layout.tsx must exist");
const layoutContent = fs.readFileSync(layoutPath, "utf-8");

// Check Poppins
const poppinsMatch = layoutContent.match(/Poppins\s*\(\s*\{([\s\S]*?)\}\s*\)/);
assert(poppinsMatch, "Poppins font configuration must exist in app/layout.tsx");
const poppinsConfig = poppinsMatch[1];
assert(poppinsConfig.includes('display: "swap"'), "Poppins must specify display: 'swap'");
assert(
    poppinsConfig.includes("['400', '500', '600', '700', '800']"),
    "Poppins must only request weights 400, 500, 600, 700, 800"
);
assert(!poppinsConfig.includes("'100'") && !poppinsConfig.includes("'200'") && !poppinsConfig.includes("'300'") && !poppinsConfig.includes("'900'"),
    "Poppins must eliminate unused weights 100, 200, 300, 900"
);

// Check Montserrat
const montserratMatch = layoutContent.match(/Montserrat\s*\(\s*\{([\s\S]*?)\}\s*\)/);
assert(montserratMatch, "Montserrat font configuration must exist in app/layout.tsx");
const montserratConfig = montserratMatch[1];
assert(montserratConfig.includes('display: "swap"'), "Montserrat must specify display: 'swap'");
assert(
    montserratConfig.includes("['400', '500', '600', '700', '800']"),
    "Montserrat must only request weights 400, 500, 600, 700, 800"
);
assert(!montserratConfig.includes("'100'") && !montserratConfig.includes("'200'") && !montserratConfig.includes("'300'") && !montserratConfig.includes("'900'"),
    "Montserrat must eliminate unused weights 100, 200, 300, 900"
);

// Check JetBrains_Mono
const jetBrainsMatch = layoutContent.match(/JetBrains_Mono\s*\(\s*\{([\s\S]*?)\}\s*\)/);
assert(jetBrainsMatch, "JetBrains_Mono font configuration must exist in app/layout.tsx");
const jetBrainsConfig = jetBrainsMatch[1];
assert(jetBrainsConfig.includes('display: "swap"'), "JetBrains_Mono must specify display: 'swap'");
assert(
    jetBrainsConfig.includes("['400', '500', '600', '700']"),
    "JetBrains_Mono must request weights 400, 500, 600, 700"
);

console.log("✔ Google fonts (Poppins, Montserrat, JetBrains_Mono) verified with display: 'swap' and pruned weights.");

// -----------------------------------------------------------------------------
// Test 2: Decoupled Session Provision & RootLayout
// -----------------------------------------------------------------------------
console.log("\n[Test 2] Verifying Decoupled Session Provision & RootLayout in app/layout.tsx...");

assert(!layoutContent.includes("await auth()"), "RootLayout must NOT call await auth()");
assert(!layoutContent.includes('from "@/auth"') && !layoutContent.includes("from '@/auth'"), "RootLayout must NOT import from @/auth");
assert(!/export\s+default\s+async\s+function\s+RootLayout/.test(layoutContent), "RootLayout must be a synchronous function (not async)");
assert(/export\s+default\s+function\s+RootLayout/.test(layoutContent), "RootLayout must be exported as a standard function component");
assert(layoutContent.includes("<SessionWrapper>"), "RootLayout must wrap tree in <SessionWrapper>");

const sessionWrapperPath = path.join(repoRoot, "app", "components", "SessionWrapper.tsx");
assert(fs.existsSync(sessionWrapperPath), "app/components/SessionWrapper.tsx must exist");
const sessionWrapperContent = fs.readFileSync(sessionWrapperPath, "utf-8");

assert(sessionWrapperContent.startsWith('"use client";') || sessionWrapperContent.startsWith("'use client';"), "SessionWrapper must have 'use client' directive");
assert(sessionWrapperContent.includes("<SessionProvider"), "SessionWrapper must render <SessionProvider>");

console.log("✔ RootLayout decoupled from eager auth() and wired to isolated client SessionWrapper.");

// -----------------------------------------------------------------------------
// Test 3: Static Pre-rendering Verification via Prerender Manifest
// -----------------------------------------------------------------------------
console.log("\n[Test 3] Verifying Static Pre-rendering & ISR via Next.js Prerender Manifest...");

const prerenderManifestPath = path.join(repoRoot, ".next", "prerender-manifest.json");
assert(fs.existsSync(prerenderManifestPath), ".next/prerender-manifest.json must exist (run npm run build first)");
const prerenderManifest = JSON.parse(fs.readFileSync(prerenderManifestPath, "utf-8"));
const routes = prerenderManifest.routes;

// Required static routes
const expectedStaticRoutes = [
    "/",
    "/_not-found",
    "/about",
    "/cheat-sheet",
    "/login",
    "/profile",
    "/quiz-cp",
];

for (const route of expectedStaticRoutes) {
    assert(routes[route], `Route '${route}' must be in prerender-manifest.json`);
    assert.strictEqual(routes[route].compute, "static", `Route '${route}' must be statically computed`);
    console.log(`  ✔ ${route} is statically pre-rendered (htmlSize: ${routes[route].htmlSize} bytes)`);
}

// ISR Route
assert(routes["/learn"], "Route '/learn' must be in prerender-manifest.json");
assert.strictEqual(routes["/learn"].initialRevalidateSeconds, 3600, "Route '/learn' must have 3600s ISR revalidation");
console.log(`  ✔ /learn is ISR pre-rendered with 3600s revalidate (htmlSize: ${routes["/learn"].htmlSize} bytes)`);

// Authenticated/dynamic routes MUST NOT be in static prerender-manifest
const dynamicRoutes = [
    "/home",
    "/admin",
    "/maintainer",
    "/pending",
    "/input",
    "/leaderboard",
    "/settings",
    "/post-login",
    "/quiz",
];

for (const route of dynamicRoutes) {
    assert(!routes[route], `Dynamic/Authenticated route '${route}' must NOT be statically pre-rendered`);
    console.log(`  ✔ ${route} is correctly dynamic SSR (not present in static prerender manifest)`);
}

// -----------------------------------------------------------------------------
// Test 4: Verify SessionWrapper Component Exports and Forwarding
// -----------------------------------------------------------------------------
console.log("\n[Test 4] Verifying SessionWrapper Component Structure...");

import("../app/components/SessionWrapper").then((module) => {
    assert(typeof module.default === "function", "SessionWrapper default export must be a valid React component function");
    console.log("✔ SessionWrapper component module loaded and validated.");

    console.log("\n================================================================================");
    console.log(" ALL PHASE 2 RENDERING & STATIC ACCELERATION TESTS PASSED!");
    console.log("================================================================================\n");
}).catch((err) => {
    console.error("Failed to load SessionWrapper module:", err);
    process.exit(1);
});
