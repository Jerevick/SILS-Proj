"use client";

/**
 * Prominent "Go to LMS" CTA for Hybrid package on faculty/student dashboards.
 */

import { useMe, isHybridPackage } from "@/hooks/use-me";
import Link from "next/link";

export function GoToLmsBanner() {
  const { data: me } = useMe();
  if (!isHybridPackage(me)) return null;

  return (
    <div className="mb-8 rounded-xl border border-neon-purple/40 bg-neon-purple/10 p-6">
      <h2 className="font-display text-lg font-semibold text-white mb-2">
        Learning management
      </h2>
      <p className="text-slate-400 text-sm mb-4">
        Open the LMS to access courses, assignments, and grades.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/30 px-5 py-3 text-base font-semibold text-neon-purple border-2 border-neon-purple/60 hover:bg-neon-purple/40 transition-colors"
      >
        Go to LMS
        <svg
          className="w-5 h-5"
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
      </Link>
    </div>
  );
}
