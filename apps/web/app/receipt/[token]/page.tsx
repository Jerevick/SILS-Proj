"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Printer, FileText, CheckCircle } from "lucide-react";

type ReceiptRequestDto = {
  id: string;
  institutionName: string;
  deploymentMode: string;
  contactPerson: string;
  contactEmail: string;
  quotationInvoiceNumber: string | null;
  paidAt: string;
  amount: string;
  currency: string;
};

const DEPLOYMENT_MODE_LABELS: Record<string, string> = {
  SIS: "Student Information System (SIS)",
  LMS: "Learning Management System (LMS)",
  HYBRID: "Hybrid (SIS + LMS)",
};

export default function PublicReceiptPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : null;
  const [request, setRequest] = useState<ReceiptRequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid link.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/receipt/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data as { error?: string }).error ?? "Receipt not found or link has expired.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setRequest(data.request ?? null);
      } catch {
        if (!cancelled) setError("Failed to load receipt.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const modeLabel = request?.deploymentMode
    ? DEPLOYMENT_MODE_LABELS[request.deploymentMode] ?? request.deploymentMode
    : "—";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <p className="text-slate-400">Loading receipt…</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-amber-400">{error ?? "Receipt not found."}</p>
        <p className="text-slate-500 text-sm">
          If you received this link by email after payment, it may have expired. Please contact support.
        </p>
      </div>
    );
  }

  const paidDate = new Date(request.paidAt).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden; }
              .receipt-print-root, .receipt-print-root * { visibility: visible; }
              .receipt-print-root {
                position: absolute; left: 0; top: 0; width: 100%;
                padding: 0; margin: 0; background: white; color: #0f172a;
              }
              .no-print { display: none !important; }
            }
          `,
        }}
      />
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="no-print border-b border-white/10 bg-slate-900/95 px-4 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-400 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Download as PDF
          </button>
          <p className="text-slate-500 text-xs ml-3 self-center">
            Use your browser&rsquo;s Print dialog and choose &ldquo;Save as PDF&rdquo;
          </p>
        </div>
        <div className="receipt-print-root p-8 md:p-12 max-w-3xl mx-auto">
          <div className="bg-white text-slate-800 rounded-lg shadow-xl p-8 md:p-10 print:shadow-none print:p-0">
            <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">SILS</h1>
                  <p className="text-sm text-slate-500">Payment receipt</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                  <CheckCircle className="h-4 w-4" />
                  PAID
                </span>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-3">Receipt date</p>
                <p className="text-slate-900 font-medium mt-0.5">{paidDate}</p>
                {request.quotationInvoiceNumber && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-2">Invoice number</p>
                    <p className="text-slate-900 font-medium mt-0.5">{request.quotationInvoiceNumber}</p>
                  </>
                )}
              </div>
            </div>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Paid by</p>
              <p className="font-semibold text-slate-900">{request.institutionName}</p>
              <p className="text-sm text-slate-600">Deployment: {modeLabel}</p>
              <p className="text-sm text-slate-600">{request.contactPerson}</p>
              <p className="text-sm text-slate-600">{request.contactEmail}</p>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left font-semibold text-slate-700 py-3 px-4">Description</th>
                    <th className="text-right font-semibold text-slate-700 py-3 px-4">Amount paid</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">Onboarding fee (one-time)</p>
                      <p className="text-slate-600 text-sm mt-0.5">{modeLabel}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                      {request.amount !== "—" ? `${request.currency} ${request.amount}` : request.currency}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-slate-500 text-xs mt-8">
              This receipt confirms that payment has been received for the above invoice. Thank you for choosing SILS.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
