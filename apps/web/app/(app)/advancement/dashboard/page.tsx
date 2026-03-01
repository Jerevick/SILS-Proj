"use client";

/**
 * Advancement Dashboard — Fundraising overview with key metrics and AI insights.
 * Scoped: Advancement Officer, Development Director, Dean, OWNER, ADMIN.
 */

import { Users, Target, DollarSign, Heart } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function AdvancementDashboardPage() {
  const { data } = useDashboardStats("advancement");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "Donors", value: stats[0]?.value ?? "—", icon: Users, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Active campaigns", value: stats[1]?.value ?? "—", icon: Target, accent: "purple" as const },
    { label: stats[2]?.label ?? "YTD raised", value: stats[2]?.value ?? "—", icon: DollarSign, accent: "green" as const },
    { label: stats[3]?.label ?? "Avg affinity", value: stats[3]?.value ?? "—", icon: Heart, accent: "amber" as const },
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
          { label: "Donor directory", href: "/advancement/donors" },
          { label: "Campaigns", href: "/advancement/campaigns" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="advancement" />
        <AIInsightsWidget context="advancement" />
      </div>
    </>
  );
}
