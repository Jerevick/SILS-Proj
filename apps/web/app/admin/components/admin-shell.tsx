"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Users,
  Home,
  ChevronLeft,
  ChevronRight,
  Shield,
  BarChart3,
  Activity,
  Settings,
  Bell,
  Search,
} from "lucide-react";
import { PLATFORM_ROLE_LABELS } from "@/lib/platform-roles";
import type { PlatformRole } from "@/lib/platform-roles";

const SIDEBAR_EXPANDED_KEY = "sils-admin-sidebar-expanded";
const SIDEBAR_WIDTH_EXPANDED = 256;
const SIDEBAR_WIDTH_COLLAPSED = 72;

type NavItem = {
  key: "dashboard" | "institutions" | "requests" | "platform-admins" | "analytics" | "health" | "settings";
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { key: "institutions", label: "Institutions", href: "/admin/institutions", icon: Building2 },
  { key: "requests", label: "Onboarding Requests", href: "/admin/requests", icon: ClipboardList },
  { key: "platform-admins", label: "Users & Roles", href: "/admin/platform-admins", icon: Users, show: true },
  { key: "analytics", label: "Analytics & Insights", href: "/admin/analytics", icon: BarChart3 },
  { key: "health", label: "System Health", href: "/admin/health", icon: Activity },
  { key: "settings", label: "Settings", href: "/admin/settings", icon: Settings },
];

const BREADCRUMB_MAP: Record<string, string> = {
  "/admin": "Platform Admin",
  "/admin/dashboard": "Dashboard",
  "/admin/institutions": "Institutions",
  "/admin/requests": "Onboarding Requests",
  "/admin/platform-admins": "Users & Roles",
  "/admin/analytics": "Analytics & Insights",
  "/admin/health": "System Health",
  "/admin/settings": "Settings",
};

function getBreadcrumbs(pathname: string): { href: string; label: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [];
  let path = "";
  for (let i = 0; i < segments.length; i++) {
    path += "/" + segments[i];
    const label = BREADCRUMB_MAP[path] ?? segments[i].charAt(0).toUpperCase() + segments[i].slice(1);
    crumbs.push({ href: path, label });
  }
  return crumbs;
}

export function AdminShell({
  children,
  activeNav = "dashboard",
}: {
  children: React.ReactNode;
  activeNav?: "dashboard" | "institutions" | "requests" | "platform-admins" | "analytics" | "health" | "settings";
}) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const platformRole = me?.kind === "platform_staff" ? (me.platformRole as PlatformRole) : null;
  const roleLabel = platformRole ? PLATFORM_ROLE_LABELS[platformRole] : "Platform staff";

  const [sidebarExpanded, setSidebarExpandedState] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      if (stored !== null) setSidebarExpandedState(stored === "true");
    } catch {
      /* ignore */
    }
  }, []);
  const setSidebarExpanded = (v: boolean) => {
    setSidebarExpandedState(v);
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  const navItems = NAV_ITEMS.filter(
    () => true
  );
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="flex min-h-screen bg-space-950 text-slate-200">
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 z-40 flex h-full flex-col border-r border-white/10 bg-space-900 transition-[width] duration-200 ease-out"
        style={{
          width: sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED,
        }}
      >
        {/* Logo */}
        <Link
          href="/admin/dashboard"
          className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neon-cyan/20 text-neon-cyan">
            <Shield className="h-5 w-5" />
          </div>
          {sidebarExpanded && (
            <span className="font-display text-lg font-bold tracking-tight text-white">
              SILS Admin
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sidebarExpanded ? (
            <>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Overview
              </p>
              <ul className="space-y-0.5">
                {navItems
                  .filter((n) => n.key === "dashboard")
                  .map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={
                          "relative z-10 flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                          (activeNav === item.key
                            ? "bg-neon-cyan/15 text-neon-cyan"
                            : "text-slate-400 hover:bg-white/5 hover:text-white")
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
              </ul>
              <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Management
              </p>
              <ul className="space-y-0.5">
                {navItems
                  .filter((n) => ["institutions", "requests"].includes(n.key))
                  .map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={
                          "relative z-10 flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                          (activeNav === item.key
                            ? "bg-neon-cyan/15 text-neon-cyan"
                            : "text-slate-400 hover:bg-white/5 hover:text-white")
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
              </ul>
              <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Access & System
              </p>
              <ul className="space-y-0.5 pb-4">
                {navItems
                  .filter((n) => ["platform-admins", "analytics", "health", "settings"].includes(n.key))
                  .map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={
                          "relative z-10 flex min-h-[40px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                          (activeNav === item.key
                            ? "bg-neon-cyan/15 text-neon-cyan"
                            : "text-slate-400 hover:bg-white/5 hover:text-white")
                        }
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    title={item.label}
                    className={
                      "relative z-10 flex min-h-[40px] cursor-pointer items-center justify-center rounded-lg p-2.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white " +
                      (activeNav === item.key ? "bg-neon-cyan/15 text-neon-cyan" : "")
                    }
                  >
                    <item.icon className="h-5 w-5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Footer: Home + collapse */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <Link
            href="/"
            className={
              "mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white " +
              (sidebarExpanded ? "" : "justify-center")
            }
          >
            <Home className="h-5 w-5 shrink-0" />
            {sidebarExpanded && <span>Back to app</span>}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-400"
            aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {sidebarExpanded && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

        {/* Main area */}
      <div
        className="flex min-h-screen flex-1 flex-col transition-[margin] duration-200 ease-out"
        style={{
          marginLeft: sidebarExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED,
        }}
      >
        {/* Top bar: Logo left, Search center, Notifications + Badge + Avatar right */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-white/10 bg-space-950/95 px-4 backdrop-blur-xl md:px-6">
          {/* Logo (left) */}
          <Link
            href="/admin/dashboard"
            className="flex shrink-0 items-center gap-2 md:gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neon-cyan/20 text-neon-cyan shadow-glow-cyan">
              <Shield className="h-5 w-5" />
            </div>
            <span className="hidden font-display text-lg font-bold tracking-tight text-white sm:inline">
                SILS Platform
              </span>
          </Link>

          {/* Global search (center) */}
          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                placeholder="Search institutions, requests..."
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none transition focus:border-neon-cyan/40 focus:ring-1 focus:ring-neon-cyan/20"
                aria-label="Global search"
              />
            </div>
          </div>

          {/* Right: breadcrumbs (mobile) or spacer, then notifications + badge + avatar */}
          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <nav className="flex sm:hidden items-center gap-2 text-xs text-slate-400" aria-label="Breadcrumb">
              {breadcrumbs.length > 0 && (
                <Link href={breadcrumbs[breadcrumbs.length - 1]?.href ?? "/admin"} className="font-medium text-white truncate max-w-[120px]">
                  {breadcrumbs[breadcrumbs.length - 1]?.label}
                </Link>
              )}
            </nav>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <span className="rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-xs font-semibold text-neon-cyan shadow-sm">
              Super Admin
            </span>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 ring-1 ring-white/10",
                },
                variables: {
                  colorBackground: "rgba(15, 23, 42, 0.95)",
                  colorText: "#e2e8f0",
                  colorPrimary: "#00f5ff",
                  borderRadius: "0.5rem",
                },
              }}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
