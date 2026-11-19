"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/app/components/icons/NavIcons";
import { useAccessibilitySettings } from "@/lib/accessibility-store";

type AccessibilityPanelProps = {
  isClosing?: boolean;
  onClose?: () => void;
  onClosed?: () => void;
};

const SCALE_MIN = 90;
const SCALE_MAX = 125;

export default function AccessibilityPanel({
  isClosing = false,
  onClose,
  onClosed,
}: AccessibilityPanelProps) {
  const { settings, setTheme, setUiScale, setReduceMotion } = useAccessibilitySettings();
  const { theme, uiScale, reduceMotion } = settings;
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-accessibility-trigger]")) return;
      if (target instanceof Node && !panelRef.current?.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose]);

  const handleAnimationEnd = () => {
    if (isClosing) onClosed?.();
  };

  const scalePercentage = ((uiScale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

  return (
    <div
      className={`accessibility-dialog settings-main${isClosing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-title"
    >
      <button
        className="accessibility-dialog-backdrop"
        type="button"
        aria-label="Close accessibility options"
        onClick={onClose}
      />
      <section
        ref={panelRef}
        className="settings-card accessibility-dialog-card"
        onAnimationEnd={handleAnimationEnd}
      >
        <button
          className="accessibility-dialog-close"
          type="button"
          aria-label="Close accessibility options"
          onClick={onClose}
        >
          <CloseIcon size={22} />
        </button>

        <div className="settings-header">
          <h1 id="accessibility-title">Accessibility Options</h1>
          <p>Customize your experience to make the application easier to see and use.</p>
        </div>

        <h3 className="settings-section-title">Theme Preference</h3>
        <div className="theme-grid">
          <button
            type="button"
            className={`theme-btn ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            <div className="theme-icon">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </div>
            Light Mode
          </button>
          <button
            type="button"
            className={`theme-btn ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            <div className="theme-icon">
              <span aria-hidden="true">◐</span>
            </div>
            Dark Mode
          </button>
          <button
            type="button"
            className={`theme-btn ${theme === "system" ? "active" : ""}`}
            onClick={() => setTheme("system")}
          >
            <div className="theme-icon">
              <span aria-hidden="true">▣</span>
            </div>
            System Default
          </button>
        </div>

        <h3 className="settings-section-title">Display &amp; Text</h3>
        <div className="scale-label-row">
          <div className="toggle-info">
            <strong>Interface Scaling</strong>
            <span>Adjust the size of text and UI elements globally.</span>
          </div>
          <span className="scale-badge">{uiScale}%</span>
        </div>
        <div className="range-container">
          <span className="range-icon small">A</span>
          <input
            className="range-slider"
            type="range"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step="5"
            value={uiScale}
            onChange={(event) => setUiScale(event.target.value)}
            style={{
              background: `linear-gradient(to right, var(--settings-primary) ${scalePercentage}%, var(--settings-border) ${scalePercentage}%)`,
            }}
            aria-label="Interface scaling"
          />
          <span className="range-icon large">A</span>
        </div>

        <h3 className="settings-section-title">Motion</h3>
        <div className="toggle-row">
          <div className="toggle-info">
            <strong>Reduce Motion</strong>
            <span>Disable background animations and page transitions.</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(event) => setReduceMotion(event.target.checked)}
            />
            <span className="slider" />
          </label>
        </div>
      </section>
    </div>
  );
}
