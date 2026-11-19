export interface SidebarNavItem {
  label: string;
  href: string;
}

export interface SidebarConfig {
  items: SidebarNavItem[];
  roleBadge: string | null;
}

export interface PrimaryNavLink {
  label: string;
  mobileDrawerLabel: string;
  href: string;
  activeRoutes: string[];
  icon: "home" | "learn" | "cheat-sheet" | "leaderboard";
}

export const PRIMARY_NAV_LINKS: PrimaryNavLink[] = [
  {
    label: "Home",
    mobileDrawerLabel: "Home Dashboard",
    href: "/home",
    activeRoutes: ["/home"],
    icon: "home",
  },
  {
    label: "Learn",
    mobileDrawerLabel: "Curriculum & Lessons",
    href: "/learn",
    activeRoutes: ["/learn", "/quiz"],
    icon: "learn",
  },
  {
    label: "Cheat Sheet",
    mobileDrawerLabel: "Cheat Sheet",
    href: "/cheat-sheet",
    activeRoutes: ["/cheat-sheet"],
    icon: "cheat-sheet",
  },
  {
    label: "Leaderboard",
    mobileDrawerLabel: "Leaderboard",
    href: "/leaderboard",
    activeRoutes: ["/leaderboard"],
    icon: "leaderboard",
  },
];

export const EXCLUDED_MOBILE_PREFIXES = [
  "/login",
  "/verify-email",
  "/quiz",
  "/quiz-cp",
  "/about",
  "/post-login",
] as const;

export function isExcludedMobileRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return EXCLUDED_MOBILE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isRouteActive(pathname: string, routes: string | string[]): boolean {
  const list = Array.isArray(routes) ? routes : [routes];
  return list.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getRouteTitle(pathname: string): string {
  if (pathname.startsWith("/admin") || pathname.startsWith("/pending")) return "Admin Panel";
  if (pathname.startsWith("/maintainer") || pathname.startsWith("/input")) return "Question Studio";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/profile")) return "Profile";
  if (pathname.startsWith("/learn") || pathname.startsWith("/quiz")) return "Learn";
  if (pathname.startsWith("/home")) return "Home";
  return "";
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
