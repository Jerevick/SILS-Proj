/**
 * GET /api/xr/labs — List XR labs for the current user.
 * Learners: labs for programmes they are enrolled in.
 * Staff (OWNER/ADMIN/INSTRUCTOR): all XR labs in the tenant.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type XRLabListItem = {
  id: string;
  title: string;
  xrType: string;
  programmeId: string;
  programmeName: string;
  programmeModuleId: string | null;
  programmeModuleTitle: string | null;
  sceneConfig: Record<string, unknown>;
  masteryMetrics: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { tenantId, role } = result.context;
  const isStaff =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";

  try {
    let labIds: string[];

    if (isStaff) {
      const labs = await prisma.xR_Lab.findMany({
        where: {
          programme: { department: { tenantId } },
        },
        select: { id: true },
      });
      labIds = labs.map((l) => l.id);
    } else {
      const enrollments = await prisma.programmeEnrollment.findMany({
        where: { studentId: userId, programme: { department: { tenantId } } },
        select: { programmeId: true },
      });
      const programmeIds = enrollments.map((e) => e.programmeId);
      if (programmeIds.length === 0) {
        return NextResponse.json([]);
      }
      const labs = await prisma.xR_Lab.findMany({
        where: { programmeId: { in: programmeIds } },
        select: { id: true },
      });
      labIds = labs.map((l) => l.id);
    }

    if (labIds.length === 0) {
      return NextResponse.json([]);
    }

    const labs = await prisma.xR_Lab.findMany({
      where: { id: { in: labIds } },
      include: {
        programme: { select: { id: true, name: true } },
        programmeModule: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const rows: XRLabListItem[] = labs.map((lab) => ({
      id: lab.id,
      title: lab.title,
      xrType: lab.xrType,
      programmeId: lab.programme.id,
      programmeName: lab.programme.name,
      programmeModuleId: lab.programmeModule?.id ?? null,
      programmeModuleTitle: lab.programmeModule?.title ?? null,
      sceneConfig: (lab.sceneConfig as Record<string, unknown>) ?? {},
      masteryMetrics: (lab.masteryMetrics as Record<string, unknown>) ?? {},
      createdAt: lab.createdAt.toISOString(),
      updatedAt: lab.updatedAt.toISOString(),
    }));

    return NextResponse.json(rows);
  } catch (e) {
    console.error("List XR labs error:", e);
    return NextResponse.json(
      { error: "Failed to list XR labs." },
      { status: 500 }
    );
  }
}
