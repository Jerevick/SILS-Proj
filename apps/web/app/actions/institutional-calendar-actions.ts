"use server";

/**
 * Phase 28: Institutional Events & Activities Calendar.
 * - CreateInstitutionalEvent: validates against academic term, clash detection (same department),
 *   LLM_Router for smart suggestions on clash, notifies affected parties, auto-adds to annual calendar.
 * - GetInstitutionalCalendar: full calendar by academic year with filters (school, department, type).
 * - CheckEventClash: for real-time UI when creating event.
 * Roles: Registrar, Dean, HoD, Event Coordinator (OWNER, ADMIN, INSTRUCTOR with scope).
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { sendNotification } from "@/app/actions/notification-actions";
import type {
  InstitutionalEventType,
  InstitutionalEventStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateInstitutionalEventInput = {
  title: string;
  description?: string | null;
  startTime: string; // ISO datetime
  endTime: string;
  type: InstitutionalEventType;
  schoolId?: string | null;
  departmentId?: string | null;
  programmeId?: string | null;
  academicTermId?: string | null; // optional: validate event falls within term
  status?: InstitutionalEventStatus;
};

export type CreateInstitutionalEventResult =
  | { ok: true; eventId: string; addedToCalendar: boolean }
  | { ok: false; error: string; clash?: ClashInfo; aiSuggestion?: string };

export type ClashInfo = {
  existingEventId: string;
  existingTitle: string;
  existingStart: string;
  existingEnd: string;
  departmentId: string | null;
};

export type CheckClashResult =
  | { ok: true; hasClash: false }
  | { ok: true; hasClash: true; clashes: ClashInfo[]; aiSuggestion?: string }
  | { ok: false; error: string };

export type GetInstitutionalCalendarInput = {
  academicYear: number; // e.g. 2025
  schoolId?: string | null;
  departmentId?: string | null;
  eventType?: InstitutionalEventType | null;
};

export type InstitutionalCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  type: InstitutionalEventType;
  status: InstitutionalEventStatus;
  createdBy: string;
  schoolId: string | null;
  schoolName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  programmeId: string | null;
  programmeName: string | null;
};

export type GetInstitutionalCalendarResult =
  | { ok: true; events: InstitutionalCalendarEvent[]; year: number }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId)
    return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok)
    return { ok: false as const, error: "Tenant not found" };
  const tenantId = tenantResult.context.tenantId;
  const role = tenantResult.context.role;
  const roleRows = await prisma.userTenantRole.findMany({
    where: { tenantId, clerkUserId: userId },
    select: { scopeType: true, scopeId: true },
  });
  const hasTenantWide = roleRows.some((r) => r.scopeType === null);
  const schoolScope = roleRows.find((r) => r.scopeType === "SCHOOL" && r.scopeId);
  const deptScope = roleRows.find((r) => r.scopeType === "DEPARTMENT" && r.scopeId);
  const programmeScope = roleRows.find((r) => r.scopeType === "PROGRAMME" && r.scopeId);
  let scopeType: string | null = null;
  let scopeId: string | null = null;
  if (!hasTenantWide && schoolScope?.scopeId) {
    scopeType = "SCHOOL";
    scopeId = schoolScope.scopeId;
  } else if (!hasTenantWide && deptScope?.scopeId) {
    scopeType = "DEPARTMENT";
    scopeId = deptScope.scopeId;
  } else if (!hasTenantWide && programmeScope?.scopeId) {
    scopeType = "PROGRAMME";
    scopeId = programmeScope.scopeId;
  }
  return {
    ok: true as const,
    userId,
    orgId,
    tenantId,
    role,
    scopeType,
    scopeId,
  };
}

/** Registrar, Dean, HoD, Event Coordinator: OWNER/ADMIN (tenant-wide) or INSTRUCTOR scoped to school/department/programme. */
function canManageInstitutionalEvents(
  role: string,
  scopeType: string | null,
  scopeId: string | null,
  eventSchoolId: string | null,
  eventDepartmentId: string | null,
  eventProgrammeId: string | null
): boolean {
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role !== "INSTRUCTOR") return false;
  if (!scopeType || !scopeId) return false;
  if (scopeType === "SCHOOL" && eventSchoolId === scopeId) return true;
  if (scopeType === "DEPARTMENT" && eventDepartmentId === scopeId) return true;
  if (scopeType === "PROGRAMME" && eventProgrammeId === scopeId) return true;
  return false;
}

function rangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

/** Resolve clerk user IDs for department and/or school (for notifications). */
async function getAffectedClerkIds(
  tenantId: string,
  departmentId: string | null,
  schoolId: string | null
): Promise<string[]> {
  const roleRows = await prisma.userTenantRole.findMany({
    where: { tenantId },
    select: { clerkUserId: true, scopeType: true, scopeId: true },
  });
  const ids = new Set<string>();
  if (departmentId) {
    for (const r of roleRows) {
      if (r.scopeType === "DEPARTMENT" && r.scopeId === departmentId)
        ids.add(r.clerkUserId);
      if (r.scopeType === "SCHOOL" && schoolId && r.scopeId === schoolId)
        ids.add(r.clerkUserId);
    }
  }
  if (schoolId) {
    for (const r of roleRows) {
      if (r.scopeType === "SCHOOL" && r.scopeId === schoolId)
        ids.add(r.clerkUserId);
    }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// CheckEventClash (for real-time UI)
// ---------------------------------------------------------------------------

export async function checkEventClash(
  input: Omit<CreateInstitutionalEventInput, "status"> & {
    excludeEventId?: string | null;
  }
): Promise<CheckClashResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()))
    return { ok: false, error: "Invalid start or end time." };
  if (startTime >= endTime)
    return { ok: false, error: "Start time must be before end time." };

  const departmentId = input.departmentId ?? null;
  if (!departmentId) {
    return { ok: true, hasClash: false };
  }

  const where: Parameters<typeof prisma.institutionalEvent.findMany>[0]["where"] = {
    tenantId: ctx.tenantId,
    departmentId,
    status: { not: "CANCELLED" },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };
  if (input.excludeEventId) where.id = { not: input.excludeEventId };

  const overlapping = await prisma.institutionalEvent.findMany({
    where,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      departmentId: true,
    },
  });

  if (overlapping.length === 0) return { ok: true, hasClash: false };

  const clashes: ClashInfo[] = overlapping.map((e) => ({
    existingEventId: e.id,
    existingTitle: e.title,
    existingStart: e.startTime.toISOString(),
    existingEnd: e.endTime.toISOString(),
    departmentId: e.departmentId,
  }));

  const llmResult = await runLLMRouter({
    systemPrompt: `You are a calendar assistant. Given a scheduling conflict (same department has overlapping events), suggest one short, practical alternative (e.g. "Move to next available slot same day" or "Suggest 2pm–3pm tomorrow"). Reply with only the suggestion, no preamble.`,
    messages: [
      {
        role: "user",
        content: `New event: "${input.title}" ${input.startTime}–${input.endTime}. Conflicting event(s): ${clashes.map((c) => `"${c.existingTitle}" ${c.existingStart}–${c.existingEnd}`).join("; ")}. Suggest one alternative.`,
      },
    ],
    maxTokens: 150,
  });

  const aiSuggestion =
    llmResult.ok && llmResult.text?.trim() ? llmResult.text.trim() : undefined;

  return {
    ok: true,
    hasClash: true,
    clashes,
    aiSuggestion,
  };
}

// ---------------------------------------------------------------------------
// CreateInstitutionalEvent
// ---------------------------------------------------------------------------

export async function createInstitutionalEvent(
  input: CreateInstitutionalEventInput
): Promise<CreateInstitutionalEventResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()))
    return { ok: false, error: "Invalid start or end time." };
  if (startTime >= endTime)
    return { ok: false, error: "Start time must be before end time." };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const canManage = canManageInstitutionalEvents(
    ctx.role,
    ctx.scopeType ?? null,
    ctx.scopeId ?? null,
    input.schoolId ?? null,
    input.departmentId ?? null,
    input.programmeId ?? null
  );
  if (!canManage)
    return { ok: false, error: "You do not have permission to create events for this scope (Registrar, Dean, HoD, or Event Coordinator required)." };

  if (input.academicTermId) {
    const term = await prisma.academicTerm.findFirst({
      where: { id: input.academicTermId, tenantId: ctx.tenantId },
      select: { startDate: true, endDate: true },
    });
    if (term) {
      const termStart = new Date(term.startDate);
      const termEnd = new Date(term.endDate);
      termEnd.setHours(23, 59, 59, 999);
      if (startTime < termStart || endTime > termEnd)
        return {
          ok: false,
          error: "Event dates must fall within the selected academic term.",
        };
    }
  }

  const departmentId = input.departmentId ?? null;
  if (departmentId) {
    const overlapping = await prisma.institutionalEvent.findMany({
      where: {
        tenantId: ctx.tenantId,
        departmentId,
        status: { not: "CANCELLED" },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        departmentId: true,
      },
    });
    if (overlapping.length > 0) {
      const clash: ClashInfo = {
        existingEventId: overlapping[0].id,
        existingTitle: overlapping[0].title,
        existingStart: overlapping[0].startTime.toISOString(),
        existingEnd: overlapping[0].endTime.toISOString(),
        departmentId: overlapping[0].departmentId,
      };
      const llmResult = await runLLMRouter({
        systemPrompt: `You are a calendar assistant. Given a scheduling conflict (same department has overlapping events), suggest one short, practical alternative. Reply with only the suggestion.`,
        messages: [
          {
            role: "user",
            content: `New event: "${title}" ${input.startTime}–${input.endTime}. Conflicting: "${clash.existingTitle}" ${clash.existingStart}–${clash.existingEnd}. Suggest: "Move to next available slot?" or similar.`,
          },
        ],
        maxTokens: 120,
      });
      const aiSuggestion =
        llmResult.ok && llmResult.text?.trim() ? llmResult.text.trim() : "Move to next available slot?";
      return {
        ok: false,
        error: `This event clashes with "${clash.existingTitle}" in the same department.`,
        clash,
        aiSuggestion,
      };
    }
  }

  const year = startTime.getFullYear();
  let calendar = await prisma.academicYearCalendar.findUnique({
    where: { tenantId_year: { tenantId: ctx.tenantId, year } },
  });
  if (!calendar) {
    calendar = await prisma.academicYearCalendar.create({
      data: { tenantId: ctx.tenantId, year },
    });
  }

  const event = await prisma.institutionalEvent.create({
    data: {
      tenantId: ctx.tenantId,
      schoolId: input.schoolId ?? null,
      departmentId: input.departmentId ?? null,
      programmeId: input.programmeId ?? null,
      academicYearCalendarId: calendar.id,
      title,
      description: input.description ?? null,
      startTime,
      endTime,
      type: input.type,
      createdBy: ctx.userId,
      status: input.status ?? "PUBLISHED",
    },
  });

  const clerkIds = await getAffectedClerkIds(
    ctx.tenantId,
    input.departmentId ?? null,
    input.schoolId ?? null
  );
  const fallbackTitle = "New institutional event";
  const fallbackBody = `"${title}" on ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
  for (const clerkId of clerkIds) {
    if (clerkId === ctx.userId) continue;
    await sendNotification(ctx.tenantId, {
      user_id: clerkId,
      template_name: "institutional_event_created",
      variables: { title, startTime: input.startTime, endTime: input.endTime },
      channels: ["in_app"],
      fallback_title: fallbackTitle,
      fallback_body: fallbackBody,
    });
  }

  return {
    ok: true,
    eventId: event.id,
    addedToCalendar: true,
  };
}

// ---------------------------------------------------------------------------
// GetInstitutionalCalendar
// ---------------------------------------------------------------------------

export async function getInstitutionalCalendar(
  input: GetInstitutionalCalendarInput
): Promise<GetInstitutionalCalendarResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const yearStart = new Date(input.academicYear, 0, 1);
  const yearEnd = new Date(input.academicYear, 11, 31, 23, 59, 59, 999);

  const where: Parameters<typeof prisma.institutionalEvent.findMany>[0]["where"] = {
    tenantId: ctx.tenantId,
    status: { not: "CANCELLED" },
    startTime: { gte: yearStart, lte: yearEnd },
  };
  if (input.schoolId) where.schoolId = input.schoolId;
  if (input.departmentId) where.departmentId = input.departmentId;
  if (input.eventType) where.type = input.eventType;

  const events = await prisma.institutionalEvent.findMany({
    where,
    orderBy: { startTime: "asc" },
    include: {
      school: { select: { name: true } },
      department: { select: { name: true } },
      programme: { select: { name: true } },
    },
  });

  const items: InstitutionalCalendarEvent[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    type: e.type,
    status: e.status,
    createdBy: e.createdBy,
    schoolId: e.schoolId,
    schoolName: e.school?.name ?? null,
    departmentId: e.departmentId,
    departmentName: e.department?.name ?? null,
    programmeId: e.programmeId,
    programmeName: e.programme?.name ?? null,
  }));

  return { ok: true, events: items, year: input.academicYear };
}

// ---------------------------------------------------------------------------
// List schools / departments / terms for filters
// ---------------------------------------------------------------------------

export async function listSchoolsForCalendar(): Promise<
  { id: string; name: string }[] | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const schools = await prisma.school.findMany({
    where: { tenantId: ctx.tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return schools;
}

export async function listDepartmentsForCalendar(params?: {
  schoolId?: string | null;
}): Promise<{ id: string; name: string; schoolId: string | null }[] | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const where: { tenantId: string; schoolId?: string } = { tenantId: ctx.tenantId };
  if (params?.schoolId) where.schoolId = params.schoolId;
  const depts = await prisma.department.findMany({
    where,
    select: { id: true, name: true, schoolId: true },
    orderBy: { name: "asc" },
  });
  return depts;
}

export async function listAcademicYearsForCalendar(): Promise<
  number[] | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const calendars = await prisma.academicYearCalendar.findMany({
    where: { tenantId: ctx.tenantId },
    select: { year: true },
    orderBy: { year: "desc" },
    distinct: ["year"],
  });
  const years = calendars.map((c) => c.year);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  return [...new Set(years)].sort((a, b) => b - a);
}
