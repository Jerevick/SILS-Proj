import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";

export default function FinanceDashboardPage() {
  return (
    <>
      <PlaceholderStats
        stats={[
          { label: "Outstanding fees", value: "—" },
          { label: "Aid disbursed", value: "—" },
          { label: "Invoices", value: "—" },
          { label: "Budget", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "Financial aid", href: "/finance/dashboard" },
          { label: "Reports", href: "/finance/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
