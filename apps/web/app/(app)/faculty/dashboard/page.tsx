import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";
import { GoToLmsBanner } from "@/components/dashboard/go-to-lms-banner";

export default function FacultyDashboardPage() {
  return (
    <>
      <GoToLmsBanner />
      <PlaceholderStats
        stats={[
          { label: "My courses", value: "—" },
          { label: "Assignments due", value: "—" },
          { label: "Students", value: "—" },
          { label: "Grading pending", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "Create course", href: "/faculty/dashboard" },
          { label: "Grade assignments", href: "/faculty/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
