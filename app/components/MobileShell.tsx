"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileRoutes = [
  { label: "Home", href: "/home", icon: "⌂" },
  { label: "Learn", href: "/learn", icon: "▣" },
  { label: "Quiz", href: "/quiz", icon: "✓" },
  { label: "Settings", href: "/settings", icon: "⚙" },
];

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mobile-shell">
      <header className="mobile-app-bar">
        <Link href="/home" className="mobile-app-brand" aria-label="QuizWeb home">
          <Image src="/assets/QuizWeb-Logo.svg" width={32} height={32} alt="" priority />
          <span>QuizWeb</span>
        </Link>
        <button type="button" className="mobile-app-action" aria-label="Open mobile actions">
          <span aria-hidden="true">•••</span>
        </button>
      </header>

      <div className="mobile-shell-content">{children}</div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileRoutes.map((route) => {
          const active = isActiveRoute(pathname, route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              className={`mobile-bottom-nav-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-bottom-nav-icon" aria-hidden="true">
                {route.icon}
              </span>
              <span>{route.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
