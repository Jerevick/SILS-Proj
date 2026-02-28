/**
 * GET /api/org-members — List members of the current organization (for Dean/role pickers).
 * Phase 15: Used by hierarchy builder to assign Dean to a School.
 */

import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export type OrgMember = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const clerk = await clerkClient();
    const { data: memberships } =
      await clerk.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });

    const userIds = [...new Set(memberships.map((m) => (m.publicUserData?.userId ?? m.userId) as string).filter(Boolean))];
    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    const members: OrgMember[] = [];
    for (const id of userIds) {
      try {
        const u = await clerk.users.getUser(id);
        members.push({
          userId: u.id,
          email: u.emailAddresses[0]?.emailAddress ?? null,
          firstName: u.firstName ?? null,
          lastName: u.lastName ?? null,
        });
      } catch {
        // Skip if user not found
      }
    }

    let result = members;
    if (q) {
      result = members.filter((m) => {
        const full = [m.firstName, m.lastName, m.email].filter(Boolean).join(" ").toLowerCase();
        return full.includes(q) || (m.email ?? "").toLowerCase().includes(q);
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error("Org members error:", e);
    return NextResponse.json(
      { error: "Failed to load organization members." },
      { status: 500 }
    );
  }
}
