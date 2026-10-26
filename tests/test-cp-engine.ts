import assert from "node:assert/strict";
import {
  CodeProblemAssessmentSchema,
  toPublicCodeProblem,
  unwrapCodeProblemAssessment,
  wrapCodeProblemAssessmentForStorage,
  type CodeProblemAssessment,
} from "../lib/cp-schema.ts";
import {
  validateCodeProblemStep,
  validateSingleTabTemplate,
} from "../lib/cp-validator.ts";

let passedCount = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    throw err;
  }
}

console.log("=== Running Code Problem (CP) Engine Test Suite ===");

const skeletonFinalTemplate = `<!DOCTYPE HTML>
<HTML>
    <HEAD>
        <TITLE>####</TITLE>
    </HEAD>
    <BODY>
    </BODY>
</HTML>`;

// 1. Indentation & Whitespace Normalization
test("Edge Case 1: 2 spaces vs 4 spaces vs Tabs vs Single-line all PASS", () => {
  const singleLine =
    "<!DOCTYPE HTML><HTML><HEAD><TITLE>My Site</TITLE></HEAD><BODY></BODY></HTML>";
  const twoSpace =
    "<!DOCTYPE HTML>\n<HTML>\n  <HEAD>\n    <TITLE>My Site</TITLE>\n  </HEAD>\n  <BODY>\n  </BODY>\n</HTML>";
  const tabIndented =
    "<!DOCTYPE HTML>\n<HTML>\n\t<HEAD>\n\t\t<TITLE>My Site</TITLE>\n\t</HEAD>\n\t<BODY></BODY>\n</HTML>";

  assert.equal(
    validateSingleTabTemplate(singleLine, skeletonFinalTemplate, "html").passed,
    true,
  );
  assert.equal(
    validateSingleTabTemplate(twoSpace, skeletonFinalTemplate, "html").passed,
    true,
  );
  assert.equal(
    validateSingleTabTemplate(tabIndented, skeletonFinalTemplate, "html").passed,
    true,
  );
});

// 2. CRLF vs LF & Blank lines
test("Edge Case 2: CRLF (\\r\\n) and extra blank lines between tags PASS", () => {
  const crlfInput =
    "\r\n<!DOCTYPE HTML>\r\n\r\n<HTML>\r\n    <HEAD>\r\n\r\n        <TITLE>Hello World</TITLE>\r\n    </HEAD>\r\n    <BODY>\r\n\r\n    </BODY>\r\n</HTML>\r\n";
  const res = validateSingleTabTemplate(crlfInput, skeletonFinalTemplate, "html");
  assert.equal(res.passed, true);
  assert.deepEqual(res.capturedWildcards, ["Hello World"]);
});

// 3. Missing required space between keywords
test("Edge Case 3: Missing required space in <!DOCTYPEHTML> FAILS with line diagnostic", () => {
  const res = validateSingleTabTemplate(
    "<!DOCTYPEHTML>",
    "<!DOCTYPE HTML>",
    "html",
  );
  assert.equal(res.passed, false);
  assert.match(res.message, /Missing required space/i);
});

// 4. HTML Case Insensitivity
test("Edge Case 4: Lowercase or mixed-case HTML tags PASS <!DOCTYPE HTML> & <HTML>", () => {
  const lowerInput = `<!doctype html>
<html>
  <head>
    <title>QuizWeb Page</title>
  </head>
  <body></body>
</html>`;
  const res = validateSingleTabTemplate(
    lowerInput,
    skeletonFinalTemplate,
    "html",
  );
  assert.equal(res.passed, true);
});

// 5. JS Strict Case Sensitivity
test("Edge Case 5: JavaScript tab enforces strict case sensitivity on keywords & literals", () => {
  const expectedJs = `const #### = "HelloWorld";`;
  const validJs = `const userTitle = "HelloWorld";`;
  const wrongKeywordCase = `CONST userTitle = "HelloWorld";`;
  const wrongStringCase = `const userTitle = "helloworld";`;

  assert.equal(
    validateSingleTabTemplate(validJs, expectedJs, "js").passed,
    true,
  );
  assert.equal(
    validateSingleTabTemplate(wrongKeywordCase, expectedJs, "js").passed,
    false,
  );
  assert.equal(
    validateSingleTabTemplate(wrongStringCase, expectedJs, "js").passed,
    false,
  );
});

// 6. Empty Wildcard
test("Edge Case 6: Empty wildcard (<TITLE></TITLE>) FAILS with targeted diagnostic", () => {
  const emptyTitle = `<!DOCTYPE HTML><HTML><HEAD><TITLE></TITLE></HEAD><BODY></BODY></HTML>`;
  const res = validateSingleTabTemplate(
    emptyTitle,
    skeletonFinalTemplate,
    "html",
  );
  assert.equal(res.passed, false);
  assert.match(res.message, /Wildcard content inside <TITLE> cannot be empty/i);
});

// 7. Whitespace-only Wildcard
test("Edge Case 7: Whitespace-only wildcard (<TITLE>   \\n  </TITLE>) FAILS", () => {
  const wsTitle = `<!DOCTYPE HTML><HTML><HEAD><TITLE>   \n\t  </TITLE></HEAD><BODY></BODY></HTML>`;
  const res = validateSingleTabTemplate(
    wsTitle,
    skeletonFinalTemplate,
    "html",
  );
  assert.equal(res.passed, false);
  assert.match(
    res.message,
    /Wildcard content inside <TITLE> cannot be empty or whitespace-only/i,
  );
});

// 8. Multi-word + punctuation in wildcard
test("Edge Case 8: Multi-word + punctuation inside #### wildcard PASSES", () => {
  const richTitle = `<!DOCTYPE HTML><HTML><HEAD><TITLE>My 1st Website: QuizWeb (2026)!</TITLE></HEAD><BODY></BODY></HTML>`;
  const res = validateSingleTabTemplate(
    richTitle,
    skeletonFinalTemplate,
    "html",
  );
  assert.equal(res.passed, true);
  assert.deepEqual(res.capturedWildcards, [
    "My 1st Website: QuizWeb (2026)!",
  ]);
});

// 9. Multiple #### wildcards on the same line (greedy runaway prevention)
test("Edge Case 9: Multiple #### wildcards on the same line (<a href=\"####\">####</a>) PASS without greedy runaway", () => {
  const tpl = `<a href="####">####</a>`;
  const student = `<a href="https://quizweb.dev">Start Learning</a>`;
  const res = validateSingleTabTemplate(student, tpl, "html");
  assert.equal(res.passed, true);
  assert.deepEqual(res.capturedWildcards, [
    "https://quizweb.dev",
    "Start Learning",
  ]);
});

// 10. Same-line multi-wildcard with second slot empty
test("Edge Case 10: Multi-wildcard where second #### is whitespace-only FAILS", () => {
  const tpl = `<a href="####">####</a>`;
  const student = `<a href="https://quizweb.dev">   </a>`;
  const res = validateSingleTabTemplate(student, tpl, "html");
  assert.equal(res.passed, false);
  assert.match(res.message, /cannot be empty/i);
});

// 11. Tag Injection Breakout Attack inside ####
test("Edge Case 11: Tag injection (<TITLE>Hi</TITLE><SCRIPT>alert(1)</SCRIPT><TITLE>Bye</TITLE>) FAILS", () => {
  const injected = `<!DOCTYPE HTML><HTML><HEAD><TITLE>Hi</TITLE><SCRIPT>alert(1)</SCRIPT><TITLE>Bye</TITLE></HEAD><BODY></BODY></HTML>`;
  const res = validateSingleTabTemplate(
    injected,
    skeletonFinalTemplate,
    "html",
  );
  assert.equal(res.passed, false);
});

// 12. Out-of-order / Missing closing tag diagnostic
test("Edge Case 12: Missing </HEAD> closing tag or swapped <BODY>/<HEAD> FAILS with pinpoint message", () => {
  const missingCloseHead = `<!DOCTYPE HTML>\n<HTML>\n  <HEAD>\n    <TITLE>Test</TITLE>\n  <BODY>\n  </BODY>\n</HTML>`;
  const res = validateSingleTabTemplate(
    missingCloseHead,
    skeletonFinalTemplate,
    "html",
  );
  assert.equal(res.passed, false);
  assert.match(res.message, /<\/HEAD>/i);
});

// 13. Blank Expected Tab Enforcement across 3 tabs (html, css, js)
test("Edge Case 13: Non-empty student CSS/JS FAILS when expected CSS/JS template is blank", () => {
  const expected = {
    html: "<!DOCTYPE HTML>",
    css: "",
    js: "",
  };
  const studentWithStrayCss = {
    html: "<!DOCTYPE HTML>",
    css: "body { color: red; }",
    js: "",
  };
  const res = validateCodeProblemStep(studentWithStrayCss, expected);
  assert.equal(res.passed, false);
  assert.equal(res.failedTab, "css");
  assert.match(res.message, /style\.css.*must remain empty/i);
});

// 14. CodeProblemAssessment + Round-Trip Storage Wrapper + Public/Private Stripping
test("Edge Case 14: Strips expectedTemplate in Public payload and round-trips storage wrappers", () => {
  const assessmentData: CodeProblemAssessment = {
    schemaVersion: 2,
    title: "HTML Skeleton",
    description: "Build an HTML Skeleton",
    steps: [
      {
        stepNumber: 1,
        instruction: "Add doctype",
        starterCode: { html: "", css: "", js: "" },
        expectedTemplate: { html: "<!DOCTYPE html>", css: "", js: "" },
        inheritPreviousCode: false,
      },
      {
        stepNumber: 2,
        instruction: "Add html tag",
        starterCode: { html: "", css: "", js: "" },
        expectedTemplate: { html: "<html>\n####\n</html>", css: "", js: "" },
        inheritPreviousCode: true,
      },
      {
        stepNumber: 3,
        instruction: "Add title",
        starterCode: { html: "", css: "", js: "" },
        expectedTemplate: { html: "<TITLE>####</TITLE>", css: "", js: "" },
        inheritPreviousCode: true,
      },
    ],
  };

  assert.equal(assessmentData.steps.length, 3);
  assert.equal(assessmentData.steps[0].inheritPreviousCode, false);
  assert.equal(assessmentData.steps[1].inheritPreviousCode, true);
  assert.equal(assessmentData.steps[2].inheritPreviousCode, true);

  // Verify public payload strips expectedTemplate
  const pub = toPublicCodeProblem(42, "HTML Skeleton", assessmentData);
  assert.equal(pub.steps.length, 3);
  assert.equal("expectedTemplate" in pub.steps[0], false);
  assert.deepEqual(pub.steps[2].expectedNonEmptyTabs, {
    html: true,
    css: false,
    js: false,
  });

  // Verify storage wrapper and unwrapper round-trip
  const storedJson = JSON.stringify(
    wrapCodeProblemAssessmentForStorage(assessmentData),
  );
  const unwrapped = unwrapCodeProblemAssessment(storedJson);
  assert.ok(unwrapped);
  assert.equal(unwrapped.steps.length, 3);
  assert.equal(
    unwrapped.steps[2].expectedTemplate.html.includes("<TITLE>####</TITLE>"),
    true,
  );
});

// 15. Zod Schema rejects adjacent ######## wildcards or all-blank expected templates
test("Edge Case 15: Zod schema rejects adjacent ######## wildcards and all-blank step templates", () => {
  const badAdjacent = CodeProblemAssessmentSchema.safeParse({
    schemaVersion: 2,
    title: "Bad Wildcard",
    description: "",
    steps: [
      {
        stepNumber: 1,
        instruction: "Write title",
        starterCode: { html: "", css: "", js: "" },
        expectedTemplate: { html: "<TITLE>########</TITLE>", css: "", js: "" },
        inheritPreviousCode: false,
      },
    ],
    expected_outcome: "",
  });
  assert.equal(badAdjacent.success, false);

  const badEmpty = CodeProblemAssessmentSchema.safeParse({
    schemaVersion: 2,
    title: "All Empty",
    description: "",
    steps: [
      {
        stepNumber: 1,
        instruction: "Write something",
        starterCode: { html: "", css: "", js: "" },
        expectedTemplate: { html: "   ", css: "", js: "" },
        inheritPreviousCode: false,
      },
    ],
    expected_outcome: "",
  });
  assert.equal(badEmpty.success, false);
});

console.log(`\n🎉 All ${passedCount} Code Problem Engine tests passed!`);
