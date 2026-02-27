/**
 * GET /api/admin/platform-admins — List platform staff. Platform Owner only.
 * POST /api/admin/platform-admins — Add platform staff by email + role. Platform Owner only.
 */

import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManagePlatformStaff } from "@/lib/platform-auth";
import {
  generateSecurePassword,
  sendPlatformStaffCreatedEmail,
  usernameFromEmail,
} from "@/lib/send-user-created-email";
import { PLATFORM_ROLE_LABELS } from "@/lib/platform-roles";
import type { PlatformRole } from "@prisma/client";

const VALID_ROLES: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
  "SUPPORT",
  "AUDITOR",
];

export type PlatformAdminRow = {
  id: string;
  clerkUserId: string;
  email: string | null;
  role: PlatformRole;
  status: string;
  createdAt: string;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId || !(await canManagePlatformStaff(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const list = await prisma.platformAdmin.findMany({
      orderBy: { createdAt: "asc" },
    });
    const rows: PlatformAdminRow[] = list.map((r) => ({
      id: r.id,
      clerkUserId: r.clerkUserId,
      email: r.email,
      role: r.role,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json(rows);
  } catch (e) {
    console.error("List platform admins error:", e);
    return NextResponse.json(
      { error: "Failed to list platform admins." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || !(await canManagePlatformStaff(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { email: string, role?: string }." },
      { status: 400 }
    );
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json(
      { error: "Missing or invalid email. Send { email: \"user@example.com\" }." },
      { status: 400 }
    );
  }
  const role =
    typeof body.role === "string" && VALID_ROLES.includes(body.role as PlatformRole)
      ? (body.role as PlatformRole)
      : "PLATFORM_ADMIN";
  try {
    const clerk = await clerkClient();
    const { data: existingUsers } = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    let clerkUser = existingUsers[0];
    let clerkUserId: string;
    let primaryEmail: string;
    let tempPassword: string | null = null;

    if (!clerkUser) {
      tempPassword = generateSecurePassword();
      clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        username: usernameFromEmail(email),
        password: tempPassword,
        skipPasswordChecks: false,
      });
      clerkUserId = clerkUser.id;
      primaryEmail =
        clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? email;
    } else {
      clerkUserId = clerkUser.id;
      primaryEmail =
        clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() ?? email;
    }

    const existing = await prisma.platformAdmin.findUnique({
      where: { clerkUserId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This user is already platform staff." },
        { status: 409 }
      );
    }

    await prisma.platformAdmin.create({
      data: {
        clerkUserId,
        email: primaryEmail,
        role,
      },
    });

    if (tempPassword) {
      await sendPlatformStaffCreatedEmail({
        to: primaryEmail,
        role: PLATFORM_ROLE_LABELS[role],
        tempPassword,
      });
    }

    return NextResponse.json({
      ok: true,
      clerkUserId,
      email: primaryEmail,
      role,
      createdWithPassword: !!tempPassword,
    });
  } catch (e) {
    console.error("Add platform admin error:", e);
    return NextResponse.json(
      { error: "Failed to add platform admin." },
      { status: 500 }
    );
  }
}
