/**
 * Dashboard nav config: role- and package-aware links for the sidebar.
 */

export const SIS_NAV_ITEMS = [
  { href: "/sis/dashboard", label: "Institution" },
  { href: "/sis/hierarchy", label: "Hierarchy" },
  { href: "/sis/calendar", label: "Academic Calendar" },
  { href: "/sis/announcements/create", label: "Announcements" },
  { href: "/notifications", label: "Notifications" },
  { href: "/sis/equity", label: "Equity" },
  { href: "/admissions/dashboard", label: "Admissions" },
  { href: "/admissions/workflows", label: "Admissions Workflows" },
  { href: "/finance/dashboard", label: "Finance" },
  { href: "/advancement/dashboard", label: "Advancement" },
  { href: "/hr/dashboard", label: "HR & Faculty" },
  { href: "/school/dashboard", label: "School" },
  { href: "/department/dashboard", label: "Department" },
  { href: "/programmes", label: "Programmes" },
  { href: "/library", label: "Library" },
  { href: "/scheduling", label: "Scheduling" },
  { href: "/exams", label: "Exams" },
] as const;

export const FACULTY_NAV_ITEMS = [
  { href: "/faculty/dashboard", label: "Faculty Dashboard" },
  { href: "/faculty/orchestrator", label: "Orchestrator" },
  { href: "/notifications", label: "Notifications" },
  { href: "/announcements", label: "Announcements" },
  { href: "/appointments", label: "Appointments" },
  { href: "/courses", label: "Courses" },
  { href: "/programmes", label: "Programmes" },
  { href: "/library", label: "Library" },
  { href: "/scheduling", label: "Scheduling" },
  { href: "/exams", label: "Exams" },
  { href: "/xr/labs", label: "XR Labs" },
  { href: "/live", label: "Live" },
  { href: "/huddles", label: "Huddles" },
  { href: "/whiteboard", label: "Whiteboards" },
] as const;

export const STUDENT_NAV_ITEMS = [
  { href: "/student/dashboard", label: "Student Dashboard" },
  { href: "/notifications", label: "Notifications" },
  { href: "/announcements", label: "Announcements" },
  { href: "/appointments", label: "Appointments" },
  { href: "/registration", label: "Registration" },
  { href: "/success", label: "Student Success" },
  { href: "/progress/me", label: "My Progress" },
  { href: "/courses", label: "Courses" },
  { href: "/library", label: "Library" },
  { href: "/xr/labs", label: "XR Labs" },
  { href: "/live", label: "Live" },
  { href: "/whiteboard", label: "Whiteboards" },
] as const;

export function getSisNavItems(): { href: string; label: string }[] {
  return SIS_NAV_ITEMS.map(({ href, label }) => ({ href, label }));
}

export function getFacultyNavItems(): { href: string; label: string }[] {
  return FACULTY_NAV_ITEMS.map(({ href, label }) => ({ href, label }));
}

export function getStudentNavItems(): { href: string; label: string }[] {
  return STUDENT_NAV_ITEMS.map(({ href, label }) => ({ href, label }));
}
