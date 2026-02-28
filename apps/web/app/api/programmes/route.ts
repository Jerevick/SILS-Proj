/**
 * GET /api/programmes — List programmes with hierarchy (Faculty → Department → Programme).
 * POST /api/programmes — Create a programme (tenant-scoped via department).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const createBodySchema = z.object({
  departmentId: z.string(),
  name: z.string().min(1).max(300),
  code: z.string().min(1).max(50),
  credits: z.number().int().min(0).optional(),
});

export type ProgrammeHierarchyItem = {
  id: string;
  name: string;
  code: string | null;
  departments: {
    id: string;
    name: string;
    code: string | null;
    programmes: {
      id: string;
      name: string;
      code: string;
      credits: number;
      _count: { modules: number };
    }[];
  }[];
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

  try {
    const faculties = await prisma.faculty.findMany({
      where: { tenantId: result.context.tenantId },
      include: {
        departments: {
          include: {
            programmes: {
              include: { _count: { select: { modules: true } } },
              orderBy: { name: "asc" },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    });

    const payload: ProgrammeHierarchyItem[] = faculties.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      departments: f.departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        programmes: d.programmes.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          credits: p.credits,
          _count: p._count,
        })),
      })),
    }));

    return NextResponse.json(payload);
  } catch (e) {
    console.error("List programmes error:", e);
    return NextResponse.json(
      { error: "Failed to list programmes." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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
      { error: "Insufficient role to create programme." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const department = await prisma.department.findFirst({
      where: {
        id: parsed.data.departmentId,
        tenantId: result.context.tenantId,
      },
    });
    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const programme = await prisma.programme.create({
      data: {
        departmentId: parsed.data.departmentId,
        name: parsed.data.name,
        code: parsed.data.code,
        credits: parsed.data.credits ?? 0,
      },
    });
    return NextResponse.json({
      id: programme.id,
      name: programme.name,
      code: programme.code,
      credits: programme.credits,
      departmentId: programme.departmentId,
    });
  } catch (e) {
    console.error("Create programme error:", e);
    return NextResponse.json(
      { error: "Failed to create programme." },
      { status: 500 }
    );
  }
}
