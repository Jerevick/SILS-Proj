"use client";

/**
 * Layout for tenant dashboards (SIS, faculty, student).
 * Renders a role- and package-aware sidebar; shows "Go to LMS" in Hybrid for faculty/student.
 */

import { usePathname } from "next/navigation";
import { useMe, isHybridPackage, isSisAvailable, isStaffRole } from "@/hooks/use-me";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getSisNavItems,
  getFacultyNavItems,
  getStudentNavItems,
} from "@/lib/dashboard-nav";

type Props = { children: React.ReactNode };

export default function AppDashboardLayout({ children }: Props) {
  const pathname = usePathname();
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!me || (me.kind === "tenant" && !me.tenantId)) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <p className="text-slate-400">
          Unable to load context.{" "}
          <a href="/dashboard" className="text-neon-cyan hover:underline">
            Go to dashboard
          </a>
        </p>
      </div>
    );
  }

  const hybrid = isHybridPackage(me);
  const sisAvailable = isSisAvailable(me);
  const staff = me.kind === "tenant" && isStaffRole(me.role);

  const isSisPath =
    pathname.startsWith("/sis") ||
    pathname.startsWith("/admissions") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/hr") ||
    pathname.startsWith("/school") ||
    pathname.startsWith("/department");
  const isFacultyPath = pathname.startsWith("/faculty");
  const isStudentPath = pathname.startsWith("/student");

  let navItems = getFacultyNavItems();
  let title = "Faculty Dashboard";
  let subtitle = "Lecturer / Faculty";
  let showGoToLms = false;

  if (isSisPath && sisAvailable && staff) {
    navItems = getSisNavItems();
    if (pathname.startsWith("/sis")) {
      title = "Institution";
      subtitle = "Institution Admin / Registrar";
    } else if (pathname.startsWith("/admissions")) {
      title = "Admissions";
      subtitle = "Admissions Office";
    } else if (pathname.startsWith("/finance")) {
      title = "Finance";
      subtitle = "Finance & Financial Aid";
    } else if (pathname.startsWith("/hr")) {
      title = "HR & Faculty Affairs";
      subtitle = "HR & Faculty Affairs";
    } else if (pathname.startsWith("/school")) {
      title = "School";
      subtitle = "Dean / School Admin";
    } else if (pathname.startsWith("/department")) {
      title = "Department";
      subtitle = "HoD";
    }
  } else if (isFacultyPath) {
    navItems = getFacultyNavItems();
    title = "Faculty Dashboard";
    subtitle = "Lecturer / Faculty";
    showGoToLms = hybrid;
  } else if (isStudentPath) {
    navItems = getStudentNavItems();
    title = "Student Dashboard";
    subtitle = "Student";
    showGoToLms = hybrid;
  }

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      navItems={navItems}
      showGoToLms={showGoToLms}
    >
      {children}
    </DashboardShell>
  );
}
