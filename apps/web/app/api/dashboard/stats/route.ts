/**
 * GET /api/dashboard/stats — Dashboard metrics by context (role-based).
 * Returns placeholder stats; can be wired to real SIS/LMS data in a later phase.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTenantContext, getPackageType } from "@/lib/tenant-context";
import { canAccessAdvancement } from "@/lib/advancement-auth";
import { prisma } from "@/lib/db";

export type DashboardContext =
  | "sis"
  | "admissions"
  | "finance"
  | "hr"
  | "advancement"
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
  advancement: [
    { label: "Donors", value: "—" },
    { label: "Active campaigns", value: "—" },
    { label: "YTD raised", value: "—" },
    { label: "Avg affinity", value: "—" },
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
  const schoolId = searchParams.get("schoolId"); // Phase 15: optional filter by school when schools_enabled

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
    "advancement",
    "school",
    "department",
  ];
  if (pkg === "lms_only" && sisContexts.includes(context)) {
    return NextResponse.json(
      { error: "SIS dashboards not available in LMS-Only package" },
      { status: 403 }
    );
  }

  // Phase 15: When schools_enabled and schoolId provided, stats can filter by school (for future real data).
  const featureFlags = result.context.featureFlags as { schoolsEnabled?: boolean };
  if (schoolId && featureFlags?.schoolsEnabled) {
    // Reserved for filtering stats by school.
  }

  // Phase 25: Advancement context — real metrics from Donor/Campaign/Donation
  if (context === "advancement" && canAccessAdvancement(result.context.role)) {
    const tenantId = result.context.tenantId;
    const [donorCount, campaigns, donationsAgg, avgAffinity] = await Promise.all([
      prisma.donor.count({ where: { tenantId } }),
      prisma.campaign.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: { id: true },
      }),
      prisma.donation.aggregate({
        where: {
          donor: { tenantId },
          date: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
        _sum: { amount: true },
      }),
      prisma.donor.aggregate({
        where: { tenantId },
        _avg: { affinityScore: true },
        _count: { id: true },
      }),
    ]);
    const ytdRaised = donationsAgg._sum.amount ?? 0;
    const avgAff = avgAffinity._count.id > 0 ? (avgAffinity._avg.affinityScore ?? 0) : 0;
    const stats: DashboardStat[] = [
      { label: "Donors", value: donorCount },
      { label: "Active campaigns", value: campaigns.length },
      { label: "YTD raised", value: `$${Number(ytdRaised).toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
      { label: "Avg affinity", value: avgAff.toFixed(1) },
    ];
    return NextResponse.json({ stats });
  }

  const stats = MOCK_STATS[context];
  return NextResponse.json({ stats });
}
