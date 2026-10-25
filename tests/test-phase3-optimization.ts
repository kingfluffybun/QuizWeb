import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

console.log("================================================================================");
console.log(" Running Phase 3: Client Bundle & Asset Optimization Verification Suite");
console.log("================================================================================");

const repoRoot = path.resolve(__dirname, "..");

// -----------------------------------------------------------------------------
// Test 1: Dynamic Monaco Imports in quiz-cp and input
// -----------------------------------------------------------------------------
console.log("\n[Test 1] Verifying Dynamic Monaco Editor Imports in quiz-cp and input...");

const quizCpPath = path.join(repoRoot, "app", "quiz-cp", "page.tsx");
assert(fs.existsSync(quizCpPath), "app/quiz-cp/page.tsx must exist");
const quizCpContent = fs.readFileSync(quizCpPath, "utf-8");

assert(
    !quizCpContent.includes('import Editor from "@monaco-editor/react"'),
    "app/quiz-cp/page.tsx must NOT statically import @monaco-editor/react"
);
assert(
    quizCpContent.includes('dynamic(() => import("@monaco-editor/react")') ||
    quizCpContent.includes("dynamic(() => import('@monaco-editor/react')"),
    "app/quiz-cp/page.tsx must dynamically import @monaco-editor/react"
);
assert(quizCpContent.includes("ssr: false"), "app/quiz-cp/page.tsx dynamic import must specify ssr: false");

console.log("  ✔ app/quiz-cp/page.tsx dynamically code-splits Monaco Editor (ssr: false).");

const inputFormPath = path.join(repoRoot, "app", "input", "QuizInputForm.tsx");
assert(fs.existsSync(inputFormPath), "app/input/QuizInputForm.tsx must exist");
const inputFormContent = fs.readFileSync(inputFormPath, "utf-8");

assert(
    !inputFormContent.includes('import Editor from "@monaco-editor/react"'),
    "app/input/QuizInputForm.tsx must NOT statically import @monaco-editor/react"
);
assert(
    inputFormContent.includes('dynamic(() => import("@monaco-editor/react")') ||
    inputFormContent.includes("dynamic(() => import('@monaco-editor/react')"),
    "app/input/QuizInputForm.tsx must dynamically import @monaco-editor/react"
);
assert(inputFormContent.includes("ssr: false"), "app/input/QuizInputForm.tsx dynamic import must specify ssr: false");

console.log("  ✔ app/input/QuizInputForm.tsx dynamically code-splits Monaco Editor (ssr: false).");

// -----------------------------------------------------------------------------
// Test 2: Global Check - Zero Static Monaco Imports in Entire app/ Directory
// -----------------------------------------------------------------------------
console.log("\n[Test 2] Verifying Zero Static Monaco Imports Across app/ Directory...");

function scanDirForStaticMonaco(dir: string): string[] {
    const violations: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            violations.push(...scanDirForStaticMonaco(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (
                content.includes('import Editor from "@monaco-editor/react"') ||
                content.includes("import Editor from '@monaco-editor/react'")
            ) {
                violations.push(fullPath);
            }
        }
    }
    return violations;
}

const staticMonacoViolations = scanDirForStaticMonaco(path.join(repoRoot, "app"));
assert.strictEqual(
    staticMonacoViolations.length,
    0,
    `Found static Monaco imports in: ${staticMonacoViolations.join(", ")}`
);

console.log("  ✔ 100% of Monaco Editor usages in app/ are dynamically imported.");

// -----------------------------------------------------------------------------
// Test 3: Static Asset Immutable Caching Headers in next.config.ts
// -----------------------------------------------------------------------------
console.log("\n[Test 3] Verifying Static Asset Caching Headers in next.config.ts...");

const nextConfigPath = path.join(repoRoot, "next.config.ts");
assert(fs.existsSync(nextConfigPath), "next.config.ts must exist");
const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");

assert(nextConfigContent.includes('source: "/assets/:path*"'), "next.config.ts must define header rule for /assets/:path*");
assert(
    nextConfigContent.includes("max-age=31536000") && nextConfigContent.includes("immutable"),
    "next.config.ts must configure immutable 1-year caching for /assets/:path*"
);

console.log("  ✔ next.config.ts verified with 'public, max-age=31536000, immutable' for /assets/:path*.");

console.log("\n================================================================================");
console.log(" ALL PHASE 3 CLIENT BUNDLE & ASSET OPTIMIZATION TESTS PASSED!");
console.log("================================================================================\n");
