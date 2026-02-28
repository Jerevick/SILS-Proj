"use client";

/**
 * SIS Dashboard — Institution Admin / Registrar.
 * Overview, quick stats, recent activity, AI insights.
 */

import { Users, BookOpen, ClipboardList, Building2 } from "lucide-react";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { AIInsightsWidget } from "@/components/dashboard/ai-insights-widget";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useQuery } from "@tanstack/react-query";
import type { GridColDef } from "@mui/x-data-grid";

// Placeholder recent records for DataGrid (can be replaced by API)
interface RecentRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  date: string;
}

async function fetchRecentRecords(): Promise<RecentRecord[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [
    { id: "1", name: "Enrollment batch Fall 2025", type: "Enrollment", status: "Completed", date: "Today" },
    { id: "2", name: "Course MATH 101", type: "Course", status: "Active", date: "Yesterday" },
    { id: "3", name: "Transcript request", type: "Request", status: "Pending", date: "2 days ago" },
  ];
}

const recentColumns: GridColDef<RecentRecord>[] = [
  { field: "name", headerName: "Item", flex: 1, minWidth: 180 },
  { field: "type", headerName: "Type", width: 110 },
  { field: "status", headerName: "Status", width: 100 },
  { field: "date", headerName: "Date", width: 100 },
];

export default function SisDashboardPage() {
  const { data } = useDashboardStats("sis");
  const stats = data?.stats ?? [];
  const { data: recentRows = [] } = useQuery({
    queryKey: ["sis-recent-records"],
    queryFn: fetchRecentRecords,
    staleTime: 60 * 1000,
  });

  const metrics = [
    { label: stats[0]?.label ?? "Total students", value: stats[0]?.value ?? "—", icon: Users, accent: "cyan" as const },
    { label: stats[1]?.label ?? "Active courses", value: stats[1]?.value ?? "—", icon: BookOpen, accent: "purple" as const },
    { label: stats[2]?.label ?? "Pending requests", value: stats[2]?.value ?? "—", icon: ClipboardList, accent: "amber" as const },
    { label: stats[3]?.label ?? "Departments", value: stats[3]?.value ?? "—", icon: Building2, accent: "green" as const },
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
        title="Quick actions"
        actions={[
          { label: "Manage institution", href: "/sis/dashboard" },
          { label: "View reports", href: "/sis/dashboard" },
          { label: "Academic calendar", href: "/sis/dashboard" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RecentActivityFeed context="sis" title="Recent activity" />
        <AIInsightsWidget context="sis" />
      </div>

      <DashboardDataGrid<RecentRecord>
        title="Recent records"
        columns={recentColumns}
        rows={recentRows}
        pageSize={5}
      />
    </>
  );
}
