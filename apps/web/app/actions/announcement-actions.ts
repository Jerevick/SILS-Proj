"use server";

/**
 * Phase 17: Centralized Announcements — server actions.
 * SendAnnouncement: creates announcement, resolves targets from scope, sends via notification engine.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { sendAnnouncementNotification } from "@/lib/notifications";
import type { AnnouncementScopeType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SendAnnouncementInput = {
  title: string;
  body: string;
  targetScopeType: AnnouncementScopeType;
  targetScopeId?: string | null;
  scheduledAt?: Date | string | null;
  expiresAt?: Date | string | null;
};

export type SendAnnouncementResult =
  | { ok: true; announcementId: string; recipientCount: number }
  | { ok: false; error: string };

export type AnnouncementFeedItem = {
  id: string;
  title: string;
  body: string;
  targetScopeType: string;
  targetScopeId: string | null;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
};

// ---------------------------------------------------------------------------
// Resolve target recipient clerk user IDs from scope
// ---------------------------------------------------------------------------

async function resolveAnnouncementTargets(
  tenantId: string,
  targetScopeType: AnnouncementScopeType,
  targetScopeId: string | null
): Promise<string[]> {
  const roleRows = await prisma.userTenantRole.findMany({
    where: { tenantId },
    select: { clerkUserId: true, scopeType: true, scopeId: true, role: true },
  });
  const allClerkIds = [...new Set(roleRows.map((r) => r.clerkUserId))];

  if (targetScopeType === "ALL" || !targetScopeId) {
    return allClerkIds;
  }

  if (targetScopeType === "ROLE") {
    return roleRows.filter((r) => r.role === targetScopeId).map((r) => r.clerkUserId);
  }

  if (targetScopeType === "SCHOOL") {
    const school = await prisma.school.findFirst({
      where: { id: targetScopeId, tenantId },
      select: { id: true, departments: { select: { id: true } } },
    });
    if (!school) return [];
    const deptIds = new Set(school.departments.map((d) => d.id));
    const programmeIds = await prisma.programme.findMany({
      where: { departmentId: { in: [...deptIds] } },
      select: { id: true },
    });
    const progIds = new Set(programmeIds.map((p) => p.id));
    const ids = new Set<string>();
    for (const r of roleRows) {
      if (r.scopeType === "SCHOOL" && r.scopeId === targetScopeId) ids.add(r.clerkUserId);
      if (r.scopeType === "DEPARTMENT" && r.scopeId && deptIds.has(r.scopeId)) ids.add(r.clerkUserId);
      if (r.scopeType === "PROGRAMME" && r.scopeId && progIds.has(r.scopeId)) ids.add(r.clerkUserId);
    }
    return [...ids];
  }

  if (targetScopeType === "DEPARTMENT") {
    const programmes = await prisma.programme.findMany({
      where: { departmentId: targetScopeId },
      select: { id: true },
    });
    const progIds = new Set(programmes.map((p) => p.id));
    const ids = new Set<string>();
    for (const r of roleRows) {
      if (r.scopeType === "DEPARTMENT" && r.scopeId === targetScopeId) ids.add(r.clerkUserId);
      if (r.scopeType === "PROGRAMME" && r.scopeId && progIds.has(r.scopeId)) ids.add(r.clerkUserId);
    }
    return [...ids];
  }

  if (targetScopeType === "PROGRAMME") {
    const enrollees = await prisma.programmeEnrollment.findMany({
      where: { programmeId: targetScopeId },
      select: { studentId: true },
    });
    const ids = new Set<string>(enrollees.map((e) => e.studentId));
    for (const r of roleRows) {
      if (r.scopeType === "PROGRAMME" && r.scopeId === targetScopeId) ids.add(r.clerkUserId);
    }
    return [...ids];
  }

  if (targetScopeType === "MODULE") {
    const pm = await prisma.programmeModule.findFirst({
      where: { id: targetScopeId },
      select: { programmeId: true },
    });
    if (!pm) return [];
    return resolveAnnouncementTargets(tenantId, "PROGRAMME", pm.programmeId);
  }

  return allClerkIds;
}

// ---------------------------------------------------------------------------
// SendAnnouncement
// ---------------------------------------------------------------------------

export async function sendAnnouncement(
  input: SendAnnouncementInput
): Promise<SendAnnouncementResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const role = tenantResult.context.role;
  const canSend = role === "OWNER" || role === "ADMIN";
  if (!canSend) {
    return { ok: false, error: "Insufficient role to send announcements." };
  }

  const title = input.title?.trim();
  const body = input.body?.trim();
  if (!title || !body) {
    return { ok: false, error: "Title and body are required." };
  }

  const tenantId = tenantResult.context.tenantId;
  const scheduledAt = input.scheduledAt
    ? typeof input.scheduledAt === "string"
      ? new Date(input.scheduledAt)
      : input.scheduledAt
    : null;
  const expiresAt = input.expiresAt
    ? typeof input.expiresAt === "string"
      ? new Date(input.expiresAt)
      : input.expiresAt
    : null;

  try {
    const recipientIds = await resolveAnnouncementTargets(
      tenantId,
      input.targetScopeType,
      input.targetScopeId ?? null
    );

    const announcement = await prisma.announcement.create({
      data: {
        tenantId,
        title,
        body,
        targetScopeType: input.targetScopeType,
        targetScopeId: input.targetScopeId ?? null,
        scheduledAt,
        expiresAt,
        createdBy: userId,
      },
    });

    await sendAnnouncementNotification({
      tenantId,
      announcementId: announcement.id,
      title,
      body,
      recipientClerkUserIds: recipientIds,
    });

    return {
      ok: true,
      announcementId: announcement.id,
      recipientCount: recipientIds.length,
    };
  } catch (e) {
    console.error("SendAnnouncement error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to send announcement.",
    };
  }
}

// ---------------------------------------------------------------------------
// Get announcements for current user (feed) — filtered by scope and date
// ---------------------------------------------------------------------------

export type GetAnnouncementsForUserOptions = {
  scopeFilter?: AnnouncementScopeType | null;
  from?: Date | string | null;
  to?: Date | string | null;
};

export async function getAnnouncementsForUser(
  options: GetAnnouncementsForUserOptions = {}
): Promise<{ ok: true; items: AnnouncementFeedItem[] } | { ok: false; error: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const tenantId = tenantResult.context.tenantId;
  const now = new Date();

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (options.from) {
    createdAtFilter.gte = typeof options.from === "string" ? new Date(options.from) : options.from;
  }
  if (options.to) {
    createdAtFilter.lte = typeof options.to === "string" ? new Date(options.to) : options.to;
  }

  const where: Parameters<typeof prisma.announcement.findMany>[0]["where"] = {
    tenantId,
    OR: [
      { scheduledAt: null },
      { scheduledAt: { lte: now } },
    ],
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ...(Object.keys(createdAtFilter).length > 0 ? [{ createdAt: createdAtFilter }] : []),
    ],
  };

  if (options.scopeFilter) {
    where.targetScopeType = options.scopeFilter;
  }
  const items = await prisma.announcement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    ok: true,
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      targetScopeType: a.targetScopeType,
      targetScopeId: a.targetScopeId,
      scheduledAt: a.scheduledAt,
      expiresAt: a.expiresAt,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Get scope options for announcement create form (schools, departments, programmes, modules, roles)
// ---------------------------------------------------------------------------

export type AnnouncementScopeOption = {
  type: AnnouncementScopeType;
  id: string;
  label: string;
};

export async function getAnnouncementScopeOptions(): Promise<
  { ok: true; options: AnnouncementScopeOption[] } | { ok: false; error: string }
> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const tenantId = tenantResult.context.tenantId;
  const featureFlags = tenantResult.context.featureFlags as { schoolsEnabled?: boolean };
  const schoolsEnabled = featureFlags?.schoolsEnabled ?? false;

  const options: AnnouncementScopeOption[] = [];

  if (schoolsEnabled) {
    const schools = await prisma.school.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    schools.forEach((s) => {
      options.push({ type: "SCHOOL", id: s.id, label: `${s.name} (${s.code})` });
    });
  }

  const departments = await prisma.department.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });
  departments.forEach((d) => {
    options.push({ type: "DEPARTMENT", id: d.id, label: d.name });
  });

  const programmes = await prisma.programme.findMany({
    where: { department: { tenantId } },
    orderBy: { name: "asc" },
  });
  programmes.forEach((p) => {
    options.push({ type: "PROGRAMME", id: p.id, label: `${p.name} (${p.code})` });
  });

  const modules = await prisma.programmeModule.findMany({
    where: { programme: { department: { tenantId } } },
    orderBy: [{ programme: { name: "asc" } }, { title: "asc" }],
    include: { programme: { select: { name: true, code: true } } },
  });
  modules.forEach((m) => {
    options.push({
      type: "MODULE",
      id: m.id,
      label: `${m.title} (${m.programme.code})`,
    });
  });

  const roles: AnnouncementScopeType[] = ["ALL", "ROLE"];
  const roleLabels: Record<string, string> = {
    LEARNER: "Learner",
    INSTRUCTOR: "Instructor",
    ADMIN: "Admin",
    OWNER: "Owner",
    SUPPORT: "Support",
    FINANCE_OFFICER: "Finance Officer",
    FINANCE_DIRECTOR: "Finance Director",
  };
  ["LEARNER", "INSTRUCTOR", "ADMIN", "OWNER", "SUPPORT", "FINANCE_OFFICER", "FINANCE_DIRECTOR"].forEach((role) => {
    options.push({ type: "ROLE", id: role, label: roleLabels[role] ?? role });
  });

  return { ok: true, options };
}
