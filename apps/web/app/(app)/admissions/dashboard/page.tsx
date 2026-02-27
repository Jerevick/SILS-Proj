import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";

export default function AdmissionsDashboardPage() {
  return (
    <>
      <PlaceholderStats
        stats={[
          { label: "Applications", value: "—" },
          { label: "Pending review", value: "—" },
          { label: "Accepted", value: "—" },
          { label: "Enrolled", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "New application", href: "/admissions/dashboard" },
          { label: "Review queue", href: "/admissions/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
