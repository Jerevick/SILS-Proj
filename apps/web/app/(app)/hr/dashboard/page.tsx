"use client";

/**
 * HR Dashboard — HR & Faculty Affairs.
 * Faculty, staff, open positions, leave requests + activity + AI insights.
 */

import { Users, Briefcase, UserPlus, Calendar } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function HrDashboardPage() {
  const { data } = useDashboardStats("hr");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "Faculty", value: stats[0]?.value ?? "—", icon: Users, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Staff", value: stats[1]?.value ?? "—", icon: Briefcase, accent: "purple" as const },
    { label: stats[2]?.label ?? "Open positions", value: stats[2]?.value ?? "—", icon: UserPlus, accent: "green" as const },
    { label: stats[3]?.label ?? "Leave requests", value: stats[3]?.value ?? "—", icon: Calendar, accent: "amber" as const },
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
          { label: "Faculty directory", href: "/hr/faculty" },
          { label: "Leave management", href: "/hr/leaves" },
          { label: "HR Dashboard", href: "/hr/dashboard" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="hr" />
        <AIInsightsWidget context="hr" />
      </div>
    </>
  );
}
