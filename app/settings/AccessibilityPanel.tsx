"use client";

import { useEffect, useState } from "react";

type AccessibilityPanelProps = {
  onClose?: () => void;
};

export default function AccessibilityPanel({ onClose }: AccessibilityPanelProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState("light");
  const [uiScale, setUiScale] = useState("100");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("app-accessibility-settings");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed.theme) setTheme(parsed.theme);
      if (parsed.uiScale) setUiScale(parsed.uiScale);
      if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-motion", reduceMotion ? "reduce" : "normal");
    document.documentElement.removeAttribute("data-contrast");
    document.documentElement.style.setProperty("--base-scale", `${uiScale}%`);
    document.documentElement.style.setProperty("--settings-base-scale", `${uiScale}%`);
    localStorage.setItem("app-accessibility-settings", JSON.stringify({ theme, uiScale, reduceMotion }));
  }, [theme, uiScale, reduceMotion, isMounted]);

  useEffect(() => {
    if (!onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isMounted) return null;

  const scaleMin = 90;
  const scaleMax = 125;
  const scalePercentage = ((Number(uiScale) - scaleMin) / (scaleMax - scaleMin)) * 100;

  return (
    <div className="accessibility-dialog settings-main" role="dialog" aria-modal="true" aria-labelledby="accessibility-title">
      <button className="accessibility-dialog-backdrop" type="button" aria-label="Close accessibility options" onClick={onClose} />
      <section className="settings-card accessibility-dialog-card">
        <button className="accessibility-dialog-close" type="button" aria-label="Close accessibility options" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
          </svg>
        </button>

        <div className="settings-header">
          <h1 id="accessibility-title">Accessibility Options</h1>
          <p>Customize your experience to make the application easier to see and use.</p>
        </div>

        <h3 className="settings-section-title">Theme Preference</h3>
        <div className="theme-grid">
          <button className={`theme-btn ${theme === "light" ? "active" : ""}`} onClick={() => setTheme("light")}>
            <div className="theme-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03 1.41 1.41 1.41.39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-1.03.39-1.41 0-1.06 1.06-1.06 1.06-.?" /></svg></div>
            Light Mode
          </button>
          <button className={`theme-btn ${theme === "dark" ? "active" : ""}`} onClick={() => setTheme("dark")}>
            <div className="theme-icon"><span aria-hidden="true">◐</span></div>
            Dark Mode
          </button>
          <button className={`theme-btn ${theme === "system" ? "active" : ""}`} onClick={() => setTheme("system")}>
            <div className="theme-icon"><span aria-hidden="true">▣</span></div>
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
          <input className="range-slider" type="range" min={scaleMin} max={scaleMax} step="5" value={uiScale} onChange={(event) => setUiScale(event.target.value)} style={{ background: `linear-gradient(to right, var(--settings-primary) ${scalePercentage}%, var(--settings-border) ${scalePercentage}%)` }} aria-label="Interface scaling" />
          <span className="range-icon large">A</span>
        </div>

        <h3 className="settings-section-title">Motion</h3>
        <div className="toggle-row">
          <div className="toggle-info">
            <strong>Reduce Motion</strong>
            <span>Disable background animations and page transitions.</span>
          </div>
          <label className="switch">
            <input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />
            <span className="slider" />
          </label>
        </div>
      </section>
    </div>
  );
}
