/**
 * GET /api/pay/[token] — Public payment data by invoice access token (no auth).
 * Returns the exact amount due and invoice summary. Used by /pay/[token] to show
 * the payment page and enforce full payment (amount is fixed server-side).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
      where: { invoiceAccessToken: token.trim() },
    });
    if (!request) {
      return NextResponse.json(
        { error: "Payment link not found or has expired." },
        { status: 404 }
      );
    }

    const row = await prisma.platformFinanceSettings.findFirst();
    const pricingPlans =
      (row?.pricingPlans as Record<string, { onboardingFee?: string; currency?: string }>) ??
      {};
    const planKey = request.deploymentMode.toLowerCase() as "sis" | "lms" | "hybrid";
    const plan = { ...DEFAULT_PLANS[planKey], ...pricingPlans[planKey] };
    const amount = String(plan?.onboardingFee ?? "").trim();
    const currency = (plan?.currency ?? "USD").toUpperCase();

    return NextResponse.json({
      request: {
        id: request.id,
        institutionName: request.institutionName,
        deploymentMode: request.deploymentMode,
        quotationInvoiceNumber: request.quotationInvoiceNumber ?? null,
      },
      amount,
      currency,
      financialVerifiedAt: request.financialVerifiedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error("Get payment by token error:", e);
    return NextResponse.json(
      { error: "Failed to load payment details." },
      { status: 500 }
    );
  }
}
