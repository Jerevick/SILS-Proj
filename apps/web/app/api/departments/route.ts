/**
 * POST /api/departments — Create a department under a faculty (tenant-scoped).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const bodySchema = z.object({
  facultyId: z.string(),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
});

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
  const canCreate = role === "OWNER" || role === "ADMIN";
  if (!canCreate) {
    return NextResponse.json(
      { error: "Insufficient role to create department." },
      { status: 403 }
    );
  }

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
    const faculty = await prisma.faculty.findFirst({
      where: {
        id: parsed.data.facultyId,
        tenantId: result.context.tenantId,
      },
    });
    if (!faculty) {
      return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
    }

    const department = await prisma.department.create({
      data: {
        tenantId: result.context.tenantId,
        facultyId: parsed.data.facultyId,
        name: parsed.data.name,
        code: parsed.data.code ?? null,
      },
    });
    return NextResponse.json({
      id: department.id,
      facultyId: department.facultyId,
      name: department.name,
      code: department.code,
    });
  } catch (e) {
    console.error("Create department error:", e);
    return NextResponse.json(
      { error: "Failed to create department." },
      { status: 500 }
    );
  }
}
