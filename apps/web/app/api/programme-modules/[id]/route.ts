/**
 * GET /api/programme-modules/[id] — Get a single programme module (for syllabus page).
 * PATCH /api/programme-modules/[id] — Update module (syllabus text, status, etc.).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

export type ProgrammeModuleDetail = {
  id: string;
  programmeId: string;
  programme: { id: string; name: string; code: string };
  lecturerId: string | null;
  title: string;
  syllabusText: string | null;
  syllabusGeneratedJson: unknown;
  syllabusStatus: string;
  isCore: boolean;
  credits: number;
  prerequisites: unknown;
  order: number;
  createdAt: string;
  updatedAt: string;
};

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  syllabusText: z.string().max(100000).optional().nullable(),
  syllabusStatus: z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]).optional(),
  isCore: z.boolean().optional(),
  credits: z.number().int().min(0).optional(),
});

export async function GET(
  _req: Request,
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

  const { id } = await params;

  try {
    const moduleRecord = await prisma.programmeModule.findFirst({
      where: {
        id,
        programme: {
          department: { tenantId: result.context.tenantId },
        },
      },
      include: { programme: { select: { id: true, name: true, code: true } } },
    });

    if (!moduleRecord) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const payload: ProgrammeModuleDetail = {
      id: moduleRecord.id,
      programmeId: moduleRecord.programmeId,
      programme: moduleRecord.programme,
      lecturerId: moduleRecord.lecturerId,
      title: moduleRecord.title,
      syllabusText: moduleRecord.syllabusText,
      syllabusGeneratedJson: moduleRecord.syllabusGeneratedJson,
      syllabusStatus: moduleRecord.syllabusStatus,
      isCore: moduleRecord.isCore,
      credits: moduleRecord.credits,
      prerequisites: moduleRecord.prerequisites,
      order: moduleRecord.order,
      createdAt: moduleRecord.createdAt.toISOString(),
      updatedAt: moduleRecord.updatedAt.toISOString(),
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Get programme module error:", e);
    return NextResponse.json(
      { error: "Failed to load module." },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
  const canEdit = role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canEdit) {
    return NextResponse.json(
      { error: "Insufficient role to edit module." },
      { status: 403 }
    );
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.programmeModule.findFirst({
      where: {
        id,
        programme: {
          department: { tenantId: result.context.tenantId },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const data: {
      title?: string;
      syllabusText?: string | null;
      syllabusStatus?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED";
      isCore?: boolean;
      credits?: number;
    } = {};
    if (parsed.data.title != null) data.title = parsed.data.title;
    if (parsed.data.syllabusText !== undefined) data.syllabusText = parsed.data.syllabusText;
    if (parsed.data.syllabusStatus != null) data.syllabusStatus = parsed.data.syllabusStatus;
    if (parsed.data.isCore != null) data.isCore = parsed.data.isCore;
    if (parsed.data.credits != null) data.credits = parsed.data.credits;

    const moduleRecord = await prisma.programmeModule.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: moduleRecord.id,
      title: moduleRecord.title,
      syllabusStatus: moduleRecord.syllabusStatus,
    });
  } catch (e) {
    console.error("Patch programme module error:", e);
    return NextResponse.json(
      { error: "Failed to update module." },
      { status: 500 }
    );
  }
}
