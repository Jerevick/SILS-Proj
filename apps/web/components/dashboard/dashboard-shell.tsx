"use client";

/**
 * Shared dashboard shell: sidebar nav + main content.
 * Used by SIS, faculty, and student dashboard layouts.
 * Sidebar links are passed in so each layout can show role- and package-appropriate nav.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain } from "lucide-react";
import { LowBandwidthToggle } from "./low-bandwidth-toggle";

export type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  /** When true, show a prominent "Go to LMS" button (Hybrid mode for faculty/student). */
  showGoToLms?: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  navItems,
  showGoToLms = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-space-950 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 glass border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <Link
            href="/"
            className="font-display text-lg font-bold text-white hover:text-neon-cyan transition-colors"
          >
            SILS
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.active ??
              (pathname === item.href || pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {showGoToLms && (
            <a
              href="/dashboard"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold bg-neon-purple/20 text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 transition-colors"
            >
              <span>Go to LMS</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </a>
          )}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-2">
          <LowBandwidthToggle />
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-400 block"
          >
            Home
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="glass border-b border-white/5 shrink-0">
          <div className="px-6 py-4">
            <h1 className="font-display text-xl font-bold text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
            )}
          </div>
        </header>
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </main>

      {/* Floating AI Assistant — quick access to Intelligence Hub from anywhere */}
      {pathname !== "/ai/orchestrator" && (
        <Link
          href="/ai/orchestrator"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan shadow-lg hover:bg-neon-cyan/30 hover:scale-105 transition-all"
          title="Open SILS Intelligence Hub"
          aria-label="Open AI Assistant"
        >
          <Brain className="w-7 h-7" />
        </Link>
      )}
    </div>
  );
}

/**
 * Placeholder content for dashboard cards and quick actions.
 * Reused across all placeholder dashboards.
 */
export function PlaceholderStats({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="glass rounded-xl p-4 border border-white/5"
        >
          <p className="text-slate-400 text-sm">{s.label}</p>
          <p className="font-display text-2xl font-bold text-white mt-1">
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function PlaceholderQuickActions({
  actions,
}: {
  actions: { label: string; href: string }[];
}) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-lg font-semibold text-white mb-3">
        Quick actions
      </h2>
      <div className="flex flex-wrap gap-3">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="inline-flex items-center rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PlaceholderRecentActivity() {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-white mb-3">
        Recent activity
      </h2>
      <div className="glass rounded-xl border border-white/5 p-4">
        <p className="text-slate-500 text-sm">
          Activity feed will appear here in a later phase.
        </p>
      </div>
    </div>
  );
}
