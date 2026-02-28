/**
 * GET /api/programmes/[id]/curriculum — Get programme curriculum JSON.
 * PATCH /api/programmes/[id]/curriculum — Update curriculum JSON (tenant-scoped).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

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
      select: { id: true, curriculumJson: true, name: true, code: true },
    });

    if (!programme) {
      return NextResponse.json({ error: "Programme not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: programme.id,
      name: programme.name,
      code: programme.code,
      curriculumJson: programme.curriculumJson,
    });
  } catch (e) {
    console.error("Get curriculum error:", e);
    return NextResponse.json(
      { error: "Failed to load curriculum." },
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
      { error: "Insufficient role to edit curriculum." },
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

  const curriculumJson =
    body && typeof body === "object" && "curriculumJson" in body
      ? (body as { curriculumJson: unknown }).curriculumJson
      : body;

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
      data: { curriculumJson: curriculumJson ?? undefined },
    });

    return NextResponse.json({
      id: programme.id,
      curriculumJson: programme.curriculumJson,
    });
  } catch (e) {
    console.error("Patch curriculum error:", e);
    return NextResponse.json(
      { error: "Failed to update curriculum." },
      { status: 500 }
    );
  }
}
