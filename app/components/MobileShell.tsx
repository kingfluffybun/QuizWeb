"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { signOutAction } from "@/app/actions/auth";
import { clearLearnCache } from "@/lib/learn-cache";
import {
  clearActiveOnboardingUser,
  replaySystemTutorial,
} from "@/lib/quiz-hints-store";
import AccessibilityPanel from "@/app/settings/AccessibilityPanel";
import {
  isExcludedMobileRoute,
  isRouteActive,
  PRIMARY_NAV_LINKS,
} from "@/lib/navigation";
import {
  AccessibilityIcon,
  AdminIcon,
  CloseIcon,
  HomeIcon,
  LearnIcon,
  LogoutIcon,
  MaintainerIcon,
  MenuIcon,
  PlusIcon,
  PrimaryNavIcon,
  ProfileCircleIcon,
  ProfileIcon,
  QueueIcon,
  QuizCheckIcon,
  SettingsIcon,
} from "@/app/components/icons/NavIcons";

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  const { data: session } = useSession();
  const sessionUser = session?.user as
    | { role?: string; user_role?: string; name?: string; email?: string }
    | undefined;
  const role = sessionUser?.role || sessionUser?.user_role || "user";
  const username =
    sessionUser?.name || (sessionUser?.email ? sessionUser.email.split("@")[0] : "Player");
  const email = sessionUser?.email || "";

  // Suppress mobile shell on public / marketing / full-screen exercise routes
  if (isExcludedMobileRoute(pathname)) {
    return <>{children}</>;
  }

  const isAdmin = role === "admin";
  const isMaintainer = role === "maintainer";
  const roleBadge = isAdmin ? "Admin" : isMaintainer ? "Maintainer" : null;

  const bottomNavItems = [
    { label: "Home", href: "/home", icon: <HomeIcon size={22} /> },
    { label: "Learn", href: "/learn", icon: <LearnIcon size={22} /> },
    { label: "Profile", href: "/profile", icon: <ProfileIcon size={22} /> },
    ...(isAdmin
      ? [{ label: "Admin", href: "/admin", icon: <AdminIcon size={22} /> }]
      : isMaintainer
        ? [{ label: "Studio", href: "/maintainer", icon: <MaintainerIcon size={22} /> }]
        : []),
    { label: "Settings", href: "/settings", icon: <SettingsIcon size={22} /> },
  ];

  return (
    <div className={`mobile-shell${pathname === "/learn" ? " mobile-shell--learn" : ""}`}>
      {/* Sticky Top Mobile App Bar */}
      <header className="mobile-app-bar" data-tutorial="mobile-app-bar">
        <Link href="/home" className="mobile-app-brand" aria-label="QuizWeb home">
          <Image src="/assets/QuizWeb-Logo.svg" width={32} height={32} alt="" priority />
          <span>QuizWeb</span>
          {roleBadge && <span className={`mobile-role-pill role-${role}`}>{roleBadge}</span>}
        </Link>
        <div className="mobile-app-actions">
          <button
            type="button"
            className="mobile-app-action"
            data-accessibility-trigger
            aria-label="Open accessibility options"
            onClick={accessibilityOpen ? closeAccessibility : openAccessibility}
          >
            <AccessibilityIcon size={22} />
          </button>
          <button
            type="button"
            className="mobile-app-action"
            aria-label={isDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isDrawerOpen}
            aria-controls="mobile-navigation-drawer"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
          >
            {isDrawerOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </header>

      {/* Main Single-Column Content Region */}
      <div className="mobile-shell-content">{children}</div>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {bottomNavItems.map((item) => {
          const active = isRouteActive(pathname, item.href);
          const tutorialTarget =
            item.href === "/learn"
              ? "mobile-nav-learn"
              : item.href === "/settings"
                ? "mobile-nav-settings"
                : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial={tutorialTarget}
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
              <ProfileCircleIcon size={24} />
            </div>
            <div className="mobile-drawer-user-info">
              <div className="mobile-drawer-user-name-row">
                <span className="mobile-drawer-user-name">{username}</span>
                {roleBadge && <span className={`mobile-role-pill role-${role}`}>{roleBadge}</span>}
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
            <CloseIcon size={22} />
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          <div className="mobile-drawer-section">
            <span className="mobile-drawer-section-title">Explore</span>
            {PRIMARY_NAV_LINKS.slice(0, 3).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-drawer-link${isRouteActive(pathname, item.href) ? " active" : ""}`}
              >
                <PrimaryNavIcon icon={item.icon} size={20} />
                <span>{item.mobileDrawerLabel}</span>
              </Link>
            ))}
            <Link
              href="/quiz"
              className={`mobile-drawer-link${isRouteActive(pathname, "/quiz") ? " active" : ""}`}
            >
              <QuizCheckIcon size={20} />
              <span>Unit Quiz</span>
            </Link>
            {PRIMARY_NAV_LINKS.slice(3).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-drawer-link${isRouteActive(pathname, item.href) ? " active" : ""}`}
              >
                <PrimaryNavIcon icon={item.icon} size={20} />
                <span>{item.mobileDrawerLabel}</span>
              </Link>
            ))}
            <Link
              href="/profile"
              className={`mobile-drawer-link${isRouteActive(pathname, "/profile") ? " active" : ""}`}
            >
              <ProfileIcon size={20} />
              <span>My Profile</span>
            </Link>
            <Link
              href="/settings"
              className={`mobile-drawer-link${isRouteActive(pathname, "/settings") ? " active" : ""}`}
            >
              <SettingsIcon size={20} />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              className="mobile-drawer-link mobile-drawer-link-button"
              onClick={() => {
                replaySystemTutorial("Home");
                setIsDrawerOpen(false);
                if (pathname !== "/home") {
                  router.push("/home");
                }
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              <span>Replay Tutorial</span>
            </button>
            <button
              type="button"
              className="mobile-drawer-link mobile-drawer-link-button"
              data-accessibility-trigger
              onClick={openAccessibility}
            >
              <AccessibilityIcon size={20} />
              <span>Accessibility</span>
            </button>
          </div>

          {(isAdmin || isMaintainer) && (
            <div className="mobile-drawer-section">
              <span className="mobile-drawer-section-title">Staff Workspace</span>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`mobile-drawer-link${isRouteActive(pathname, "/admin") ? " active" : ""}`}
                >
                  <AdminIcon size={20} />
                  <span>Admin Dashboard</span>
                </Link>
              )}
              <Link
                href="/maintainer"
                className={`mobile-drawer-link${isRouteActive(pathname, "/maintainer") ? " active" : ""}`}
              >
                <MaintainerIcon size={20} />
                <span>Maintainer Studio</span>
              </Link>
              <Link
                href={`${isAdmin ? "/admin" : "/maintainer"}#quiz-workspace`}
                className="mobile-drawer-link"
              >
                <PlusIcon size={20} />
                <span>Create Quiz</span>
              </Link>
              <Link
                href={`${isAdmin ? "/admin" : "/maintainer"}#pending-submissions`}
                className="mobile-drawer-link"
              >
                <QueueIcon size={20} />
                <span>Pending Review</span>
              </Link>
            </div>
          )}
        </nav>

        <div className="mobile-drawer-footer">
          <form
            action={signOutAction}
            onSubmit={() => {
              clearLearnCache();
              clearActiveOnboardingUser();
            }}
            className="mobile-drawer-signout-form"
          >
            <button type="submit" className="mobile-drawer-signout-btn">
              <LogoutIcon size={18} />
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
