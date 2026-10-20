import {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  type CPFileBuffers,
  type CPFileKey,
} from "./cp-schema";

export type WildcardContext =
  | "tag_text"
  | "double_quote"
  | "single_quote"
  | "css_value"
  | "general";

export interface WildcardSlotMeta {
  index: number; // 0-based wildcard index in the tab
  context: WildcardContext;
  enclosingTag?: string; // e.g., "TITLE" or "a"
  lineInTemplate: number;
}

interface TemplateToken {
  type: "LITERAL" | "REQUIRED_SPACE" | "OPTIONAL_SPACE" | "WILDCARD";
  raw: string;
  regexFragment: string;
  displayLabel: string;
  wildcardMeta?: WildcardSlotMeta;
}

export interface TabValidationResult {
  passed: boolean;
  fileKey: CPFileKey;
  fileLabel: string;
  message: string;
  failedLine?: number;
  capturedWildcards: string[];
}

export interface StepValidationResult {
  passed: boolean;
  failedTab?: CPFileKey;
  message: string;
  failedLine?: number;
  tabResults: Record<CPFileKey, TabValidationResult>;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toCaseInsensitiveRegex(literal: string): string {
  let out = "";
  for (const ch of literal) {
    const upper = ch.toUpperCase();
    const lower = ch.toLowerCase();
    if (upper !== lower) {
      out += `[${escapeRegExp(upper)}${escapeRegExp(lower)}]`;
    } else {
      out += escapeRegExp(ch);
    }
  }
  return out;
}

function isWordLikeChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9_$#%-]/.test(ch);
}

function getLineNumberAtOffset(text: string, offset: number): number {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  for (let i = 0; i < safeOffset; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Determines the enclosing context and tag name of a `####` wildcard at `pos` inside `template`.
 */
function detectWildcardContext(
  template: string,
  pos: number,
  fileKey: CPFileKey,
): { context: WildcardContext; enclosingTag?: string } {
  const before = template.slice(0, pos);
  const after = template.slice(pos + 4);

  // Check if inside double or single quotes on the same line
  const currentLineBefore = before.split("\n").pop() ?? "";
  const doubleQuotesBefore = (currentLineBefore.match(/"/g) ?? []).length;
  const singleQuotesBefore = (currentLineBefore.match(/'/g) ?? []).length;

  const tagBeforeMatch = before.match(/<([A-Za-z][A-Za-z0-9-]*)[^>]*$/);
  if (doubleQuotesBefore % 2 === 1 && after.includes('"')) {
    return {
      context: "double_quote",
      enclosingTag: tagBeforeMatch ? tagBeforeMatch[1] : undefined,
    };
  }
  if (singleQuotesBefore % 2 === 1 && after.includes("'")) {
    return {
      context: "single_quote",
      enclosingTag: tagBeforeMatch ? tagBeforeMatch[1] : undefined,
    };
  }

  // Check if between `>` and `</Tag>` in HTML
  const openTagMatch = before.match(/<([A-Za-z][A-Za-z0-9-]*)\b[^>]*>\s*$/);
  if (openTagMatch && /^\s*<\//.test(after)) {
    return {
      context: "tag_text",
      enclosingTag: openTagMatch[1],
    };
  }

  if (fileKey === "html" && /[^>]*>\s*$/.test(before) && /^\s*</.test(after)) {
    return {
      context: "tag_text",
      enclosingTag: openTagMatch ? openTagMatch[1] : undefined,
    };
  }

  if (fileKey === "css" && /:\s*$/.test(before)) {
    return { context: "css_value" };
  }

  return {
    context: "general",
    enclosingTag: openTagMatch ? openTagMatch[1] : undefined,
  };
}

/**
 * Compiles a literal chunk into a regex fragment using language-aware case sensitivity:
 * - html: case-insensitive for HTML tags, doctype, and attribute names
 * - css: case-insensitive for CSS properties and keywords
 * - js: strictly case-sensitive
 */
function compileLiteralFragment(literal: string, fileKey: CPFileKey): string {
  if (fileKey === "js") {
    return escapeRegExp(literal);
  }
  // HTML and CSS apply language-aware case-insensitive matching on identifiers/tags
  return toCaseInsensitiveRegex(literal);
}

/**
 * Splits a non-whitespace literal segment into atomic structural pieces
 * (e.g. `<HTML>`, `</HEAD>`, `<!DOCTYPE`, `HTML`, attributes, punctuation)
 * so prefix diagnostics can pinpoint the exact failing tag or symbol,
 * and inserts optional `\s*` inside tag brackets (e.g. `<HTML >` vs `<HTML>`).
 */
function splitAtomicLiterals(
  segment: string,
  fileKey: CPFileKey,
): { raw: string; regexFragment: string; displayLabel: string }[] {
  const atoms: { raw: string; regexFragment: string; displayLabel: string }[] =
    [];
  // Match HTML tags/closers, words, or individual punctuation characters
  const pattern =
    /(<\/?[A-Za-z!][A-Za-z0-9-]*|\/>|>|<|[A-Za-z0-9_$#%-]+|[^A-Za-z0-9_$#%-\s<>]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(segment)) !== null) {
    const rawAtom = match[0];
    atoms.push({
      raw: rawAtom,
      regexFragment: compileLiteralFragment(rawAtom, fileKey),
      displayLabel: rawAtom,
    });
  }

  return atoms;
}

/**
 * Tokenizes `expectedTemplate` into a sequence of structural tokens (`LITERAL`,
 * `REQUIRED_SPACE`, `OPTIONAL_SPACE`, `WILDCARD`).
 */
export function tokenizeTemplate(
  expectedRaw: string,
  fileKey: CPFileKey,
): TemplateToken[] {
  const normalized = expectedRaw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const tokens: TemplateToken[] = [];
  let cursor = 0;
  let wildcardCounter = 0;

  while (cursor < normalized.length) {
    // 1. Check for `####` wildcard token
    if (normalized.startsWith("####", cursor)) {
      const { context, enclosingTag } = detectWildcardContext(
        normalized,
        cursor,
        fileKey,
      );
      const wildcardIndex = wildcardCounter++;
      const lineInTemplate = getLineNumberAtOffset(normalized, cursor);

      let capturePattern: string;
      switch (context) {
        case "tag_text":
          // Forbids `<` and `>` so wildcard cannot greedily cross tags or allow <script> injection
          capturePattern = `(?<w_${wildcardIndex}>[^<>]*?)`;
          break;
        case "double_quote":
          capturePattern = `(?<w_${wildcardIndex}>[^"<>]*?)`;
          break;
        case "single_quote":
          capturePattern = `(?<w_${wildcardIndex}>[^'<>]*?)`;
          break;
        case "css_value":
          capturePattern = `(?<w_${wildcardIndex}>[^;{}<>]*?)`;
          break;
        case "general":
        default:
          capturePattern = `(?<w_${wildcardIndex}>[^<>;"'{}()\n]*?)`;
          break;
      }

      tokens.push({
        type: "WILDCARD",
        raw: "####",
        regexFragment: capturePattern,
        displayLabel: enclosingTag
          ? `wildcard (####) inside <${enclosingTag}>`
          : `wildcard #${wildcardIndex + 1} (####)`,
        wildcardMeta: {
          index: wildcardIndex,
          context,
          enclosingTag,
          lineInTemplate,
        },
      });
      cursor += 4;
      continue;
    }

    // 2. Check for whitespace run
    const wsMatch = normalized.slice(cursor).match(/^\s+/);
    if (wsMatch) {
      const wsRaw = wsMatch[0];
      const prevChar = cursor > 0 ? normalized[cursor - 1] : undefined;
      const nextChar =
        cursor + wsRaw.length < normalized.length
          ? normalized[cursor + wsRaw.length]
          : undefined;

      // Space is REQUIRED when separating two word/identifier tokens (e.g., `<!DOCTYPE HTML>`, `let x`, `<a href`)
      const isRequired = isWordLikeChar(prevChar) && isWordLikeChar(nextChar);

      tokens.push({
        type: isRequired ? "REQUIRED_SPACE" : "OPTIONAL_SPACE",
        raw: wsRaw,
        regexFragment: isRequired ? "\\s+" : "\\s*",
        displayLabel: isRequired ? "required space" : "whitespace",
      });
      cursor += wsRaw.length;
      continue;
    }

    // 3. Consume non-whitespace literal run up to next whitespace or `####`
    let nextBreak = normalized.length;
    const nextWs = normalized.slice(cursor).search(/\s/);
    if (nextWs !== -1) {
      nextBreak = Math.min(nextBreak, cursor + nextWs);
    }
    const nextWildcard = normalized.indexOf("####", cursor);
    if (nextWildcard !== -1) {
      nextBreak = Math.min(nextBreak, nextWildcard);
    }

    const literalChunk = normalized.slice(cursor, nextBreak);
    const atoms = splitAtomicLiterals(literalChunk, fileKey);

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      tokens.push({
        type: "LITERAL",
        raw: atom.raw,
        regexFragment: atom.regexFragment,
        displayLabel: atom.displayLabel,
      });

      // Allow optional whitespace before closing `>` or `/>` inside HTML tags (e.g. `<HTML >`)
      const nextAtom = atoms[i + 1];
      if (
        nextAtom &&
        (nextAtom.raw === ">" ||
          nextAtom.raw === "/>" ||
          atom.raw === "=" ||
          nextAtom.raw === "=" ||
          atom.raw === ":" ||
          atom.raw === ";" ||
          atom.raw === "{" ||
          nextAtom.raw === "{")
      ) {
        tokens.push({
          type: "OPTIONAL_SPACE",
          raw: "",
          regexFragment: "\\s*",
          displayLabel: "optional space",
        });
      } else if (
        nextAtom &&
        (atom.raw === ">" || atom.raw === "{" || atom.raw === "}") &&
        nextAtom.raw.startsWith("<")
      ) {
        // Between `><` on a single line in the template, allow optional indentation/newlines in student code
        tokens.push({
          type: "OPTIONAL_SPACE",
          raw: "",
          regexFragment: "\\s*",
          displayLabel: "optional whitespace",
        });
      }
    }

    cursor = nextBreak;
  }

  // Group `<TAG` + `>` display labels when adjacent for cleaner error messages
  return tokens;
}

/**
 * Formats a clean human-readable tag/token label at `tokenIndex` (e.g. combining `<HEAD` and `>` into `<HEAD>`).
 */
function formatExpectedTokenLabel(
  tokens: TemplateToken[],
  tokenIndex: number,
): string {
  const token = tokens[tokenIndex];
  if (!token) return "end of code";

  if (token.raw.startsWith("<") && !token.raw.endsWith(">")) {
    // Look ahead for immediate `>`
    for (let i = tokenIndex + 1; i < Math.min(tokens.length, tokenIndex + 4); i++) {
      if (tokens[i].type === "OPTIONAL_SPACE") continue;
      if (tokens[i].raw === ">" || tokens[i].raw === "/>") {
        return `${token.raw}${tokens[i].raw}`;
      }
      break;
    }
  }
  return token.displayLabel;
}

/**
 * Generates an actionable, student-friendly diagnostic message when `studentNormalized`
 * fails to match `tokens`.
 */
function diagnoseMismatch(
  studentNormalized: string,
  tokens: TemplateToken[],
  fileKey: CPFileKey,
): { message: string; failedLine: number } {
  const fileLabel = CP_FILE_LABELS[fileKey];

  // Find longest prefix of tokens[0..k] that matches the start of studentNormalized
  let lastMatchedTokenIdx = -1;
  let matchedPrefixLength = 0;

  for (let k = 0; k < tokens.length; k++) {
    const prefixPattern =
      "^\\s*" +
      tokens
        .slice(0, k + 1)
        .map((t) => t.regexFragment)
        .join("");
    const regex = new RegExp(prefixPattern, "s");
    const match = regex.exec(studentNormalized);
    if (match) {
      lastMatchedTokenIdx = k;
      matchedPrefixLength = match[0].length;
    } else {
      break;
    }
  }

  const failedLine = getLineNumberAtOffset(
    studentNormalized,
    matchedPrefixLength,
  );
  const remainingStudent = studentNormalized.slice(matchedPrefixLength).trim();
  const nextStudentToken =
    remainingStudent.match(/^(<\/?[A-Za-z!][^>\s]*>?|\S+)/)?.[1] ?? "";

  // Case 1: All template tokens matched as a prefix, but student has unexpected extra code after the end
  if (lastMatchedTokenIdx === tokens.length - 1) {
    const lastLiteral = [...tokens]
      .reverse()
      .find((t) => t.type === "LITERAL");
    const afterLabel = lastLiteral ? lastLiteral.raw : "the expected code";
    return {
      failedLine,
      message: `${fileLabel} (Line ${failedLine}): Unexpected extra content '${nextStudentToken.slice(0, 30)}' found after '${afterLabel}'.`,
    };
  }

  const failingIdx = lastMatchedTokenIdx + 1;
  const failingToken = tokens[failingIdx];

  // Case 2: Failed on REQUIRED_SPACE (e.g., `<!DOCTYPEHTML>`)
  if (failingToken.type === "REQUIRED_SPACE") {
    const prevToken = tokens[failingIdx - 1];
    const nextToken = tokens[failingIdx + 1];
    return {
      failedLine,
      message: `${fileLabel} (Line ${failedLine}): Missing required space between '${prevToken?.raw ?? ""}' and '${nextToken?.raw ?? ""}'.`,
    };
  }

  const expectedLabel = formatExpectedTokenLabel(tokens, failingIdx);
  const prevSignificant = tokens
    .slice(0, failingIdx)
    .reverse()
    .find((t) => t.type === "LITERAL" || t.type === "WILDCARD");

  // Case 3: Missing closing tag (e.g., `</HEAD>`, `</HTML>`, `</BODY>`)
  if (expectedLabel.startsWith("</")) {
    if (!remainingStudent) {
      return {
        failedLine,
        message: `${fileLabel} (Line ${failedLine}): Missing closing '${expectedLabel}' tag.`,
      };
    }
    return {
      failedLine,
      message: `${fileLabel} (Line ${failedLine}): Expected closing '${expectedLabel}' tag, but found '${nextStudentToken.slice(0, 30)}'.`,
    };
  }

  // Case 4: Missing opening tag or expected literal token
  if (!remainingStudent) {
    return {
      failedLine,
      message: `${fileLabel} (Line ${failedLine}): Incomplete code — missing expected '${expectedLabel}'${prevSignificant ? ` after '${prevSignificant.raw}'` : ""}.`,
    };
  }

  return {
    failedLine,
    message: `${fileLabel} (Line ${failedLine}): Expected '${expectedLabel}'${prevSignificant ? ` after '${prevSignificant.raw}'` : ""}, but found '${nextStudentToken.slice(0, 30)}'.`,
  };
}

/**
 * Validates a single editor tab (`html`, `css`, or `js`) against its expected template.
 */
export function validateSingleTabTemplate(
  studentRaw: string,
  expectedRaw: string,
  fileKey: CPFileKey,
): TabValidationResult {
  const fileLabel = CP_FILE_LABELS[fileKey];
  const studentNormalized = (studentRaw ?? "").replace(/\r\n?/g, "\n");
  const expectedNormalized = (expectedRaw ?? "").replace(/\r\n?/g, "\n");

  const studentTrimmed = studentNormalized.trim();
  const expectedTrimmed = expectedNormalized.trim();

  // Rule: If the maintainer left this tab's expected template blank,
  // the student's corresponding editor tab must also be completely empty.
  if (expectedTrimmed.length === 0) {
    if (studentTrimmed.length === 0) {
      return {
        passed: true,
        fileKey,
        fileLabel,
        message: `${fileLabel} is clean.`,
        capturedWildcards: [],
      };
    }
    return {
      passed: false,
      fileKey,
      fileLabel,
      failedLine: 1,
      message: `Unexpected code in ${fileLabel}: this file must remain empty for this step.`,
      capturedWildcards: [],
    };
  }

  if (studentTrimmed.length === 0) {
    return {
      passed: false,
      fileKey,
      fileLabel,
      failedLine: 1,
      message: `${fileLabel} is empty. Follow the step instructions to write the required code.`,
      capturedWildcards: [],
    };
  }

  const tokens = tokenizeTemplate(expectedTrimmed, fileKey);
  const fullPattern =
    "^\\s*" + tokens.map((t) => t.regexFragment).join("") + "\\s*$";
  const fullRegex = new RegExp(fullPattern, "s");

  const match = fullRegex.exec(studentNormalized);
  if (!match) {
    const diag = diagnoseMismatch(studentNormalized, tokens, fileKey);
    return {
      passed: false,
      fileKey,
      fileLabel,
      failedLine: diag.failedLine,
      message: diag.message,
      capturedWildcards: [],
    };
  }

  // Verify all captured `####` wildcards are non-empty and non-whitespace
  const wildcardTokens = tokens.filter((t) => t.type === "WILDCARD");
  const capturedWildcards: string[] = [];

  for (const wToken of wildcardTokens) {
    const meta = wToken.wildcardMeta!;
    const rawCapture = match.groups?.[`w_${meta.index}`] ?? "";
    const trimmedCapture = rawCapture.trim();

    if (trimmedCapture.length === 0) {
      const targetLocation = meta.enclosingTag
        ? `inside <${meta.enclosingTag}>`
        : `for wildcard #${meta.index + 1}`;
      return {
        passed: false,
        fileKey,
        fileLabel,
        failedLine: meta.lineInTemplate,
        message: `${fileLabel}: Wildcard content ${targetLocation} cannot be empty or whitespace-only.`,
        capturedWildcards,
      };
    }

    if (/[<>]/.test(trimmedCapture)) {
      return {
        passed: false,
        fileKey,
        fileLabel,
        failedLine: meta.lineInTemplate,
        message: `${fileLabel}: Invalid markup tags ('<' or '>') inside wildcard content.`,
        capturedWildcards,
      };
    }

    capturedWildcards.push(trimmedCapture);
  }

  return {
    passed: true,
    fileKey,
    fileLabel,
    message: `${fileLabel} passed validation.`,
    capturedWildcards,
  };
}

/**
 * Validates all 3 file buffers (`html`, `css`, `js`) for a given step.
 */
export function validateCodeProblemStep(
  studentBuffers: CPFileBuffers,
  expectedBuffers: CPFileBuffers,
): StepValidationResult {
  const tabResults = {} as Record<CPFileKey, TabValidationResult>;

  // First check non-empty expected tabs so primary language errors take priority over stray tab errors
  const orderedKeys: CPFileKey[] = [
    ...CP_FILE_KEYS.filter((k) => expectedBuffers[k].trim().length > 0),
    ...CP_FILE_KEYS.filter((k) => expectedBuffers[k].trim().length === 0),
  ];

  for (const key of orderedKeys) {
    tabResults[key] = validateSingleTabTemplate(
      studentBuffers[key] ?? "",
      expectedBuffers[key] ?? "",
      key,
    );
  }

  for (const key of orderedKeys) {
    const res = tabResults[key];
    if (!res.passed) {
      return {
        passed: false,
        failedTab: key,
        failedLine: res.failedLine,
        message: res.message,
        tabResults,
      };
    }
  }

  return {
    passed: true,
    message: "Step completed! All files match the expected structure.",
    tabResults,
  };
}
