"use server";

/**
 * Phase 13: Finance & Financial Aid server actions.
 * - ProcessFinancialAid: LLM_Router analyzes application, academic performance, equity → recommendation + draft letter; creates award and optional invoice.
 * - GenerateInvoice: creates invoice with items and Stripe payment link.
 * - RecordPayment: manual recording of payment; Stripe webhook handles online payments and triggers receipt.
 * Scoped: Finance Officer, Finance Director, OWNER, ADMIN.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessFinance, canApproveAid } from "@/lib/finance-auth";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import type { FinancialAidStatus, InvoiceStatus } from "@prisma/client";
import { stripe, stripeEnabled, toStripeAmount, CHECKOUT_PAYMENT_METHOD_TYPES } from "@/lib/stripe";

const FINANCE_CURRENCY = "USD";

/** Input for GenerateInvoice: items and optional due date / student. */
export type GenerateInvoiceInput = {
  studentId: string;
  items: { description: string; amount: number; quantity?: number }[];
  dueDate?: string; // ISO date
  financialAidApplicationId?: string | null;
};

/** Input for RecordPayment (manual). */
export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: string;
  transactionId?: string | null;
};

/** Result of ProcessFinancialAid LLM: recommendation and draft letter. */
type ProcessFinancialAidLLMResult = {
  recommendation: "approve_full" | "approve_partial" | "reject";
  suggestedAmount?: number;
  confidence: number;
  factors: string[];
  decisionLetter: string;
};

/**
 * ProcessFinancialAid: Uses LLM_Router to analyze application, academic performance, and equity.
 * Generates recommendation + draft decision letter; creates award record and optionally links to invoice (remaining balance).
 */
export async function processFinancialAid(applicationId: string): Promise<
  | { ok: true; applicationId: string; recommendation: ProcessFinancialAidLLMResult }
  | { ok: false; error: string }
> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const { tenantId, role } = tenantResult.context;
  if (!canAccessFinance(role)) {
    return { ok: false, error: "You do not have permission to process financial aid." };
  }

  const application = await prisma.financialAidApplication.findFirst({
    where: { id: applicationId, tenantId },
    include: {
      programme: { select: { name: true, code: true } },
    },
  });
  if (!application) {
    return { ok: false, error: "Application not found." };
  }

  const { studentId, programmeId, requestedAmount } = application;
  const requestedNum = Number(requestedAmount);

  // Gather academic performance: programme module grades (SIS) and gradebook (LMS)
  const [moduleGrades, gradebookEntries, equity] = await Promise.all([
    prisma.programmeModuleGrade.findMany({
      where: { studentId, programmeModule: { programmeId } },
      select: { grade: true, programmeModule: { select: { title: true } } },
    }),
    prisma.gradebookEntry.findMany({
      where: { studentId },
      select: { finalGrade: true, course: { select: { title: true } } },
    }),
    prisma.equityMetric.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    }),
  ]);

  const academicSummary = [
    "Programme module grades:",
    ...moduleGrades.map((g) => `- ${g.programmeModule.title}: ${g.grade ?? "—"}`),
    "LMS gradebook:",
    ...gradebookEntries.map((g) => `- ${g.course.title}: ${g.finalGrade ?? "—"}`),
  ].join("\n");

  const equitySummary = equity
    ? [
        equity.firstGen && "first-generation",
        equity.lowIncome && "low-income",
        equity.neurodiverse && "neurodiverse",
        equity.caregiver && "caregiver",
        equity.refugeeOrDisplaced && "refugee or displaced",
      ]
        .filter(Boolean)
        .join(", ")
    : "None recorded";

  const systemPrompt = `You are a financial aid officer assistant. Given a financial aid application and context, output a JSON object (no markdown, no code fence) with:
{
  "recommendation": "approve_full" | "approve_partial" | "reject",
  "suggestedAmount": number or null (only if approve_partial; amount to award in same currency),
  "confidence": number between 0 and 1,
  "factors": ["list of 3-6 short factors that influenced the recommendation"],
  "decisionLetter": "A 2-4 paragraph draft decision letter to the student. For approve_full/approve_partial: congratulate, state amount, mention conditions. For reject: be empathetic, state reason briefly, suggest next steps."
}
Consider: academic performance, equity factors (first-gen, low-income, etc.), requested amount. Be fair and consistent. Output only the JSON object.`;

  const userPrompt = [
    `Application: student ${studentId}, programme ${application.programme.name} (${application.programme.code}).`,
    `Requested amount: ${requestedNum} ${FINANCE_CURRENCY}.`,
    "",
    "Academic summary:",
    academicSummary,
    "",
    `Equity flags: ${equitySummary}.`,
  ].join("\n");

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: "financial-aid",
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const trimmed = result.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  let parsed: ProcessFinancialAidLLMResult;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    const rec = raw.recommendation as string;
    const recommendation =
      rec === "approve_full" || rec === "approve_partial" || rec === "reject"
        ? rec
        : "reject";
    parsed = {
      recommendation,
      suggestedAmount:
        typeof raw.suggestedAmount === "number" ? raw.suggestedAmount : undefined,
      confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5,
      factors: Array.isArray(raw.factors) ? (raw.factors as string[]) : [],
      decisionLetter: typeof raw.decisionLetter === "string" ? raw.decisionLetter : "",
    };
  } catch {
    return { ok: false, error: "Failed to parse AI recommendation." };
  }

  const aiRecommendation = {
    recommendation: parsed.recommendation,
    suggestedAmount: parsed.suggestedAmount,
    confidence: parsed.confidence,
    factors: parsed.factors,
  };

  await prisma.financialAidApplication.update({
    where: { id: applicationId },
    data: {
      status: "UNDER_REVIEW",
      aiRecommendation: aiRecommendation as object,
      decisionLetter: parsed.decisionLetter,
    },
  });

  // If recommendation is approve (full or partial), create award record. Do not auto-approve; officer/director must click Approve.
  const awardAmount =
    parsed.recommendation === "approve_full"
      ? requestedNum
      : parsed.recommendation === "approve_partial" && typeof parsed.suggestedAmount === "number"
        ? parsed.suggestedAmount
        : null;

  if (awardAmount != null && awardAmount > 0) {
    const existing = await prisma.financialAidAward.count({
      where: { applicationId },
    });
    if (existing === 0) {
      await prisma.financialAidAward.create({
        data: {
          applicationId,
          awardType: "grant",
          amount: new Decimal(awardAmount),
          conditions: "Maintain satisfactory academic progress and enrollment.",
        },
      });
    }
  }

  return {
    ok: true,
    applicationId,
    recommendation: parsed,
  };
}

/**
 * Approve or reject an application (Finance Director / ADMIN / OWNER). Updates status, decision date, reviewer.
 */
export async function approveOrRejectAid(
  applicationId: string,
  decision: "approve" | "reject",
  awardedAmount?: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  if (!canApproveAid(tenantResult.context.role)) {
    return { ok: false, error: "Only Finance Director or Admin can approve/reject applications." };
  }

  const application = await prisma.financialAidApplication.findFirst({
    where: { id: applicationId, tenantId: tenantResult.context.tenantId },
    include: { awards: true },
  });
  if (!application) {
    return { ok: false, error: "Application not found." };
  }

  const status: FinancialAidStatus = decision === "approve" ? "APPROVED" : "REJECTED";
  const finalAmount =
    decision === "approve" && typeof awardedAmount === "number" && awardedAmount >= 0
      ? new Decimal(awardedAmount)
      : decision === "reject"
        ? null
        : application.awards[0]?.amount ?? null;

  await prisma.financialAidApplication.update({
    where: { id: applicationId },
    data: {
      status,
      reviewedBy: userId,
      decisionDate: new Date(),
      awardedAmount: finalAmount,
    },
  });

  return { ok: true };
}

/**
 * GenerateInvoice: creates invoice with items and optional Stripe payment link.
 */
export async function generateInvoice(
  input: GenerateInvoiceInput
): Promise<{ ok: true; invoiceId: string; paymentUrl?: string } | { ok: false; error: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  if (!canAccessFinance(tenantResult.context.role)) {
    return { ok: false, error: "You do not have permission to create invoices." };
  }

  const { studentId, items, financialAidApplicationId } = input;
  if (!items?.length) {
    return { ok: false, error: "At least one line item is required." };
  }

  const total = items.reduce(
    (sum, i) => sum + (Number(i.amount) || 0) * (i.quantity ?? 1),
    0
  );
  if (total <= 0) {
    return { ok: false, error: "Total amount must be greater than zero." };
  }

  const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const itemsJson = items.map((i) => ({
    description: i.description,
    amount: i.amount,
    quantity: i.quantity ?? 1,
  }));

  const invoice = await prisma.invoice.create({
    data: {
      tenantId: tenantResult.context.tenantId,
      studentId,
      amount: new Decimal(total),
      dueDate,
      status: "DRAFT",
      items: itemsJson as object,
      financialAidApplicationId: financialAidApplicationId ?? null,
    },
  });

  let paymentUrl: string | undefined;
  if (stripeEnabled && stripe && total > 0) {
    try {
      const amountInCents = toStripeAmount(String(total), FINANCE_CURRENCY);
      if (amountInCents >= 1) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: CHECKOUT_PAYMENT_METHOD_TYPES,
          line_items: itemsJson.map((i) => ({
            quantity: i.quantity,
            price_data: {
              currency: FINANCE_CURRENCY.toLowerCase(),
              unit_amount: toStripeAmount(String(i.amount), FINANCE_CURRENCY),
              product_data: {
                name: i.description,
                description: `Invoice ${invoice.id}`,
              },
            },
          })),
          success_url: `${baseUrl}/finance/invoices?success=1&invoice=${invoice.id}`,
          cancel_url: `${baseUrl}/finance/invoices`,
          client_reference_id: invoice.id,
          metadata: {
            invoiceId: invoice.id,
            tenantId: tenantResult.context.tenantId,
            studentId,
          },
        });
        if (session.url) {
          paymentUrl = session.url;
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "SENT",
              stripePaymentLinkId: session.id,
              stripePaymentLinkUrl: session.url,
            },
          });
        }
      }
    } catch (e) {
      console.error("GenerateInvoice: Stripe session create failed", e);
      // Invoice still created; officer can send link later or record manual payment
    }
  }

  return {
    ok: true,
    invoiceId: invoice.id,
    paymentUrl,
  };
}

/**
 * RecordPayment: manual recording of a payment (e.g. bank transfer, cash). Updates invoice status and can trigger receipt.
 * For Stripe payments, use the webhook instead.
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  if (!canAccessFinance(tenantResult.context.role)) {
    return { ok: false, error: "You do not have permission to record payments." };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, tenantId: tenantResult.context.tenantId },
    include: { payments: true },
  });
  if (!invoice) {
    return { ok: false, error: "Invoice not found." };
  }

  const amount = new Decimal(input.amount);
  if (amount.lte(0)) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  await prisma.payment.create({
    data: {
      invoiceId: input.invoiceId,
      amount,
      method: input.method || "other",
      transactionId: input.transactionId ?? null,
    },
  });

  const paidTotal = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + input.amount;
  const invoiceTotal = Number(invoice.amount);
  const newStatus: InvoiceStatus =
    paidTotal >= invoiceTotal ? "PAID" : paidTotal > 0 ? "PARTIAL" : invoice.status;

  await prisma.invoice.update({
    where: { id: input.invoiceId },
    data: { status: newStatus },
  });

  return { ok: true };
}
