"use client";

/**
 * Financial Aid application detail — AI insights, decision letter, Approve/Reject.
 * Scoped: Finance Officer (view + run AI), Finance Director / Admin (approve/reject).
 */

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Check, X } from "lucide-react";
import { processFinancialAid, approveOrRejectAid } from "@/app/actions/finance-actions";
import { useMe } from "@/hooks/use-me";
import { canAccessFinance, canApproveAid, canProcessAid } from "@/lib/finance-auth";

type ApplicationDetail = {
  id: string;
  studentId: string;
  programmeName: string;
  programmeCode: string;
  requestedAmount: number;
  status: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  awardedAmount: number | null;
  decisionDate: string | null;
  aiRecommendation: {
    recommendation?: string;
    suggestedAmount?: number;
    confidence?: number;
    factors?: string[];
  } | null;
  decisionLetter: string | null;
  awards: { id: string; awardType: string; amount: number; conditions: string | null }[];
  createdAt: string;
  updatedAt: string;
};

async function fetchApplication(id: string): Promise<ApplicationDetail> {
  const res = await fetch(`/api/finance/aid/${id}`);
  if (!res.ok) throw new Error("Failed to fetch application");
  return res.json();
}

export default function FinanceAidDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const applicationId = params?.applicationId as string | undefined;
  const { data: me } = useMe();

  const [processing, setProcessing] = React.useState(false);
  const [approving, setApproving] = React.useState<"approve" | "reject" | null>(null);
  const [awardAmount, setAwardAmount] = React.useState<string>("");

  const { data: application, isLoading } = useQuery({
    queryKey: ["finance", "aid", applicationId],
    queryFn: () => fetchApplication(applicationId!),
    enabled: !!applicationId,
  });

  const canAccess = me?.kind === "tenant" && canAccessFinance(me.role);
  const canApprove = me?.kind === "tenant" && canApproveAid(me.role);
  const canProcess = me?.kind === "tenant" && canProcessAid(me.role);

  const handleRunAI = async () => {
    if (!applicationId || !canProcess) return;
    setProcessing(true);
    try {
      const result = await processFinancialAid(applicationId);
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: ["finance", "aid"] });
        await queryClient.invalidateQueries({ queryKey: ["finance", "aid", applicationId] });
        router.refresh();
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveReject = async (decision: "approve" | "reject") => {
    if (!applicationId || !canApprove) return;
    setApproving(decision);
    try {
      const amount =
        decision === "approve" && awardAmount.trim()
          ? parseFloat(awardAmount)
          : undefined;
      const result = await approveOrRejectAid(applicationId, decision, amount);
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: ["finance", "aid"] });
        await queryClient.invalidateQueries({ queryKey: ["finance", "aid", applicationId] });
        router.refresh();
      }
    } finally {
      setApproving(null);
    }
  };

  if (!applicationId) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Invalid application ID.</p>
        <Link href="/finance/aid" className="text-neon-cyan hover:underline mt-2 inline-block">
          Back to applications
        </Link>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view this application.</p>
      </div>
    );
  }

  if (isLoading || !application) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  const rec = application.aiRecommendation;
  const suggested =
    rec?.recommendation === "approve_partial" && typeof rec.suggestedAmount === "number"
      ? rec.suggestedAmount
      : application.requestedAmount;

  return (
    <div className="p-6 max-w-4xl">
      <Link
        href="/finance/aid"
        className="inline-flex items-center gap-1 text-slate-400 hover:text-neon-cyan mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to applications
      </Link>

      <div className="mb-8">
        <h1 className="font-display text-xl font-semibold text-white mb-1">
          Financial Aid Application
        </h1>
        <p className="text-slate-400 text-sm">
          Student: {application.studentId} · Programme: {application.programmeName} (
          {application.programmeCode}) · Status: {application.status}
        </p>
      </div>

      <div className="grid gap-6">
        <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h2 className="text-sm font-medium text-slate-300 mb-2">Request &amp; decision</h2>
          <ul className="text-slate-200 space-y-1">
            <li>Requested amount: ${application.requestedAmount.toFixed(2)}</li>
            {application.awardedAmount != null && (
              <li>Awarded amount: ${application.awardedAmount.toFixed(2)}</li>
            )}
            {application.submittedAt && (
              <li>Submitted: {new Date(application.submittedAt).toLocaleString()}</li>
            )}
            {application.decisionDate && (
              <li>Decision date: {new Date(application.decisionDate).toLocaleString()}</li>
            )}
            {application.reviewedBy && <li>Reviewed by: {application.reviewedBy}</li>}
          </ul>
        </section>

        <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h2 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            AI recommendation
            {!rec && canProcess && (
              <button
                type="button"
                onClick={handleRunAI}
                disabled={processing}
                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                {processing ? "Processing…" : "Run AI"}
              </button>
            )}
          </h2>
          {rec ? (
            <div className="space-y-2 text-slate-200">
              <p>
                Recommendation:{" "}
                <span className="font-medium">
                  {rec.recommendation === "approve_full"
                    ? "Approve full amount"
                    : rec.recommendation === "approve_partial"
                      ? `Approve partial (suggested: $${rec.suggestedAmount?.toFixed(2) ?? "—"})`
                      : "Reject"}
                </span>
                {typeof rec.confidence === "number" && (
                  <span className="text-slate-500 text-sm ml-2">
                    Confidence: {(rec.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </p>
              {Array.isArray(rec.factors) && rec.factors.length > 0 && (
                <ul className="list-disc list-inside text-sm text-slate-400">
                  {rec.factors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No AI recommendation yet. Run AI to generate.</p>
          )}
        </section>

        {application.decisionLetter && (
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 mb-2">Draft decision letter</h2>
            <div className="text-slate-200 whitespace-pre-wrap text-sm">
              {application.decisionLetter}
            </div>
          </section>
        )}

        {application.awards.length > 0 && (
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 mb-2">Awards</h2>
            <ul className="text-slate-200 space-y-1">
              {application.awards.map((a) => (
                <li key={a.id}>
                  {a.awardType}: ${a.amount.toFixed(2)}
                  {a.conditions && ` — ${a.conditions}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        {canApprove && application.status === "UNDER_REVIEW" && (
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h2 className="text-sm font-medium text-slate-300 mb-3">Approve / Reject</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-slate-400 text-sm">
                Award amount (USD):{" "}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={awardAmount}
                  onChange={(e) => setAwardAmount(e.target.value)}
                  placeholder={String(suggested)}
                  className="ml-2 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-white w-28"
                />
              </label>
              <button
                type="button"
                onClick={() => handleApproveReject("approve")}
                disabled={approving !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
              >
                <Check className="w-4 h-4" /> {approving === "approve" ? "Processing…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleApproveReject("reject")}
                disabled={approving !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-500 text-white text-sm"
              >
                <X className="w-4 h-4" /> {approving === "reject" ? "Processing…" : "Reject"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
