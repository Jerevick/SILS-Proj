import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canApproveOnboarding } from "@/lib/platform-auth";
import {
  generateSecurePassword,
  sendInstitutionUserCreatedEmail,
  usernameFromEmail,
} from "@/lib/send-user-created-email";
import { buildInstitutionTermsAcceptUrl } from "@/lib/terms-token";
import type { DeploymentMode } from "@prisma/client";

const ONBOARDING_TO_DEPLOYMENT: Record<string, DeploymentMode> = {
  SIS: "SIS",
  LMS: "LMS",
  HYBRID: "HYBRID",
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canApproveOnboarding(userId))) {
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
    if (!request.financialVerifiedAt) {
      return NextResponse.json(
        { error: "Payment must be verified before approval. It is set automatically when the institution pays online (Stripe)." },
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
      ONBOARDING_TO_DEPLOYMENT[request.deploymentMode] ?? "LMS";

    const tenant = await prisma.tenant.create({
      data: {
        clerkOrgId: org.id,
        name,
        slug,
        deploymentMode,
        termsAcceptedAt: request.termsAcceptedAt ?? null,
        paymentVerifiedAt: new Date(), // Payment was verified before approval
      },
    });

    await prisma.featureFlags.create({
      data: {
        tenantId: tenant.id,
        sisEnabled: request.deploymentMode === "SIS" || request.deploymentMode === "HYBRID",
        schoolsEnabled: false, // Phase 15: enable per tenant in settings
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

    const dashboardLink = institutionDashboardUrl(slug);
    const institutionUrl = institutionBaseUrl(slug);
    const termsMode = request.deploymentMode === "SIS" ? "sis" : request.deploymentMode === "HYBRID" ? "hybrid" : "lms";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const termsLink = buildInstitutionTermsAcceptUrl(tenant.id, termsMode, baseUrl);
    const contactEmail = request.contactEmail.trim().toLowerCase();

    const { data: existingUsers } = await clerk.users.getUserList({
      emailAddress: [contactEmail],
      limit: 1,
    });
    const existingUser = existingUsers[0];

    if (!existingUser) {
      const tempPassword = generateSecurePassword();
      const newUser = await clerk.users.createUser({
        emailAddress: [contactEmail],
        username: usernameFromEmail(contactEmail),
        password: tempPassword,
        skipPasswordChecks: false,
      });
      await clerk.organizations.createOrganizationMembership({
        organizationId: org.id,
        userId: newUser.id,
        role: "org:admin",
      });
      await sendInstitutionUserCreatedEmail({
        to: contactEmail,
        recipientName: request.contactPerson,
        institutionName: name,
        tempPassword,
        institutionUrl,
        dashboardUrl: dashboardLink,
        termsUrl: termsLink,
      });
    } else {
      try {
        await clerk.organizations.createOrganizationInvitation({
          organizationId: org.id,
          inviterUserId: userId,
          emailAddress: contactEmail,
          role: "org:admin",
          redirectUrl: dashboardLink,
        });
      } catch (inviteErr) {
        console.error("Clerk invite error (continuing):", inviteErr);
      }
      await sendWelcomeEmail(request.contactEmail, request.contactPerson, institutionUrl, dashboardLink, termsLink);
    }

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

function institutionBaseUrl(slug: string): string {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  if (domain && domain.includes(".")) {
    return `https://${slug}.${domain}`;
  }
  return base;
}

function institutionDashboardUrl(slug: string): string {
  return `${institutionBaseUrl(slug)}/dashboard`;
}

async function sendWelcomeEmail(
  to: string,
  contactPerson: string,
  institutionUrl: string,
  dashboardUrl: string,
  termsUrl: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(
      "[SILS] Welcome email skipped (RESEND_API_KEY not set). Institution URL:",
      institutionUrl,
      "Dashboard:",
      dashboardUrl,
      "Terms:",
      termsUrl
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
          <p>Your institution has been approved for SILS.</p>
          <p><strong>Your institution's unique URL:</strong></p>
          <p><a href="${institutionUrl}">${institutionUrl}</a></p>
          <p>Save or bookmark this link — it is the permanent URL for your institution.</p>
          <p><strong>Before you can access the platform</strong>, you must read and accept our Terms and Conditions:</p>
          <p><a href="${termsUrl}">Accept Terms and Conditions</a></p>
          <p>After accepting, sign in and access your dashboard here:</p>
          <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
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
