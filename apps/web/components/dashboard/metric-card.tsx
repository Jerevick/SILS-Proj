"use client";

/**
 * Glassmorphism metric card for role-based dashboards.
 * Supports accent colors and framer-motion entrance.
 */

import { motion } from "framer-motion";

export type MetricAccent = "cyan" | "purple" | "magenta" | "green" | "amber";

const ACCENT_CLASSES: Record<MetricAccent, { card: string; icon: string }> = {
  cyan: {
    card: "border-neon-cyan/30 bg-neon-cyan/5",
    icon: "text-neon-cyan",
  },
  purple: {
    card: "border-neon-purple/30 bg-neon-purple/5",
    icon: "text-neon-purple",
  },
  magenta: {
    card: "border-neon-pink/30 bg-neon-pink/5",
    icon: "text-neon-pink",
  },
  green: {
    card: "border-emerald-500/30 bg-emerald-500/5",
    icon: "text-emerald-400",
  },
  amber: {
    card: "border-amber-500/30 bg-amber-500/5",
    icon: "text-amber-400",
  },
};

export interface DashboardMetricCardProps {
  label: string;
  value: string | number;
  /** Optional Lucide icon component */
  icon?: React.ComponentType<{ className?: string }>;
  accent?: MetricAccent;
  /** Stagger delay for grid entrance (seconds) */
  delay?: number;
  /** Optional trend or subtitle */
  subtitle?: string;
}

export function DashboardMetricCard({
  label,
  value,
  icon: Icon,
  accent,
  delay = 0,
  subtitle,
}: DashboardMetricCardProps) {
  const accentStyles = accent ? ACCENT_CLASSES[accent] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-xl glass border p-4 sm:p-5 transition-all hover:border-white/15 ${
        accentStyles?.card ?? "border-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl sm:text-2xl font-bold tabular-nums text-white tracking-tight">
            {value}
          </p>
          <p className="text-sm text-slate-400 mt-0.5">{label}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div
            className={`shrink-0 rounded-lg p-2 bg-white/5 ${
              accentStyles?.icon ?? "text-slate-400"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
