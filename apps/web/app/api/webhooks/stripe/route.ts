/**
 * POST /api/webhooks/stripe — Stripe webhook handler.
 * This is the only way payment is verified: on checkout.session.completed we set
 * OnboardingRequest.financialVerifiedAt. Staff cannot mark payment received (no delay/abuse).
 * Sends payment confirmation email to institution with unique receipt URL.
 *
 * Local testing: Stripe cannot POST to localhost. Run in a separate terminal:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 * Then set STRIPE_WEBHOOK_SECRET in .env.local to the signing secret (whsec_...) the CLI prints.
 */

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendPaymentConfirmationEmail } from "@/lib/send-user-created-email";
import { buildReceiptSnapshot } from "@/lib/invoice-receipt-snapshots";
import type Stripe from "stripe";

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const DEFAULT_PLANS: Record<string, { onboardingFee: string; currency: string }> = {
  sis: { onboardingFee: "", currency: "USD" },
  lms: { onboardingFee: "", currency: "USD" },
  hybrid: { onboardingFee: "", currency: "USD" },
};

export async function POST(req: Request) {
  console.info("[SILS] Stripe webhook: request received");

  if (!stripe) {
    console.error("[SILS] Stripe webhook: Stripe not configured (STRIPE_SECRET_KEY missing or invalid)");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.startsWith("whsec_")) {
    console.warn("[SILS] STRIPE_WEBHOOK_SECRET not set or invalid; webhook signature not verified.");
  } else {
    console.info("[SILS] Stripe webhook: using secret whsec_...%s", secret.slice(-6));
  }

  // Use raw body as Buffer so signature verification gets exact bytes (no string encoding changes)
  const bodyBuffer = Buffer.from(await req.arrayBuffer());
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = secret
      ? stripe.webhooks.constructEvent(bodyBuffer, signature, secret)
      : (JSON.parse(bodyBuffer.toString("utf-8")) as Stripe.Event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SILS] Stripe webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature", detail: message }, { status: 400 });
  }

  console.info("[SILS] Stripe webhook: event type=%s", event.type);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Require session to indicate payment/complete so we don't fulfill before payment.
    const paidOrComplete =
      session.payment_status === "paid" || session.status === "complete";
    if (!paidOrComplete) {
      console.warn(
        "[SILS] Stripe checkout.session.completed skipped: payment_status=%s status=%s",
        session.payment_status,
        session.status
      );
      return NextResponse.json({ received: true });
    }

    const token =
      session.client_reference_id ??
      (session.metadata?.invoiceAccessToken as string | undefined);
    const requestIdFromMeta = session.metadata?.onboardingRequestId as string | undefined;
    const invoiceIdFromMeta = session.metadata?.invoiceId as string | undefined;

    console.info(
      "[SILS] Stripe webhook: client_reference_id=%s onboardingRequestId=%s invoiceId=%s",
      session.client_reference_id ?? "(none)",
      requestIdFromMeta ?? "(none)",
      invoiceIdFromMeta ?? "(none)"
    );

    // Phase 13: Tenant invoice payment (student fee) — record payment and update invoice status
    if (invoiceIdFromMeta && paidOrComplete) {
      try {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceIdFromMeta },
          include: { payments: true },
        });
        if (invoice && invoice.status !== "PAID") {
          const amountTotal = session.amount_total ?? 0;
          const amountDecimal = amountTotal / 100; // Stripe uses cents
          const { Decimal } = await import("@prisma/client/runtime/library");
          await prisma.payment.create({
            data: {
              invoiceId: invoice.id,
              amount: new Decimal(amountDecimal),
              method: "stripe",
              transactionId: session.payment_intent as string | undefined ?? session.id,
            },
          });
          const paidSoFar = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + amountDecimal;
          const newStatus = paidSoFar >= Number(invoice.amount) ? "PAID" : "PARTIAL";
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus },
          });
          console.info("[SILS] Invoice payment recorded for %s (Stripe checkout.session.completed)", invoice.id);
        }
      } catch (e) {
        console.error("[SILS] Stripe webhook: failed to record invoice payment:", e);
      }
      return NextResponse.json({ received: true });
    }

    if (!token && !requestIdFromMeta) {
      console.warn("[SILS] Stripe checkout.session.completed missing client_reference_id and metadata");
      return NextResponse.json({ received: true });
    }

    try {
      let request = token
        ? await prisma.onboardingRequest.findFirst({
            where: { invoiceAccessToken: token },
            select: {
              id: true,
              financialVerifiedAt: true,
              institutionName: true,
              deploymentMode: true,
              contactPerson: true,
              contactEmail: true,
              quotationInvoiceNumber: true,
            },
          })
        : null;
      if (!request && requestIdFromMeta) {
        request = await prisma.onboardingRequest.findUnique({
          where: { id: requestIdFromMeta },
          select: {
            id: true,
            financialVerifiedAt: true,
            institutionName: true,
            deploymentMode: true,
            contactPerson: true,
            contactEmail: true,
            quotationInvoiceNumber: true,
          },
        });
      }
      if (!request) {
        console.warn(
          "[SILS] Stripe webhook: onboarding request not found for token=%s requestId=%s",
          token ?? "(none)",
          requestIdFromMeta ?? "(none)"
        );
        return NextResponse.json({ received: true });
      }
      if (request.financialVerifiedAt) {
        return NextResponse.json({ received: true });
      }

      const receiptAccessToken = randomBytes(32).toString("hex");
      const verifiedAt = new Date();

      const settings = await prisma.platformFinanceSettings.findFirst();
      const pricingPlans =
        (settings?.pricingPlans as Record<string, { onboardingFee?: string; currency?: string }>) ?? {};
      const planKey = request.deploymentMode?.toLowerCase() ?? "lms";
      const plan = { ...DEFAULT_PLANS[planKey], ...pricingPlans[planKey] };
      const amount = String(plan?.onboardingFee ?? "").trim() || "—";
      const currency = (plan?.currency ?? "USD").toUpperCase();

      const receiptSnapshot = buildReceiptSnapshot(
        {
          id: request.id,
          institutionName: request.institutionName,
          deploymentMode: request.deploymentMode,
          contactPerson: request.contactPerson,
          contactEmail: request.contactEmail,
          quotationInvoiceNumber: request.quotationInvoiceNumber,
        },
        amount,
        currency,
        verifiedAt
      );

      await prisma.onboardingRequest.update({
        where: { id: request.id },
        data: {
          financialVerifiedAt: verifiedAt,
          receiptAccessToken,
          receiptSnapshot: receiptSnapshot as object,
        },
      });
      console.info("[SILS] Payment verified for onboarding request %s (Stripe checkout.session.completed)", request.id);

      if (request.contactEmail) {
        const receiptUrl = `${APP_BASE_URL}/receipt/${encodeURIComponent(receiptAccessToken)}`;
        const { sent, error } = await sendPaymentConfirmationEmail({
          to: request.contactEmail.trim().toLowerCase(),
          recipientName: request.contactPerson,
          institutionName: request.institutionName,
          invoiceNumber: request.quotationInvoiceNumber ?? null,
          receiptUrl,
          amount,
          currency,
          paidAt: verifiedAt.toISOString(),
        });
        if (!sent) {
          console.warn("[SILS] Payment confirmation email not sent:", error);
        }
      }
    } catch (e) {
      console.error("[SILS] Stripe webhook: failed to update onboarding request:", e);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
