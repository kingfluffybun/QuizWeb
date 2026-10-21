"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import AccessibilityPanel from "../settings/AccessibilityPanel";

interface PublicNavProps {
  session?: { user?: { name?: string | null; email?: string | null } } | null;
}

export default function PublicNav({ session: initialSession }: PublicNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);
  const [session, setSession] = useState(initialSession ?? null);

  useEffect(() => {
    if (initialSession !== undefined) return;
    let isMounted = true;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && typeof data === "object" && data.user) {
          setSession(data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [initialSession]);

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
    <nav className={`public-nav${menuOpen ? " menu-open" : ""}`}>
      <div className="col" id="logo-nav">
        <Link href="/">
          <div className="logo col">
            <Image src="/assets/QuizWeb-Logo.svg" width={64} height={64} alt=""/>
            <h2>QuizWeb</h2>
          </div>
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
        <div><Link href="/learn"><p>Learn</p></Link></div>
        <div><Link href="/leaderboard"><p>Leaderboard</p></Link></div>
        <div><Link href="/about"><p>About</p></Link></div>
        {/* <div><Link href="/settings"><p>Settings</p></Link></div> */}
        <div className="nav-a11y-item">
          <button
            type="button"
            className="nav-a11y-btn"
            data-accessibility-trigger
            aria-label="Open accessibility options"
            onClick={() => {
              setMenuOpen(false);
              openAccessibility();
            }}
          >
            <p>Accessibility</p>
          </button>
        </div>
        <div>
            {session?.user ? (
                <Link href="/home"><p>Dashboard</p></Link>
            ) : (
                <Link href="/login"><p>Get Started</p></Link>
            )}
        </div>
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