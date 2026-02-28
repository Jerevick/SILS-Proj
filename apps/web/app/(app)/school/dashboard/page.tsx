"use client";

/**
 * School Dashboard — Dean / School Admin.
 * Programs, departments, enrollment, faculty + activity + AI insights.
 */

import { Layers, Building2, Users, GraduationCap } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function SchoolDashboardPage() {
  const { data } = useDashboardStats("school");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "Programs", value: stats[0]?.value ?? "—", icon: Layers, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Departments", value: stats[1]?.value ?? "—", icon: Building2, accent: "purple" as const },
    { label: stats[2]?.label ?? "Enrollment", value: stats[2]?.value ?? "—", icon: GraduationCap, accent: "green" as const },
    { label: stats[3]?.label ?? "Faculty", value: stats[3]?.value ?? "—", icon: Users, accent: "amber" as const },
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
          { label: "Manage programs", href: "/school/dashboard" },
          { label: "Analytics", href: "/school/dashboard" },
          { label: "Accreditation", href: "/school/dashboard" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="school" />
        <AIInsightsWidget context="school" />
      </div>
    </>
  );
}
