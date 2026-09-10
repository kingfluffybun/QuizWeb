"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import AccessibilityPanel from "../settings/AccessibilityPanel";

export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);

  const openAccessibility = () => {
    setAccessibilityClosing(false);
    setAccessibilityOpen(true);
  };

  const closeAccessibility = () => setAccessibilityClosing(true);

  const finishClosingAccessibility = () => {
    setAccessibilityOpen(false);
    setAccessibilityClosing(false);
  };

  return (
    <nav className={menuOpen ? "menu-open" : ""}>
      <div className="col" id="logo-nav">
        <Link href="/">
          <div className="logo col">
            <Image src="/assets/QuizWeb-Logo.svg" width={64} height={64} alt="QuizWeb Logo"/>
            <h2>QuizWeb</h2>
          </div>
        </Link>
      </div>
      
      <button
        className="menu-btn"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="nav-options"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
      > {menuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"> <path d="M6 6l12 12" /> <path d="M18 6 6 18" /> </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"> <path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" /> </svg>
        )}
        <p>{menuOpen ? "Close" : "Menu"}</p>
      </button>

      <div id="nav-options" className={`nav-options${menuOpen ? " is-open" : ""}`}>
        <div><Link href="/quiz"><p>Learn</p></Link></div>
        <div><Link href="/leaderboard"><p>Leaderboard</p></Link></div>
        <div><Link href="/about"><p>About</p></Link></div>
        {/* <div><Link href="/settings"><p>Settings</p></Link></div> */}
        <div><Link href="/login"><p>Get Started </p></Link></div>
      </div>

      <div className="accessibility">
        <div>
          <button data-accessibility-trigger type="button" aria-label={accessibilityOpen ? "Close accessibility options" : "Open accessibility options"} onClick={accessibilityOpen ? closeAccessibility : openAccessibility}>
            <div><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg></div>
          </button>
        </div>
      </div>
      {accessibilityOpen && <AccessibilityPanel isClosing={accessibilityClosing} onClose={closeAccessibility} onClosed={finishClosingAccessibility} />}
    </nav>
  );
}