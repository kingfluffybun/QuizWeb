"use client";

import { useState } from "react";
import Link from "next/link";
import AccessibilityPanel from "../settings/AccessibilityPanel";

export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  return (
    <nav className={menuOpen ? "menu-open" : ""}>
      <div>
        <Link href="/">
          <p>Logo</p>
        </Link>
      </div>
      
      <button className="menu-btn" type="button" onClick={() => setMenuOpen((isOpen) => !isOpen)} > {menuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"> <path d="M6 6l12 12" /> <path d="M18 6 6 18" /> </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"> <path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" /> </svg>
        )}
        <p>{menuOpen ? "Close" : "Menu"}</p>
      </button>

      <div className={`nav-options${menuOpen ? " is-open" : ""}`}>
        <div><Link href="/quiz"><p>Learn</p></Link></div>
        <div><Link href="https://test.com"><p>Leaderboard</p></Link></div>
        <div><Link href="/about"><p>About</p></Link></div>
        {/* <div><Link href="/settings"><p>Settings</p></Link></div> */}
        <div><Link href="/login"><p>Get Started </p></Link></div>
      </div>

      <div className="accessibility">
        <div>
          <button type="button" aria-label="Open accessibility options" onClick={() => setAccessibilityOpen(true)}>
            <div><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg></div>
          </button>
        </div>
      </div>
      {accessibilityOpen && <AccessibilityPanel onClose={() => setAccessibilityOpen(false)} />}
    </nav>
  );
}