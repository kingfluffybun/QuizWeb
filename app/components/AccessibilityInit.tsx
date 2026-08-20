// app/components/AccessibilityInit.tsx
"use client";

import { useEffect } from "react";

export default function AccessibilityInit() {
  useEffect(() => {
    // 1. Check if the user has saved settings
    const saved = localStorage.getItem('app-accessibility-settings');
    
    if (saved) {
      // 2. Parse the settings
      const { theme, uiScale, reduceMotion, highContrast } = JSON.parse(saved);
      
      // 3. Inject them into the HTML document universally
      document.documentElement.setAttribute('data-theme', theme || 'system');
      document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
      document.documentElement.setAttribute('data-motion', reduceMotion ? 'reduce' : 'normal');
      
      if (uiScale) {
        document.documentElement.style.setProperty('--base-scale', `${uiScale}%`);
        document.documentElement.style.setProperty('--settings-base-scale', `${uiScale}%`);
      }
    }
  }, []); // Empty dependency array means this runs once globally on mount

  // This component renders nothing to the screen
  return null;
}