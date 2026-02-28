/**
 * GET /api/xr/labs/[labId] — Fetch a single XR lab by ID (for immersive viewer).
 * Returns 404 if lab not found or user has no access (tenant + programme enrollment for learners).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type XRLabDetail = {
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ labId: string }> }
) {
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

  const { labId } = await params;
  if (!labId) {
    return NextResponse.json({ error: "labId required" }, { status: 400 });
  }

  const lab = await prisma.xR_Lab.findFirst({
    where: { id: labId },
    include: {
      programme: { select: { id: true, name: true, department: { select: { tenantId: true } } } },
      programmeModule: { select: { id: true, title: true } },
    },
  });

  if (!lab || lab.programme.department.tenantId !== tenantId) {
    return NextResponse.json({ error: "XR Lab not found" }, { status: 404 });
  }

  if (!isStaff) {
    const enrolled = await prisma.programmeEnrollment.findUnique({
      where: {
        programmeId_studentId: { programmeId: lab.programmeId, studentId: userId },
      },
    });
    if (!enrolled) {
      return NextResponse.json({ error: "Not enrolled in this programme" }, { status: 403 });
    }
  }

  const payload: XRLabDetail = {
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
  };

  return NextResponse.json(payload);
}
