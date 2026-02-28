/**
 * GET /api/programmes/[id] — Get a single programme with modules (tenant-scoped via department).
 * PATCH /api/programmes/[id] — Update programme (name, code, credits).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

export type ProgrammeWithModules = {
  id: string;
  name: string;
  code: string;
  curriculumJson: unknown;
  credits: number;
  department: { id: string; name: string; faculty: { id: string; name: string } };
  modules: {
    id: string;
    title: string;
    lecturerId: string | null;
    syllabusStatus: string;
    isCore: boolean;
    credits: number;
    order: number;
  }[];
};

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  code: z.string().min(1).max(50).optional(),
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
    const programme = await prisma.programme.findFirst({
      where: {
        id,
        department: { tenantId: result.context.tenantId },
      },
      include: {
        department: { include: { faculty: true } },
        modules: { orderBy: { order: "asc" } },
      },
    });

    if (!programme) {
      return NextResponse.json({ error: "Programme not found" }, { status: 404 });
    }

    const payload: ProgrammeWithModules = {
      id: programme.id,
      name: programme.name,
      code: programme.code,
      curriculumJson: programme.curriculumJson,
      credits: programme.credits,
      department: {
        id: programme.department.id,
        name: programme.department.name,
        faculty: {
          id: programme.department.faculty.id,
          name: programme.department.faculty.name,
        },
      },
      modules: programme.modules.map((m) => ({
        id: m.id,
        title: m.title,
        lecturerId: m.lecturerId,
        syllabusStatus: m.syllabusStatus,
        isCore: m.isCore,
        credits: m.credits,
        order: m.order,
      })),
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Get programme error:", e);
    return NextResponse.json(
      { error: "Failed to load programme." },
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
      { error: "Insufficient role to edit programme." },
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
    const existing = await prisma.programme.findFirst({
      where: {
        id,
        department: { tenantId: result.context.tenantId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Programme not found" }, { status: 404 });
    }

    const programme = await prisma.programme.update({
      where: { id },
      data: {
        ...(parsed.data.name != null && { name: parsed.data.name }),
        ...(parsed.data.code != null && { code: parsed.data.code }),
        ...(parsed.data.credits != null && { credits: parsed.data.credits }),
      },
    });

    return NextResponse.json({
      id: programme.id,
      name: programme.name,
      code: programme.code,
      credits: programme.credits,
    });
  } catch (e) {
    console.error("Patch programme error:", e);
    return NextResponse.json(
      { error: "Failed to update programme." },
      { status: 500 }
    );
  }
}
