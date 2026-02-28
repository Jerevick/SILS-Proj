/**
 * Dashboard nav config: role- and package-aware links for the sidebar.
 */

export const SIS_NAV_ITEMS = [
  { href: "/sis/dashboard", label: "Institution" },
  { href: "/admissions/dashboard", label: "Admissions" },
  { href: "/finance/dashboard", label: "Finance" },
  { href: "/hr/dashboard", label: "HR & Faculty" },
  { href: "/school/dashboard", label: "School" },
  { href: "/department/dashboard", label: "Department" },
] as const;

export const FACULTY_NAV_ITEMS = [
  { href: "/faculty/dashboard", label: "Faculty Dashboard" },
  { href: "/courses", label: "Courses" },
] as const;

export const STUDENT_NAV_ITEMS = [
  { href: "/student/dashboard", label: "Student Dashboard" },
  { href: "/courses", label: "Courses" },
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
