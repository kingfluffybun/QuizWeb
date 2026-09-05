// app/components/AccessibilityInit.tsx
"use client";

import { useEffect } from "react";

export default function AccessibilityInit() {
  useEffect(() => {
    // 1. Check if the user has saved settings
    const saved = localStorage.getItem('app-accessibility-settings');
    
    // Always ensure data-contrast is removed globally
    document.documentElement.removeAttribute('data-contrast');

    if (saved) {
      try {
        // 2. Parse the settings
        const { theme, uiScale, reduceMotion } = JSON.parse(saved);
        
        // 3. Inject them into the HTML document universally
        document.documentElement.setAttribute('data-theme', theme || 'light');
        document.documentElement.setAttribute('data-motion', reduceMotion ? 'reduce' : 'normal');
        
        if (uiScale) {
          document.documentElement.style.setProperty('--base-scale', `${uiScale}%`);
          document.documentElement.style.setProperty('--settings-base-scale', `${uiScale}%`);
        }
      } catch {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.setAttribute('data-motion', 'normal');
      }
    } else {
      // Default to light theme and normal motion
      if (!document.documentElement.getAttribute('data-theme')) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      if (!document.documentElement.getAttribute('data-motion')) {
        document.documentElement.setAttribute('data-motion', 'normal');
      }
    }
  }, []); // Empty dependency array means this runs once globally on mount

  // This component renders nothing to the screen
  return null;
}