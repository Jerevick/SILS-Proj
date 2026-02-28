"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditCard, FileText, CheckCircle, ExternalLink, Loader2 } from "lucide-react";

type PaymentData = {
  request: {
    id: string;
    institutionName: string;
    deploymentMode: string;
    quotationInvoiceNumber: string | null;
  };
  amount: string;
  currency: string;
  financialVerifiedAt: string | null;
};

const DEPLOYMENT_LABELS: Record<string, string> = {
  SIS: "Student Information System (SIS)",
  LMS: "Learning Management System (LMS)",
  HYBRID: "Hybrid (SIS + LMS)",
};

export default function InstitutionPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = typeof params?.token === "string" ? params.token : null;
  const successFromStripe = searchParams?.get("success") === "1";
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeRedirecting, setStripeRedirecting] = useState(false);
  const [stripeUnavailable, setStripeUnavailable] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid payment link.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pay/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            (body as { error?: string }).error ??
              "Payment link not found or has expired."
          );
          setLoading(false);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch {
        if (!cancelled) setError("Failed to load payment details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const amountNum = data?.amount ? parseFloat(data.amount.replace(/,/g, "")) : NaN;
  const hasValidAmount = !isNaN(amountNum) && amountNum > 0;
  const alreadyPaid = Boolean(data?.financialVerifiedAt);

  const handlePayOnline = async () => {
    if (!token || !hasValidAmount) return;
    setStripeRedirecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(token)}/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) setStripeUnavailable(true);
        else setError((json as { error?: string }).error ?? "Could not start payment.");
        setStripeRedirecting(false);
        return;
      }
      if ((json as { url?: string }).url) {
        window.location.href = (json as { url: string }).url;
        return;
      }
      setError("Invalid response from payment server.");
    } catch {
      setError("Failed to start payment. Please try again.");
    } finally {
      setStripeRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <p className="text-slate-400">Loading payment…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-amber-400">{error ?? "Payment link not found."}</p>
        <p className="text-slate-500 text-sm text-center max-w-md">
          If you received this link by email with your quotation, it may have
          expired or already been used. Please contact the sender.
        </p>
      </div>
    );
  }

  if (alreadyPaid || successFromStripe) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 max-w-md text-center">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">
            {alreadyPaid ? "Payment received" : "Payment submitted"}
          </h1>
          <p className="text-slate-300 text-sm">
            {alreadyPaid ? (
              <>
                Payment for <strong className="text-white">{data?.request.institutionName}</strong> has
                been verified. No further action is required.
              </>
            ) : (
              <>
                Your payment for <strong className="text-white">{data?.request.institutionName}</strong> has been
                submitted. We will confirm once it is processed. You can close this page.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="border-b border-white/10 bg-slate-900/95 px-4 py-3 flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium">SILS — Onboarding payment</span>
        <Link
          href={`/invoice/${token}`}
          className="inline-flex items-center gap-2 text-sm text-neon-cyan hover:underline"
        >
          <FileText className="h-4 w-4" />
          View invoice
        </Link>
      </div>

      <div className="p-6 md:p-12 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-cyan/20 text-neon-cyan">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pay onboarding fee</h1>
            <p className="text-slate-400 text-sm">
              {data.request.institutionName} — {DEPLOYMENT_LABELS[data.request.deploymentMode] ?? data.request.deploymentMode}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6 space-y-4">
          {data.request.quotationInvoiceNumber && (
            <p className="text-slate-400 text-sm">
              Invoice: <span className="text-slate-200 font-medium">{data.request.quotationInvoiceNumber}</span>
            </p>
          )}

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Amount due (full payment required)
            </p>
            <p className="text-2xl font-bold text-white">
              {hasValidAmount ? (
                <>
                  {data.currency} {amountNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </>
              ) : (
                <span className="text-amber-400">Amount not set</span>
              )}
            </p>
            <p className="text-slate-500 text-xs mt-2">
              This invoice must be paid in full. Partial payments are not accepted.
            </p>
          </div>

          {hasValidAmount && (
            <div className="pt-4 space-y-3">
              {!stripeUnavailable && (
                <button
                  type="button"
                  onClick={handlePayOnline}
                  disabled={stripeRedirecting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neon-cyan px-4 py-3.5 text-sm font-semibold text-space-950 hover:bg-neon-cyan/90 disabled:opacity-70 transition-colors"
                >
                  {stripeRedirecting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Redirecting to payment…
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Pay online (card, PayPal, Google Pay & more)
                    </>
                  )}
                </button>
              )}
              <a
                href={`/invoice/${token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                View invoice & bank transfer details
              </a>
              <p className="text-slate-500 text-xs text-center">
                Pay securely with card, PayPal, Google Pay, Apple Pay, or other methods—or use the link above for bank transfer.
                Payment is verified automatically when you pay online.
              </p>
            </div>
          )}
        </div>

        {!hasValidAmount && (
          <p className="text-amber-400/90 text-sm mt-4 text-center">
            The amount for this invoice has not been configured yet. Please contact the sender of this link or reply to your quotation email.
          </p>
        )}
        {error && (
          <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
