/**
 * GET /api/admin/institutions — List all tenants (institutions). Super admin only.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canViewInstitutions } from "@/lib/platform-auth";

export type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  clerkOrgId: string;
  deploymentMode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; courses: number };
  onboardingRequest: {
    id: string;
    institutionName: string;
    contactPerson: string;
    contactEmail: string;
    status: string;
  } | null;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId || !(await canViewInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, courses: true } },
        onboardingRequests: {
          take: 1,
          orderBy: { approvedAt: "desc" },
          select: {
            id: true,
            institutionName: true,
            contactPerson: true,
            contactEmail: true,
            status: true,
          },
        },
      },
    });

    const rows: InstitutionRow[] = tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      clerkOrgId: t.clerkOrgId,
      deploymentMode: t.deploymentMode,
      status: "status" in t && typeof (t as { status?: string }).status === "string" ? (t as { status: string }).status : "ACTIVE",
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      _count: t._count,
      onboardingRequest: t.onboardingRequests[0] ?? null,
    }));

    return NextResponse.json(rows);
  } catch (e) {
    console.error("List institutions error:", e);
    return NextResponse.json(
      { error: "Failed to list institutions." },
      { status: 500 }
    );
  }
}
