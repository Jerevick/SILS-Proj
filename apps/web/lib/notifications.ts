/**
 * Phase 17: Notification integration stub.
 * Phase 20 will implement full multi-channel notification engine (in-app, email, push).
 * This module provides a single entry point for sending notifications so Phase 20 can plug in.
 */

export type AnnouncementNotificationPayload = {
  tenantId: string;
  announcementId: string;
  title: string;
  body: string;
  recipientClerkUserIds: string[];
};

export type AppointmentNotificationPayload = {
  tenantId: string;
  appointmentId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  hostClerkUserId: string;
  attendeeClerkUserId: string;
  type: string;
};

/**
 * Send announcement to target users. Phase 20 will fan out to in-app, email, etc.
 */
export async function sendAnnouncementNotification(
  payload: AnnouncementNotificationPayload
): Promise<void> {
  // Stub: log for now; Phase 20 will enqueue to notification engine
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[notifications] Announcement:", payload.announcementId, "recipients:", payload.recipientClerkUserIds.length);
  }
}

/**
 * Notify host and attendee of a new/updated appointment. Phase 20 will send to both.
 */
export async function sendAppointmentNotification(
  payload: AppointmentNotificationPayload
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[notifications] Appointment:", payload.appointmentId, "host:", payload.hostClerkUserId, "attendee:", payload.attendeeClerkUserId);
  }
}
