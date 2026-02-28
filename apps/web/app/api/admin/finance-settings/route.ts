/**
 * GET /api/admin/finance-settings — Fetch platform finance settings (singleton).
 * PATCH /api/admin/finance-settings — Update one or more sections. Can manage institutions.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canViewInstitutions, canManageInstitutions } from "@/lib/platform-auth";

const DEFAULT_SETTINGS = {
  pricingPlans: {
    sis: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
    lms: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
    hybrid: { onboardingFee: "", amount: "", perStudentAmount: "", currency: "USD", period: "annual" },
  },
  paymentTerms: {
    defaultTerms: "Net 30",
    dueDays: 30,
    latePolicy: "",
  },
  bankDetails: {
    bankName: "",
    bban: "",
    swift: "",
    accountMasked: "",
    referenceFormat: "INV-{institution}-{year}",
    instructions: "",
  },
  taxCompliance: {
    taxId: "",
    vatNumber: "",
    invoicePrefix: "SILS",
    nextNumber: 1,
  },
};

export type FinanceSettingsPayload = {
  pricingPlans?: typeof DEFAULT_SETTINGS.pricingPlans;
  paymentTerms?: typeof DEFAULT_SETTINGS.paymentTerms;
  bankDetails?: typeof DEFAULT_SETTINGS.bankDetails;
  taxCompliance?: typeof DEFAULT_SETTINGS.taxCompliance;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId || !(await canViewInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const row = await prisma.platformFinanceSettings.findFirst();
    const pricingPlans = (row?.pricingPlans as Record<string, unknown>) ?? DEFAULT_SETTINGS.pricingPlans;
    const paymentTerms = (row?.paymentTerms as Record<string, unknown>) ?? DEFAULT_SETTINGS.paymentTerms;
    // Prisma may return Json as object or string; normalize to object
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
      bankName: String(bankDetailsRaw.bankName ?? DEFAULT_SETTINGS.bankDetails.bankName),
      bban: String(bankDetailsRaw.bban ?? DEFAULT_SETTINGS.bankDetails.bban),
      swift: String(bankDetailsRaw.swift ?? DEFAULT_SETTINGS.bankDetails.swift),
      accountMasked: String(bankDetailsRaw.accountMasked ?? DEFAULT_SETTINGS.bankDetails.accountMasked),
      referenceFormat: String(bankDetailsRaw.referenceFormat ?? DEFAULT_SETTINGS.bankDetails.referenceFormat),
      instructions: String(bankDetailsRaw.instructions ?? DEFAULT_SETTINGS.bankDetails.instructions),
    };

    return NextResponse.json({
      pricingPlans: { ...DEFAULT_SETTINGS.pricingPlans, ...pricingPlans },
      paymentTerms: { ...DEFAULT_SETTINGS.paymentTerms, ...paymentTerms },
      bankDetails,
      taxCompliance: { ...DEFAULT_SETTINGS.taxCompliance, ...taxCompliance },
    });
  } catch (e) {
    console.error("Get finance settings error:", e);
    return NextResponse.json(
      { error: "Failed to load finance settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId || !(await canManageInstitutions(userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: FinanceSettingsPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const existing = await prisma.platformFinanceSettings.findFirst();
    const normalizeJson = (raw: unknown): Record<string, unknown> => {
      if (raw == null) return {};
      if (typeof raw === "string") {
        try {
          return (JSON.parse(raw) as Record<string, unknown>) ?? {};
        } catch {
          return {};
        }
      }
      return (raw as Record<string, unknown>) ?? {};
    };
    const current = {
      pricingPlans: normalizeJson(existing?.pricingPlans),
      paymentTerms: normalizeJson(existing?.paymentTerms),
      bankDetails: normalizeJson(existing?.bankDetails),
      taxCompliance: normalizeJson(existing?.taxCompliance),
    };

    const data: Record<string, object> = {};
    if (body.pricingPlans !== undefined) {
      data.pricingPlans = { ...DEFAULT_SETTINGS.pricingPlans, ...current.pricingPlans, ...body.pricingPlans } as object;
    }
    if (body.paymentTerms !== undefined) {
      data.paymentTerms = { ...DEFAULT_SETTINGS.paymentTerms, ...current.paymentTerms, ...body.paymentTerms } as object;
    }
    if (body.bankDetails !== undefined) {
      data.bankDetails = { ...DEFAULT_SETTINGS.bankDetails, ...current.bankDetails, ...body.bankDetails } as object;
    }
    if (body.taxCompliance !== undefined) {
      data.taxCompliance = { ...DEFAULT_SETTINGS.taxCompliance, ...current.taxCompliance, ...body.taxCompliance } as object;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid section to update." }, { status: 400 });
    }

    if (existing) {
      await prisma.platformFinanceSettings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.platformFinanceSettings.create({
        data: {
          pricingPlans: (data.pricingPlans ?? DEFAULT_SETTINGS.pricingPlans) as object,
          paymentTerms: (data.paymentTerms ?? DEFAULT_SETTINGS.paymentTerms) as object,
          bankDetails: (data.bankDetails ?? DEFAULT_SETTINGS.bankDetails) as object,
          taxCompliance: (data.taxCompliance ?? DEFAULT_SETTINGS.taxCompliance) as object,
        },
      });
    }

    // Return full settings so client can update cache and show saved values immediately
    const updated = await prisma.platformFinanceSettings.findFirst();
    const updatedPricing = (updated?.pricingPlans as Record<string, unknown>) ?? DEFAULT_SETTINGS.pricingPlans;
    const updatedPayment = (updated?.paymentTerms as Record<string, unknown>) ?? DEFAULT_SETTINGS.paymentTerms;
    const updatedBankRaw = (() => {
      const raw = updated?.bankDetails;
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
    const updatedTax = (updated?.taxCompliance as Record<string, unknown>) ?? DEFAULT_SETTINGS.taxCompliance;

    return NextResponse.json({
      ok: true,
      settings: {
        pricingPlans: { ...DEFAULT_SETTINGS.pricingPlans, ...updatedPricing },
        paymentTerms: { ...DEFAULT_SETTINGS.paymentTerms, ...updatedPayment },
        bankDetails: {
          ...DEFAULT_SETTINGS.bankDetails,
          ...updatedBankRaw,
          bankName: String(updatedBankRaw.bankName ?? ""),
          bban: String(updatedBankRaw.bban ?? ""),
          swift: String(updatedBankRaw.swift ?? ""),
          accountMasked: String(updatedBankRaw.accountMasked ?? ""),
          referenceFormat: String(updatedBankRaw.referenceFormat ?? DEFAULT_SETTINGS.bankDetails.referenceFormat),
          instructions: String(updatedBankRaw.instructions ?? ""),
        },
        taxCompliance: { ...DEFAULT_SETTINGS.taxCompliance, ...updatedTax },
      },
    });
  } catch (e) {
    console.error("Patch finance settings error:", e);
    return NextResponse.json(
      { error: "Failed to update finance settings." },
      { status: 500 }
    );
  }
}
