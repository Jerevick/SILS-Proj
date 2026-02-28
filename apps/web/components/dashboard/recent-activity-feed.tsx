"use client";

/**
 * Recent activity feed for dashboards. Uses TanStack Query; data can come from API or mock.
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText,
  UserPlus,
  DollarSign,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

export interface ActivityItem {
  id: string;
  action: string;
  target: string;
  time: string;
  type: "enrollment" | "application" | "finance" | "course" | "grade" | "general";
}

const TYPE_ICONS: Record<ActivityItem["type"], LucideIcon> = {
  enrollment: UserPlus,
  application: FileText,
  finance: DollarSign,
  course: BookOpen,
  grade: ClipboardCheck,
  general: GraduationCap,
};

async function fetchActivity(_context: string): Promise<ActivityItem[]> {
  // Placeholder: in a later phase this can call /api/dashboard/activity?context=...
  await new Promise((r) => setTimeout(r, 200));
  return [
    { id: "1", action: "Enrollment updated", target: "Fall 2025", time: "12 min ago", type: "enrollment" },
    { id: "2", action: "Application reviewed", target: "Jane Doe", time: "1 hour ago", type: "application" },
    { id: "3", action: "Fee payment received", target: "John Smith", time: "2 hours ago", type: "finance" },
    { id: "4", action: "Course published", target: "Intro to CS", time: "5 hours ago", type: "course" },
    { id: "5", action: "Grades submitted", target: "MATH 101", time: "1 day ago", type: "grade" },
  ];
}

const ACTIVITY_QUERY_KEY = ["dashboard-activity"] as const;

export function useDashboardActivity(context: string) {
  return useQuery({
    queryKey: [...ACTIVITY_QUERY_KEY, context],
    queryFn: () => fetchActivity(context),
    staleTime: 60 * 1000,
  });
}

export interface RecentActivityFeedProps {
  /** Dashboard context for scoped activity (sis, admissions, faculty, etc.) */
  context: string;
  title?: string;
}

export function RecentActivityFeed({ context, title = "Recent activity" }: RecentActivityFeedProps) {
  const { data: items = [], isLoading } = useDashboardActivity(context);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-white mb-3">
        {title}
      </h2>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl border border-white/5 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-6 text-slate-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">
            No recent activity.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item, i) => {
              const Icon = TYPE_ICONS[item.type];
              return (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="shrink-0 rounded-lg bg-white/5 p-2 text-slate-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {item.action}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.target} · {item.time}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </div>
  );
}
