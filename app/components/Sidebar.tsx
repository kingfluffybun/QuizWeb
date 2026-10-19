"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export interface SidebarNavItem {
    label: string;
    href: string;
}

export interface SidebarConfig {
    items: SidebarNavItem[];
    roleBadge: string | null;
}

export interface SidebarProps {
    role?: string;
    username?: string;
}

/**
 * Returns role-aware navigation items and role badge configuration.
 * Strictly aligned with tests/test-rbac-e2e.ts Feature F12 contract.
 */
export function getSidebarConfig(role?: string): SidebarConfig {
    const baseItems: SidebarNavItem[] = [
        { label: "Home", href: "/home" },
        { label: "Learn", href: "/learn" },
        { label: "Settings", href: "/settings" },
    ];

    if (role === "admin") {
        return {
            items: [
                ...baseItems,
                { label: "Admin Panel", href: "/admin" },
                { label: "Question Studio", href: "/maintainer" },
            ],
            roleBadge: "Admin",
        };
    }

    if (role === "maintainer") {
        return {
            items: [
                ...baseItems,
                { label: "Question Studio", href: "/maintainer" },
            ],
            roleBadge: "Maintainer",
        };
    }

    return {
        items: baseItems,
        roleBadge: null,
    };
}

function isRouteActive(pathname: string, routes: string[]) {
    return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default function Sidebar({ role: initialRole, username: initialUsername }: SidebarProps = {}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [fetchedRole, setFetchedRole] = useState<string | undefined>(undefined);
    const [fetchedUsername, setFetchedUsername] = useState<string | undefined>(undefined);
    const [fetchedEmail, setFetchedEmail] = useState<string | undefined>(undefined);
    const pathname = usePathname();

    useEffect(() => {
        if (initialRole !== undefined) return;
        let isMounted = true;
        fetch("/api/auth/session")
            .then((res) => (res.ok ? res.json() : null))
            .then((session) => {
                if (!isMounted || !session?.user) return;
                const role = session.user.role || session.user.user_role || "user";
                setFetchedRole(role);
                if (session.user.name) {
                    setFetchedUsername(session.user.name);
                }
                if (session.user.email) {
                    setFetchedEmail(session.user.email);
                }
            })
            .catch(() => {
                // Silently fallback to unauthenticated/user default
            });
        return () => {
            isMounted = false;
        };
    }, [initialRole]);

    const effectiveRole = initialRole ?? fetchedRole ?? "user";
    const isAdmin = effectiveRole === "admin";
    const isMaintainer = effectiveRole === "maintainer";
    const roleBadge = isAdmin ? "Admin" : isMaintainer ? "Maintainer" : null;
    const displayName = initialUsername ?? fetchedUsername ?? "Profile";
    const displayEmail = fetchedEmail ?? null;

    const isSettingsPage = pathname === "/settings" || pathname?.startsWith("/settings");

    return (
        <>
            <nav>
                <div className="navbar-header">
                    {!isSettingsPage && (
                        <div className="toggle-sidebar-nav col">
                            <button
                                className="toggle-sidebar col"
                                type="button"
                                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                aria-expanded={!isCollapsed}
                                aria-controls="quiz-sidebar"
                                onClick={(event) => {
                                    const nextCollapsed = !isCollapsed;
                                    setIsCollapsed(nextCollapsed);
                                    event.currentTarget.closest(".quiz-page, .dashboard-page, .admin-app-layout")?.classList.toggle(
                                        "sidebar-collapsed",
                                        nextCollapsed,
                                    );
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></svg>
                            </button>
                        </div>
                    )}
                    <Image src="/assets/QuizWeb-Logo.svg" width={48} height={48} alt="" />
                    <div>
                        <h2>QuizWeb</h2>
                        <p>code made fun</p>
                    </div>
                </div>
            </nav>
            <div className="sidebar" id="quiz-sidebar">
                <div className="sidebar-nav">
                    {/* Primary Navigation */}
                    <Link href={"/home"} className={`sidebar-option${isRouteActive(pathname, ["/home"]) ? " active" : ""}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        <p>Home</p>
                    </Link>
                    <Link href={"/quiz"} className={`sidebar-option${isRouteActive(pathname, ["/quiz", "/learn"]) ? " active" : ""}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap preview-icon"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
                        <p>Learn</p>
                    </Link>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-notebook-text"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5"/><path d="M9.5 12H16"/><path d="M9.5 16H14"/></svg>
                        <p>Cheat Sheet</p>
                    </div>
                    <div className={`sidebar-option${isRouteActive(pathname, ["/test"]) ? " active" : ""}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M13 3.055a9 9 0 1 0 7.941 7.945"/><path d="M15 6v3h3l3 -3h-3v-3z"/><path d="M15 9l-3 3"/></svg>
                        <p>Practice</p>
                    </div>
                    <div className="sidebar-option">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trophy"><path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/></svg>
                        <p>Leaderboard</p>
                    </div>

                    {/* Role-Aware Staff Navigation */}
                    {isAdmin && (
                        <Link href={"/admin"} className={`sidebar-option${isRouteActive(pathname, ["/admin", "/pending"]) ? " active" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                            <p>Admin Panel</p>
                        </Link>
                    )}
                    {(isAdmin || isMaintainer) && (
                        <Link href={"/maintainer"} className={`sidebar-option${isRouteActive(pathname, ["/maintainer", "/input"]) ? " active" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>
                            <p>Question Studio</p>
                        </Link>
                    )}
                    {(isAdmin || isMaintainer) && (
                        <>
                            <Link
                                href={`${isAdmin ? "/admin" : "/maintainer"}#quiz-workspace`}
                                className="sidebar-option sidebar-suboption"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                                <p>Create Quiz</p>
                            </Link>
                            <Link
                                href={`${isAdmin ? "/admin" : "/maintainer"}#pending-submissions`}
                                className="sidebar-option sidebar-suboption"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>
                                <p>Pending Review</p>
                            </Link>
                        </>
                    )}

                    {/* Bottom Profile and Settings */}
                    <div className="sidebar-option sidebar-profile">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-user"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
                        <p>{displayName}</p>
                        <p>{displayEmail}</p>
                        {roleBadge && (
                            <span className={`sidebar-role-badge role-${effectiveRole}`}>
                                {roleBadge}
                            </span>
                        )}
                    </div>
                    <Link href={"/settings"} className={`sidebar-option${isRouteActive(pathname, ["/settings"]) ? " active" : ""}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                        <p>Settings</p>
                    </Link>
                </div>
            </div>
        </>
    );
}