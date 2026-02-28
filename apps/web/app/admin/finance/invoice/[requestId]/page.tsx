"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, FileText } from "lucide-react";

type RequestDto = {
  id: string;
  institutionName: string;
  deploymentMode: string;
  contactPerson: string;
  contactEmail: string;
  quotationInvoiceNumber: string | null;
  quotationSentAt: string | null;
};

type FinanceSettings = {
  pricingPlans: {
    sis: { onboardingFee: string; currency: string };
    lms: { onboardingFee: string; currency: string };
    hybrid: { onboardingFee: string; currency: string };
  };
  paymentTerms: { defaultTerms: string; dueDays: number; latePolicy: string };
  bankDetails: {
    bankName: string;
    bban: string;
    swift: string;
    accountMasked: string;
    referenceFormat: string;
    instructions: string;
  };
  taxCompliance: { taxId: string; vatNumber: string; invoicePrefix: string; nextNumber: number };
};

const DEPLOYMENT_MODE_INVOICE: Record<
  string,
  { label: string; description: string }
> = {
  SIS: {
    label: "Student Information System (SIS) portal",
    description:
      "Full student records, enrollment, grades, and administrative workflows.",
  },
  LMS: {
    label: "Learning Management System (LMS)",
    description:
      "Course delivery, assignments, and learning activities.",
  },
  HYBRID: {
    label: "Hybrid — Student Information System (SIS) + Learning Management System (LMS)",
    description:
      "Combined SIS and LMS: student records and administrative workflows plus course and learning management.",
  },
};

function getDeploymentModeForInvoice(mode: string | undefined) {
  if (!mode) return { label: "—", description: "" };
  const entry = DEPLOYMENT_MODE_INVOICE[mode];
  return entry ?? { label: mode, description: "" };
}

export default function AdminFinanceInvoicePage() {
  const params = useParams();
  const requestId = typeof params?.requestId === "string" ? params.requestId : null;
  const [request, setRequest] = useState<RequestDto | null>(null);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError("Invalid request");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [reqRes, setRes] = await Promise.all([
          fetch(`/api/onboarding/requests/${requestId}`),
          fetch("/api/admin/finance-settings"),
        ]);
        if (cancelled) return;
        if (!reqRes.ok) {
          if (reqRes.status === 403) setError("You don't have permission to view this invoice.");
          else if (reqRes.status === 404) setError("Request not found.");
          else setError("Failed to load request.");
          setLoading(false);
          return;
        }
        if (!setRes.ok) {
          setError("Failed to load finance settings.");
          setLoading(false);
          return;
        }
        const reqData = await reqRes.json();
        const setData = await setRes.json();
        setRequest({
          id: reqData.id,
          institutionName: reqData.institutionName,
          deploymentMode: reqData.deploymentMode,
          contactPerson: reqData.contactPerson,
          contactEmail: reqData.contactEmail,
          quotationInvoiceNumber: reqData.quotationInvoiceNumber ?? null,
          quotationSentAt: reqData.quotationSentAt ?? null,
        });
        setSettings({
          pricingPlans: {
            sis: { onboardingFee: "", currency: "USD", ...setData.pricingPlans?.sis },
            lms: { onboardingFee: "", currency: "USD", ...setData.pricingPlans?.lms },
            hybrid: { onboardingFee: "", currency: "USD", ...setData.pricingPlans?.hybrid },
          },
          paymentTerms: { defaultTerms: "Net 30", dueDays: 30, latePolicy: "", ...setData.paymentTerms },
          bankDetails: {
            bankName: "",
            bban: "",
            swift: "",
            accountMasked: "",
            referenceFormat: "INV-{institution}-{year}",
            instructions: "",
            ...setData.bankDetails,
          },
          taxCompliance: {
            taxId: "",
            vatNumber: "",
            invoicePrefix: "SILS",
            nextNumber: 1,
            ...setData.taxCompliance,
          },
        });
      } catch {
        if (!cancelled) setError("Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const handlePrint = () => {
    window.print();
  };

  const deploymentForInvoice = getDeploymentModeForInvoice(request?.deploymentMode);
  const modeLabel = deploymentForInvoice.label;
  const modeDescription = deploymentForInvoice.description;

  const planKey = (request?.deploymentMode?.toLowerCase() ?? "sis") as "sis" | "lms" | "hybrid";
  const plan = settings?.pricingPlans[planKey] ?? settings?.pricingPlans.sis;
  const currency = plan?.currency ?? "USD";
  const onboardingFee = plan?.onboardingFee ?? "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <p className="text-slate-400">Loading invoice…</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-amber-400">{error ?? "Request not found."}</p>
        <Link
          href="/admin/finance"
          className="inline-flex items-center gap-2 text-neon-cyan hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Finance
        </Link>
      </div>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              .invoice-print-root, .invoice-print-root * { visibility: visible; }
              .invoice-print-root {
                position: absolute; left: 0; top: 0; width: 100%;
                padding: 0; margin: 0; background: white; color: #0f172a;
              }
              .no-print { display: none !important; }
            }
          `,
        }}
      />

      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="no-print border-b border-white/10 bg-slate-900/95 px-4 py-3 flex items-center justify-between">
          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Finance
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 text-neon-cyan px-4 py-2.5 text-sm font-medium hover:bg-neon-cyan/30 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>

        <div className="invoice-print-root p-8 md:p-12 max-w-3xl mx-auto">
          <div className="bg-white text-slate-800 rounded-lg shadow-xl p-8 md:p-10 print:shadow-none print:p-0">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">SILS</h1>
                  <p className="text-sm text-slate-500">Onboarding invoice / Quotation</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Invoice number
                </p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">
                  {request.quotationInvoiceNumber ?? "—"}
                </p>
                {request.quotationSentAt && (
                  <p className="text-xs text-slate-500 mt-1">
                    Date:{" "}
                    {new Date(request.quotationSentAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Bill to */}
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Bill to
              </p>
              <p className="font-semibold text-slate-900">{request.institutionName}</p>
              <p className="text-sm text-slate-600">
                Deployment: {modeLabel}
              </p>
              {modeDescription && (
                <p className="text-xs text-slate-500 mt-0.5">{modeDescription}</p>
              )}
              <p className="text-sm text-slate-600">{request.contactPerson}</p>
              <p className="text-sm text-slate-600">{request.contactEmail}</p>
            </div>

            {/* Deployment & amount */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left font-semibold text-slate-700 py-3 px-4">Description</th>
                    <th className="text-right font-semibold text-slate-700 py-3 px-4">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">Onboarding fee (one-time)</p>
                      <p className="text-slate-600 text-sm mt-0.5">{modeLabel}</p>
                      {modeDescription && (
                        <p className="text-slate-500 text-xs mt-1">{modeDescription}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {onboardingFee ? `${currency} ${onboardingFee}` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment terms */}
            {settings && (
              <>
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Payment terms
                  </p>
                  <p className="text-slate-700">
                    {settings.paymentTerms.defaultTerms || "—"}
                    {settings.paymentTerms.dueDays
                      ? ` — Due within ${settings.paymentTerms.dueDays} days`
                      : ""}
                  </p>
                  {settings.paymentTerms.latePolicy && (
                    <p className="text-slate-600 text-sm mt-1">
                      {settings.paymentTerms.latePolicy}
                    </p>
                  )}
                </div>

                {/* Bank details */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Bank & payment details
                  </p>
                  <div className="text-slate-700 text-sm space-y-1">
                    {settings.bankDetails.bankName && (
                      <p><strong>Bank:</strong> {settings.bankDetails.bankName}</p>
                    )}
                    {settings.bankDetails.bban && (
                      <p>BBAN: {settings.bankDetails.bban}</p>
                    )}
                    {settings.bankDetails.swift && (
                      <p>SWIFT/BIC: {settings.bankDetails.swift}</p>
                    )}
                    {settings.bankDetails.accountMasked && (
                      <p>Account: {settings.bankDetails.accountMasked}</p>
                    )}
                    {settings.bankDetails.referenceFormat && (
                      <p className="mt-2">
                        Reference:{" "}
                        {settings.bankDetails.referenceFormat
                          .replace("{institution}", request.institutionName.replace(/\s+/g, "-").slice(0, 20))
                          .replace("{year}", new Date().getFullYear().toString())}
                        {request.quotationInvoiceNumber &&
                          ` or ${request.quotationInvoiceNumber}`}
                      </p>
                    )}
                    {settings.bankDetails.instructions && (
                      <p className="text-slate-600 mt-2 whitespace-pre-wrap">
                        {settings.bankDetails.instructions}
                      </p>
                    )}
                  </div>
                </div>

                {/* Tax / compliance */}
                {(settings.taxCompliance.taxId || settings.taxCompliance.vatNumber) && (
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Tax / compliance
                    </p>
                    <div className="text-slate-700 text-sm space-y-0.5">
                      {settings.taxCompliance.taxId && (
                        <p>Tax ID: {settings.taxCompliance.taxId}</p>
                      )}
                      {settings.taxCompliance.vatNumber && (
                        <p>VAT: {settings.taxCompliance.vatNumber}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-slate-500 text-xs mt-8">
              This document serves as the official quotation/invoice for SILS onboarding. Please pay
              according to the payment terms above. Thank you for choosing SILS.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
