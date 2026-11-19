"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import AccessibilityPanel from "../settings/AccessibilityPanel";
import {
  AccessibilityIcon,
  CloseIcon,
  MenuIcon,
} from "@/app/components/icons/NavIcons";

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
    <nav className={`public-nav${menuOpen ? " menu-open" : ""}`}>
      <div className="col" id="logo-nav">
        <Link href="/">
          <div className="logo col">
            <Image src="/assets/QuizWeb-Logo.svg" width={64} height={64} alt="" />
            <h2>QuizWeb</h2>
          </div>
        </Link>
      </div>

      <button className="menu-btn" type="button" onClick={() => setMenuOpen((isOpen) => !isOpen)}>
        {menuOpen ? <CloseIcon size={24} /> : <MenuIcon size={24} />}
        <p>{menuOpen ? "Close" : "Menu"}</p>
      </button>

      <div className={`nav-options${menuOpen ? " is-open" : ""}`}>
        <div><Link href="/learn"><p>Learn</p></Link></div>
        <div><Link href="/leaderboard"><p>Leaderboard</p></Link></div>
        <div><Link href="/about"><p>About</p></Link></div>
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
        <div><Link href="/login"><p>Get Started</p></Link></div>
      </div>

      <div className="accessibility">
        <div>
          <button
            data-accessibility-trigger
            type="button"
            aria-label={accessibilityOpen ? "Close accessibility options" : "Open accessibility options"}
            onClick={accessibilityOpen ? closeAccessibility : openAccessibility}
          >
            <div>
              <AccessibilityIcon size={24} stroke="white" />
            </div>
          </button>
        </div>
      </div>

      {accessibilityOpen && (
        <AccessibilityPanel
          isClosing={accessibilityClosing}
          onClose={closeAccessibility}
          onClosed={finishClosingAccessibility}
        />
      )}
    </nav>
  );
}
