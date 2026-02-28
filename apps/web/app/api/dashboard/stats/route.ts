/**
 * GET /api/dashboard/stats — Dashboard metrics by context (role-based).
 * Returns placeholder stats; can be wired to real SIS/LMS data in a later phase.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext, getPackageType } from "@/lib/tenant-context";

export type DashboardContext =
  | "sis"
  | "admissions"
  | "finance"
  | "hr"
  | "school"
  | "department"
  | "faculty"
  | "student";

export interface DashboardStat {
  label: string;
  value: string | number;
}

export interface DashboardStatsResponse {
  stats: DashboardStat[];
}

// Placeholder stats per context. In production, derive from DB/analytics.
const MOCK_STATS: Record<DashboardContext, DashboardStat[]> = {
  sis: [
    { label: "Total students", value: "—" },
    { label: "Active courses", value: "—" },
    { label: "Pending requests", value: "—" },
    { label: "Departments", value: "—" },
  ],
  admissions: [
    { label: "Applications", value: "—" },
    { label: "Pending review", value: "—" },
    { label: "Accepted", value: "—" },
    { label: "Enrolled", value: "—" },
  ],
  finance: [
    { label: "Outstanding fees", value: "—" },
    { label: "Aid disbursed", value: "—" },
    { label: "Invoices", value: "—" },
    { label: "Budget", value: "—" },
  ],
  hr: [
    { label: "Faculty", value: "—" },
    { label: "Staff", value: "—" },
    { label: "Open positions", value: "—" },
    { label: "Leave requests", value: "—" },
  ],
  school: [
    { label: "Programs", value: "—" },
    { label: "Departments", value: "—" },
    { label: "Enrollment", value: "—" },
    { label: "Faculty", value: "—" },
  ],
  department: [
    { label: "Courses", value: "—" },
    { label: "Lecturers", value: "—" },
    { label: "Students", value: "—" },
    { label: "Modules", value: "—" },
  ],
  faculty: [
    { label: "My courses", value: "—" },
    { label: "Assignments due", value: "—" },
    { label: "Students", value: "—" },
    { label: "Grading pending", value: "—" },
  ],
  student: [
    { label: "Enrolled courses", value: "—" },
    { label: "Assignments due", value: "—" },
    { label: "Completed", value: "—" },
    { label: "Progress", value: "—" },
  ],
};

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const pkg = getPackageType(result.context);
  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context") as DashboardContext | null;

  if (!context || !MOCK_STATS[context]) {
    return NextResponse.json(
      { error: "Invalid or missing context" },
      { status: 400 }
    );
  }

  // LMS-Only: SIS contexts are not available
  const sisContexts: DashboardContext[] = [
    "sis",
    "admissions",
    "finance",
    "hr",
    "school",
    "department",
  ];
  if (pkg === "lms_only" && sisContexts.includes(context)) {
    return NextResponse.json(
      { error: "SIS dashboards not available in LMS-Only package" },
      { status: 403 }
    );
  }

  const stats = MOCK_STATS[context];
  return NextResponse.json({ stats });
}
