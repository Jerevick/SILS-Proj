/**
 * GET /api/receipt/[token] — Public receipt data by receipt access token (no auth).
 * Serves saved snapshot when present (as at payment time); otherwise builds from current request + settings.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseReceiptSnapshot } from "@/lib/invoice-receipt-snapshots";

const DEFAULT_PLANS: Record<string, { onboardingFee: string; currency: string }> = {
  sis: { onboardingFee: "", currency: "USD" },
  lms: { onboardingFee: "", currency: "USD" },
  hybrid: { onboardingFee: "", currency: "USD" },
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
      where: {
        receiptAccessToken: token.trim(),
        financialVerifiedAt: { not: null },
      },
    });
    if (!request || !request.financialVerifiedAt) {
      return NextResponse.json({ error: "Receipt not found or link has expired." }, { status: 404 });
    }

    const snapshot = parseReceiptSnapshot(request.receiptSnapshot);
    if (snapshot) {
      return NextResponse.json({
        request: snapshot.request,
      });
    }

    const row = await prisma.platformFinanceSettings.findFirst();
    const pricingPlans =
      (row?.pricingPlans as Record<string, { onboardingFee?: string; currency?: string }>) ?? {};
    const planKey = request.deploymentMode.toLowerCase() as "sis" | "lms" | "hybrid";
    const plan = { ...DEFAULT_PLANS[planKey], ...pricingPlans[planKey] };
    const amount = String(plan?.onboardingFee ?? "").trim() || "—";
    const currency = (plan?.currency ?? "USD").toUpperCase();

    return NextResponse.json({
      request: {
        id: request.id,
        institutionName: request.institutionName,
        deploymentMode: request.deploymentMode,
        contactPerson: request.contactPerson,
        contactEmail: request.contactEmail,
        quotationInvoiceNumber: request.quotationInvoiceNumber ?? null,
        paidAt: request.financialVerifiedAt.toISOString(),
        amount,
        currency,
      },
    });
  } catch (e) {
    console.error("Get receipt by token error:", e);
    return NextResponse.json(
      { error: "Failed to load receipt." },
      { status: 500 }
    );
  }
}
