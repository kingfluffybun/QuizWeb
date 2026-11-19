import {
  CP_FILE_KEYS,
  CP_FILE_LABELS,
  type CPFileBuffers,
  type CPFileKey,
} from "./cp-constants";

export type WildcardContext =
  | "tag_text"
  | "double_quote"
  | "single_quote"
  | "css_value"
  | "general";

export interface WildcardSlotMeta {
  index: number;
  context: WildcardContext;
  enclosingTag?: string;
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

interface CompiledTemplateEntry {
  tokens: TemplateToken[];
  wildcardTokens: TemplateToken[];
  fullRegex: RegExp;
}

const MAX_STUDENT_TAB_CHARS = 65_536;
const TEMPLATE_CACHE_LIMIT = 256;
const compiledTemplateCache = new Map<string, CompiledTemplateEntry>();

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

function detectWildcardContext(
  template: string,
  pos: number,
  fileKey: CPFileKey,
): { context: WildcardContext; enclosingTag?: string } {
  const before = template.slice(0, pos);
  const after = template.slice(pos + 4);

  const lastNewline = before.lastIndexOf("\n");
  const currentLineBefore = lastNewline === -1 ? before : before.slice(lastNewline + 1);
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

function compileLiteralFragment(literal: string, fileKey: CPFileKey): string {
  if (fileKey === "js") {
    return escapeRegExp(literal);
  }
  return toCaseInsensitiveRegex(literal);
}

function splitAtomicLiterals(
  segment: string,
  fileKey: CPFileKey,
): { raw: string; regexFragment: string; displayLabel: string }[] {
  const atoms: { raw: string; regexFragment: string; displayLabel: string }[] = [];
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
 * Tokenizes `expectedTemplate` into structural tokens (`LITERAL`,
 * `REQUIRED_SPACE`, `OPTIONAL_SPACE`, `WILDCARD`) using sticky regex scanning.
 */
export function tokenizeTemplate(
  expectedRaw: string,
  fileKey: CPFileKey,
): TemplateToken[] {
  const normalized = expectedRaw.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const tokens: TemplateToken[] = [];
  const stickyWs = /\s+/y;
  const nextWsPattern = /\s/g;
  let cursor = 0;
  let wildcardCounter = 0;

  while (cursor < normalized.length) {
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

    stickyWs.lastIndex = cursor;
    const wsMatch = stickyWs.exec(normalized);
    if (wsMatch) {
      const wsRaw = wsMatch[0];
      const prevChar = cursor > 0 ? normalized[cursor - 1] : undefined;
      const nextChar =
        cursor + wsRaw.length < normalized.length
          ? normalized[cursor + wsRaw.length]
          : undefined;

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

    let nextBreak = normalized.length;
    nextWsPattern.lastIndex = cursor;
    const nextWsMatch = nextWsPattern.exec(normalized);
    if (nextWsMatch && nextWsMatch.index < nextBreak) {
      nextBreak = nextWsMatch.index;
    }
    const nextWildcard = normalized.indexOf("####", cursor);
    if (nextWildcard !== -1 && nextWildcard < nextBreak) {
      nextBreak = nextWildcard;
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

  return tokens;
}

function getCompiledTemplate(
  expectedTrimmed: string,
  fileKey: CPFileKey,
): CompiledTemplateEntry {
  const cacheKey = `${fileKey}\0${expectedTrimmed}`;
  const cached = compiledTemplateCache.get(cacheKey);
  if (cached) {
    // Refresh LRU order
    compiledTemplateCache.delete(cacheKey);
    compiledTemplateCache.set(cacheKey, cached);
    return cached;
  }

  const tokens = tokenizeTemplate(expectedTrimmed, fileKey);
  const fullPattern =
    "^\\s*" + tokens.map((t) => t.regexFragment).join("") + "\\s*$";
  const entry: CompiledTemplateEntry = {
    tokens,
    wildcardTokens: tokens.filter((t) => t.type === "WILDCARD"),
    fullRegex: new RegExp(fullPattern, "s"),
  };

  if (compiledTemplateCache.size >= TEMPLATE_CACHE_LIMIT) {
    const oldestKey = compiledTemplateCache.keys().next().value;
    if (oldestKey !== undefined) {
      compiledTemplateCache.delete(oldestKey);
    }
  }
  compiledTemplateCache.set(cacheKey, entry);
  return entry;
}

function formatExpectedTokenLabel(
  tokens: TemplateToken[],
  tokenIndex: number,
): string {
  const token = tokens[tokenIndex];
  if (!token) return "end of code";

  if (token.raw.startsWith("<") && !token.raw.endsWith(">")) {
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

function diagnoseMismatch(
  studentNormalized: string,
  tokens: TemplateToken[],
  fileKey: CPFileKey,
): { message: string; failedLine: number } {
  const fileLabel = CP_FILE_LABELS[fileKey];

  // Binary search for the longest prefix tokens[0..k] matching studentNormalized (O(log N) regexes)
  let lastMatchedTokenIdx = -1;
  let matchedPrefixLength = 0;
  let lo = 0;
  let hi = tokens.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let prefixPattern = "^\\s*";
    for (let i = 0; i <= mid; i++) {
      prefixPattern += tokens[i].regexFragment;
    }
    const match = new RegExp(prefixPattern, "s").exec(studentNormalized);
    if (match) {
      lastMatchedTokenIdx = mid;
      matchedPrefixLength = match[0].length;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const failedLine = getLineNumberAtOffset(
    studentNormalized,
    matchedPrefixLength,
  );
  const remainingStudent = studentNormalized.slice(matchedPrefixLength).trim();
  const nextStudentToken =
    remainingStudent.match(/^(<\/?[A-Za-z!][^>\s]*>?|\S+)/)?.[1] ?? "";

  if (lastMatchedTokenIdx === tokens.length - 1) {
    let lastLiteral: TemplateToken | undefined;
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].type === "LITERAL") {
        lastLiteral = tokens[i];
        break;
      }
    }
    const afterLabel = lastLiteral ? lastLiteral.raw : "the expected code";
    return {
      failedLine,
      message: `${fileLabel} (Line ${failedLine}): Unexpected extra content '${nextStudentToken.slice(0, 30)}' found after '${afterLabel}'.`,
    };
  }

  const failingIdx = lastMatchedTokenIdx + 1;
  const failingToken = tokens[failingIdx];

  if (failingToken.type === "REQUIRED_SPACE") {
    const prevToken = tokens[failingIdx - 1];
    const nextToken = tokens[failingIdx + 1];
    return {
      failedLine,
      message: `${fileLabel} (Line ${failedLine}): Missing required space between '${prevToken?.raw ?? ""}' and '${nextToken?.raw ?? ""}'.`,
    };
  }

  const expectedLabel = formatExpectedTokenLabel(tokens, failingIdx);
  let prevSignificant: TemplateToken | undefined;
  for (let i = failingIdx - 1; i >= 0; i--) {
    if (tokens[i].type === "LITERAL" || tokens[i].type === "WILDCARD") {
      prevSignificant = tokens[i];
      break;
    }
  }

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

  if (studentNormalized.length > MAX_STUDENT_TAB_CHARS) {
    return {
      passed: false,
      fileKey,
      fileLabel,
      failedLine: 1,
      message: `${fileLabel} exceeds maximum supported length (${MAX_STUDENT_TAB_CHARS} characters).`,
      capturedWildcards: [],
    };
  }

  const { tokens, wildcardTokens, fullRegex } = getCompiledTemplate(
    expectedTrimmed,
    fileKey,
  );

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

  const orderedKeys: CPFileKey[] = [
    ...CP_FILE_KEYS.filter((k) => (expectedBuffers[k] ?? "").trim().length > 0),
    ...CP_FILE_KEYS.filter((k) => (expectedBuffers[k] ?? "").trim().length === 0),
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
