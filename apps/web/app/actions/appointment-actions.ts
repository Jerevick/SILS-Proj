"use server";

/**
 * Phase 17: Appointments & Office Hours — server actions.
 * BookAppointment: checks availability, creates booking, sends notifications to both parties.
 * SetOfficeHours: creates/updates recurring availability slots.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { sendNotification } from "@/app/actions/notification-actions";
import type { AppointmentType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BookAppointmentInput = {
  hostUserId: string;
  startTime: Date | string;
  endTime: Date | string;
  title: string;
  type?: AppointmentType;
  location?: string | null;
  notes?: string | null;
};

export type BookAppointmentResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string };

export type AvailabilitySlotInput = {
  dayOfWeek: number; // 0–6 Sunday–Saturday
  startMinutes: number; // 0–1439
  endMinutes: number; // 0–1439
};

export type SetOfficeHoursInput = {
  slots: AvailabilitySlotInput[];
};

export type SetOfficeHoursResult =
  | { ok: true }
  | { ok: false; error: string };

export type AppointmentItem = {
  id: string;
  hostUserId: string;
  attendeeUserId: string | null;
  title: string;
  startTime: Date;
  endTime: Date;
  type: string;
  status: string;
  location: string | null;
  notes: string | null;
  createdAt: Date;
};

export type AvailabilitySlotItem = {
  id: string;
  hostUserId: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
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
  };
}

/**
 * Generate candidate slot start/end Date for a given date from recurring AvailabilitySlot.
 */
function slotToDateRange(
  date: Date,
  dayOfWeek: number,
  startMinutes: number,
  endMinutes: number
): { start: Date; end: Date } | null {
  const d = new Date(date);
  const currentDay = d.getDay();
  if (currentDay !== dayOfWeek) return null;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setMinutes(start.getMinutes() + startMinutes);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  end.setMinutes(end.getMinutes() + endMinutes);
  return { start, end };
}

/**
 * Check if requested [start, end) is within any availability slot for host on that day and not overlapping existing appointments.
 */
async function isSlotAvailable(
  tenantId: string,
  hostUserId: string,
  start: Date,
  end: Date
): Promise<boolean> {
  const dayOfWeek = start.getDay();
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();

  const slots = await prisma.availabilitySlot.findMany({
    where: { tenantId, hostUserId, dayOfWeek },
  });

  const fitsInSlot = slots.some(
    (s) => startMinutes >= s.startMinutes && endMinutes <= s.endMinutes
  );
  if (!fitsInSlot) return false;

  const overlapping = await prisma.appointment.count({
    where: {
      tenantId,
      hostUserId,
      status: { in: ["SCHEDULED", "AVAILABLE"] },
      OR: [
        {
          startTime: { lt: end },
          endTime: { gt: start },
        },
      ],
    },
  });
  return overlapping === 0;
}

// ---------------------------------------------------------------------------
// BookAppointment
// ---------------------------------------------------------------------------

export async function bookAppointment(
  input: BookAppointmentInput
): Promise<BookAppointmentResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { tenantId, userId: attendeeUserId } = ctx;

  const start =
    typeof input.startTime === "string" ? new Date(input.startTime) : input.startTime;
  const end =
    typeof input.endTime === "string" ? new Date(input.endTime) : input.endTime;

  if (start >= end) {
    return { ok: false, error: "End time must be after start time." };
  }

  const available = await isSlotAvailable(
    tenantId,
    input.hostUserId,
    start,
    end
  );
  if (!available) {
    return { ok: false, error: "The selected slot is not available." };
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        hostUserId: input.hostUserId,
        attendeeUserId,
        title: input.title.trim(),
        startTime: start,
        endTime: end,
        type: input.type ?? "OFFICE_HOURS",
        status: "SCHEDULED",
        location: input.location?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });

    await sendNotification(tenantId, {
      user_id: input.hostUserId,
      template_name: "appointment_booked",
      variables: {
        title: appointment.title,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        type: appointment.type,
        role: "host",
      },
      channels: ["in_app", "email"],
      fallback_title: "Appointment booked",
      fallback_body: `Your appointment "${appointment.title}" is scheduled for ${appointment.startTime.toLocaleString()} – ${appointment.endTime.toLocaleString()}.`,
      metadata: { appointmentId: appointment.id },
    });
    await sendNotification(tenantId, {
      user_id: attendeeUserId,
      template_name: "appointment_booked",
      variables: {
        title: appointment.title,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        type: appointment.type,
        role: "attendee",
      },
      channels: ["in_app", "email"],
      fallback_title: "Appointment booked",
      fallback_body: `You have an appointment "${appointment.title}" on ${appointment.startTime.toLocaleString()} – ${appointment.endTime.toLocaleString()}.`,
      metadata: { appointmentId: appointment.id },
    });

    return { ok: true, appointmentId: appointment.id };
  } catch (e) {
    console.error("BookAppointment error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to book appointment.",
    };
  }
}

// ---------------------------------------------------------------------------
// SetOfficeHours (replace all recurring slots for current user)
// ---------------------------------------------------------------------------

export async function setOfficeHours(
  input: SetOfficeHoursInput
): Promise<SetOfficeHoursResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { tenantId, userId: hostUserId } = ctx;

  const valid = input.slots.every(
    (s) =>
      s.dayOfWeek >= 0 &&
      s.dayOfWeek <= 6 &&
      s.startMinutes >= 0 &&
      s.startMinutes < 1440 &&
      s.endMinutes > s.startMinutes &&
      s.endMinutes <= 1440
  );
  if (!valid) {
    return { ok: false, error: "Invalid slot times." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.availabilitySlot.deleteMany({
        where: { tenantId, hostUserId },
      });
      if (input.slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: input.slots.map((s) => ({
            tenantId,
            hostUserId,
            dayOfWeek: s.dayOfWeek,
            startMinutes: s.startMinutes,
            endMinutes: s.endMinutes,
          })),
        });
      }
    });
    return { ok: true };
  } catch (e) {
    console.error("SetOfficeHours error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to set office hours.",
    };
  }
}

// ---------------------------------------------------------------------------
// Get availability slots for a host (for calendar / booking UI)
// ---------------------------------------------------------------------------

export async function getAvailabilitySlots(hostUserId: string): Promise<
  { ok: true; slots: AvailabilitySlotItem[] } | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const slots = await prisma.availabilitySlot.findMany({
    where: { tenantId: ctx.tenantId, hostUserId },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
  });

  return {
    ok: true,
    slots: slots.map((s) => ({
      id: s.id,
      hostUserId: s.hostUserId,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
    })),
  };
}

// ---------------------------------------------------------------------------
// Get bookable slots for a host on a given date (from recurring + minus existing)
// ---------------------------------------------------------------------------

export async function getBookableSlotsForDate(
  hostUserId: string,
  date: Date | string
): Promise<
  { ok: true; slots: { start: Date; end: Date }[] } | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const d = typeof date === "string" ? new Date(date) : new Date(date);
  const dayOfWeek = d.getDay();

  const availabilitySlots = await prisma.availabilitySlot.findMany({
    where: { tenantId: ctx.tenantId, hostUserId, dayOfWeek },
  });

  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

  const existing = await prisma.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      hostUserId,
      status: { in: ["SCHEDULED", "AVAILABLE"] },
      startTime: { gte: dayStart },
      endTime: { lte: dayEnd },
    },
  });

  const ranges: { start: Date; end: Date }[] = [];
  for (const slot of availabilitySlots) {
    const range = slotToDateRange(
      d,
      slot.dayOfWeek,
      slot.startMinutes,
      slot.endMinutes
    );
    if (!range) continue;
    const overlaps = existing.some(
      (e) => e.startTime < range.end && e.endTime > range.start
    );
    if (!overlaps) ranges.push(range);
  }

  return { ok: true, slots: ranges };
}

// ---------------------------------------------------------------------------
// Get appointments for current user (as host or attendee)
// ---------------------------------------------------------------------------

export async function getMyAppointments(options: {
  from?: Date | string;
  to?: Date | string;
}): Promise<
  { ok: true; appointments: AppointmentItem[] } | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const from = options.from
    ? typeof options.from === "string"
      ? new Date(options.from)
      : options.from
    : new Date(0);
  const to = options.to
    ? typeof options.to === "string"
      ? new Date(options.to)
      : options.to
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      OR: [{ hostUserId: ctx.userId }, { attendeeUserId: ctx.userId }],
      status: { not: "CANCELLED" },
      startTime: { gte: from },
      endTime: { lte: to },
    },
    orderBy: { startTime: "asc" },
  });

  return {
    ok: true,
    appointments: appointments.map((a) => ({
      id: a.id,
      hostUserId: a.hostUserId,
      attendeeUserId: a.attendeeUserId,
      title: a.title,
      startTime: a.startTime,
      endTime: a.endTime,
      type: a.type,
      status: a.status,
      location: a.location,
      notes: a.notes,
      createdAt: a.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Get hosts with office hours (for booking page — list faculty with availability)
// ---------------------------------------------------------------------------

export async function getHostsWithAvailability(): Promise<
  { ok: true; hostUserIds: string[] } | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const slots = await prisma.availabilitySlot.findMany({
    where: { tenantId: ctx.tenantId },
    select: { hostUserId: true },
    distinct: ["hostUserId"],
  });

  return {
    ok: true,
    hostUserIds: slots.map((s) => s.hostUserId),
  };
}
