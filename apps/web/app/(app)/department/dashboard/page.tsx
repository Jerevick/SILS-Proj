import {
  PlaceholderStats,
  PlaceholderQuickActions,
  PlaceholderRecentActivity,
} from "@/components/dashboard/dashboard-shell";

export default function DepartmentDashboardPage() {
  return (
    <>
      <PlaceholderStats
        stats={[
          { label: "Courses", value: "—" },
          { label: "Lecturers", value: "—" },
          { label: "Students", value: "—" },
          { label: "Modules", value: "—" },
        ]}
      />
      <PlaceholderQuickActions
        actions={[
          { label: "Course catalog", href: "/department/dashboard" },
          { label: "Assignments", href: "/department/dashboard" },
        ]}
      />
      <PlaceholderRecentActivity />
    </>
  );
}
