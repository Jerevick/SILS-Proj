/**
 * GET /api/courses — List courses for current tenant (with search & filters).
 * POST /api/courses — Create a new course (tenant-scoped).
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";
import { z } from "zod";

const createBodySchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  mode: z.enum(["SYNC", "ASYNC"]).optional(),
});

export type CourseListItem = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  createdBy: string | null;
  mode: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { modules: number };
};

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await getTenantContext(orgId, userId);
  if (!result.ok) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const published = searchParams.get("published"); // "true" | "false" | omit
  const mode = searchParams.get("mode"); // SYNC | ASYNC

  try {
    const where: Prisma.CourseWhereInput = {
      tenantId: result.context.tenantId,
    };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (published === "true") where.published = true;
    if (published === "false") where.published = false;
    if (mode === "SYNC" || mode === "ASYNC") where.mode = mode;

    const courses = await prisma.course.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { modules: true } } },
    });

    const rows: CourseListItem[] = courses.map((c) => ({
      id: c.id,
      tenantId: c.tenantId,
      title: c.title,
      slug: c.slug,
      description: c.description,
      createdBy: c.createdBy,
      mode: c.mode,
      published: c.published,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      _count: c._count,
    }));

    return NextResponse.json(rows);
  } catch (e) {
    console.error("List courses error:", e);
    return NextResponse.json(
      { error: "Failed to list courses." },
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
  const canCreate =
    role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
  if (!canCreate) {
    return NextResponse.json(
      { error: "Insufficient role to create courses." },
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

  const { title, description, mode } = parsed.data;
  const slugBase = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  let slug = slugBase;
  let suffix = 0;
  const tenantId = result.context.tenantId;

  try {
    while (true) {
      const existing = await prisma.course.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
      });
      if (!existing) break;
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    const course = await prisma.course.create({
      data: {
        tenantId,
        title,
        slug,
        description: description ?? null,
        createdBy: userId,
        mode: (mode as "SYNC" | "ASYNC") ?? "ASYNC",
      },
      include: { _count: { select: { modules: true } } },
    });

    return NextResponse.json({
      id: course.id,
      tenantId: course.tenantId,
      title: course.title,
      slug: course.slug,
      description: course.description,
      createdBy: course.createdBy,
      mode: course.mode,
      published: course.published,
      createdAt: course.createdAt.toISOString(),
      updatedAt: course.updatedAt.toISOString(),
      _count: course._count,
    });
  } catch (e) {
    console.error("Create course error:", e);
    return NextResponse.json(
      { error: "Failed to create course." },
      { status: 500 }
    );
  }
}
