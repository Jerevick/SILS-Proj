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

const SIS_PATH_PREFIXES = ["/sis", "/admissions", "/finance", "/advancement", "/hr", "/school", "/department"];

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
    pathname.startsWith("/advancement") ||
    pathname.startsWith("/hr") ||
    pathname.startsWith("/school") ||
    pathname.startsWith("/department");
  const isFacultyPath = pathname.startsWith("/faculty");
  const isStudentPath = pathname.startsWith("/student") || pathname.startsWith("/progress") || pathname.startsWith("/success");
  const isRegistrationPath = pathname.startsWith("/registration");
  const isCoursesPath = pathname.startsWith("/courses");
  const isGradingPath = pathname.startsWith("/grading");
  const isProgrammesPath = pathname.startsWith("/programmes") || pathname.startsWith("/modules");
  const isAnnouncementsPath = pathname.startsWith("/announcements");
  const isExamsPath = pathname.startsWith("/exams");
  const isSchedulingPath = pathname.startsWith("/scheduling");
  const isAppointmentsPath = pathname.startsWith("/appointments");
  const isNotificationsPath = pathname.startsWith("/notifications");
  const isSocialLivePath =
    pathname.startsWith("/huddles") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/whiteboard") ||
    pathname.startsWith("/attendance");
  const isXrPath = pathname.startsWith("/xr");
  const isAlumniPath = pathname.startsWith("/alumni");
  const isCareerPath = pathname.startsWith("/career");
  const isAiOrchestratorPath = pathname.startsWith("/ai");

  let navItems = filterNavItems(getFacultyNavItems());
  let title = "Faculty Dashboard";
  let subtitle = "Lecturer / Faculty";
  let showGoToLms = false;

  const hideFloatingAi = me.kind === "tenant" && me.featureFlags?.aiEnabled === false;
  function filterNavItems(items: { href: string; label: string }[]) {
    return hideFloatingAi ? items.filter((item) => item.href !== "/ai/orchestrator") : items;
  }

  if (isSisRoute && sisAvailable && staff) {
    navItems = filterNavItems(getSisNavItems());
    if (pathname.startsWith("/sis")) {
      title = "Institution";
      subtitle = "Institution Admin / Registrar";
    } else if (pathname.startsWith("/admissions")) {
      title = "Admissions";
      subtitle = "Admissions Office";
    } else if (pathname.startsWith("/finance")) {
      title = "Finance";
      subtitle = "Finance & Financial Aid";
    } else if (pathname.startsWith("/advancement")) {
      title = "Advancement";
      subtitle = "Donor, Fundraising & CRM";
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
    navItems = filterNavItems(getSisNavItems());
    title = "Programmes & Curriculum";
    subtitle = "Programme structure and module syllabi";
  } else if (isExamsPath) {
    navItems = filterNavItems(sisAvailable && staff ? getSisNavItems() : getFacultyNavItems());
    title = "Exams";
    subtitle = "AI-powered examination scheduling, seating & results";
    showGoToLms = hybrid;
  } else if (isSchedulingPath) {
    navItems = filterNavItems(sisAvailable && staff ? getSisNavItems() : getFacultyNavItems());
    title = "Scheduling";
    subtitle = "Intelligent timetabling & conflict resolution";
    showGoToLms = hybrid;
  } else if (pathname.startsWith("/calendar")) {
    navItems = filterNavItems(sisAvailable && staff ? getSisNavItems() : getFacultyNavItems());
    title = "Institutional Calendar";
    subtitle = "Events & activities with clash detection";
    showGoToLms = hybrid;
  } else if (isAnnouncementsPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems()
    );
    title = "Announcements";
    subtitle = "Centralized announcements";
    showGoToLms = hybrid;
  } else if (isAppointmentsPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems()
    );
    title = "Appointments";
    subtitle = "Office hours & advising";
    showGoToLms = hybrid;
  } else if (isNotificationsPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems()
    );
    title = pathname.startsWith("/notifications/templates")
      ? "Notification templates"
      : pathname.startsWith("/notifications/settings")
        ? "Notification settings"
        : "Notifications";
    subtitle = "Inbox and preferences";
    showGoToLms = hybrid;
  } else if (isCoursesPath || isGradingPath || isProgrammesPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems()
    );
    title = isProgrammesPath
      ? "Programmes & Curriculum"
      : isGradingPath
        ? "SpeedGrader"
        : "Courses";
    subtitle = isProgrammesPath
      ? "Programme structure and module syllabi"
      : isGradingPath
        ? "Grade submissions with AI"
        : "Browse and manage courses";
    showGoToLms = hybrid;
  } else if (isFacultyPath) {
    navItems = filterNavItems(getFacultyNavItems());
    title = pathname.startsWith("/faculty/orchestrator") ? "Faculty Orchestrator" : "Faculty Dashboard";
    subtitle = "Lecturer / Faculty";
    showGoToLms = hybrid;
  } else if (isSocialLivePath || isXrPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : getFacultyNavItems()
    );
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
    navItems = filterNavItems(getStudentNavItems());
    title = pathname.startsWith("/progress") ? "My Progress" : pathname.startsWith("/success") ? "Student Success" : "Student Dashboard";
    subtitle = "Student";
    showGoToLms = hybrid;
  } else if (isAlumniPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && isStaffRole(me.role)
        ? getSisNavItems()
        : me.kind === "tenant" && me.role === "LEARNER"
          ? getStudentNavItems()
          : getFacultyNavItems()
    );
    title = pathname.startsWith("/alumni/events") ? "Alumni events" : pathname === "/alumni" ? "Alumni Directory" : "Alumni profile";
    subtitle = "Alumni & Career Services";
    showGoToLms = hybrid;
  } else if (isCareerPath) {
    navItems = filterNavItems(
      me.kind === "tenant" && me.role === "LEARNER"
        ? getStudentNavItems()
        : me.kind === "tenant" && isStaffRole(me.role)
          ? getSisNavItems()
          : getFacultyNavItems()
    );
    title = "Career Hub";
    subtitle = "AI Career Coach, jobs & mentorship";
    showGoToLms = hybrid;
  } else if (isRegistrationPath) {
    navItems = filterNavItems(getStudentNavItems());
    title = "Registration";
    subtitle = "Course & module registration";
    showGoToLms = hybrid;
  } else if (isAiOrchestratorPath) {
    navItems = filterNavItems(
      sisAvailable && staff
        ? getSisNavItems()
        : me.kind === "tenant" && me.role === "LEARNER"
          ? getStudentNavItems()
          : getFacultyNavItems()
    );
    title = "SILS Intelligence Hub";
    subtitle = "Central AI — proactive insights and global assistant";
    showGoToLms = hybrid;
  }

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      navItems={navItems}
      showGoToLms={showGoToLms}
      hideFloatingAi={hideFloatingAi}
    >
      {children}
    </DashboardShell>
  );
}
