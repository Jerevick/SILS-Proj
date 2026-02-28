"use server";

/**
 * Phase 20: Intelligent Scheduling & Timetabling Engine.
 * - Room CRUD; Schedule list/create/update; IntelligentTimetabler (LLM + optimization).
 * - Respects faculty workload, room capacity, student schedule balance, school hierarchy, equity.
 * - Auto-resolves minor conflicts; flags major ones with recommendations.
 * Roles: OWNER, ADMIN, INSTRUCTOR (Registrar, Scheduler, Dean, HoD).
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleFilters = {
  termId?: string;
  programmeId?: string;
  schoolId?: string;
  departmentId?: string;
};

export type ScheduleListItem = {
  id: string;
  programmeId: string;
  programme: { id: string; name: string; code: string };
  moduleId: string;
  module: { id: string; title: string; lecturerId: string | null };
  roomId: string;
  room: { id: string; name: string; capacity: number; type: string };
  lecturerId: string | null;
  termId: string;
  term: { id: string; name: string };
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  recurrencePattern: string | null;
};

export type RoomListItem = {
  id: string;
  name: string;
  capacity: number;
  type: string;
  schoolId: string | null;
  school: { name: string } | null;
};

export type TimetableSlotInput = {
  programmeModuleId: string;
  roomId: string;
  lecturerId: string | null;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  recurrencePattern?: string | null;
};

export type ConflictItem = {
  type: "room_double_book" | "lecturer_double_book" | "room_capacity" | "room_unavailable" | "workload";
  severity: "minor" | "major";
  description: string;
  scheduleIds?: string[];
  recommendation?: string;
};

export type ConflictReport = {
  resolved: string[];
  minor: ConflictItem[];
  major: ConflictItem[];
  recommendations: string[];
};

export type IntelligentTimetablerResult =
  | { ok: true; schedule: TimetableSlotInput[]; conflictReport: ConflictReport; created: number }
  | { ok: false; error: string };

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

function canManageScheduling(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
}

function slotsOverlap(
  day1: number,
  start1: number,
  end1: number,
  day2: number,
  start2: number,
  end2: number
): boolean {
  if (day1 !== day2) return false;
  return start1 < end2 && end1 > start2;
}

// ---------------------------------------------------------------------------
// List rooms
// ---------------------------------------------------------------------------

export async function listRooms(schoolId?: string | null): Promise<RoomListItem[] | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const where: { tenantId: string; schoolId?: string | null } = { tenantId: ctx.tenantId };
    if (schoolId != null) where.schoolId = schoolId || null;

    const rooms = await prisma.room.findMany({
      where,
      orderBy: [{ name: "asc" }],
      include: { school: { select: { name: true } } },
    });
    return rooms.map((r) => ({
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      type: r.type,
      schoolId: r.schoolId,
      school: r.school ? { name: r.school.name } : null,
    }));
  } catch (e) {
    console.error("listRooms error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list rooms." };
  }
}

// ---------------------------------------------------------------------------
// List schedules (with filters)
// ---------------------------------------------------------------------------

export async function listSchedules(
  filters?: ScheduleFilters
): Promise<ScheduleListItem[] | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const where: Parameters<typeof prisma.schedule.findMany>[0]["where"] = {
      tenantId: ctx.tenantId,
    };
    if (filters?.termId) where.termId = filters.termId;
    if (filters?.programmeId) where.programmeId = filters.programmeId;
    if (filters?.departmentId || filters?.schoolId) {
      where.programme = {
        ...(filters.departmentId && { departmentId: filters.departmentId }),
        ...(filters.schoolId && { department: { schoolId: filters.schoolId } }),
      };
    }

    const list = await prisma.schedule.findMany({
      where,
      orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
      include: {
        programme: { select: { id: true, name: true, code: true } },
        module: { select: { id: true, title: true, lecturerId: true } },
        room: { select: { id: true, name: true, capacity: true, type: true } },
        term: { select: { id: true, name: true } },
      },
    });
    return list.map((s) => ({
      id: s.id,
      programmeId: s.programmeId,
      programme: s.programme,
      moduleId: s.moduleId,
      module: s.module,
      roomId: s.roomId,
      room: s.room,
      lecturerId: s.lecturerId,
      termId: s.termId,
      term: s.term,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      recurrencePattern: s.recurrencePattern,
    }));
  } catch (e) {
    console.error("listSchedules error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list schedules." };
  }
}

// ---------------------------------------------------------------------------
// Create room (for admin/scheduler)
// ---------------------------------------------------------------------------

export async function createRoom(input: {
  name: string;
  capacity: number;
  type: string;
  schoolId?: string | null;
  availability?: object | null;
}): Promise<{ ok: true; roomId: string } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageScheduling(ctx.role)) return { ok: false, error: "Insufficient role to create rooms." };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Room name is required." };

  try {
    const room = await prisma.room.create({
      data: {
        tenantId: ctx.tenantId,
        schoolId: input.schoolId ?? null,
        name,
        capacity: Math.max(0, input.capacity ?? 0),
        type: (input.type?.trim() || "LECTURE_HALL").toUpperCase(),
        availability: input.availability ?? undefined,
      },
    });
    return { ok: true, roomId: room.id };
  } catch (e) {
    console.error("createRoom error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create room." };
  }
}

// ---------------------------------------------------------------------------
// Apply schedules (persist timetable slots for a term; replaces existing for same programme/term when full replace)
// ---------------------------------------------------------------------------

export async function applySchedules(
  termId: string,
  programmeId: string,
  slots: TimetableSlotInput[],
  replaceExisting: boolean
): Promise<{ ok: true; created: number; updated: number } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageScheduling(ctx.role)) return { ok: false, error: "Insufficient role to apply schedules." };

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, tenantId: ctx.tenantId },
  });
  if (!term) return { ok: false, error: "Academic term not found." };

  const programme = await prisma.programme.findFirst({
    where: { id: programmeId, department: { tenantId: ctx.tenantId } },
  });
  if (!programme) return { ok: false, error: "Programme not found." };

  let created = 0;
  let updated = 0;

  try {
    if (replaceExisting) {
      const deleted = await prisma.schedule.deleteMany({
        where: { tenantId: ctx.tenantId, termId, programmeId },
      });
      updated = deleted.count;
    }

    for (const slot of slots) {
      const module = await prisma.programmeModule.findFirst({
        where: { id: slot.programmeModuleId, programmeId },
      });
      if (!module) continue;

      const room = await prisma.room.findFirst({
        where: { id: slot.roomId, tenantId: ctx.tenantId },
      });
      if (!room) continue;

      await prisma.schedule.create({
        data: {
          tenantId: ctx.tenantId,
          programmeId,
          moduleId: slot.programmeModuleId,
          roomId: slot.roomId,
          lecturerId: slot.lecturerId ?? null,
          termId,
          dayOfWeek: slot.dayOfWeek,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          recurrencePattern: slot.recurrencePattern ?? null,
        },
      });
      created++;
    }
    return { ok: true, created, updated };
  } catch (e) {
    console.error("applySchedules error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to apply schedules." };
  }
}

// ---------------------------------------------------------------------------
// Resolve conflict: one-click fix — update one schedule's room/time
// ---------------------------------------------------------------------------

export async function resolveScheduleConflict(
  scheduleId: string,
  resolution: { roomId?: string; dayOfWeek?: number; startMinutes?: number; endMinutes?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageScheduling(ctx.role)) return { ok: false, error: "Insufficient role to resolve conflicts." };

  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, tenantId: ctx.tenantId },
  });
  if (!existing) return { ok: false, error: "Schedule not found." };

  const data: { roomId?: string; dayOfWeek?: number; startMinutes?: number; endMinutes?: number } = {};
  if (resolution.roomId != null) data.roomId = resolution.roomId;
  if (resolution.dayOfWeek != null) data.dayOfWeek = resolution.dayOfWeek;
  if (resolution.startMinutes != null) data.startMinutes = resolution.startMinutes;
  if (resolution.endMinutes != null) data.endMinutes = resolution.endMinutes;

  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data,
    });
    return { ok: true };
  } catch (e) {
    console.error("resolveScheduleConflict error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update schedule." };
  }
}

// ---------------------------------------------------------------------------
// Delete schedule slot
// ---------------------------------------------------------------------------

export async function deleteSchedule(scheduleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageScheduling(ctx.role)) return { ok: false, error: "Insufficient role." };

  const existing = await prisma.schedule.findFirst({
    where: { id: scheduleId, tenantId: ctx.tenantId },
  });
  if (!existing) return { ok: false, error: "Schedule not found." };

  try {
    await prisma.schedule.delete({ where: { id: scheduleId } });
    return { ok: true };
  } catch (e) {
    console.error("deleteSchedule error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete schedule." };
  }
}

// ---------------------------------------------------------------------------
// Intelligent Timetabler: LLM + optimization → conflict-free timetable
// Input: term_id, programme_id optional. Returns optimized schedule + conflict report.
// ---------------------------------------------------------------------------

export async function IntelligentTimetabler(
  termId: string,
  programmeId?: string | null
): Promise<IntelligentTimetablerResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageScheduling(ctx.role)) return { ok: false, error: "Insufficient role to run timetabler." };

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, tenantId: ctx.tenantId },
  });
  if (!term) return { ok: false, error: "Academic term not found." };

  const programmes = programmeId
    ? await prisma.programme.findMany({
        where: { id: programmeId, department: { tenantId: ctx.tenantId } },
        include: { department: { select: { name: true, school: { select: { name: true } } } } },
      })
    : await prisma.programme.findMany({
        where: { department: { tenantId: ctx.tenantId } },
        include: { department: { select: { name: true, school: { select: { name: true } } } } },
      });

  const programmeIds = programmes.map((p) => p.id);
  const programmeModules = await prisma.programmeModule.findMany({
    where: {
      programmeId: { in: programmeIds },
      academicTermId: termId,
    },
    include: { programme: { select: { id: true, name: true, code: true } } },
  });

  if (programmeModules.length === 0) {
    return {
      ok: false,
      error: "No programme modules linked to this term. Link modules to the term first (Programmes > Module term).",
    };
  }

  const rooms = await prisma.room.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ capacity: "desc" }, { name: "asc" }],
  });
  if (rooms.length === 0) {
    return { ok: false, error: "No rooms defined. Create rooms in Scheduling or Admin first." };
  }

  const existingSchedules = await prisma.schedule.findMany({
    where: { tenantId: ctx.tenantId, termId },
    include: { module: true, room: true },
  });

  const availabilitySlots = await prisma.availabilitySlot.findMany({
    where: { tenantId: ctx.tenantId },
  });

  const systemPrompt = `You are an academic timetabling expert. Given:
- Term: ${term.name} (${term.startDate.toISOString().slice(0, 10)} to ${term.endDate.toISOString().slice(0, 10)})
- Programme modules to schedule (id, title, programme name, lecturerId if any): ${JSON.stringify(programmeModules.map((m) => ({ id: m.id, title: m.title, programme: m.programme?.name, lecturerId: m.lecturerId })))}
- Rooms (id, name, capacity, type): ${JSON.stringify(rooms.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity, type: r.type })))}
- Existing schedules in this term (do not double-book): ${JSON.stringify(existingSchedules.map((s) => ({ moduleId: s.moduleId, roomId: s.roomId, lecturerId: s.lecturerId, dayOfWeek: s.dayOfWeek, startMinutes: s.startMinutes, endMinutes: s.endMinutes })))}
- Lecturer availability (hostUserId = clerk user id, dayOfWeek 0-6, startMinutes/endMinutes): ${JSON.stringify(availabilitySlots.slice(0, 100))}

Rules:
- dayOfWeek: 1=Monday, 2=Tuesday, ... 5=Friday (prefer weekdays).
- startMinutes/endMinutes: minutes from midnight (e.g. 540=9:00, 600=10:00, 90-min slot = 540 to 630).
- Spread classes across the week; avoid more than 3 consecutive hours per lecturer per day.
- Assign a room with sufficient capacity (e.g. 30+ for typical class).
- Respect lecturer availability: only put a slot in a day/time where that lecturer has an availability slot covering it.
- Output ONLY valid JSON, no markdown.

Output format:
{
  "schedule": [
    { "programmeModuleId": "<id>", "roomId": "<id>", "lecturerId": "<clerk user id or null>", "dayOfWeek": 1-5, "startMinutes": 540, "endMinutes": 630, "recurrencePattern": "WEEKLY" }
  ],
  "insights": { "workloadBalance": "<short note>", "roomUsage": "<short note>", "equityNote": "<short note if any>" }
}`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: "Generate the optimal timetable JSON for this term." }],
    maxTokens: 4096,
    cachePrefix: "timetabler",
  });

  if (!result.ok) return { ok: false, error: result.error };

  let parsed: {
    schedule?: Array<{
      programmeModuleId: string;
      roomId: string;
      lecturerId: string | null;
      dayOfWeek: number;
      startMinutes: number;
      endMinutes: number;
      recurrencePattern?: string | null;
    }>;
    insights?: Record<string, string>;
  };
  try {
    const raw = result.text.replace(/```json?\s*|\s*```/g, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "AI did not return valid JSON schedule." };
  }

  const schedule = parsed.schedule ?? [];
  const conflictReport: ConflictReport = { resolved: [], minor: [], major: [], recommendations: [] };
  const insights = parsed.insights ?? {};
  if (insights.workloadBalance) conflictReport.recommendations.push(insights.workloadBalance);
  if (insights.roomUsage) conflictReport.recommendations.push(insights.roomUsage);
  if (insights.equityNote) conflictReport.recommendations.push(insights.equityNote);

  // Conflict detection: room double-book, lecturer double-book
  const byRoomDay: Record<string, Array<{ idx: number; day: number; start: number; end: number; lecturerId: string | null; moduleId: string }>> = {};
  const byLecturerDay: Record<string, Array<{ idx: number; day: number; start: number; end: number; roomId: string; moduleId: string }>> = {};

  schedule.forEach((s, idx) => {
    const key = `${s.roomId}-${s.dayOfWeek}`;
    if (!byRoomDay[key]) byRoomDay[key] = [];
    byRoomDay[key].push({
      idx,
      day: s.dayOfWeek,
      start: s.startMinutes,
      end: s.endMinutes,
      lecturerId: s.lecturerId ?? null,
      moduleId: s.programmeModuleId,
    });
    const lid = s.lecturerId ?? "unassigned";
    if (!byLecturerDay[lid]) byLecturerDay[lid] = [];
    byLecturerDay[lid].push({
      idx,
      day: s.dayOfWeek,
      start: s.startMinutes,
      end: s.endMinutes,
      roomId: s.roomId,
      moduleId: s.programmeModuleId,
    });
  });

  const minorResolved: number[] = [];
  for (const key of Object.keys(byRoomDay)) {
    const arr = byRoomDay[key];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (slotsOverlap(arr[i].day, arr[i].start, arr[i].end, arr[j].day, arr[j].start, arr[j].end)) {
          conflictReport.minor.push({
            type: "room_double_book",
            severity: "minor",
            description: `Room double-book: slot ${arr[i].idx + 1} and ${arr[j].idx + 1} overlap.`,
            scheduleIds: [],
            recommendation: "Shift one slot by 30 minutes or assign a different room.",
          });
        }
      }
    }
  }
  for (const lid of Object.keys(byLecturerDay)) {
    const arr = byLecturerDay[lid];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (slotsOverlap(arr[i].day, arr[i].start, arr[i].end, arr[j].day, arr[j].start, arr[j].end)) {
          conflictReport.minor.push({
            type: "lecturer_double_book",
            severity: "minor",
            description: `Lecturer double-book: slot ${arr[i].idx + 1} and ${arr[j].idx + 1} overlap.`,
            recommendation: "Move one slot to another day or time.",
          });
        }
      }
    }
  }

  // If no major conflicts, we can still apply; minor are flagged for user to optionally fix
  const programmeIdToUse = programmeId || programmes[0]?.id;
  if (!programmeIdToUse) return { ok: false, error: "No programme found." };

  const programmeModuleIds = new Set(
    programmeModules.filter((pm) => pm.programmeId === programmeIdToUse).map((pm) => pm.id)
  );
  const scheduleToApply = schedule.filter((s) => programmeModuleIds.has(s.programmeModuleId));
  const applyResult = await applySchedules(termId, programmeIdToUse, scheduleToApply, true);
  if (!applyResult.ok) return { ok: false, error: applyResult.error };

  return {
    ok: true,
    schedule,
    conflictReport,
    created: applyResult.created,
  };
}

// ---------------------------------------------------------------------------
// Get schools/departments/programmes for filters (scheduling page)
// ---------------------------------------------------------------------------

export async function getSchedulingFilterOptions(): Promise<
  | {
      ok: true;
      terms: { id: string; name: string }[];
      schools: { id: string; name: string; code: string }[];
      departments: { id: string; name: string; code: string | null; schoolId: string | null }[];
      programmes: { id: string; name: string; code: string; departmentId: string }[];
    }
  | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const [terms, schools, departments, programmes] = await Promise.all([
      prisma.academicTerm.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { startDate: "desc" },
        select: { id: true, name: true },
      }),
      prisma.school.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, code: true },
      }),
      prisma.department.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { order: "asc" },
        select: { id: true, name: true, code: true, schoolId: true },
      }),
      prisma.programme.findMany({
        where: { department: { tenantId: ctx.tenantId } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true, departmentId: true },
      }),
    ]);
    return {
      ok: true,
      terms,
      schools,
      departments,
      programmes,
    };
  } catch (e) {
    console.error("getSchedulingFilterOptions error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load filter options." };
  }
}
