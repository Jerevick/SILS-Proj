"use server";

/**
 * Phase 16: Academic Calendar & Term Management.
 * CreateAcademicTerm with validation for overlapping terms; list/update terms.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import type { AcademicTermType, AcademicTermStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateAcademicTermInput = {
  name: string;
  type: AcademicTermType;
  startDate: string; // ISO date
  endDate: string;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  status?: AcademicTermStatus;
};

export type CreateAcademicTermResult =
  | { ok: true; termId: string }
  | { ok: false; error: string };

export type UpdateAcademicTermInput = {
  termId: string;
  name?: string;
  type?: AcademicTermType;
  startDate?: string;
  endDate?: string;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  status?: AcademicTermStatus;
};

export type UpdateAcademicTermResult =
  | { ok: true }
  | { ok: false; error: string };

export type AcademicTermListItem = {
  id: string;
  name: string;
  type: AcademicTermType;
  startDate: Date;
  endDate: Date;
  registrationOpenDate: Date | null;
  registrationCloseDate: Date | null;
  status: AcademicTermStatus;
  _count?: { studentRegistrations: number };
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
  };
}

/** Check if two date ranges overlap (inclusive). */
function rangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && end1 >= start2;
}

// ---------------------------------------------------------------------------
// CreateAcademicTerm (with overlap validation)
// ---------------------------------------------------------------------------

export async function createAcademicTerm(
  input: CreateAcademicTermInput
): Promise<CreateAcademicTermResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const canCreate = ctx.role === "OWNER" || ctx.role === "ADMIN";
  if (!canCreate) {
    return { ok: false, error: "Insufficient role to create an academic term." };
  }

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { ok: false, error: "Invalid start or end date." };
  }
  if (startDate > endDate) {
    return { ok: false, error: "Start date must be before or equal to end date." };
  }

  const registrationOpenDate = input.registrationOpenDate
    ? new Date(input.registrationOpenDate)
    : null;
  const registrationCloseDate = input.registrationCloseDate
    ? new Date(input.registrationCloseDate)
    : null;
  if (registrationOpenDate && isNaN(registrationOpenDate.getTime())) {
    return { ok: false, error: "Invalid registration open date." };
  }
  if (registrationCloseDate && isNaN(registrationCloseDate.getTime())) {
    return { ok: false, error: "Invalid registration close date." };
  }
  if (
    registrationOpenDate &&
    registrationCloseDate &&
    registrationOpenDate > registrationCloseDate
  ) {
    return {
      ok: false,
      error: "Registration open date must be before or equal to close date.",
    };
  }

  try {
    const existingTerms = await prisma.academicTerm.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    for (const t of existingTerms) {
      if (rangesOverlap(startDate, endDate, t.startDate, t.endDate)) {
        return {
          ok: false,
          error: `Term dates overlap with existing term "${t.name}". Choose non-overlapping dates.`,
        };
      }
    }

    const term = await prisma.academicTerm.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        type: input.type,
        startDate,
        endDate,
        registrationOpenDate,
        registrationCloseDate,
        status: input.status ?? "DRAFT",
      },
    });
    return { ok: true, termId: term.id };
  } catch (e) {
    console.error("CreateAcademicTerm error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create academic term.",
    };
  }
}

// ---------------------------------------------------------------------------
// UpdateAcademicTerm (overlap check excluding self)
// ---------------------------------------------------------------------------

export async function updateAcademicTerm(
  input: UpdateAcademicTermInput
): Promise<UpdateAcademicTermResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const canUpdate = ctx.role === "OWNER" || ctx.role === "ADMIN";
  if (!canUpdate) {
    return { ok: false, error: "Insufficient role to update an academic term." };
  }

  try {
    const existing = await prisma.academicTerm.findFirst({
      where: { id: input.termId, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return { ok: false, error: "Academic term not found." };
    }

    const startDate = input.startDate ? new Date(input.startDate) : existing.startDate;
    const endDate = input.endDate ? new Date(input.endDate) : existing.endDate;
    if (startDate > endDate) {
      return { ok: false, error: "Start date must be before or equal to end date." };
    }

    const otherTerms = await prisma.academicTerm.findMany({
      where: {
        tenantId: ctx.tenantId,
        id: { not: input.termId },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    for (const t of otherTerms) {
      if (rangesOverlap(startDate, endDate, t.startDate, t.endDate)) {
        return {
          ok: false,
          error: `Term dates would overlap with "${t.name}".`,
        };
      }
    }

    const data: {
      name?: string;
      type?: AcademicTermType;
      startDate?: Date;
      endDate?: Date;
      registrationOpenDate?: Date | null;
      registrationCloseDate?: Date | null;
      status?: AcademicTermStatus;
    } = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.type !== undefined) data.type = input.type;
    if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
    if (input.endDate !== undefined) data.endDate = new Date(input.endDate);
    if (input.registrationOpenDate !== undefined) {
      data.registrationOpenDate = input.registrationOpenDate
        ? new Date(input.registrationOpenDate)
        : null;
    }
    if (input.registrationCloseDate !== undefined) {
      data.registrationCloseDate = input.registrationCloseDate
        ? new Date(input.registrationCloseDate)
        : null;
    }
    if (input.status !== undefined) data.status = input.status;

    await prisma.academicTerm.update({
      where: { id: input.termId },
      data,
    });
    return { ok: true };
  } catch (e) {
    console.error("UpdateAcademicTerm error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update academic term.",
    };
  }
}

// ---------------------------------------------------------------------------
// List terms for tenant
// ---------------------------------------------------------------------------

export async function listAcademicTerms(): Promise<
  AcademicTermListItem[] | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const terms = await prisma.academicTerm.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { startDate: "desc" },
      include: { _count: { select: { studentRegistrations: true } } },
    });
    return terms.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      startDate: t.startDate,
      endDate: t.endDate,
      registrationOpenDate: t.registrationOpenDate,
      registrationCloseDate: t.registrationCloseDate,
      status: t.status,
      _count: t._count,
    }));
  } catch (e) {
    console.error("ListAcademicTerms error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to list terms.",
    };
  }
}

// ---------------------------------------------------------------------------
// Get current open term (registration window is open)
// ---------------------------------------------------------------------------

export async function getCurrentOpenTerm(): Promise<
  { term: AcademicTermListItem | null } | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const now = new Date();
  try {
    const term = await prisma.academicTerm.findFirst({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"] },
        registrationOpenDate: { lte: now },
        registrationCloseDate: { gte: now },
      },
      orderBy: { startDate: "desc" },
      include: { _count: { select: { studentRegistrations: true } } },
    });
    if (!term) return { term: null };
    return {
      term: {
        id: term.id,
        name: term.name,
        type: term.type,
        startDate: term.startDate,
        endDate: term.endDate,
        registrationOpenDate: term.registrationOpenDate,
        registrationCloseDate: term.registrationCloseDate,
        status: term.status,
        _count: term._count,
      },
    };
  } catch (e) {
    console.error("GetCurrentOpenTerm error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to get current term.",
    };
  }
}
