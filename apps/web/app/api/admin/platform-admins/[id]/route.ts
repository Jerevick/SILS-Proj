/**
 * PATCH /api/admin/platform-admins/[id] — Update role or status (suspend/activate). Platform Owner only.
 * DELETE /api/admin/platform-admins/[id] — Remove platform staff. Platform Owner only.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canManagePlatformStaff } from "@/lib/platform-auth";
import type { PlatformRole, PlatformStaffStatus } from "@prisma/client";

const VALID_ROLES: PlatformRole[] = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "ONBOARDING_MANAGER",
  "SUPPORT",
  "AUDITOR",
];
const VALID_STATUSES: PlatformStaffStatus[] = ["ACTIVE", "SUSPENDED"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canManagePlatformStaff(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  let body: { role?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON. Expected { role?: string, status?: string }." },
      { status: 400 }
    );
  }
  const updates: { role?: PlatformRole; status?: PlatformStaffStatus } = {};
  if (typeof body.role === "string" && VALID_ROLES.includes(body.role as PlatformRole)) {
    updates.role = body.role as PlatformRole;
  }
  if (typeof body.status === "string" && VALID_STATUSES.includes(body.status as PlatformStaffStatus)) {
    updates.status = body.status as PlatformStaffStatus;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Send at least one of role or status." },
      { status: 400 }
    );
  }
  try {
    const admin = await prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) {
      return NextResponse.json(
        { error: "Platform staff not found." },
        { status: 404 }
      );
    }
    await prisma.platformAdmin.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Update platform admin error:", e);
    return NextResponse.json(
      { error: "Failed to update." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canManagePlatformStaff(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const admin = await prisma.platformAdmin.findUnique({
      where: { id },
    });
    if (!admin) {
      return NextResponse.json(
        { error: "Platform staff not found." },
        { status: 404 }
      );
    }
    await prisma.platformAdmin.delete({
      where: { id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Remove platform admin error:", e);
    return NextResponse.json(
      { error: "Failed to remove." },
      { status: 500 }
    );
  }
}
