"use client";

/**
 * Faculty Dashboard — Lecturer.
 * In Hybrid mode, "Go to LMS" is shown in sidebar and via GoToLmsBanner.
 * My courses, assignments due, students, grading pending + activity + AI insights.
 */

import { BookOpen, ClipboardList, Users, CheckSquare } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { GoToLmsBanner } from "@/components/dashboard/go-to-lms-banner";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function FacultyDashboardPage() {
  const { data } = useDashboardStats("faculty");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "My courses", value: stats[0]?.value ?? "—", icon: BookOpen, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Assignments due", value: stats[1]?.value ?? "—", icon: ClipboardList, accent: "amber" as const },
    { label: stats[2]?.label ?? "Students", value: stats[2]?.value ?? "—", icon: Users, accent: "purple" as const },
    { label: stats[3]?.label ?? "Grading pending", value: stats[3]?.value ?? "—", icon: CheckSquare, accent: "green" as const },
  ];

  return (
    <>
      <GoToLmsBanner />
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
          { label: "Create course", href: "/faculty/dashboard" },
          { label: "Grade assignments", href: "/faculty/dashboard" },
          { label: "Go to LMS", href: "/dashboard", accent: "purple" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="faculty" />
        <AIInsightsWidget context="faculty" />
      </div>
    </>
  );
}
