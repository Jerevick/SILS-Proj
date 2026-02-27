import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";

export default function SchoolDashboardPage() {
  return (
    <>
      <PlaceholderStats
        stats={[
          { label: "Programs", value: "—" },
          { label: "Departments", value: "—" },
          { label: "Enrollment", value: "—" },
          { label: "Faculty", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "Manage programs", href: "/school/dashboard" },
          { label: "Analytics", href: "/school/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
