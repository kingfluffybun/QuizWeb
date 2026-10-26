"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOutAction } from "@/app/actions/auth";
import type { UserInfoResponse } from "@/app/api/db/user-info/route";

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
    email?: string;
    avatarColor?: string;
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

function getRouteTitle(pathname: string) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/pending")) return "Admin Panel";
    if (pathname.startsWith("/maintainer") || pathname.startsWith("/input")) return "Question Studio";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/profile")) return "Profile";
    if (pathname.startsWith("/learn") || pathname.startsWith("/quiz")) return "Learn";
    if (pathname.startsWith("/home")) return "Home";
    return "";
}





export default function Sidebar(props: SidebarProps = {}) {
    const { data: session } = useSession();
    const sessionUser = session?.user as { role?: string; user_role?: string; name?: string; email?: string } | undefined;

    const initialRole = props.role || sessionUser?.role || sessionUser?.user_role;
    const initialUsername = props.username || sessionUser?.name;
    const initialEmail = props.email || sessionUser?.email;
    const initialAvaColor = props.avatarColor;

    const [fetchedRole, setFetchedRole] = useState<string | undefined>(initialRole);
    const [fetchedUsername, setFetchedUsername] = useState<string | undefined>(initialUsername);
    const [fetchedEmail, setFetchedEmail] = useState<string | undefined>(initialEmail);
    const [fetchedAvaColor, setFetcedAvaColor] = useState<string | undefined>(initialAvaColor);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    const pathname = usePathname();
    const currentPageIconRef = useRef<HTMLDivElement>(null);
    const currentPageTitleRef = useRef<HTMLHeadingElement>(null);
    const profileContainerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // Skip network round-trip if all essential profile data is already provided
        if (props.role && props.username && props.email && props.avatarColor) return;
        let isMounted = true;
        fetch("/api/db/user-info")
            .then(async (res) => {
                const json = await res.json();
                if (!isMounted || !res.ok) return;
                if (Object.keys(json).length === 0) return;
                
                const userData: UserInfoResponse | undefined = json as UserInfoResponse | undefined;

                if (userData?.user_role) setFetchedRole(userData.user_role);
                if (userData?.username) setFetchedUsername(userData.username);
                if (userData?.email) setFetchedEmail(userData.email);
                if (userData?.avatar_color) setFetcedAvaColor(userData.avatar_color);
            })
            .catch((err) => {
                // Silently fallback to unauthenticated/user default
                console.error("API Fetch encountered an error:", err);
            });
        return () => {
            isMounted = false;
        };
    }, [props.role, props.username, props.email, props.avatarColor]);

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
        const activeOption = document.querySelector("#quiz-sidebar .sidebar-option.active");
        const activeIcon = activeOption?.querySelector<SVGSVGElement>("svg:nth-of-type(2)")
            ?? activeOption?.querySelector<SVGSVGElement>("svg");

        currentPageIconRef.current?.replaceChildren(
            ...(activeIcon ? [activeIcon.cloneNode(true)] : []),
        );
        if (currentPageTitleRef.current) {
            currentPageTitleRef.current.textContent =
                activeOption?.querySelector("p")?.textContent?.trim() ?? getRouteTitle(pathname);
        }
    }, [pathname, effectiveRole]);

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
        <>

            <div className="sidebar" id="quiz-sidebar">
                <div className="sidebar-nav">
                    <div className="logo">
                        <Image src="/assets/QuizWeb-Logo.svg" width={48} height={48} alt="" />
                        <div>
                            <h2>QuizWeb</h2>
                            <p>code made fun</p>
                        </div>
                    </div>
                    {/* Primary Navigation */}
                    <div className="sidebar-main">
                        <Link href={"/home"} className={`sidebar-option${isRouteActive(pathname, ["/home"]) ? " active" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M12 1.5C12.5171 1.5 13.0196 1.66034 13.4395 1.95605L13.6133 2.09082L13.6162 2.09277L20.6162 8.09277H20.6152C20.892 8.32713 21.1149 8.61834 21.2676 8.94727C21.4206 9.27697 21.5 9.63654 21.5 10V19C21.5 19.663 21.2364 20.2997 20.7676 20.7686C20.2988 21.2372 19.6629 21.5 19 21.5H15V13.1113C15 12.8166 14.8946 12.5336 14.707 12.3252C14.5195 12.1169 14.2651 12 14 12H10C9.73486 12 9.48049 12.1169 9.29297 12.3252C9.10543 12.5336 9 12.8166 9 13.1113V21.5H5C4.33708 21.5 3.70124 21.2372 3.23242 20.7686C2.76358 20.2997 2.5 19.663 2.5 19V10C2.5 9.63654 2.57944 9.27697 2.73242 8.94727C2.88502 8.61857 3.10733 8.32705 3.38379 8.09277L10.3838 2.09277L10.3867 2.09082C10.8379 1.70954 11.4093 1.5 12 1.5Z" fill="currentColor"/> </svg>
                            <p>Home</p>
                        </Link>
                        <Link href={"/learn"} className={`sidebar-option${isRouteActive(pathname, ["/learn"]) ? " active" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap preview-icon"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M21.4198 10.9224C21.5988 10.8434 21.7507 10.7136 21.8567 10.5492C21.9627 10.3847 22.0181 10.1927 22.0161 9.99709C22.0141 9.80144 21.9547 9.61068 21.8454 9.44844C21.736 9.2862 21.5814 9.15961 21.4008 9.08436L12.8298 5.18036C12.5692 5.06151 12.2862 5 11.9998 5C11.7134 5 11.4304 5.06151 11.1698 5.18036L2.5998 9.08036C2.42177 9.15833 2.27031 9.28649 2.16396 9.44917C2.05761 9.61185 2.00098 9.802 2.00098 9.99636C2.00098 10.1907 2.05761 10.3809 2.16396 10.5435C2.27031 10.7062 2.42177 10.8344 2.5998 10.9124L11.1698 14.8204C11.4304 14.9392 11.7134 15.0007 11.9998 15.0007C12.2862 15.0007 12.5692 14.9392 12.8298 14.8204L21.4198 10.9224Z" fill="currentColor" stroke="currentColor"/> <path d="M22 10V16" stroke="currentColor"/> <path d="M6 16.5V14.5C6 14.5 9.53008 17 12 17C14.4699 17 18 14.5 18 14.5V16.5C18 17.2956 17.3679 18.0587 16.2426 18.6213C15.1174 19.1839 13.5913 19.5 12 19.5C10.4087 19.5 8.88258 19.1839 7.75736 18.6213C6.63214 18.0587 6 17.2956 6 16.5Z" fill="currentColor" stroke="currentColor"/> </svg>

                            <p>Learn</p>
                        </Link>
                        <Link href="/cheat-sheet" className={`sidebar-option${isRouteActive(pathname, ["/cheat-sheet"]) ? " active" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-notebook-text"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9.5 8h5"/><path d="M9.5 12H16"/><path d="M9.5 16H14"/></svg>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M18 1.5C19.3807 1.5 20.5 2.61929 20.5 4V20C20.5 21.3807 19.3807 22.5 18 22.5H6C4.61929 22.5 3.5 21.3807 3.5 20V18.5H6V17.5H3.5V14.5H6V13.5H3.5V10.5H6V9.5H3.5V6.5H6V5.5H3.5V4C3.5 2.61929 4.61929 1.5 6 1.5H18ZM9.5 15.5V16.5H14V15.5H9.5ZM9.5 12.5H16V11.5H9.5V12.5ZM9.5 8.5H14.5V7.5H9.5V8.5Z" fill="currentColor"/> </svg>
                            <p>Cheat Sheet</p>
                        </Link>
                        <Link
                            href="/quiz"
                            aria-current={isRouteActive(pathname, ["/quiz"]) ? "page" : undefined}
                            className={`sidebar-option${isRouteActive(pathname, ["/quiz"]) ? " active" : ""}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M13 3.055a9 9 0 1 0 7.941 7.945"/><path d="M15 6v3h3l3 -3h-3v-3z"/><path d="M15 9l-3 3"/></svg>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <path d="M11 12C11 12.2652 11.1054 12.5196 11.2929 12.7071C11.4804 12.8946 11.7348 13 12 13C12.2652 13 12.5196 12.8946 12.7071 12.7071C12.8946 12.5196 13 12.2652 13 12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M12 7C11.0111 7 10.0444 7.29324 9.22215 7.84265C8.39991 8.39206 7.75904 9.17295 7.3806 10.0866C7.00217 11.0002 6.90315 12.0055 7.09608 12.9755C7.289 13.9454 7.76521 14.8363 8.46447 15.5355C9.16373 16.2348 10.0546 16.711 11.0246 16.9039C11.9945 17.0969 12.9998 16.9978 13.9134 16.6194C14.827 16.241 15.6079 15.6001 16.1574 14.7779C16.7068 13.9556 17 12.9889 17 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M13 3.05514C11.1461 2.84715 9.2733 3.22042 7.64079 4.12331C6.00827 5.0262 4.69667 6.41409 3.88743 8.095C3.07818 9.77591 2.81128 11.6667 3.12365 13.506C3.43601 15.3452 4.31221 17.0419 5.63103 18.3614C6.94985 19.6809 8.64611 20.5579 10.4852 20.8712C12.3242 21.1845 14.2152 20.9186 15.8965 20.1102C17.5779 19.3018 18.9664 17.9909 19.8701 16.3588C20.7738 14.7267 21.148 12.8542 20.941 11.0001" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M15 6V9H18L21 6H18V3L15 6Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> <path d="M15 9L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> </svg>
                            <p>Practice</p>
                        </Link>
                        <Link href="/leaderboard" className={`sidebar-option${isRouteActive(pathname, ["/leaderboard"]) ? " active" : ""}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trophy"><path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/></svg>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M21.2678 9.26777C20.7989 9.73661 20.663 10 20 10V4H21C21.2652 4 21.5196 4.10536 21.7071 4.29289C21.8947 4.48043 22 4.73478 22 5V7.5C22 8.16304 21.7366 8.79893 21.2678 9.26777Z" fill="currentColor" stroke="currentColor"/> <path d="M9.70711 17.7073C9.89464 17.5197 10 17.2654 10 17.0002H12L14 17C14 17.2652 14.1054 17.5197 14.2929 17.7073C14.4804 17.8948 14.7348 18.0002 15 18.0002C15.5304 18.0002 16.0391 18.2109 16.4142 18.5859C16.7893 18.961 17 19.4697 17 20.0002V22.0002H7V20.0002C7 19.4697 7.21071 18.961 7.58579 18.5859C7.96086 18.2109 8.46957 18.0002 9 18.0002C9.26522 18.0002 9.51957 17.8948 9.70711 17.7073Z" fill="currentColor"/> <path d="M7 22.0002V20.0002C7 19.4697 7.21071 18.961 7.58579 18.5859C7.96086 18.2109 8.46957 18.0002 9 18.0002C9.26522 18.0002 9.51957 17.8948 9.70711 17.7073C9.89464 17.5197 10 17.2654 10 17.0002H12L14 17C14 17.2652 14.1054 17.5197 14.2929 17.7073C14.4804 17.8948 14.7348 18.0002 15 18.0002C15.5304 18.0002 16.0391 18.2109 16.4142 18.5859C16.7893 18.961 17 19.4697 17 20.0002V22.0002M7 22.0002H4M7 22.0002H17M17 22.0002H20" stroke="currentColor"/> <path d="M6 9C6 10.5913 6.63214 12.1174 7.75736 13.2426C8.88258 14.3679 10.4087 15 12 15C13.5913 15 15.1174 14.3679 16.2426 13.2426C17.3679 12.1174 18 10.5913 18 9V3C18 2.73478 17.8946 2.48043 17.7071 2.29289C17.5196 2.10536 17.2652 2 17 2H7C6.73478 2 6.48043 2.10536 6.29289 2.29289C6.10536 2.48043 6 2.73478 6 3V9Z" fill="currentColor" stroke="currentColor"/> <path d="M2.73223 9.26777C3.20107 9.73661 3.33696 10 4 10V4H3C2.73478 4 2.48043 4.10536 2.29289 4.29289C2.10536 4.48043 2 4.73478 2 5V7.5C2 8.16304 2.26339 8.79893 2.73223 9.26777Z" fill="currentColor" stroke="currentColor"/> </svg>
                            <p>Leaderboard</p>
                        </Link>
                    </div>

                    <div className="sidebar-bottom">
                        <div className="profile-container" ref={profileContainerRef}>
                            <button
                                type="button"
                                className="profile-menu-toggle"
                                aria-label={`${isProfileMenuOpen ? "Close" : "Open"} profile menu for ${displayName}`}
                                aria-expanded={isProfileMenuOpen}
                                aria-controls="profile-menu"
                                onClick={() => setIsProfileMenuOpen((open) => !open)}
                            >
                                <span className="profile-icon" aria-hidden="true" style={{backgroundColor: avaColor}}><span>{profileInitial}</span></span>
                                <div className="profile-detail">
                                    <p id="name">{firstName}</p>
                                    <p id="email">{displayEmail}</p>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-up preview-icon"><path d="m18 15-6-6-6 6"/></svg>
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
                                    <div className="profile-icon" aria-hidden="true" style={{backgroundColor: avaColor}}><span>{profileInitial}</span></div>
                                    <div className="profile-detail">
                                        <p id="name">{displayName}</p>
                                        <p id="email">{displayEmail}</p>
                                    </div>
                                </div>
                                <hr></hr>
                                <div className="profile-options-container">
                                    <Link href={"/profile"} className="profile-options">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className ="lucide lucide-user preview-icon"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        <p>Profile</p>
                                    </Link>
                                    {/* Role-Aware Staff Navigation */}
                                    {isAdmin && (
                                        <Link href={"/admin"} className={`profile-options${isRouteActive(pathname, ["/admin", "/pending"]) ? " active" : ""}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
                                            <p>Admin Panel</p>
                                        </Link>
                                    )}
                                    {(isAdmin || isMaintainer) && (
                                        <Link href={"/maintainer"} className={`profile-options${isRouteActive(pathname, ["/maintainer", "/input"]) ? " active" : ""}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-square-pen"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>
                                            <p>Question Studio</p>
                                        </Link>
                                    )}
                                    <Link href={"/settings"} className={`profile-options${isRouteActive(pathname, ["/settings"]) ? " active" : ""}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
                                        <p>Settings</p>
                                    </Link>
                                </div>
                                <hr></hr>
                                <form action={signOutAction}>
                                    <button type="submit" className="profile-options profile-logout">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-out preview-icon"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
                                        <p>Log Out</p>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}