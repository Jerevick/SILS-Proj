import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { DeploymentMode } from "@prisma/client";

const SUPER_ADMIN_CLERK_USER_IDS = (
  process.env.SUPER_ADMIN_CLERK_USER_IDS ?? ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ONBOARDING_TO_DEPLOYMENT: Record<string, DeploymentMode> = {
  LMS_ONLY: "CLOUD",
  HYBRID_BRIDGE: "HYBRID",
  UNIFIED_BLENDED: "CLOUD",
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !SUPER_ADMIN_CLERK_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const request = await prisma.onboardingRequest.findUnique({
      where: { id },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request is not pending." },
        { status: 400 }
      );
    }

    const slug = request.slug;
    const name = request.institutionName;

    const clerk = await clerkClient();
    const org = await clerk.organizations.createOrganization({
      name,
      slug,
      createdBy: userId,
    });

    const deploymentMode =
      ONBOARDING_TO_DEPLOYMENT[request.deploymentMode] ?? "CLOUD";

    const tenant = await prisma.tenant.create({
      data: {
        clerkOrgId: org.id,
        name,
        slug,
        deploymentMode,
      },
    });

    await prisma.featureFlags.create({
      data: {
        tenantId: tenant.id,
        sisEnabled: request.deploymentMode === "UNIFIED_BLENDED",
      },
    });

    await prisma.onboardingRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        tenantId: tenant.id,
      },
    });

    try {
      await clerk.organizations.createOrganizationInvitation({
        organizationId: org.id,
        inviterUserId: userId,
        emailAddress: request.contactEmail,
        role: "org:admin",
        redirectUrl: dashboardUrl(slug),
      });
    } catch (inviteErr) {
      console.error("Clerk invite error (continuing):", inviteErr);
    }

    await sendWelcomeEmail(request.contactEmail, request.contactPerson, slug);

    return NextResponse.json({
      ok: true,
      tenantId: tenant.id,
      clerkOrgId: org.id,
    });
  } catch (e) {
    console.error("Approve onboarding request error:", e);
    return NextResponse.json(
      { error: "Failed to approve request." },
      { status: 500 }
    );
  }
}

function dashboardUrl(_slug: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/dashboard`;
}

async function sendWelcomeEmail(
  to: string,
  contactPerson: string,
  slug: string
): Promise<void> {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "app.sils.app";
  const dashboardLink = domain.includes(".")
    ? `https://${slug}.${domain}/dashboard`
    : `${(process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sils.app").replace(/\/$/, "")}/dashboard`;
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(
      "[SILS] Welcome email skipped (RESEND_API_KEY not set). Dashboard URL:",
      dashboardLink
    );
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from:
          process.env.RESEND_FROM_EMAIL ?? "SILS <onboarding@resend.dev>",
        to: [to],
        subject: "Welcome to SILS — Your institution is approved",
        html: `
          <p>Hi ${contactPerson},</p>
          <p>Your institution has been approved for SILS. You can sign in and access your dashboard here:</p>
          <p><a href="${dashboardLink}">${dashboardLink}</a></p>
          <p>If you have not yet created an account, use the same email address to sign up and you will be able to join your institution.</p>
          <p>— The SILS Team</p>
        `,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Resend API error:", res.status, text);
    }
  } catch (err) {
    console.error("Send welcome email error:", err);
  }
}
