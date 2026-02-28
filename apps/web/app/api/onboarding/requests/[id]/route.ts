/**
 * GET /api/onboarding/requests/[id] — Fetch a single onboarding request. Platform staff with canViewOnboarding only.
 * PATCH /api/onboarding/requests/[id] — Update request (send/void quotation only). Payment is verified only by Stripe webhook.
 */

import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canViewOnboarding, canApproveOnboarding } from "@/lib/platform-auth";
import { sendOnboardingQuotationEmail } from "@/lib/send-user-created-email";
import { buildInstitutionTermsAcceptUrl, buildRequestTermsAcceptUrl } from "@/lib/terms-token";
import {
  buildInvoiceSnapshot,
  type InvoiceSnapshotSettings,
} from "@/lib/invoice-receipt-snapshots";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canViewOnboarding(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    const request = await prisma.onboardingRequest.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, slug: true, name: true, termsAcceptedAt: true },
        },
      },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const termsMode = request.deploymentMode === "SIS" ? "sis" : request.deploymentMode === "HYBRID" ? "hybrid" : "lms";
    const termsAcceptUrl =
      request.tenantId && request.tenant
        ? buildInstitutionTermsAcceptUrl(request.tenant.id, termsMode, APP_BASE_URL)
        : null;
    const termsQuotationUrl = buildRequestTermsAcceptUrl(request.id, termsMode, APP_BASE_URL);

    return NextResponse.json({
      id: request.id,
      deploymentMode: request.deploymentMode,
      institutionName: request.institutionName,
      slug: request.slug,
      contactPerson: request.contactPerson,
      contactEmail: request.contactEmail,
      phone: request.phone,
      country: request.country,
      website: request.website,
      approxStudents: request.approxStudents,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      approvedAt: request.approvedAt?.toISOString() ?? null,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      rejectionReason: request.rejectionReason ?? null,
      tenantId: request.tenantId,
      tenant: request.tenant,
      addressLine1: request.addressLine1,
      addressLine2: request.addressLine2,
      addressCity: request.addressCity,
      addressStateRegion: request.addressStateRegion,
      addressPostalCode: request.addressPostalCode,
      yearFounded: request.yearFounded,
      institutionType: request.institutionType,
      legalEntityName: request.legalEntityName,
      taxIdOrRegistrationNumber: request.taxIdOrRegistrationNumber,
      accreditationStatus: request.accreditationStatus,
      accreditationBody: request.accreditationBody,
      accreditationCertificateUrl: request.accreditationCertificateUrl,
      missionOrDescription: request.missionOrDescription,
      numberOfCampuses: request.numberOfCampuses,
      financialVerifiedAt: request.financialVerifiedAt?.toISOString() ?? null,
      financialVerifiedBy: request.financialVerifiedBy ?? null,
      quotationSentAt: request.quotationSentAt?.toISOString() ?? null,
      quotationInvoiceNumber: request.quotationInvoiceNumber ?? null,
      termsAcceptUrl,
      termsQuotationUrl,
      termsAcceptedAt: request.termsAcceptedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("Get onboarding request error:", e);
    return NextResponse.json(
      { error: "Failed to load request." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId || !(await canApproveOnboarding(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const body = await req.json().catch(() => ({}));

    if (body.quotationSent === true) {
      const request = await prisma.onboardingRequest.findUnique({
        where: { id },
      });
      if (!request) {
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      }
      if (request.status !== "PENDING") {
        return NextResponse.json(
          { error: "Only pending requests can have quotation sent." },
          { status: 400 }
        );
      }

      const settings = await prisma.platformFinanceSettings.findFirst();
      const taxRaw = settings?.taxCompliance as Record<string, unknown> | null;
      const prefix = String(taxRaw?.invoicePrefix ?? "SILS").trim() || "SILS";
      const nextNum = Math.max(1, Number(taxRaw?.nextNumber) || 1);
      const invoiceNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      const newTaxCompliance = {
        ...(typeof settings?.taxCompliance === "object" && settings?.taxCompliance !== null
          ? (settings.taxCompliance as Record<string, unknown>)
          : {}),
        invoicePrefix: prefix,
        nextNumber: nextNum + 1,
      };

      const invoiceAccessToken = randomBytes(32).toString("hex");
      const sentAt = new Date();

      const pricingPlans = (settings?.pricingPlans as Record<string, unknown>) ?? {};
      const paymentTermsRaw = (settings?.paymentTerms as Record<string, unknown>) ?? {};
      const paymentTerms = {
        defaultTerms: String(paymentTermsRaw.defaultTerms ?? "Net 30"),
        dueDays: Number(paymentTermsRaw.dueDays ?? 30),
        latePolicy: String(paymentTermsRaw.latePolicy ?? ""),
      };
      const bankDetailsRaw = (() => {
        const raw = settings?.bankDetails;
        if (raw == null) return {} as Record<string, unknown>;
        if (typeof raw === "object" && raw !== null) return raw as Record<string, unknown>;
        return {};
      })();
      const bankDetails = {
        bankName: String(bankDetailsRaw.bankName ?? ""),
        bban: String(bankDetailsRaw.bban ?? ""),
        swift: String(bankDetailsRaw.swift ?? ""),
        accountMasked: String(bankDetailsRaw.accountMasked ?? ""),
        referenceFormat: String(bankDetailsRaw.referenceFormat ?? "INV-{institution}-{year}"),
        instructions: String(bankDetailsRaw.instructions ?? ""),
      };
      const taxCompliance = (settings?.taxCompliance as Record<string, unknown>) ?? {
        taxId: "",
        vatNumber: "",
        invoicePrefix: "SILS",
        nextNumber: nextNum,
      };

      const invoiceSnapshot = buildInvoiceSnapshot(
        {
          ...request,
          quotationInvoiceNumber: invoiceNumber,
          quotationSentAt: sentAt,
        },
        { pricingPlans, paymentTerms, bankDetails, taxCompliance } as InvoiceSnapshotSettings,
        sentAt
      );

      await prisma.$transaction(async (tx) => {
        await tx.onboardingRequest.update({
          where: { id },
          data: {
            quotationSentAt: sentAt,
            quotationInvoiceNumber: invoiceNumber,
            invoiceAccessToken,
            invoiceSnapshot: invoiceSnapshot as object,
          },
        });
        if (settings) {
          await tx.platformFinanceSettings.update({
            where: { id: settings.id },
            data: { taxCompliance: newTaxCompliance as object },
          });
        } else {
          await tx.platformFinanceSettings.create({
            data: {
              pricingPlans: {},
              paymentTerms: {},
              bankDetails: {},
              taxCompliance: newTaxCompliance as object,
            },
          });
        }
      });

      const invoiceUrl = `${APP_BASE_URL}/invoice/${invoiceAccessToken}`;
      const paymentUrl = `${APP_BASE_URL}/pay/${invoiceAccessToken}`;
      const termsMode = request.deploymentMode === "SIS" ? "sis" : request.deploymentMode === "HYBRID" ? "hybrid" : "lms";
      const termsUrl = buildRequestTermsAcceptUrl(request.id, termsMode, APP_BASE_URL);

      const { sent, error } = await sendOnboardingQuotationEmail({
        to: request.contactEmail.trim().toLowerCase(),
        recipientName: request.contactPerson,
        institutionName: request.institutionName,
        deploymentMode: request.deploymentMode,
        invoiceNumber,
        invoiceUrl,
        paymentUrl,
        termsUrl,
      });
      if (!sent) {
        console.warn("[SILS] Onboarding quotation email not sent:", error);
      }
      return NextResponse.json({ ok: true, emailSent: sent, invoiceNumber });
    }

    if (body.voidQuotation === true) {
      const request = await prisma.onboardingRequest.findUnique({
        where: { id },
      });
      if (!request) {
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      }
      if (request.status !== "PENDING") {
        return NextResponse.json(
          { error: "Only pending requests can have quotation voided." },
          { status: 400 }
        );
      }
      if (!request.quotationSentAt) {
        return NextResponse.json(
          { error: "No quotation has been sent for this request." },
          { status: 400 }
        );
      }
      await prisma.onboardingRequest.update({
        where: { id },
        data: {
          quotationSentAt: null,
          quotationInvoiceNumber: null,
          invoiceSnapshot: Prisma.DbNull,
        },
      });
      return NextResponse.json({ ok: true });
    }

    // Payment verification is automatic via Stripe webhook only; staff cannot set it.
    if (body.financialVerified === true) {
      return NextResponse.json(
        { error: "Payment verification is automatic. It is set when the institution pays online (Stripe)." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Unsupported update." }, { status: 400 });
  } catch (e) {
    console.error("Patch onboarding request error:", e);
    return NextResponse.json(
      { error: "Failed to update request." },
      { status: 500 }
    );
  }
}
