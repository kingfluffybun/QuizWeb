"use client";

import React, { useState, useEffect } from 'react';
import '@/public/css/settings.css'; 
import PublicNav from '../components/publicNav';
import '@/public/css/nav.css';

export default function AccessibilitySettingsPage() {
  const [isMounted, setIsMounted] = useState(false);
  
  const [theme, setTheme] = useState('system');
  const [uiScale, setUiScale] = useState('100');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // 1. Fetch saved settings so the UI toggles match the user's preferences
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('app-accessibility-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.theme) setTheme(parsed.theme);
      if (parsed.uiScale) setUiScale(parsed.uiScale);
      if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
      if (parsed.highContrast !== undefined) setHighContrast(parsed.highContrast);
    }
  }, []);

  // 2. Apply live changes to the DOM and save to localStorage
  useEffect(() => {
    if (!isMounted) return; 
    
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
    document.documentElement.setAttribute('data-motion', reduceMotion ? 'reduce' : 'normal');
    
    // Dynamically inject the exact percentage for fluid scaling
    document.documentElement.style.setProperty('--base-scale', `${uiScale}%`);
    document.documentElement.style.setProperty('--settings-base-scale', `${uiScale}%`);
    
    localStorage.setItem('app-accessibility-settings', JSON.stringify({ 
      theme, 
      uiScale, 
      reduceMotion, 
      highContrast 
    }));
  }, [theme, uiScale, highContrast, reduceMotion, isMounted]);

  // Prevent hydration mismatch flashes
  if (!isMounted) return null;

  // Calculate the slider's visual fill percentage
  const scaleMin = 90;
  const scaleMax = 125;
  const scalePercentage = ((Number(uiScale) - scaleMin) / (scaleMax - scaleMin)) * 100;

  return (
    <>
      <PublicNav />
      <main className="settings-main">
      <div className="settings-card">
        
        <div className="settings-header">
          <h1>Accessibility Options</h1>
          <p>Customize your experience to make the application easier to see and use.</p>
        </div>

        {/* --- Theme Selection --- */}
        <h3 className="settings-section-title">Theme Preference</h3>
        <div className="theme-grid">
          <button 
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <div className="theme-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/></svg>
            </div>
            Light Mode
          </button>
          
          <button 
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <div className="theme-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4C12.92 3.04 12.46 3 12 3z"/></svg>
            </div>
            Dark Mode
          </button>

          <button 
            className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => setTheme('system')}
          >
            <div className="theme-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h4v2h8v-2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/></svg>
            </div>
            System Default
          </button>
        </div>

        {/* --- Display Scaling --- */}
        <h3 className="settings-section-title">Display & Text</h3>
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
            min={scaleMin} 
            max={scaleMax} 
            step="5" 
            value={uiScale}
            onChange={(e) => setUiScale(e.target.value)}
            style={{
              background: `linear-gradient(to right, var(--settings-primary) ${scalePercentage}%, var(--settings-border) ${scalePercentage}%)`
            }}
          />
          <span className="range-icon large">A</span>
        </div>

        {/* --- Motion & Contrast Toggles --- */}
        <h3 className="settings-section-title">Motion & Contrast</h3>
        
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
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="toggle-row">
          <div className="toggle-info">
            <strong>High Contrast Borders</strong>
            <span>Increase the visibility of inputs, buttons, and borders.</span>
          </div>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

      </div>
    </main>
    </>
  );
}