"use client";

/**
 * Admissions Dashboard — Admissions team.
 * Applications, pending review, accepted, enrolled metrics + activity + AI insights.
 */

import { FileText, Clock, UserCheck, GraduationCap } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function AdmissionsDashboardPage() {
  const { data } = useDashboardStats("admissions");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "Applications", value: stats[0]?.value ?? "—", icon: FileText, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Pending review", value: stats[1]?.value ?? "—", icon: Clock, accent: "amber" as const },
    { label: stats[2]?.label ?? "Accepted", value: stats[2]?.value ?? "—", icon: UserCheck, accent: "green" as const },
    { label: stats[3]?.label ?? "Enrolled", value: stats[3]?.value ?? "—", icon: GraduationCap, accent: "purple" as const },
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
          { label: "New application", href: "/admissions/dashboard" },
          { label: "Review queue", href: "/admissions/dashboard" },
          { label: "Import applicants", href: "/admissions/dashboard" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="admissions" />
        <AIInsightsWidget context="admissions" />
      </div>
    </>
  );
}
