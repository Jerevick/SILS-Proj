"use client";

/**
 * Quick action buttons for dashboards. Styled to match glassmorphism theme.
 */

import Link from "next/link";
import { motion } from "framer-motion";

export interface QuickAction {
  label: string;
  href: string;
  /** Optional accent (default cyan) */
  accent?: "cyan" | "purple";
}

export interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
}

export function QuickActions({ actions, title = "Quick actions" }: QuickActionsProps) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-lg font-semibold text-white mb-3">
        {title}
      </h2>
      <div className="flex flex-wrap gap-3">
        {actions.map((a, i) => {
          const isPurple = a.accent === "purple";
          const base =
            "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium border transition-colors";
          const className = isPurple
            ? `${base} bg-neon-purple/20 text-neon-purple border-neon-purple/50 hover:bg-neon-purple/30`
            : `${base} bg-neon-cyan/20 text-neon-cyan border-neon-cyan/50 hover:bg-neon-cyan/30`;
          return (
            <motion.div
              key={a.href + a.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <Link href={a.href} className={className}>
                {a.label}
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
