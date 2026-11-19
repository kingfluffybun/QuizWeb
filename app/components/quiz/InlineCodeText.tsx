"use client";

import type { ReactNode } from "react";
import { LessonCodeFrame } from "@/app/components/LessonCard";

export type QuizQuestionPart = { type: "text" | "code"; content: string };

export function renderInlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function getQuizCodeLanguage(categoryId?: number, categoryName?: string): string {
  if (categoryId === 1) return "html";
  if (categoryId === 2) return "css";
  if (categoryId === 3) return "javascript";

  const normalizedCategory = categoryName?.trim().toLowerCase();
  return normalizedCategory === "js" || normalizedCategory?.includes("javascript")
    ? "javascript"
    : "html";
}

export function parseQuizQuestion(text: string): QuizQuestionPart[] {
  const parts: QuizQuestionPart[] = [];
  const codeBlockPattern = /```[^\n`]*\r?\n([\s\S]*?)```/g;
  let lastIndex = 0;

  for (const match of text.matchAll(codeBlockPattern)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, matchIndex) });
    }
    parts.push({ type: "code", content: match[1].replace(/\r?\n$/, "") });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

export function QuizQuestionPrompt({ parts }: { parts: QuizQuestionPart[] }) {
  const hasCode = parts.some((part) => part.type === "code");
  const textParts = parts.filter((part) => part.type === "text" && part.content.trim());

  if (!hasCode) {
    return <h1>{renderInlineCode(parts.map((part) => part.content).join(""))}</h1>;
  }

  return (
    <div className="quiz-question-prompt">
      {textParts.map((part, index) => (
        <p className="quiz-question-copy" key={index}>
          {renderInlineCode(part.content)}
        </p>
      ))}
    </div>
  );
}

export function QuizQuestionCodeBlocks({
  parts,
  codeLanguage,
}: {
  parts: QuizQuestionPart[];
  codeLanguage: string;
}) {
  return (
    <>
      {parts
        .filter((part) => part.type === "code")
        .map((part, index) => (
          <LessonCodeFrame
            className="quiz-question-code"
            title={`Question code snippet ${index + 1}`}
            source={part.content}
            language={codeLanguage}
            editorOnly
            toggleable={false}
            key={index}
          />
        ))}
    </>
  );
}
