"use client";

import { useAccessibilitySettings } from "@/lib/accessibility-store";

const SCALE_MIN = 90;
const SCALE_MAX = 125;

export default function AccessibilityTab() {
  const { settings, setTheme, setUiScale, setReduceMotion } = useAccessibilitySettings();
  const { theme, uiScale, reduceMotion } = settings;
  const scalePercentage = ((uiScale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

  return (
    <section className="settings-section" aria-labelledby="heading-accessibility">
      <h2 id="heading-accessibility" className="settings-section-title">Theme Preference</h2>
      <div className="theme-grid">
        <button
          type="button"
          className={`theme-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
        >
          <div className="theme-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z" />
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
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z" />
            </svg>
          </div>
          Dark Mode
        </button>

        <button
          type="button"
          className={`theme-btn ${theme === "system" ? "active" : ""}`}
          onClick={() => setTheme("system")}
        >
          <div className="theme-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h4v2h8v-2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z" />
            </svg>
          </div>
          System Default
        </button>
      </div>

      <h2 className="settings-section-title">Display &amp; Text</h2>
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
          type="range"
          className="range-slider"
          min={SCALE_MIN}
          max={SCALE_MAX}
          step="5"
          value={uiScale}
          onChange={(e) => setUiScale(e.target.value)}
          style={{
            background: `linear-gradient(to right, var(--settings-primary) ${scalePercentage}%, var(--settings-border) ${scalePercentage}%)`,
          }}
          aria-label="Interface scaling"
        />
        <span className="range-icon large">A</span>
      </div>

      <h2 className="settings-section-title">Motion</h2>
      <div className="toggle-row">
        <div className="toggle-info">
          <strong>Reduce Motion</strong>
          <span>Disable background animations and page transitions.</span>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={reduceMotion}
            onChange={(e) => setReduceMotion(e.target.checked)}
            aria-label="Toggle reduce motion"
          />
          <span className="slider"></span>
        </label>
      </div>
    </section>
  );
}
