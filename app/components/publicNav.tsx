"use client";

import { useState } from "react";
import Link from "next/link";

export default function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className={menuOpen ? "menu-open" : ""}>
      <div>
        <Link href="/">
          <p>Logo</p>
        </Link>
      </div>
      
      <button 
        className="menu-btn" 
        type="button"
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
      >
        {menuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16" />
            <path d="M4 12h16" />
            <path d="M4 19h16" />
          </svg>
        )}
        <p>{menuOpen ? "Close" : "Menu"}</p>
      </button>

      <div className={`nav-options${menuOpen ? " is-open" : ""}`}>
        <div><Link href="/quiz"><p>Learn</p></Link></div>
        <div><Link href="https://test.com"><p>Leaderboard</p></Link></div>
        <div><Link href="/about"><p>About</p></Link></div>
        <div><Link href="/login"><p>Log in</p></Link></div>
        <div><Link href="/login"><p>Sign Up</p></Link></div>
      </div>
    </nav>
  );
}