"use server";

/**
 * Phase 21: Multi-Channel Notification Engine — server actions.
 * - SendNotification: render template, send via channels, log to Notification table.
 * - NotificationPreferences: get/update per-user per-channel preferences.
 * - User notification center: list, mark read, mark all read.
 * - Admin: template CRUD (create/edit templates with variable placeholders).
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import {
  sendNotificationInternal,
  type NotificationChannelType,
} from "@/lib/notification-engine";
import type { NotificationChannel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SendNotificationInput = {
  user_id: string; // Clerk user ID
  template_name: string;
  variables: Record<string, string | number | boolean>;
  channels: NotificationChannelType[];
  metadata?: Record<string, unknown>;
  fallback_title?: string;
  fallback_body?: string;
};

export type SendNotificationResult =
  | { ok: true; notificationIds: string[] }
  | { ok: false; error: string };

export type NotificationPreferenceItem = {
  channel: NotificationChannel;
  enabled: boolean;
};

export type UpdatePreferencesInput = {
  channel: NotificationChannel;
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return { ok: true as const, userId, tenantId: tenantResult.context.tenantId, context: tenantResult.context };
}

/** Resolve current user's internal User id. */
async function requireUser(tenantId: string) {
  const { userId } = await auth();
  if (!userId) return { ok: false as const, error: "Unauthorized" };
  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) return { ok: false as const, error: "User not found" };
  return { ok: true as const, userId: user.id, clerkUserId: userId };
}

// ---------------------------------------------------------------------------
// SendNotification (call from other actions / API; tenant-scoped)
// ---------------------------------------------------------------------------

/**
 * Send a notification to a user by template name and channels.
 * Used system-wide: admissions, grade posted, live class starting, wellness nudge, appointment reminder.
 * Caller must have tenant context (e.g. from requireTenant in the calling action).
 */
export async function sendNotification(
  tenantId: string,
  input: Omit<SendNotificationInput, "metadata"> & { metadata?: Record<string, unknown> }
): Promise<SendNotificationResult> {
  return sendNotificationInternal({
    tenantId,
    userClerkId: input.user_id,
    templateName: input.template_name,
    channels: input.channels,
    variables: input.variables,
    metadata: input.metadata,
    fallbackTitle: input.fallback_title,
    fallbackBody: input.fallback_body,
  });
}

// ---------------------------------------------------------------------------
// Notification preferences (current user, tenant-scoped)
// ---------------------------------------------------------------------------

export async function getNotificationPreferences(): Promise<
  { ok: true; preferences: NotificationPreferenceItem[] } | { ok: false; error: string }
> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const userResult = await requireUser(tenantResult.tenantId);
  if (!userResult.ok) return { ok: false, error: userResult.error };

  const prefs = await prisma.notificationPreference.findMany({
    where: { tenantId: tenantResult.tenantId, userId: userResult.userId },
  });

  const channels: NotificationChannel[] = ["EMAIL", "SMS", "PUSH", "IN_APP", "WHATSAPP"];
  const preferences: NotificationPreferenceItem[] = channels.map((channel) => {
    const p = prefs.find((x) => x.channel === channel);
    return { channel, enabled: p ? p.enabled : true };
  });

  return { ok: true, preferences };
}

export async function updateNotificationPreference(
  input: UpdatePreferencesInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const userResult = await requireUser(tenantResult.tenantId);
  if (!userResult.ok) return { ok: false, error: userResult.error };

  await prisma.notificationPreference.upsert({
    where: {
      tenantId_userId_channel: {
        tenantId: tenantResult.tenantId,
        userId: userResult.userId,
        channel: input.channel,
      },
    },
    create: {
      tenantId: tenantResult.tenantId,
      userId: userResult.userId,
      channel: input.channel,
      enabled: input.enabled,
    },
    update: { enabled: input.enabled },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// User notification center: list, mark read
// ---------------------------------------------------------------------------

export type NotificationItem = {
  id: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export async function listNotifications(params: {
  filter?: "all" | "unread" | "read";
  limit?: number;
  cursor?: string;
}): Promise<
  { ok: true; items: NotificationItem[]; nextCursor: string | null } | { ok: false; error: string }
> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const userResult = await requireUser(tenantResult.tenantId);
  if (!userResult.ok) return { ok: false, error: userResult.error };

  const limit = Math.min(params.limit ?? 50, 100);
  const where: { userId: string; tenantId: string; readAt?: unknown } = {
    userId: userResult.userId,
    tenantId: tenantResult.tenantId,
  };
  if (params.filter === "unread") where.readAt = null;
  if (params.filter === "read") where.readAt = { not: null };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  const list = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = hasMore ? list[list.length - 1]?.id ?? null : null;

  const items: NotificationItem[] = list.map((n) => ({
    id: n.id,
    channel: n.channel,
    title: n.title,
    body: n.body,
    status: n.status,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    metadata: (n.metadata as Record<string, unknown>) ?? null,
  }));

  return { ok: true, items, nextCursor };
}

export async function getUnreadCount(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const userResult = await requireUser(tenantResult.tenantId);
  if (!userResult.ok) return { ok: false, error: userResult.error };

  const count = await prisma.notification.count({
    where: {
      userId: userResult.userId,
      tenantId: tenantResult.tenantId,
      channel: "IN_APP",
      readAt: null,
    },
  });
  return { ok: true, count };
}

export async function markNotificationAsRead(notificationId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const userResult = await requireUser(tenantResult.tenantId);
  if (!userResult.ok) return { ok: false, error: userResult.error };

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: userResult.userId,
      tenantId: tenantResult.tenantId,
    },
    data: { readAt: new Date(), status: "READ" },
  });
  return { ok: true };
}

export async function markAllNotificationsAsRead(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const userResult = await requireUser(tenantResult.tenantId);
  if (!userResult.ok) return { ok: false, error: userResult.error };

  await prisma.notification.updateMany({
    where: {
      userId: userResult.userId,
      tenantId: tenantResult.tenantId,
      channel: "IN_APP",
      readAt: null,
    },
    data: { readAt: new Date(), status: "READ" },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: template manager (tenant-scoped; ADMIN/OWNER only)
// ---------------------------------------------------------------------------

export type TemplateItem = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  bodyTemplate: string;
  variables: unknown;
  createdAt: string;
};

export async function listNotificationTemplates(): Promise<
  { ok: true; templates: TemplateItem[] } | { ok: false; error: string }
> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const { role } = tenantResult.context;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, error: "Only admins can manage notification templates" };
  }

  const templates = await prisma.notificationTemplate.findMany({
    where: { tenantId: tenantResult.tenantId },
    orderBy: [{ name: "asc" }, { channel: "asc" }],
  });

  return {
    ok: true,
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      channel: t.channel,
      subject: t.subject,
      bodyTemplate: t.bodyTemplate,
      variables: t.variables,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export type CreateTemplateInput = {
  name: string;
  channel: NotificationChannel;
  subject?: string | null;
  bodyTemplate: string;
  variables?: unknown;
};

export async function createNotificationTemplate(
  input: CreateTemplateInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const { role } = tenantResult.context;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, error: "Only admins can create templates" };
  }

  const template = await prisma.notificationTemplate.create({
    data: {
      tenantId: tenantResult.tenantId,
      name: input.name,
      channel: input.channel,
      subject: input.subject ?? null,
      bodyTemplate: input.bodyTemplate,
      variables: input.variables ? (input.variables as object) : undefined,
    },
  });
  return { ok: true, id: template.id };
}

export type UpdateTemplateInput = {
  id: string;
  name?: string;
  subject?: string | null;
  bodyTemplate?: string;
  variables?: unknown;
};

export async function updateNotificationTemplate(
  input: UpdateTemplateInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const { role } = tenantResult.context;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, error: "Only admins can update templates" };
  }

  await prisma.notificationTemplate.updateMany({
    where: {
      id: input.id,
      tenantId: tenantResult.tenantId,
    },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.bodyTemplate !== undefined && { bodyTemplate: input.bodyTemplate }),
      ...(input.variables !== undefined && { variables: input.variables as object }),
    },
  });
  return { ok: true };
}

export async function deleteNotificationTemplate(
  templateId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantResult = await requireTenant();
  if (!tenantResult.ok) return { ok: false, error: tenantResult.error };
  const { role } = tenantResult.context;
  if (role !== "OWNER" && role !== "ADMIN") {
    return { ok: false, error: "Only admins can delete templates" };
  }

  await prisma.notificationTemplate.deleteMany({
    where: { id: templateId, tenantId: tenantResult.tenantId },
  });
  return { ok: true };
}
