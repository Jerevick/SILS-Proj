/**
 * POST /api/admin/send-email — Send an email to an institution contact (or any address).
 * Platform staff with canViewOnboarding can use this for communication from request/institution pages.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canViewOnboarding } from "@/lib/platform-auth";
import { sendAdminEmail } from "@/lib/send-user-created-email";

const BODY_SCHEMA = {
  to: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  subject: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  body: (v: unknown) => typeof v === "string" && v.trim().length > 0,
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || !(await canViewOnboarding(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { to?: unknown; subject?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (
    !BODY_SCHEMA.to(body.to) ||
    !BODY_SCHEMA.subject(body.subject) ||
    !BODY_SCHEMA.body(body.body)
  ) {
    return NextResponse.json(
      { error: "to, subject, and body are required and must be non-empty strings." },
      { status: 400 }
    );
  }

  const result = await sendAdminEmail({
    to: String(body.to).trim(),
    subject: String(body.subject).trim(),
    body: String(body.body).trim(),
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: result.error ?? "Failed to send email." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}
