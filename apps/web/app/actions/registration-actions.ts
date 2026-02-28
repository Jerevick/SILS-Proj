"use server";

/**
 * Phase 16: Student Registration Engine.
 * Input: student_id, term_id → available programmes + core/optional modules,
 * prerequisite validation, registration/waitlist/approval, real-time SIS sync (Hybrid/Unified).
 * LMS-Only: simplified module registration (no programme-level).
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext, getPackageType } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import type { StudentRegistrationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgrammeModuleOption = {
  id: string;
  title: string;
  isCore: boolean;
  credits: number;
  order: number;
  prerequisites: string[];
  prerequisitesMet: boolean;
  prerequisiteNames?: string[];
};

export type ProgrammeOption = {
  id: string;
  name: string;
  code: string;
  credits: number;
  departmentName: string;
  modules: ProgrammeModuleOption[];
};

export type RegistrationEnginePayload = {
  termId: string;
  termName: string;
  termType: string;
  registrationOpen: boolean;
  registrationClosesAt: string | null;
  programmes: ProgrammeOption[];
  existingRegistration: {
    id: string;
    programmeId: string;
    status: StudentRegistrationStatus;
    enrolledModuleIds: string[];
    waitlistModuleIds: string[];
  } | null;
  deploymentMode: "LMS" | "HYBRID" | "SIS";
};

export type SubmitRegistrationInput = {
  termId: string;
  programmeId: string;
  enrolledModuleIds: string[];
  waitlistModuleIds?: string[];
};

export type SubmitRegistrationResult =
  | { ok: true; registrationId: string; status: StudentRegistrationStatus }
  | { ok: false; error: string };

export type StudentRegistrationListItem = {
  id: string;
  termId: string;
  termName: string;
  termType: string;
  programmeId: string;
  programmeName: string;
  programmeCode: string;
  status: StudentRegistrationStatus;
  enrolledModuleIds: string[];
  waitlistModuleIds: string[];
  submittedAt: Date | null;
  approvedAt: Date | null;
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
    role: tenantResult.context.role,
    context: tenantResult.context,
  };
}

/** Get completed programme module ids for a student (from ProgrammeModuleGrade). */
async function getCompletedModuleIds(
  tenantId: string,
  studentId: string
): Promise<Set<string>> {
  const grades = await prisma.programmeModuleGrade.findMany({
    where: { studentId },
    select: { programmeModuleId: true },
  });
  return new Set(grades.map((g) => g.programmeModuleId));
}

// ---------------------------------------------------------------------------
// StudentRegistrationEngine — get payload for student + term
// ---------------------------------------------------------------------------

export async function getRegistrationEnginePayload(
  termId: string
): Promise<RegistrationEnginePayload | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const studentId = ctx.userId;
  const tenantId = ctx.tenantId;
  const deploymentMode = ctx.context.deploymentMode as "LMS" | "HYBRID" | "SIS";

  try {
    const term = await prisma.academicTerm.findFirst({
      where: { id: termId, tenantId },
    });
    if (!term) return { ok: false, error: "Term not found." };

    const now = new Date();
    const regOpen =
      term.registrationOpenDate != null &&
      term.registrationCloseDate != null &&
      term.registrationOpenDate <= now &&
      term.registrationCloseDate >= now;
    const registrationClosesAt = term.registrationCloseDate?.toISOString() ?? null;

    const programmes = await prisma.programme.findMany({
      where: {
        department: { tenantId },
      },
      orderBy: { name: "asc" },
      include: {
        department: { select: { name: true } },
        modules: {
          where: {
            OR: [{ academicTermId: null }, { academicTermId: termId }],
          },
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            isCore: true,
            credits: true,
            order: true,
            prerequisites: true,
          },
        },
      },
    });

    const completedIds = await getCompletedModuleIds(tenantId, studentId);

    const programmeOptions: ProgrammeOption[] = programmes.map((prog) => {
      const modules: ProgrammeModuleOption[] = prog.modules.map((mod) => {
        const prereqIds = Array.isArray(mod.prerequisites)
          ? (mod.prerequisites as string[])
          : [];
        const prereqMet = prereqIds.every((id) => completedIds.has(id));
        return {
          id: mod.id,
          title: mod.title,
          isCore: mod.isCore,
          credits: mod.credits,
          order: mod.order,
          prerequisites: prereqIds,
          prerequisitesMet: prereqMet,
        };
      });
      return {
        id: prog.id,
        name: prog.name,
        code: prog.code,
        credits: prog.credits,
        departmentName: prog.department.name,
        modules: modules,
      };
    });

    const existing = await prisma.studentRegistration.findFirst({
      where: {
        termId,
        studentId,
        tenantId,
      },
      select: {
        id: true,
        programmeId: true,
        status: true,
        registeredModules: true,
      },
    });

    let enrolledModuleIds: string[] = [];
    let waitlistModuleIds: string[] = [];
    if (existing?.registeredModules && typeof existing.registeredModules === "object") {
      const rm = existing.registeredModules as { enrolled?: string[]; waitlist?: string[] };
      enrolledModuleIds = Array.isArray(rm.enrolled) ? rm.enrolled : [];
      waitlistModuleIds = Array.isArray(rm.waitlist) ? rm.waitlist : [];
    }

    return {
      termId: term.id,
      termName: term.name,
      termType: term.type,
      registrationOpen: regOpen,
      registrationClosesAt,
      programmes: programmeOptions,
      existingRegistration: existing
        ? {
            id: existing.id,
            programmeId: existing.programmeId,
            status: existing.status,
            enrolledModuleIds,
            waitlistModuleIds,
          }
        : null,
      deploymentMode,
    };
  } catch (e) {
    console.error("GetRegistrationEnginePayload error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load registration data.",
    };
  }
}

// ---------------------------------------------------------------------------
// Submit registration (with prerequisite validation, then push to SIS when approved)
// ---------------------------------------------------------------------------

export async function submitRegistration(
  input: SubmitRegistrationInput
): Promise<SubmitRegistrationResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const studentId = ctx.userId;
  const tenantId = ctx.tenantId;

  try {
    const term = await prisma.academicTerm.findFirst({
      where: { id: input.termId, tenantId },
    });
    if (!term) return { ok: false, error: "Term not found." };

    const now = new Date();
    const regOpen =
      term.registrationOpenDate != null &&
      term.registrationCloseDate != null &&
      term.registrationOpenDate <= now &&
      term.registrationCloseDate >= now;
    if (!regOpen) {
      return { ok: false, error: "Registration is not open for this term." };
    }

    const programme = await prisma.programme.findFirst({
      where: { id: input.programmeId, department: { tenantId } },
      include: {
        modules: {
          where: {
            OR: [{ academicTermId: null }, { academicTermId: input.termId }],
          },
          select: { id: true, prerequisites: true, isCore: true },
        },
      },
    });
    if (!programme) return { ok: false, error: "Programme not found." };

    const completedIds = await getCompletedModuleIds(tenantId, studentId);
    const allEnrolled = [...(input.enrolledModuleIds || []), ...(input.waitlistModuleIds || [])];
    const moduleMap = new Map(programme.modules.map((m) => [m.id, m]));

    for (const modId of allEnrolled) {
      const mod = moduleMap.get(modId);
      if (!mod) continue;
      const prereqIds = Array.isArray(mod.prerequisites) ? (mod.prerequisites as string[]) : [];
      const missing = prereqIds.filter((id) => !completedIds.has(id));
      if (missing.length > 0) {
        return {
          ok: false,
          error: `Prerequisites not met for one or more modules. Complete required modules first.`,
        };
      }
    }

    const coreIds = new Set(programme.modules.filter((m) => m.isCore).map((m) => m.id));
    const enrolled = input.enrolledModuleIds || [];
    const missingCore =
      coreIds.size > 0 && coreIds.size > enrolled.filter((id) => coreIds.has(id)).length;
    if (missingCore) {
      return {
        ok: false,
        error: "All core modules for this programme must be selected.",
      };
    }

    const registeredModules = {
      enrolled: enrolled,
      waitlist: input.waitlistModuleIds ?? [],
    };

    const existing = await prisma.studentRegistration.findFirst({
      where: {
        termId: input.termId,
        studentId,
        programmeId: input.programmeId,
        tenantId,
      },
    });

    let registrationId: string;
    let status: StudentRegistrationStatus;

    if (existing) {
      await prisma.studentRegistration.update({
        where: { id: existing.id },
        data: {
          registeredModules,
          status: "SUBMITTED",
          submittedAt: now,
        },
      });
      registrationId = existing.id;
      status = "SUBMITTED";
    } else {
      const reg = await prisma.studentRegistration.create({
        data: {
          tenantId,
          studentId,
          programmeId: input.programmeId,
          termId: input.termId,
          status: "SUBMITTED",
          registeredModules,
          submittedAt: now,
        },
      });
      registrationId = reg.id;
      status = "SUBMITTED";
    }

    // Auto-approve for Hybrid/SIS and push to SIS (ProgrammeEnrollment)
    const pkg = getPackageType(ctx.context);
    if (pkg === "hybrid" || ctx.context.deploymentMode === "SIS") {
      await prisma.studentRegistration.update({
        where: { id: registrationId },
        data: {
          status: "APPROVED",
          approvedAt: now,
          approvedBy: ctx.userId,
        },
      });
      status = "APPROVED";

      await prisma.programmeEnrollment.upsert({
        where: {
          programmeId_studentId: {
            programmeId: input.programmeId,
            studentId,
          },
        },
        create: {
          programmeId: input.programmeId,
          studentId,
        },
        update: {},
      });
    }

    return { ok: true, registrationId, status };
  } catch (e) {
    console.error("SubmitRegistration error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to submit registration.",
    };
  }
}

// ---------------------------------------------------------------------------
// List my registrations (for student dashboard)
// ---------------------------------------------------------------------------

export async function listMyRegistrations(): Promise<
  StudentRegistrationListItem[] | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const list = await prisma.studentRegistration.findMany({
      where: { tenantId: ctx.tenantId, studentId: ctx.userId },
      orderBy: { createdAt: "desc" },
      include: {
        term: { select: { id: true, name: true, type: true } },
        programme: { select: { id: true, name: true, code: true } },
      },
    });

    return list.map((r) => {
      const rm = (r.registeredModules as { enrolled?: string[]; waitlist?: string[] }) ?? {};
      return {
        id: r.id,
        termId: r.term.id,
        termName: r.term.name,
        termType: r.term.type,
        programmeId: r.programme.id,
        programmeName: r.programme.name,
        programmeCode: r.programme.code,
        status: r.status,
        enrolledModuleIds: Array.isArray(rm.enrolled) ? rm.enrolled : [],
        waitlistModuleIds: Array.isArray(rm.waitlist) ? rm.waitlist : [],
        submittedAt: r.submittedAt,
        approvedAt: r.approvedAt,
      };
    });
  } catch (e) {
    console.error("ListMyRegistrations error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to list registrations.",
    };
  }
}
