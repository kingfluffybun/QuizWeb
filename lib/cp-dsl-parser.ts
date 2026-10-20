import {
  CodeProblemAssessmentSchema,
  createEmptyFileBuffers,
  type CodeProblemAssessment,
  type CPFileBuffers,
  type CPFileKey,
  type CPStep,
} from "./cp-schema";

export interface CPParseResult {
  success: boolean;
  data?: CodeProblemAssessment;
  errors: string[];
}

export const EXAMPLE_HTML_SKELETON_DSL = `---
title: Build an HTML Website Skeleton
description: Construct a complete HTML5 document structure step by step.
---

# Step 1
@instruction: Add a doctype element at the top of the document.
@inherit: false
@hint: Start with <!DOCTYPE HTML>.
\`\`\`starter:html
\`\`\`
\`\`\`expected:html
<!DOCTYPE HTML>
\`\`\`

# Step 2
@instruction: Add the opening and closing <HTML> element below the doctype.
@inherit: true
@hint: Place <HTML> and </HTML> directly below <!DOCTYPE HTML>.
\`\`\`expected:html
<!DOCTYPE HTML>
<HTML>
</HTML>
\`\`\`

# Step 3
@instruction: Complete the website skeleton by adding <HEAD> with a non-empty <TITLE>, followed by <BODY>.
@inherit: true
@hint: Add <HEAD><TITLE>Your Title</TITLE></HEAD> and <BODY></BODY> inside <HTML>.
\`\`\`expected:html
<!DOCTYPE HTML>
<HTML>
    <HEAD>
        <TITLE>####</TITLE>
    </HEAD>
    <BODY>
    </BODY>
</HTML>
\`\`\`
`;

function parseFileKeyTag(tag: string | undefined): CPFileKey {
  const clean = (tag ?? "").trim().toLowerCase();
  if (clean === "css") return "css";
  if (clean === "js" || clean === "javascript") return "js";
  return "html";
}

/**
 * Parses a human-readable Markdown DSL string into a validated `CodeProblemAssessment`.
 */
export function parseCPMarkdownDsl(rawText: string): CPParseResult {
  const normalized = (rawText ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) {
    return {
      success: false,
      errors: ["DSL input is empty. Paste or write at least one # Step block."],
    };
  }

  let title = "";
  let description = "";
  let expectedOutcome = "";
  let body = normalized;

  // 1. Extract optional YAML-style frontmatter
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\s*\n?/);
  if (frontmatterMatch) {
    const fmLines = frontmatterMatch[1].split("\n");
    for (const line of fmLines) {
      const m = line.match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].trim().toLowerCase();
      const val = m[2].trim();
      if (key === "title") title = val;
      else if (key === "description") description = val;
      else if (key === "expected_outcome" || key === "outcome") {
        expectedOutcome = val;
      }
    }
    body = normalized.slice(frontmatterMatch[0].length);
  }

  // 2. Split `# Step N` blocks
  const stepHeadingRegex = /^#\s*Step\s+(\d+)\b[^\n]*$/gim;
  const headings: { stepNum: number; index: number; endOfLine: number }[] = [];
  let hMatch: RegExpExecArray | null;

  while ((hMatch = stepHeadingRegex.exec(body)) !== null) {
    headings.push({
      stepNum: Number(hMatch[1]),
      index: hMatch.index,
      endOfLine: hMatch.index + hMatch[0].length,
    });
  }

  if (headings.length === 0) {
    return {
      success: false,
      errors: [
        "No '# Step 1' headings found. Begin each step with '# Step 1', '# Step 2', etc.",
      ],
    };
  }

  const steps: CPStep[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    const nextStart =
      i + 1 < headings.length ? headings[i + 1].index : body.length;
    const stepBlock = body.slice(current.endOfLine, nextStart).trim();

    const starterCode: CPFileBuffers = createEmptyFileBuffers();
    const expectedTemplate: CPFileBuffers = createEmptyFileBuffers();

    // Extract fenced code blocks: ```starter[:html|css|js] ... ``` and ```expected[:html|css|js] ... ```
    const fenceRegex =
      /```(starter|expected)(?::([A-Za-z]+))?\s*\n([\s\S]*?)```/gi;
    let fMatch: RegExpExecArray | null;
    while ((fMatch = fenceRegex.exec(stepBlock)) !== null) {
      const mode = fMatch[1].toLowerCase() as "starter" | "expected";
      const fileKey = parseFileKeyTag(fMatch[2]);
      const content = fMatch[3].replace(/\n$/, "");
      if (mode === "starter") {
        starterCode[fileKey] = content;
      } else {
        expectedTemplate[fileKey] = content;
      }
    }

    // Remove fenced code blocks before parsing metadata directives
    const directivesBlock = stepBlock.replace(
      /```(?:starter|expected)(?::[A-Za-z]+)?\s*\n[\s\S]*?```/gi,
      "",
    );

    let instruction = "";
    let inheritPreviousCode = i > 0;
    let hint: string | undefined;

    for (const rawLine of directivesBlock.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const dirMatch = line.match(/^@([A-Za-z_]+)\s*:\s*(.*)$/);
      if (dirMatch) {
        const key = dirMatch[1].toLowerCase();
        const val = dirMatch[2].trim();
        if (key === "instruction" || key === "prompt") {
          instruction = val;
        } else if (key === "inherit" || key === "inheritpreviouscode") {
          inheritPreviousCode =
            val.toLowerCase() === "true" || val.toLowerCase() === "yes";
        } else if (key === "hint") {
          hint = val || undefined;
        }
      } else if (!instruction) {
        instruction = line;
      }
    }

    steps.push({
      stepNumber: i + 1,
      instruction,
      starterCode,
      expectedTemplate,
      inheritPreviousCode,
      ...(hint ? { hint } : {}),
    });
  }

  if (!expectedOutcome && steps.length > 0) {
    const lastExpected = steps[steps.length - 1].expectedTemplate;
    expectedOutcome =
      lastExpected.html || lastExpected.css || lastExpected.js || "";
  }

  const candidate: CodeProblemAssessment = {
    schemaVersion: 2,
    title,
    description,
    steps,
    expected_outcome: expectedOutcome,
  };

  const validation = CodeProblemAssessmentSchema.safeParse(candidate);
  if (!validation.success) {
    for (const issue of validation.error.issues) {
      parseErrors.push(issue.message);
    }
    return {
      success: false,
      errors: parseErrors,
    };
  }

  return {
    success: true,
    data: validation.data,
    errors: [],
  };
}

/**
 * Serializes a `CodeProblemAssessment` into the human-readable Markdown DSL format
 * for two-way editing and export in the Maintainer UI.
 */
export function serializeCPToMarkdownDsl(
  assessment: CodeProblemAssessment,
): string {
  const lines: string[] = [
    "---",
    `title: ${assessment.title || "Untitled Coding Assessment"}`,
    `description: ${assessment.description || ""}`,
    "---",
    "",
  ];

  for (const step of assessment.steps) {
    lines.push(`# Step ${step.stepNumber}`);
    lines.push(`@instruction: ${step.instruction}`);
    lines.push(`@inherit: ${step.inheritPreviousCode ? "true" : "false"}`);
    if (step.hint) {
      lines.push(`@hint: ${step.hint}`);
    }

    for (const key of ["html", "css", "js"] as const) {
      const starterVal = step.starterCode[key] ?? "";
      if (starterVal.trim().length > 0 || (key === "html" && !step.inheritPreviousCode)) {
        lines.push(`\`\`\`starter:${key}`);
        if (starterVal) lines.push(starterVal);
        lines.push("```");
      }
    }

    for (const key of ["html", "css", "js"] as const) {
      const expectedVal = step.expectedTemplate[key] ?? "";
      if (expectedVal.trim().length > 0 || key === "html") {
        lines.push(`\`\`\`expected:${key}`);
        if (expectedVal) lines.push(expectedVal);
        lines.push("```");
      }
    }

    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
