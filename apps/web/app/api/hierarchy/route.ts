/**
 * GET /api/hierarchy — Full organizational hierarchy for the current tenant.
 * Phase 15: When schools_enabled returns Schools → Departments → Programmes;
 * otherwise returns Faculties → Departments → Programmes.
 * Used by the hierarchy builder and dashboards.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant-context";

export type HierarchySchoolNode = {
  id: string;
  name: string;
  code: string;
  deanId: string | null;
  description: string | null;
  departments: HierarchyDepartmentNode[];
};

export type HierarchyDepartmentNode = {
  id: string;
  name: string;
  code: string | null;
  schoolId: string | null;
  facultyId: string;
  programmes: HierarchyProgrammeNode[];
};

export type HierarchyProgrammeNode = {
  id: string;
  name: string;
  code: string;
  credits: number;
  departmentId: string;
  _count: { modules: number };
};

export type HierarchyFacultyNode = {
  id: string;
  name: string;
  code: string | null;
  departments: HierarchyDepartmentNode[];
};

export type HierarchyResponse = {
  schoolsEnabled: boolean;
  schools: HierarchySchoolNode[];
  faculties: HierarchyFacultyNode[];
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

  const tenantId = result.context.tenantId;
  const featureFlags = result.context.featureFlags as { schoolsEnabled?: boolean };
  const schoolsEnabled = featureFlags?.schoolsEnabled ?? false;

  try {
    let schools: HierarchySchoolNode[] = [];
    if (schoolsEnabled) {
      const rows = await prisma.school.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        include: {
          departments: {
            orderBy: { name: "asc" },
            include: {
              programmes: {
                orderBy: { name: "asc" },
                include: { _count: { select: { modules: true } } },
              },
            },
          },
        },
      });
      schools = rows.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        deanId: s.deanId,
        description: s.description,
        departments: s.departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          schoolId: d.schoolId,
          facultyId: d.facultyId,
          programmes: d.programmes.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            credits: p.credits,
            departmentId: p.departmentId,
            _count: p._count,
          })),
        })),
      }));
    }

    const facultyRows = await prisma.faculty.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        departments: {
          orderBy: { name: "asc" },
          include: {
            programmes: {
              orderBy: { name: "asc" },
              include: { _count: { select: { modules: true } } },
            },
          },
        },
      },
    });

    const faculties: HierarchyFacultyNode[] = facultyRows.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      departments: f.departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        schoolId: d.schoolId,
        facultyId: d.facultyId,
        programmes: d.programmes.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          credits: p.credits,
          departmentId: p.departmentId,
          _count: p._count,
        })),
      })),
    }));

    const payload: HierarchyResponse = {
      schoolsEnabled,
      schools,
      faculties,
    };

    return NextResponse.json(payload);
  } catch (e) {
    console.error("Hierarchy GET error:", e);
    return NextResponse.json(
      { error: "Failed to load hierarchy." },
      { status: 500 }
    );
  }
}
