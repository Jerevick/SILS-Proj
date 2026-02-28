"use client";

/**
 * Finance Dashboard — Finance & Financial Aid.
 * Outstanding fees, aid, invoices, budget + activity + AI insights.
 */

import { DollarSign, Wallet, FileSpreadsheet, PieChart } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";

export default function FinanceDashboardPage() {
  const { data } = useDashboardStats("finance");
  const stats = data?.stats ?? [];

  const metrics = [
    { label: stats[0]?.label ?? "Outstanding fees", value: stats[0]?.value ?? "—", icon: DollarSign, accent: "amber" as const },
    { label: stats[1]?.label ?? "Aid disbursed", value: stats[1]?.value ?? "—", icon: Wallet, accent: "green" as const },
    { label: stats[2]?.label ?? "Invoices", value: stats[2]?.value ?? "—", icon: FileSpreadsheet, accent: "cyan" as const },
    { label: stats[3]?.label ?? "Budget", value: stats[3]?.value ?? "—", icon: PieChart, accent: "purple" as const },
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
          { label: "Financial aid", href: "/finance/aid" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: "Payments", href: "/finance/payments" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityFeed context="finance" />
        <AIInsightsWidget context="finance" />
      </div>
    </>
  );
}
