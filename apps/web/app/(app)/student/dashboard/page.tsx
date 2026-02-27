import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";
import { GoToLmsBanner } from "@/components/dashboard/go-to-lms-banner";

export default function StudentDashboardPage() {
  return (
    <>
      <GoToLmsBanner />
      <PlaceholderStats
        stats={[
          { label: "Enrolled courses", value: "—" },
          { label: "Assignments due", value: "—" },
          { label: "Completed", value: "—" },
          { label: "Progress", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "My courses", href: "/student/dashboard" },
          { label: "Assignments", href: "/student/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
