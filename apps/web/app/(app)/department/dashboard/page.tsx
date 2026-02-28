"use client";

/**
 * Department Dashboard — HoD (Head of Department).
 * Courses, lecturers, students, modules + activity + AI insights.
 */

import { BookOpen, Users, GraduationCap, FolderOpen } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function DepartmentDashboardPage() {
  const { data } = useDashboardStats("department");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "Courses", value: stats[0]?.value ?? "—", icon: BookOpen, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Lecturers", value: stats[1]?.value ?? "—", icon: Users, accent: "purple" as const },
    { label: stats[2]?.label ?? "Students", value: stats[2]?.value ?? "—", icon: GraduationCap, accent: "green" as const },
    { label: stats[3]?.label ?? "Modules", value: stats[3]?.value ?? "—", icon: FolderOpen, accent: "amber" as const },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m, i) => (
          <DashboardMetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            icon={m.icon}
            accent={m.accent}
            delay={i * 0.06}
          />
        ))}
      </div>

      <QuickActions
        actions={[
          { label: "Course catalog", href: "/department/dashboard" },
          { label: "Assignments", href: "/department/dashboard" },
          { label: "Timetable", href: "/department/dashboard" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="department" />
        <AIInsightsWidget context="department" />
      </div>
    </>
  );
}
