/**
 * POST /api/programmes/[id]/modules — Create a programme module (tenant-scoped).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1).max(300),
  lecturerId: z.string().optional().nullable(),
  isCore: z.boolean().optional(),
  credits: z.number().int().min(0).optional(),
  order: z.number().int().min(0).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { role } = result.context;
  const canCreate = role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canCreate) {
    return NextResponse.json(
      { error: "Insufficient role to create module." },
      { status: 403 }
    );
  }

  const { id: programmeId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const programme = await prisma.programme.findFirst({
      where: {
        id: programmeId,
        department: { tenantId: result.context.tenantId },
      },
      include: { _count: { select: { modules: true } } },
    });
    if (!programme) {
      return NextResponse.json({ error: "Programme not found" }, { status: 404 });
    }

    const order =
      parsed.data.order ??
      (programme._count.modules > 0 ? programme._count.modules : 0);

    const moduleRecord = await prisma.programmeModule.create({
      data: {
        programmeId,
        title: parsed.data.title,
        lecturerId: parsed.data.lecturerId ?? userId,
        isCore: parsed.data.isCore ?? true,
        credits: parsed.data.credits ?? 0,
        order,
      },
    });

    return NextResponse.json({
      id: moduleRecord.id,
      programmeId: moduleRecord.programmeId,
      title: moduleRecord.title,
      syllabusStatus: moduleRecord.syllabusStatus,
      order: moduleRecord.order,
    });
  } catch (e) {
    console.error("Create programme module error:", e);
    return NextResponse.json(
      { error: "Failed to create module." },
      { status: 500 }
    );
  }
}
