import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";

export default function HrDashboardPage() {
  return (
    <>
      <PlaceholderStats
        stats={[
          { label: "Faculty", value: "—" },
          { label: "Staff", value: "—" },
          { label: "Open positions", value: "—" },
          { label: "Leave requests", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "Faculty affairs", href: "/hr/dashboard" },
          { label: "Recruitment", href: "/hr/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
