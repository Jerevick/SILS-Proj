/**
 * POST /api/pay/[token]/checkout-session — Create Stripe Checkout Session for online payment.
 * Returns { url } to redirect the customer to Stripe-hosted payment (cards, PayPal, Google Pay, etc.).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe, stripeEnabled, toStripeAmount, CHECKOUT_PAYMENT_METHOD_TYPES } from "@/lib/stripe";

const DEFAULT_PLANS: Record<string, { onboardingFee: string; currency: string }> = {
  sis: { onboardingFee: "", currency: "USD" },
  lms: { onboardingFee: "", currency: "USD" },
  hybrid: { onboardingFee: "", currency: "USD" },
};

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });
  }

  if (!stripeEnabled || !stripe) {
    return NextResponse.json(
      { error: "Online payment is not configured. Please use bank transfer or contact support." },
      { status: 503 }
    );
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

    if (request.financialVerifiedAt) {
      return NextResponse.json(
        { error: "This invoice has already been paid." },
        { status: 400 }
      );
    }

    const row = await prisma.platformFinanceSettings.findFirst();
    const pricingPlans =
      (row?.pricingPlans as Record<string, { onboardingFee?: string; currency?: string }>) ?? {};
    const planKey = request.deploymentMode.toLowerCase() as "sis" | "lms" | "hybrid";
    const plan = { ...DEFAULT_PLANS[planKey], ...pricingPlans[planKey] };
    const amountStr = String(plan?.onboardingFee ?? "").trim();
    const currency = (plan?.currency ?? "USD").toUpperCase();

    const amountInSmallestUnit = toStripeAmount(amountStr, currency);
    if (amountInSmallestUnit < 1) {
      return NextResponse.json(
        { error: "The amount for this invoice has not been set. Please contact the sender." },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const successUrl = `${baseUrl}/pay/${encodeURIComponent(token)}?success=1`;
    const cancelUrl = `${baseUrl}/pay/${encodeURIComponent(token)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: CHECKOUT_PAYMENT_METHOD_TYPES,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amountInSmallestUnit,
            product_data: {
              name: `SILS onboarding — ${request.institutionName}`,
              description: `One-time onboarding fee (${request.deploymentMode}). Invoice ${request.quotationInvoiceNumber ?? request.id}.`,
              images: undefined,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: token,
      metadata: {
        onboardingRequestId: request.id,
        invoiceAccessToken: token,
        institutionName: request.institutionName,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create payment session." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const err = e as { message?: string; type?: string };
    console.error("Create checkout session error:", e);
    const message =
      process.env.NODE_ENV === "development" && err?.message
        ? err.message
        : "Failed to create payment session.";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
