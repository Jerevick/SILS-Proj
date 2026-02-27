import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";

export default function SisDashboardPage() {
  return (
    <>
      <PlaceholderStats
        stats={[
          { label: "Total students", value: "—" },
          { label: "Active courses", value: "—" },
          { label: "Pending requests", value: "—" },
          { label: "Departments", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "Manage institution", href: "/sis/dashboard" },
          { label: "View reports", href: "/sis/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
