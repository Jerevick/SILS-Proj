/**
 * GET /api/invoice/[token] — Public invoice data by access token (no auth).
 * Serves saved snapshot when present (as sent); otherwise builds from current request + settings.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseInvoiceSnapshot } from "@/lib/invoice-receipt-snapshots";

const DEFAULT_SETTINGS = {
  pricingPlans: {
    sis: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
    lms: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
    hybrid: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
  },
  paymentTerms: { defaultTerms: "Net 30", dueDays: 30, latePolicy: "" },
  bankDetails: {
    bankName: "",
    bban: "",
    swift: "",
    accountMasked: "",
    referenceFormat: "INV-{institution}-{year}",
    instructions: "",
  },
  taxCompliance: { taxId: "", vatNumber: "", invoicePrefix: "SILS", nextNumber: 1 },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  }

  try {
    const request = await prisma.onboardingRequest.findFirst({
      where: { invoiceAccessToken: token.trim() },
    });
    if (!request) {
      return NextResponse.json({ error: "Invoice not found or link has expired." }, { status: 404 });
    }

    const snapshot = parseInvoiceSnapshot(request.invoiceSnapshot);
    if (snapshot) {
      return NextResponse.json({
        request: snapshot.request,
        settings: snapshot.settings,
        snapshotSentAt: snapshot.sentAt,
      });
    }

    const row = await prisma.platformFinanceSettings.findFirst();
    const pricingPlans = (row?.pricingPlans as Record<string, unknown>) ?? DEFAULT_SETTINGS.pricingPlans;
    const paymentTerms = (row?.paymentTerms as Record<string, unknown>) ?? DEFAULT_SETTINGS.paymentTerms;
    const bankDetailsRaw = (() => {
      const raw = row?.bankDetails;
      if (raw == null) return {};
      if (typeof raw === "string") {
        try {
          return (JSON.parse(raw) as Record<string, unknown>) ?? {};
        } catch {
          return {};
        }
      }
      return (raw as Record<string, unknown>) ?? {};
    })();
    const taxCompliance = (row?.taxCompliance as Record<string, unknown>) ?? DEFAULT_SETTINGS.taxCompliance;

    const bankDetails = {
      ...DEFAULT_SETTINGS.bankDetails,
      ...bankDetailsRaw,
      bankName: String(bankDetailsRaw.bankName ?? ""),
      bban: String(bankDetailsRaw.bban ?? ""),
      swift: String(bankDetailsRaw.swift ?? ""),
      accountMasked: String(bankDetailsRaw.accountMasked ?? ""),
      referenceFormat: String(bankDetailsRaw.referenceFormat ?? DEFAULT_SETTINGS.bankDetails.referenceFormat),
      instructions: String(bankDetailsRaw.instructions ?? ""),
    };

    return NextResponse.json({
      request: {
        id: request.id,
        institutionName: request.institutionName,
        deploymentMode: request.deploymentMode,
        contactPerson: request.contactPerson,
        contactEmail: request.contactEmail,
        quotationInvoiceNumber: request.quotationInvoiceNumber ?? null,
        quotationSentAt: request.quotationSentAt?.toISOString() ?? null,
      },
      settings: {
        pricingPlans: { ...DEFAULT_SETTINGS.pricingPlans, ...pricingPlans },
        paymentTerms: { ...DEFAULT_SETTINGS.paymentTerms, ...paymentTerms },
        bankDetails,
        taxCompliance: { ...DEFAULT_SETTINGS.taxCompliance, ...taxCompliance },
      },
    });
  } catch (e) {
    console.error("Get invoice by token error:", e);
    return NextResponse.json(
      { error: "Failed to load invoice." },
      { status: 500 }
    );
  }
}
