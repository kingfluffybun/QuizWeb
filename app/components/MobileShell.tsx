"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { signOutAction } from "@/app/actions/auth";
import { clearLearnCache } from "@/lib/learn-cache";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";

const EXCLUDED_PREFIXES = [
  "/login",
  "/verify-email",
  "/quiz",
  "/quiz-cp",
  "/about",
  "/post-login",
];

function isExcludedRoute(pathname: string) {
  if (pathname === "/") return true;
  return EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [accessibilityClosing, setAccessibilityClosing] = useState(false);

  const openAccessibility = () => {
    setIsDrawerOpen(false);
    setAccessibilityClosing(false);
    setAccessibilityOpen(true);
  };
  const closeAccessibility = () => setAccessibilityClosing(true);
  const finishClosingAccessibility = () => {
    setAccessibilityOpen(false);
    setAccessibilityClosing(false);
  };

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsDrawerOpen(false);
  }

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
    };
    if (isDrawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  const { data: session } = useSession();
  const sessionUser = session?.user as { role?: string; user_role?: string; name?: string; email?: string } | undefined;
  const role = sessionUser?.role || sessionUser?.user_role || "user";
  const username = sessionUser?.name || (sessionUser?.email ? sessionUser.email.split("@")[0] : "Player");
  const email = sessionUser?.email || "";

  // Suppress mobile shell on public / marketing / full-screen exercise routes
  if (isExcludedRoute(pathname)) {
    return <>{children}</>;
  }

  const isAdmin = role === "admin";
  const isMaintainer = role === "maintainer";
  const roleBadge = isAdmin ? "Admin" : isMaintainer ? "Maintainer" : null;

  // Role-aware bottom nav tabs
  const bottomNavItems = [
    {
      label: "Home",
      href: "/home",
      icon: (
        <svg className="lucide lucide-house" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
          <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      ),
    },
    {
      label: "Learn",
      href: "/learn",
      icon: (
        <svg className="lucide lucide-graduation-cap" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
          <path d="M22 10v6" />
          <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
        </svg>
      ),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: (
        <svg className="lucide lucide-user" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="5" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [
          {
            label: "Admin",
            href: "/admin",
            icon: (
              <svg className="lucide lucide-shield" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              </svg>
            ),
          },
        ]
      : isMaintainer
      ? [
          {
            label: "Studio",
            href: "/maintainer",
            icon: (
              <svg className="lucide lucide-square-pen" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
              </svg>
            ),
          },
        ]
      : []),
    {
      label: "Settings",
      href: "/settings",
      icon: (
        <svg className="lucide lucide-settings" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`mobile-shell${pathname === "/learn" ? " mobile-shell--learn" : ""}`}>
      {/* Sticky Top Mobile App Bar */}
      <header className="mobile-app-bar">
        <Link href="/home" className="mobile-app-brand" aria-label="QuizWeb home">
          <Image src="/assets/QuizWeb-Logo.svg" width={32} height={32} alt="" priority />
          <span>QuizWeb</span>
          {roleBadge && (
            <span className={`mobile-role-pill role-${role}`}>
              {roleBadge}
            </span>
          )}
        </Link>
        <div className="mobile-app-actions">
        <button
          type="button"
          className="mobile-app-action"
          data-accessibility-trigger
          aria-label="Open accessibility options"
          onClick={accessibilityOpen ? closeAccessibility : openAccessibility}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="5" r="1" />
            <path d="m9 20 3-6 3 6" />
            <path d="m6 8 6 2 6-2" />
            <path d="M12 10v4" />
          </svg>
        </button>
        <button
          type="button"
          className="mobile-app-action"
          aria-label={isDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isDrawerOpen}
          aria-controls="mobile-navigation-drawer"
          onClick={() => setIsDrawerOpen((prev) => !prev)}
        >
          {isDrawerOpen ? (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          )}
        </button>
        </div>
      </header>

      {/* Main Single-Column Content Region */}
      <div className="mobile-shell-content">{children}</div>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {bottomNavItems.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-bottom-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-bottom-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Interactive Mobile Navigation Drawer / Action Sheet */}
      {isDrawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="mobile-navigation-drawer"
        className={`mobile-drawer${isDrawerOpen ? " is-open" : ""}`}
        aria-modal="true"
        role="dialog"
        aria-label="Navigation drawer"
      >
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-user">
            <div className="mobile-drawer-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="10" r="3" />
                <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
              </svg>
            </div>
            <div className="mobile-drawer-user-info">
              <div className="mobile-drawer-user-name-row">
                <span className="mobile-drawer-user-name">{username}</span>
                {roleBadge && (
                  <span className={`mobile-role-pill role-${role}`}>
                    {roleBadge}
                  </span>
                )}
              </div>
              {email && <span className="mobile-drawer-user-email">{email}</span>}
            </div>
          </div>
          <button
            type="button"
            className="mobile-drawer-close-btn"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          <div className="mobile-drawer-section">
            <span className="mobile-drawer-section-title">Explore</span>
            <Link href="/home" className={`mobile-drawer-link${isActiveRoute(pathname, "/home") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
                <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span>Home Dashboard</span>
            </Link>
            <Link href="/learn" className={`mobile-drawer-link${isActiveRoute(pathname, "/learn") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
                <path d="M22 10v6" />
                <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
              </svg>
              <span>Curriculum & Lessons</span>
            </Link>
            <Link href="/cheat-sheet" className={`mobile-drawer-link${isActiveRoute(pathname, "/cheat-sheet") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6h4" />
                <path d="M2 10h4" />
                <path d="M2 14h4" />
                <path d="M2 18h4" />
                <rect width="16" height="20" x="4" y="2" rx="2" />
                <path d="M9.5 8h5" />
                <path d="M9.5 12H16" />
                <path d="M9.5 16H14" />
              </svg>
              <span>Cheat Sheet</span>
            </Link>
            <Link href="/quiz" className={`mobile-drawer-link${isActiveRoute(pathname, "/quiz") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Unit Quiz</span>
            </Link>
            <Link href="/quiz" className={`mobile-drawer-link${isActiveRoute(pathname, "/quiz") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                <path d="M12 7a5 5 0 1 0 5 5" />
                <path d="M13 3.055a9 9 0 1 0 7.941 7.945" />
                <path d="M15 6v3h3l3 -3h-3v-3z" />
                <path d="M15 9l-3 3" />
              </svg>
              <span>Practice Arena</span>
            </Link>
            <Link href="/leaderboard" className={`mobile-drawer-link${isActiveRoute(pathname, "/leaderboard") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" />
                <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" />
                <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" />
                <path d="M4 22h16" />
                <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" />
                <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" />
              </svg>
              <span>Leaderboard</span>
            </Link>
            <Link href="/profile" className={`mobile-drawer-link${isActiveRoute(pathname, "/profile") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              </svg>
              <span>My Profile</span>
            </Link>
            <Link href="/settings" className={`mobile-drawer-link${isActiveRoute(pathname, "/settings") ? " active" : ""}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Settings</span>
            </Link>
            <button
              type="button"
              className="mobile-drawer-link mobile-drawer-link-button"
              data-accessibility-trigger
              onClick={openAccessibility}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" />
                <path d="m9 20 3-6 3 6" />
                <path d="m6 8 6 2 6-2" />
                <path d="M12 10v4" />
              </svg>
              <span>Accessibility</span>
            </button>
          </div>

          {(isAdmin || isMaintainer) && (
            <div className="mobile-drawer-section">
              <span className="mobile-drawer-section-title">Staff Workspace</span>
              {isAdmin && (
                <Link href="/admin" className={`mobile-drawer-link${isActiveRoute(pathname, "/admin") ? " active" : ""}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  </svg>
                  <span>Admin Dashboard</span>
                </Link>
              )}
              <Link href="/maintainer" className={`mobile-drawer-link${isActiveRoute(pathname, "/maintainer") ? " active" : ""}`}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
                </svg>
                <span>Maintainer Studio</span>
              </Link>
              <Link href={`${isAdmin ? "/admin" : "/maintainer"}#quiz-workspace`} className="mobile-drawer-link">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                <span>Create Quiz</span>
              </Link>
              <Link href={`${isAdmin ? "/admin" : "/maintainer"}#pending-submissions`} className="mobile-drawer-link">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                  <path d="M8 16h5" />
                </svg>
                <span>Pending Review</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="mobile-drawer-footer">
          <form action={signOutAction} onSubmit={() => clearLearnCache()} className="mobile-drawer-signout-form">
            <button type="submit" className="mobile-drawer-signout-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {accessibilityOpen && (
        <AccessibilityPanel
          isClosing={accessibilityClosing}
          onClose={closeAccessibility}
          onClosed={finishClosingAccessibility}
        />
      )}
    </div>
  );
}
