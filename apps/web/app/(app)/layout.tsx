"use client";

/**
 * Layout for tenant dashboards (SIS, faculty, student).
 * Renders a role- and package-aware sidebar; shows "Go to LMS" in Hybrid for faculty/student.
 * Redirects LMS-Only users away from SIS routes to /dashboard.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe, isHybridPackage, isSisAvailable, isStaffRole } from "@/hooks/use-me";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getSisNavItems,
  getFacultyNavItems,
  getStudentNavItems,
} from "@/lib/dashboard-nav";

type Props = { children: React.ReactNode };

const SIS_PATH_PREFIXES = ["/sis", "/admissions", "/finance", "/hr", "/school", "/department"];

function isSisPath(pathname: string): boolean {
  return SIS_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function AppDashboardLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  // LMS-Only package: staff must not access SIS dashboards; redirect to hub
  useEffect(() => {
    if (!me || me.kind !== "tenant" || me.package !== "lms_only") return;
    if (!isSisPath(pathname)) return;
    router.replace("/dashboard");
  }, [me, pathname, router]);

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

  const isSisRoute =
    pathname.startsWith("/sis") ||
    pathname.startsWith("/admissions") ||
    pathname.startsWith("/finance") ||
    pathname.startsWith("/hr") ||
    pathname.startsWith("/school") ||
    pathname.startsWith("/department");
  const isFacultyPath = pathname.startsWith("/faculty");
  const isStudentPath = pathname.startsWith("/student") || pathname.startsWith("/progress") || pathname.startsWith("/success");
  const isCoursesPath = pathname.startsWith("/courses");
  const isProgrammesPath = pathname.startsWith("/programmes") || pathname.startsWith("/modules");
  const isSocialLivePath =
    pathname.startsWith("/huddles") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/whiteboard") ||
    pathname.startsWith("/attendance");
  const isXrPath = pathname.startsWith("/xr");

  let navItems = getFacultyNavItems();
  let title = "Faculty Dashboard";
  let subtitle = "Lecturer / Faculty";
  let showGoToLms = false;

  if (isSisRoute && sisAvailable && staff) {
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
  } else if (isProgrammesPath && sisAvailable && staff) {
    navItems = getSisNavItems();
    title = "Programmes & Curriculum";
    subtitle = "Programme structure and module syllabi";
  } else if (isCoursesPath || isProgrammesPath) {
    navItems =
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems();
    title = isProgrammesPath ? "Programmes & Curriculum" : "Courses";
    subtitle = isProgrammesPath
      ? "Programme structure and module syllabi"
      : "Browse and manage courses";
    showGoToLms = hybrid;
  } else if (isFacultyPath) {
    navItems = getFacultyNavItems();
    title = pathname.startsWith("/faculty/orchestrator") ? "Faculty Orchestrator" : "Faculty Dashboard";
    subtitle = "Lecturer / Faculty";
    showGoToLms = hybrid;
  } else if (isSocialLivePath || isXrPath) {
    navItems =
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems();
    if (pathname.startsWith("/huddles")) {
      title = "Huddle";
      subtitle = "Collaborative discussion";
    } else if (pathname.startsWith("/live")) {
      title = "Live class";
      subtitle = "Video and AI co-host";
    } else if (pathname.startsWith("/whiteboard")) {
      title = "Whiteboard";
      subtitle = "Collaborative canvas";
    } else if (pathname.startsWith("/attendance")) {
      title = "Attendance";
      subtitle = "Engagement and presence";
    } else if (pathname.startsWith("/xr")) {
      title = "XR Labs";
      subtitle = "Immersive learning";
    } else {
      title = "Social & Live";
      subtitle = "Huddles, live class, whiteboard";
    }
    showGoToLms = hybrid;
  } else if (isStudentPath) {
    navItems = getStudentNavItems();
    title = pathname.startsWith("/progress") ? "My Progress" : pathname.startsWith("/success") ? "Student Success" : "Student Dashboard";
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
