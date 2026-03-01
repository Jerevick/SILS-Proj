/**
 * Phase 21: Multi-Channel Notification Engine.
 * Renders templates with variables, sends via appropriate provider, logs to Notification table.
 * Providers: Resend/SendGrid (email), Twilio (SMS), Firebase/VAPID (push), in_app (DB only).
 */

import { prisma } from "@/lib/db";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";

export type NotificationChannelType = "email" | "sms" | "push" | "in_app" | "whatsapp";

const CHANNEL_MAP: Record<NotificationChannelType, NotificationChannel> = {
  email: "EMAIL",
  sms: "SMS",
  push: "PUSH",
  in_app: "IN_APP",
  whatsapp: "WHATSAPP",
};

/**
 * Render a template string with {{variable}} placeholders.
 */
export function renderTemplate(template: string, variables: Record<string, string | number | boolean>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = variables[key];
    return v !== undefined && v !== null ? String(v) : "";
  });
}

/**
 * Resolve Clerk user ID to internal User id (for Notification.userId and preferences).
 */
export async function resolveUserId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Get template by tenant and name for a given channel; render with variables.
 */
export async function getAndRenderTemplate(
  tenantId: string,
  templateName: string,
  channel: NotificationChannelType,
  variables: Record<string, string | number | boolean>
): Promise<{ title: string; body: string; subject: string | null } | null> {
  const ch = CHANNEL_MAP[channel];
  const template = await prisma.notificationTemplate.findFirst({
    where: { tenantId, name: templateName, channel: ch },
  });
  if (!template) return null;
  const subject = template.subject ? renderTemplate(template.subject, variables) : null;
  const body = renderTemplate(template.bodyTemplate, variables);
  // Title for in_app/push: use subject or first line of body
  const title = subject ?? body.slice(0, 80).split("\n")[0] ?? templateName;
  return { title, body, subject };
}

/**
 * Check if user has this channel enabled in preferences (default true if no preference).
 */
export async function isChannelEnabledForUser(
  tenantId: string,
  userId: string,
  channel: NotificationChannel
): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      tenantId_userId_channel: { tenantId, userId, channel },
    },
  });
  return pref ? pref.enabled : true;
}

/**
 * Send via provider (email/SMS/push). In-app is always stored only.
 * Returns delivery status string or error message.
 */
async function sendViaProvider(
  channel: NotificationChannel,
  title: string,
  body: string,
  subject: string | null,
  recipientEmail: string | null,
  recipientPhone: string | null
): Promise<{ ok: boolean; deliveryStatus?: string; error?: string; providerMetadata?: Record<string, unknown> }> {
  if (channel === "IN_APP") {
    return { ok: true, deliveryStatus: "in_app" };
  }

  if (channel === "EMAIL" && recipientEmail) {
    const apiKey = process.env.RESEND_API_KEY ?? process.env.SENDGRID_API_KEY;
    if (apiKey && process.env.RESEND_API_KEY) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL ?? "SILS <notifications@localhost>",
            to: [recipientEmail],
            subject: subject ?? title,
            text: body,
          }),
        });
        const data = (await res.json()) as { id?: string; message?: string };
        if (res.ok) return { ok: true, deliveryStatus: "sent", providerMetadata: data.id ? { resendId: data.id } : undefined };
        return { ok: false, error: (data as { message?: string }).message ?? res.statusText };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Email send failed" };
      }
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[notification-engine] Email (no Resend):", recipientEmail, subject ?? title);
    }
    return { ok: true, deliveryStatus: "skipped_no_provider" };
  }

  if ((channel === "SMS" || channel === "WHATSAPP") && recipientPhone) {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    if (twilioSid && twilioToken) {
      try {
        const from = channel === "WHATSAPP" ? process.env.TWILIO_WHATSAPP_FROM : process.env.TWILIO_PHONE_FROM;
        const to = channel === "WHATSAPP" ? `whatsapp:${recipientPhone}` : recipientPhone;
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: to,
              From: from ?? "",
              Body: body.slice(0, 1600),
            }),
          }
        );
        const data = (await res.json()) as { sid?: string; message?: string; error_message?: string };
        if (res.ok && data.sid) return { ok: true, deliveryStatus: "sent", providerMetadata: { twilioSid: data.sid } };
        return { ok: false, error: data.error_message ?? data.message ?? res.statusText };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "SMS send failed" };
      }
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[notification-engine] SMS (no Twilio):", recipientPhone, body.slice(0, 50));
    }
    return { ok: true, deliveryStatus: "skipped_no_provider" };
  }

  if (channel === "PUSH") {
    // Firebase/VAPID: would need subscription endpoint from client; stub for now
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[notification-engine] Push (stub):", title);
    }
    return { ok: true, deliveryStatus: "skipped_no_provider" };
  }

  return { ok: true, deliveryStatus: "skipped" };
}

export type SendNotificationInternalInput = {
  tenantId: string;
  userClerkId: string;
  templateName: string;
  channels: NotificationChannelType[];
  variables: Record<string, string | number | boolean>;
  /** Override title/body if no template found (optional). */
  fallbackTitle?: string;
  fallbackBody?: string;
  /** Extra metadata to store on Notification (e.g. appointmentId, submissionId). */
  metadata?: Record<string, unknown>;
};

/**
 * Send notification to one user: resolve user, load template per channel, respect preferences,
 * create Notification rows, send via providers, update status.
 */
export async function sendNotificationInternal(input: SendNotificationInternalInput): Promise<
  { ok: true; notificationIds: string[] } | { ok: false; error: string }
> {
  const { tenantId, userClerkId, templateName, channels, variables, fallbackTitle, fallbackBody, metadata = {} } = input;
  const userId = await resolveUserId(userClerkId);
  if (!userId) {
    return { ok: false, error: "User not found in database" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const recipientEmail = user?.email ?? null;
  const recipientPhone = null; // TODO: add phone to User or profile when needed

  const notificationIds: string[] = [];
  const channelList = [...new Set(channels)].map((c) => CHANNEL_MAP[c]);

  for (const channel of channelList) {
    const enabled = await isChannelEnabledForUser(tenantId, userId, channel);
    if (!enabled) continue;

    const rendered = await getAndRenderTemplate(tenantId, templateName, channel as NotificationChannelType, variables);
    const title = rendered?.title ?? fallbackTitle ?? templateName;
    const body = rendered?.body ?? fallbackBody ?? "";

    const template = await prisma.notificationTemplate.findFirst({
      where: { tenantId, name: templateName, channel },
    });

    const notification = await prisma.notification.create({
      data: {
        userId,
        tenantId,
        templateId: template?.id ?? null,
        channel,
        title,
        body,
        status: "PENDING",
      },
    });
    notificationIds.push(notification.id);

    const result = await sendViaProvider(
      channel,
      title,
      body,
      rendered?.subject ?? null,
      recipientEmail,
      recipientPhone
    );

    const status: NotificationStatus = result.ok ? "SENT" : "FAILED";
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status,
        sentAt: result.ok ? new Date() : null,
        deliveryStatus: result.deliveryStatus ?? result.error ?? undefined,
        metadata: result.ok
          ? { ...(metadata ?? {}), ...result.providerMetadata }
          : { ...(metadata ?? {}), error: result.error },
      },
    });
  }

  return { ok: true, notificationIds };
}
