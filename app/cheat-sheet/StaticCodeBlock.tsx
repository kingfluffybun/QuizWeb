"use client";

import { useEffect, useRef, useState } from "react";
import type { CodeLanguage } from "@/lib/cheat-sheet-data";

type TokenKind =
  | "plain"
  | "comment"
  | "string"
  | "keyword"
  | "tag"
  | "attr"
  | "property"
  | "number"
  | "selector";

interface Token {
  kind: TokenKind;
  value: string;
}

const JS_KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "for",
  "while",
  "of",
  "in",
  "typeof",
  "delete",
  "async",
  "await",
  "true",
  "false",
  "null",
  "undefined",
]);

function tokenizeLine(line: string, language: CodeLanguage): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (kind: TokenKind, value: string) => {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) {
      last.value += value;
    } else {
      tokens.push({ kind, value });
    }
  };

  while (i < line.length) {
    const ch = line[i];

    // Comments
    if (language === "javascript" && line.startsWith("//", i)) {
      push("comment", line.slice(i));
      break;
    }
    if ((language === "css" || language === "html") && line.startsWith("/*", i)) {
      const end = line.indexOf("*/", i + 2);
      const sliceEnd = end === -1 ? line.length : end + 2;
      push("comment", line.slice(i, sliceEnd));
      i = sliceEnd;
      continue;
    }
    if (language === "html" && line.startsWith("<!--", i)) {
      const end = line.indexOf("-->", i + 4);
      const sliceEnd = end === -1 ? line.length : end + 3;
      push("comment", line.slice(i, sliceEnd));
      i = sliceEnd;
      continue;
    }

    // Strings & template literals
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) {
        if (line[j] === "\\") j++;
        j++;
      }
      const end = j < line.length ? j + 1 : line.length;
      push("string", line.slice(i, end));
      i = end;
      continue;
    }

    // HTML tags / attributes
    if (language === "html" && ch === "<") {
      const doctypeMatch = line.slice(i).match(/^<!DOCTYPE[^>]*>/i);
      if (doctypeMatch) {
        push("keyword", doctypeMatch[0]);
        i += doctypeMatch[0].length;
        continue;
      }
      const tagMatch = line.slice(i).match(/^<\/?[A-Za-z][\w-]*/);
      if (tagMatch) {
        push("tag", tagMatch[0]);
        i += tagMatch[0].length;
        continue;
      }
    }

    if (language === "html") {
      const attrMatch = line.slice(i).match(/^([a-zA-Z_:][\w:.-]*)(?=\s*=)/);
      if (attrMatch && i > 0 && /\s/.test(line[i - 1])) {
        push("attr", attrMatch[0]);
        i += attrMatch[0].length;
        continue;
      }
    }

    // CSS rules
    if (language === "css") {
      const atRuleMatch = line.slice(i).match(/^@[a-zA-Z-]+/);
      if (atRuleMatch) {
        push("keyword", atRuleMatch[0]);
        i += atRuleMatch[0].length;
        continue;
      }
      const propMatch = line.slice(i).match(/^([a-z-]+)(?=\s*:)/);
      if (propMatch && (i === 0 || /^\s+$/.test(line.slice(0, i)))) {
        push("property", propMatch[0]);
        i += propMatch[0].length;
        continue;
      }
      const hexOrSelector = line.slice(i).match(/^(#[0-9a-fA-F]{3,8}\b|[.#][A-Za-z_-][\w-]*)/);
      if (hexOrSelector) {
        push(hexOrSelector[0].startsWith("#") && /^#[0-9a-fA-F]{3,8}$/.test(hexOrSelector[0]) ? "number" : "selector", hexOrSelector[0]);
        i += hexOrSelector[0].length;
        continue;
      }
    }

    // Numbers
    const numMatch = line.slice(i).match(/^\b\d+(?:\.\d+)?(?:px|rem|em|vw|vh|ms|deg|%)?/);
    if (numMatch && (i === 0 || !/[A-Za-z0-9_$]/.test(line[i - 1]))) {
      push("number", numMatch[0]);
      i += numMatch[0].length;
      continue;
    }

    // Identifiers / JS keywords
    const wordMatch = line.slice(i).match(/^[A-Za-z_$][\w$-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      push(language === "javascript" && JS_KEYWORDS.has(word) ? "keyword" : "plain", word);
      i += word.length;
      continue;
    }

    push("plain", ch);
    i++;
  }

  return tokens;
}

export default function StaticCodeBlock({
  title,
  language,
  code,
}: {
  title: string;
  language: CodeLanguage;
  code: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmedCode = code.trimEnd();
  const lines = trimmedCode.split("\n");

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trimmedCode);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <div className="cheatsheet-code-editor cheatsheet-code-block">
      <div className="cheatsheet-code-toolbar">
        <span className="cheatsheet-code-lang">{language.toUpperCase()}</span>
        <button
          type="button"
          className="cheatsheet-copy-btn"
          onClick={handleCopy}
          aria-label={`Copy ${title} code example`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre aria-label={`${title} code example`}>
        <code>
          {lines.map((line, lineIdx) => (
            <span className="cheatsheet-code-line" key={lineIdx}>
              <span className="cheatsheet-line-no" aria-hidden="true">
                {lineIdx + 1}
              </span>
              <span className="cheatsheet-line-content">
                {line.length === 0
                  ? "\n"
                  : tokenizeLine(line, language).map((token, tokIdx) => (
                      <span
                        key={tokIdx}
                        className={token.kind === "plain" ? undefined : `tok-${token.kind}`}
                      >
                        {token.value}
                      </span>
                    ))}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
