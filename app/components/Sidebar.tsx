"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { signOutAction } from "@/app/actions/auth";
import { clearLearnCache } from "@/lib/learn-cache";
import {
  clearActiveOnboardingUser,
  replaySystemTutorial,
} from "@/lib/quiz-hints-store";
import { fetchClientUserInfo } from "@/lib/user-info-client";
import {
  getSidebarConfig,
  isRouteActive,
  PRIMARY_NAV_LINKS,
  type SidebarConfig,
  type SidebarNavItem,
} from "@/lib/navigation";
import {
  AdminIcon,
  ChevronUpIcon,
  LogoutIcon,
  MaintainerIcon,
  PanelLeftIcon,
  PrimaryNavIcon,
  ProfileIcon,
  SettingsIcon,
} from "@/app/components/icons/NavIcons";

export { getSidebarConfig, type SidebarConfig, type SidebarNavItem };

export interface SidebarProps {
  role?: string;
  username?: string;
  email?: string;
  avatarColor?: string;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = "quizweb-sidebar-collapsed";
const SIDEBAR_COLLAPSE_EVENT = "quizweb-sidebar-collapse";
let sidebarCollapsedFallback = false;

function subscribeToSidebarCollapse(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_COLLAPSE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_COLLAPSE_EVENT, onStoreChange);
  };
}

function getSidebarCollapsedSnapshot() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return sidebarCollapsedFallback;
  }
}

function getServerSidebarCollapsedSnapshot() {
  return false;
}

export default function Sidebar(props: SidebarProps = {}) {
  const { data: session, status } = useSession();
  const sessionUser = session?.user as
    | { role?: string; user_role?: string; name?: string; email?: string }
    | undefined;

  const initialRole = props.role || sessionUser?.role || sessionUser?.user_role;
  const initialUsername = props.username || sessionUser?.name;
  const initialEmail = props.email || sessionUser?.email;
  const initialAvaColor = props.avatarColor;

  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarCollapse,
    getSidebarCollapsedSnapshot,
    getServerSidebarCollapsedSnapshot,
  );
  const [fetchedRole, setFetchedRole] = useState<string | undefined>(initialRole);
  const [fetchedUsername, setFetchedUsername] = useState<string | undefined>(initialUsername);
  const [fetchedEmail, setFetchedEmail] = useState<string | undefined>(initialEmail);
  const [fetchedAvaColor, setFetchedAvaColor] = useState<string | undefined>(initialAvaColor);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const parentContainer = sidebarRef.current?.closest(
      ".quiz-page, .dashboard-page, .admin-app-layout, .settings-app-layout, .maintainer-page, .profile-page",
    );
    if (parentContainer) {
      parentContainer.classList.toggle("sidebar-collapsed", isCollapsed);
    }
  }, [isCollapsed]);

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    sidebarCollapsedFallback = next;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage failures
    }
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSE_EVENT));
  };

  useEffect(() => {
    const hasAllProps = Boolean(
      props.role && props.username && props.email && props.avatarColor,
    );
    const isConfirmedGuest =
      status === "unauthenticated" && !props.role && !props.username && !props.email;

    if (hasAllProps || isConfirmedGuest) return;
    if (status === "loading" && !props.role && !props.username) return;

    let isMounted = true;
    fetchClientUserInfo("minimal").then((userData) => {
      if (!isMounted || !userData) return;
      if (userData.user_role) setFetchedRole(userData.user_role);
      if (userData.username) setFetchedUsername(userData.username);
      if (userData.email) setFetchedEmail(userData.email);
      if (userData.avatar_color) setFetchedAvaColor(userData.avatar_color);
    });

    return () => {
      isMounted = false;
    };
  }, [props.role, props.username, props.email, props.avatarColor, status]);

  const effectiveRole = fetchedRole ?? initialRole ?? "user";
  const isAdmin = effectiveRole === "admin";
  const isMaintainer = effectiveRole === "maintainer";
  const displayName = fetchedUsername ?? initialUsername ?? "Profile";
  const firstName = displayName.trim().split(/\s+/)[0] || "Profile";
  const profileInitial = (fetchedUsername ?? initialUsername ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart.charAt(0).toUpperCase())
    .join("");
  const displayEmail = fetchedEmail ?? initialEmail ?? null;
  const avaColor = fetchedAvaColor ?? initialAvaColor;

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileContainerRef.current?.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isProfileMenuOpen]);

  return (
    <div
      className={`sidebar${isCollapsed ? " is-collapsed" : ""}`}
      id="quiz-sidebar"
      data-tutorial="nav-sidebar"
      ref={sidebarRef}
    >
      <div className="sidebar-nav">
        <div className="logo-container">
          <div className="logo">
            <Image src="/assets/QuizWeb-Logo.svg" width={48} height={48} alt="" />
            <div>
              <h2>QuizWeb</h2>
              <p>code made fun</p>
            </div>
          </div>
          <button
            type="button"
            className="close-sidebar"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            aria-controls="quiz-sidebar"
            onClick={handleToggleCollapse}
          >
            <PanelLeftIcon className="preview-icon" />
          </button>
        </div>

        {/* Primary Navigation */}
        <div className="sidebar-main">
          {PRIMARY_NAV_LINKS.map((item) => {
            const active = isRouteActive(pathname, item.activeRoutes);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tutorial={item.href === "/learn" ? "nav-learn" : undefined}
                aria-current={isRouteActive(pathname, item.href) ? "page" : undefined}
                className={`sidebar-option${active ? " active" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <PrimaryNavIcon
                  icon={item.icon}
                  className={item.icon === "learn" ? "preview-icon" : undefined}
                />
                <PrimaryNavIcon icon={item.icon} solid />
                <p>{item.label}</p>
              </Link>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <div className="profile-container" ref={profileContainerRef}>
            <button
              type="button"
              className="profile-menu-toggle"
              data-tutorial="nav-profile"
              title={isCollapsed ? displayName : undefined}
              aria-label={`${isProfileMenuOpen ? "Close" : "Open"} profile menu for ${displayName}`}
              aria-expanded={isProfileMenuOpen}
              aria-controls="profile-menu"
              onClick={() => setIsProfileMenuOpen((open) => !open)}
            >
              <span className="profile-icon" aria-hidden="true" style={{ backgroundColor: avaColor }}>
                <span>{profileInitial}</span>
              </span>
              <div className="profile-detail">
                <p id="name">{firstName}</p>
                <p id="email">{displayEmail}</p>
              </div>
              <ChevronUpIcon className="preview-icon" />
            </button>

            <div
              className={`profile-menu${isProfileMenuOpen ? " is-open" : ""}`}
              id="profile-menu"
              aria-hidden={!isProfileMenuOpen}
              onClick={(event) => {
                if (
                  event.target instanceof Element &&
                  event.target.closest("a, button[type='submit']")
                ) {
                  setIsProfileMenuOpen(false);
                }
              }}
            >
              <div className="profile-header">
                <div className="profile-icon" aria-hidden="true" style={{ backgroundColor: avaColor }}>
                  <span>{profileInitial}</span>
                </div>
                <div className="profile-detail">
                  <p id="name">{displayName}</p>
                  <p id="email">{displayEmail}</p>
                </div>
              </div>
              <hr />
              <div className="profile-options-container">
                <Link href="/profile" className="profile-options">
                  <ProfileIcon className="preview-icon" />
                  <p>Profile</p>
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`profile-options${isRouteActive(pathname, ["/admin", "/pending"]) ? " active" : ""}`}
                  >
                    <AdminIcon />
                    <p>Admin Panel</p>
                  </Link>
                )}
                {(isAdmin || isMaintainer) && (
                  <Link
                    href="/maintainer"
                    className={`profile-options${isRouteActive(pathname, ["/maintainer", "/input"]) ? " active" : ""}`}
                  >
                    <MaintainerIcon />
                    <p>Question Studio</p>
                  </Link>
                )}
                <button
                  type="button"
                  className="profile-options profile-replay-tutorial"
                  onClick={() => {
                    replaySystemTutorial("Home");
                    setIsProfileMenuOpen(false);
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
                  <p>Replay Tutorial</p>
                </button>
                <Link
                  href="/settings"
                  className={`profile-options${isRouteActive(pathname, ["/settings"]) ? " active" : ""}`}
                >
                  <SettingsIcon />
                  <p>Settings</p>
                </Link>
              </div>
              <hr />
              <form
                action={signOutAction}
                onSubmit={() => {
                  clearLearnCache();
                  clearActiveOnboardingUser();
                }}
              >
                <button type="submit" className="profile-options profile-logout">
                  <LogoutIcon className="preview-icon" />
                  <p>Log Out</p>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
