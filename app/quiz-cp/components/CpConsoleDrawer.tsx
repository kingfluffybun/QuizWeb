"use client";

import type { ConsoleMessage } from "../types";

interface CpConsoleDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ConsoleMessage[];
}

export default function CpConsoleDrawer({
  isOpen,
  onToggle,
  messages,
}: CpConsoleDrawerProps) {
  return (
    <div className={`console${isOpen ? " console-open" : ""}`}>
      <div className="header">
        <div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-square-terminal"
          >
            <path d="m7 11 2-2-2-2" />
            <path d="M11 13h4" />
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          </svg>
          <h2>Console</h2>
          <button
            className="console-maximize"
            type="button"
            aria-label={isOpen ? "Collapse console output" : "Expand console output"}
            aria-expanded={isOpen}
            onClick={onToggle}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-chevron-up"
            >
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        className="console-output"
        aria-live="polite"
        aria-hidden={!isOpen}
      >
        {messages.length === 0 ? (
          <p className="console-empty">No console output yet.</p>
        ) : (
          messages.map((message, index) => (
            <div
              className={`console-line console-${message.level}`}
              key={`${index}-${message.text}`}
            >
              <span className="console-level">{message.level}</span>
              <code>{message.text}</code>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
