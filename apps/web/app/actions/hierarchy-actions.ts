"use server";

/**
 * Phase 15: Flexible Organizational Hierarchy — Schools/Colleges layer.
 * Server actions: CreateSchool (with Dean assignment), GetUserHierarchyContext.
 * Respects feature flag schools_enabled and scoped roles.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import type { RoleScopeType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HierarchySchool = {
  id: string;
  name: string;
  code: string;
  deanId: string | null;
  description: string | null;
  departments: HierarchyDepartment[];
};

export type HierarchyDepartment = {
  id: string;
  name: string;
  code: string | null;
  schoolId: string | null;
  programmes: HierarchyProgramme[];
};

export type HierarchyProgramme = {
  id: string;
  name: string;
  code: string;
  credits: number;
  departmentId: string;
  _count?: { modules: number };
};

/** Full hierarchy context for the current user based on scoped roles. */
export type UserHierarchyContext = {
  schoolsEnabled: boolean;
  /** When schoolsEnabled: schools the user can access (empty = all if tenant-wide). */
  schools: HierarchySchool[];
  /** Departments the user can access (filtered by school/department scope when applicable). */
  departments: HierarchyDepartment[];
  /** Programme IDs the user can access (for programme-scoped role). */
  programmeIds: string[];
  /** User has tenant-wide (or equivalent) access to full hierarchy. */
  fullAccess: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return {
    ok: true as const,
    userId,
    orgId,
    tenantId: tenantResult.context.tenantId,
    featureFlags: tenantResult.context.featureFlags,
    role: tenantResult.context.role,
  };
}

// ---------------------------------------------------------------------------
// CreateSchool
// ---------------------------------------------------------------------------

export type CreateSchoolInput = {
  name: string;
  code: string;
  deanId?: string | null;
  description?: string | null;
};

export type CreateSchoolResult =
  | { ok: true; schoolId: string }
  | { ok: false; error: string };

/**
 * Create a School (phase 15). Requires schools_enabled and OWNER/ADMIN.
 * Optionally assign a Dean (Clerk user id).
 */
export async function createSchool(
  input: CreateSchoolInput
): Promise<CreateSchoolResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const schoolsEnabled = (ctx.featureFlags as { schoolsEnabled?: boolean })
    ?.schoolsEnabled ?? false;
  if (!schoolsEnabled) {
    return { ok: false, error: "Schools layer is not enabled for this tenant." };
  }

  const canCreate =
    ctx.role === "OWNER" || ctx.role === "ADMIN";
  if (!canCreate) {
    return { ok: false, error: "Insufficient role to create a school." };
  }

  const name = input.name?.trim();
  const code = input.code?.trim().toUpperCase();
  if (!name || !code) {
    return { ok: false, error: "Name and code are required." };
  }

  try {
    const existing = await prisma.school.findUnique({
      where: {
        tenantId_code: { tenantId: ctx.tenantId, code },
      },
    });
    if (existing) {
      return { ok: false, error: `A school with code "${code}" already exists.` };
    }

    const school = await prisma.school.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        code,
        deanId: input.deanId ?? null,
        description: input.description?.trim() || null,
      },
    });
    return { ok: true, schoolId: school.id };
  } catch (e) {
    console.error("CreateSchool error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create school.",
    };
  }
}

// ---------------------------------------------------------------------------
// UpdateSchool
// ---------------------------------------------------------------------------

export type UpdateSchoolInput = {
  schoolId: string;
  name?: string;
  code?: string;
  deanId?: string | null;
  description?: string | null;
};

export type UpdateSchoolResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Update a School. Requires schools_enabled and OWNER/ADMIN.
 */
export async function updateSchool(
  input: UpdateSchoolInput
): Promise<UpdateSchoolResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const schoolsEnabled = (ctx.featureFlags as { schoolsEnabled?: boolean })
    ?.schoolsEnabled ?? false;
  if (!schoolsEnabled) {
    return { ok: false, error: "Schools layer is not enabled for this tenant." };
  }

  const canUpdate = ctx.role === "OWNER" || ctx.role === "ADMIN";
  if (!canUpdate) {
    return { ok: false, error: "Insufficient role to update a school." };
  }

  try {
    const existing = await prisma.school.findFirst({
      where: { id: input.schoolId, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return { ok: false, error: "School not found." };
    }

    const data: { name?: string; code?: string; deanId?: string | null; description?: string | null } = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.code !== undefined) data.code = input.code.trim().toUpperCase();
    if (input.deanId !== undefined) data.deanId = input.deanId || null;
    if (input.description !== undefined) data.description = input.description?.trim() || null;

    if (data.code && data.code !== existing.code) {
      const conflict = await prisma.school.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: data.code } },
      });
      if (conflict) {
        return { ok: false, error: `A school with code "${data.code}" already exists.` };
      }
    }

    await prisma.school.update({
      where: { id: input.schoolId },
      data,
    });
    return { ok: true };
  } catch (e) {
    console.error("UpdateSchool error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update school.",
    };
  }
}

// ---------------------------------------------------------------------------
// CreateDepartment (with optional school scope)
// ---------------------------------------------------------------------------

export type CreateDepartmentInput = {
  facultyId: string;
  schoolId?: string | null;
  name: string;
  code?: string | null;
};

export type CreateDepartmentResult =
  | { ok: true; departmentId: string }
  | { ok: false; error: string };

/**
 * Create a Department under a Faculty; optionally under a School when schools_enabled.
 */
export async function createDepartment(
  input: CreateDepartmentInput
): Promise<CreateDepartmentResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const canCreate = ctx.role === "OWNER" || ctx.role === "ADMIN";
  if (!canCreate) {
    return { ok: false, error: "Insufficient role to create a department." };
  }

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };

  try {
    const faculty = await prisma.faculty.findFirst({
      where: { id: input.facultyId, tenantId: ctx.tenantId },
    });
    if (!faculty) {
      return { ok: false, error: "Faculty not found." };
    }

    if (input.schoolId) {
      const school = await prisma.school.findFirst({
        where: { id: input.schoolId, tenantId: ctx.tenantId },
      });
      if (!school) {
        return { ok: false, error: "School not found." };
      }
    }

    const department = await prisma.department.create({
      data: {
        tenantId: ctx.tenantId,
        facultyId: input.facultyId,
        schoolId: input.schoolId ?? null,
        name,
        code: input.code?.trim() || null,
      },
    });
    return { ok: true, departmentId: department.id };
  } catch (e) {
    console.error("CreateDepartment error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create department.",
    };
  }
}

// ---------------------------------------------------------------------------
// GetUserHierarchyContext
// ---------------------------------------------------------------------------

/**
 * Returns the full hierarchy (schools → departments → programmes) the user has access to,
 * based on scoped roles. When user has only tenant-wide role, fullAccess is true and
 * all schools/departments/programmes are returned (when schools_enabled).
 */
export async function getUserHierarchyContext(): Promise<
  UserHierarchyContext | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const schoolsEnabled = (ctx.featureFlags as { schoolsEnabled?: boolean })
    ?.schoolsEnabled ?? false;

  // Load all role rows for this user in this tenant (tenant-wide + scoped).
  const roleRows = await prisma.userTenantRole.findMany({
    where: {
      tenantId: ctx.tenantId,
      clerkUserId: ctx.userId,
    },
  });

  const hasTenantWide = roleRows.some((r) => r.scopeType === null);
  const schoolScopes = roleRows.filter(
    (r) => r.scopeType === "SCHOOL" && r.scopeId
  );
  const departmentScopes = roleRows.filter(
    (r) => r.scopeType === "DEPARTMENT" && r.scopeId
  );
  const programmeScopes = roleRows.filter(
    (r) => r.scopeType === "PROGRAMME" && r.scopeId
  );

  const fullAccess =
    hasTenantWide ||
    (roleRows.length === 0); // No roles = treat as admin for backward compat

  const schoolIds = new Set<string>();
  const departmentIds = new Set<string>();
  const programmeIds = new Set<string>();

  if (fullAccess) {
    // Return full hierarchy; we'll load everything below.
  } else {
    schoolScopes.forEach((r) => r.scopeId && schoolIds.add(r.scopeId));
    departmentScopes.forEach((r) => r.scopeId && departmentIds.add(r.scopeId));
    programmeScopes.forEach((r) => r.scopeId && programmeIds.add(r.scopeId));
  }

  try {
    if (schoolsEnabled) {
      const allSchools = await prisma.school.findMany({
        where: { tenantId: ctx.tenantId },
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

      let schools: HierarchySchool[];
      const allProgrammeIds = new Set<string>();

      if (fullAccess) {
        schools = allSchools.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          deanId: s.deanId,
          description: s.description,
          departments: s.departments.map((d) => {
            d.programmes.forEach((p) => allProgrammeIds.add(p.id));
            return {
              id: d.id,
              name: d.name,
              code: d.code,
              schoolId: d.schoolId,
              programmes: d.programmes.map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code,
                credits: p.credits,
                departmentId: p.departmentId,
                _count: p._count,
              })),
            };
          }),
        }));
      } else {
        const allowedSchoolIds = new Set(schoolIds);
        const allowedDeptIds = new Set(departmentIds);
        const allowedProgIds = new Set(programmeIds);
        schools = allSchools
          .filter(
            (s) =>
              allowedSchoolIds.has(s.id) ||
              s.departments.some(
                (d) =>
                  allowedDeptIds.has(d.id) ||
                  d.programmes.some((p) => allowedProgIds.has(p.id))
              )
          )
          .map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            deanId: s.deanId,
            description: s.description,
            departments: s.departments
              .filter(
                (d) =>
                  allowedSchoolIds.has(s.id) ||
                  allowedDeptIds.has(d.id) ||
                  d.programmes.some((p) => allowedProgIds.has(p.id))
              )
              .map((d) => {
                d.programmes.forEach((p) => allProgrammeIds.add(p.id));
                return {
                  id: d.id,
                  name: d.name,
                  code: d.code,
                  schoolId: d.schoolId,
                  programmes: d.programmes.map((p) => ({
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    credits: p.credits,
                    departmentId: p.departmentId,
                    _count: p._count,
                  })),
                };
              }),
          }));
        allSchools.forEach((s) =>
          s.departments.forEach((d) =>
            d.programmes.forEach((p) => {
              if (allowedProgIds.has(p.id)) allProgrammeIds.add(p.id);
            })
          )
        );
      }

      const departments = schools.flatMap((s) => s.departments);

      return {
        schoolsEnabled: true,
        schools,
        departments,
        programmeIds: Array.from(allProgrammeIds),
        fullAccess,
      };
    }

    // When schools are not enabled, hierarchy is Faculty → Department → Programme (existing).
    const faculties = await prisma.faculty.findMany({
      where: { tenantId: ctx.tenantId },
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

    const departments: HierarchyDepartment[] = [];
    const allProgrammeIds = new Set<string>();
    faculties.forEach((f) =>
      f.departments.forEach((d) => {
        if (
          fullAccess ||
          departmentIds.has(d.id) ||
          d.programmes.some((p) => programmeIds.has(p.id))
        ) {
          departments.push({
            id: d.id,
            name: d.name,
            code: d.code,
            schoolId: d.schoolId,
            programmes: d.programmes.map((p) => {
              allProgrammeIds.add(p.id);
              return {
                id: p.id,
                name: p.name,
                code: p.code,
                credits: p.credits,
                departmentId: p.departmentId,
                _count: p._count,
              };
            }),
          });
          d.programmes.forEach((p) => allProgrammeIds.add(p.id));
        }
      })
    );
    programmeIds.forEach((id) => allProgrammeIds.add(id));

    return {
      schoolsEnabled: false,
      schools: [],
      departments,
      programmeIds: Array.from(allProgrammeIds),
      fullAccess,
    };
  } catch (e) {
    console.error("GetUserHierarchyContext error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load hierarchy.",
    };
  }
}
