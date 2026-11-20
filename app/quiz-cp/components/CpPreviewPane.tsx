"use client";

import type { ConsoleMessage } from "../types";
import CpConsoleDrawer from "./CpConsoleDrawer";

interface CpPreviewPaneProps {
  previewFrameRef: React.RefObject<HTMLIFrameElement | null>;
  srcDoc: string;
  isMobilePreview: boolean;
  onToggleMobilePreview: (checked: boolean) => void;
  isConsoleOpen: boolean;
  onToggleConsole: () => void;
  consoleMessages: ConsoleMessage[];
}

export default function CpPreviewPane({
  previewFrameRef,
  srcDoc,
  isMobilePreview,
  onToggleMobilePreview,
  isConsoleOpen,
  onToggleConsole,
  consoleMessages,
}: CpPreviewPaneProps) {
  return (
    <div id="preview" data-tutorial="cp-preview">
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
            className="lucide lucide-eye"
          >
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <h2>Preview</h2>
        </div>
        <div className="toggle-device-container row">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            id="desktop-toggle"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-monitor"
          >
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" />
            <line x1="12" x2="12" y1="17" y2="21" />
          </svg>
          <label className="toggle-device">
            <input
              type="checkbox"
              checked={isMobilePreview}
              onChange={(e) => onToggleMobilePreview(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            id="mobile-toggle"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-smartphone"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
          </svg>
        </div>
      </div>

      <div className="canvas-container col">
        <iframe
          title="code preview"
          className="preview-frame"
          ref={previewFrameRef}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{
            maxWidth: isMobilePreview ? "375px" : "100%",
            margin: isMobilePreview ? "0 auto" : undefined,
            borderLeft: isMobilePreview ? "1px solid var(--border-main)" : undefined,
            borderRight: isMobilePreview ? "1px solid var(--border-main)" : undefined,
          }}
        />
        <CpConsoleDrawer
          isOpen={isConsoleOpen}
          onToggle={onToggleConsole}
          messages={consoleMessages}
        />
      </div>
    </div>
  );
}
