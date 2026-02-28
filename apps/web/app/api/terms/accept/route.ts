/**
 * POST /api/terms/accept — Accept terms using token (from email link) or session (logged-in user).
 * Body: { token?: string } — if token present, verify and set tenant.termsAcceptedAt or
 * request.termsAcceptedAt (request-scoped token from quotation email); else use session org.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTermsAcceptanceToken } from "@/lib/terms-token";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token : undefined;
    const { userId, orgId } = await auth();

    if (token) {
      const parsed = verifyTermsAcceptanceToken(token);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid or expired link. Please request a new one from your administrator." },
          { status: 400 }
        );
      }

      if (parsed.kind === "request") {
        const request = await prisma.onboardingRequest.findUnique({
          where: { id: parsed.requestId },
          select: { id: true, termsAcceptedAt: true },
        });
        if (!request) {
          return NextResponse.json({ error: "Request not found." }, { status: 404 });
        }
        if (request.termsAcceptedAt) {
          return NextResponse.json({ ok: true, alreadyAccepted: true });
        }
        await prisma.onboardingRequest.update({
          where: { id: parsed.requestId },
          data: { termsAcceptedAt: new Date() },
        });
        return NextResponse.json({ ok: true });
      }

      // Tenant-scoped token
      const tenant = await prisma.tenant.findUnique({
        where: { id: parsed.tenantId },
        select: { id: true, termsAcceptedAt: true },
      });
      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
      }
      if (tenant.termsAcceptedAt) {
        return NextResponse.json({ ok: true, alreadyAccepted: true });
      }
      await prisma.tenant.update({
        where: { id: parsed.tenantId },
        data: { termsAcceptedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (userId && orgId) {
      const tenant = await prisma.tenant.findUnique({
        where: { clerkOrgId: orgId },
        select: { id: true, termsAcceptedAt: true },
      });
      if (!tenant) {
        return NextResponse.json(
          { error: "Tenant not found." },
          { status: 404 }
        );
      }
      if (tenant.termsAcceptedAt) {
        return NextResponse.json({ ok: true, alreadyAccepted: true });
      }
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { termsAcceptedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Provide a valid acceptance link token or sign in." },
      { status: 400 }
    );
  } catch (e) {
    console.error("Terms accept error:", e);
    return NextResponse.json(
      { error: "Failed to record acceptance." },
      { status: 500 }
    );
  }
}
