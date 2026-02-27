/**
 * GET /api/admin/stats — Dashboard metrics for Super Admin. Super admin only.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canViewInstitutions, canViewOnboarding } from "@/lib/platform-auth";

export type AdminStats = {
  totalInstitutions: number;
  activeStudents: number;
  pendingOnboardingRequests: number;
  aiAgentsRunning: number;
  systemHealthScore: number;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [canInstitutions, canOnboarding] = await Promise.all([
    canViewInstitutions(userId),
    canViewOnboarding(userId),
  ]);
  if (!canInstitutions && !canOnboarding) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [tenantCount, activeStudents, pendingCount] = await Promise.all([
      canInstitutions ? prisma.tenant.count() : 0,
      canInstitutions ? prisma.userTenantRole.count() : 0,
      canOnboarding
        ? prisma.onboardingRequest.count({ where: { status: "PENDING" } })
        : 0,
    ]);

    const stats: AdminStats = {
      totalInstitutions: Number(tenantCount),
      activeStudents,
      pendingOnboardingRequests: Number(pendingCount),
      aiAgentsRunning: 0,
      systemHealthScore: 98,
    };

    return NextResponse.json(stats);
  } catch (e) {
    console.error("Admin stats error:", e);
    return NextResponse.json(
      { error: "Failed to load stats." },
      { status: 500 }
    );
  }
}
