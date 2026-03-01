"use client";

/**
 * Donor profile — detailed view with interaction history and "Generate Personalized Outreach" (AI draft).
 * Scoped: Advancement Officer, Development Director, OWNER, ADMIN.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, DollarSign, Heart, Calendar, Mail } from "lucide-react";
import { runAdvancementCRMAgent } from "@/app/actions/advancement-actions";
import { useMe } from "@/hooks/use-me";
import { canAccessAdvancement } from "@/lib/advancement-auth";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";

type DonationItem = {
  id: string;
  amount: number;
  date: string;
  designation: string | null;
  receiptSent: boolean;
  campaign: { id: string; name: string } | null;
};

type InteractionItem = {
  id: string;
  type: string;
  notes: string | null;
  date: string;
  userId: string;
};

type DonorDetail = {
  id: string;
  name: string;
  email: string;
  contactId: string | null;
  lifetimeValue: number;
  affinityScore: number;
  lastContactDate: string | null;
  tags: string[];
  createdAt: string;
  donations: DonationItem[];
  interactions: InteractionItem[];
};

async function fetchDonor(id: string): Promise<DonorDetail> {
  const res = await fetch(`/api/advancement/donors/${id}`);
  if (!res.ok) throw new Error("Failed to fetch donor");
  return res.json();
}

export default function AdvancementDonorProfilePage() {
  const params = useParams();
  const donorId = params.donorId as string;
  const queryClient = useQueryClient();
  const { data: donor, isLoading } = useQuery({
    queryKey: ["advancement", "donors", donorId],
    queryFn: () => fetchDonor(donorId),
    enabled: !!donorId,
  });
  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessAdvancement(me.role);

  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiResult, setAiResult] = React.useState<{
    nextGiftLikelihood: number;
    factors: string[];
    recommendations: string[];
    draftMessage: string;
  } | null>(null);

  const handleGenerateOutreach = async () => {
    if (!donorId) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await runAdvancementCRMAgent({ donorId });
      if (result.ok) {
        setAiResult({
          nextGiftLikelihood: result.nextGiftLikelihood,
          factors: result.factors,
          recommendations: result.recommendations,
          draftMessage: result.draftMessage,
        });
        queryClient.invalidateQueries({ queryKey: ["advancement", "donors"] });
        queryClient.invalidateQueries({ queryKey: ["advancement", "donors", donorId] });
      }
    } finally {
      setAiLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to view donor profiles.</p>
      </div>
    );
  }

  if (isLoading || !donor) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Loading donor…</p>
      </div>
    );
  }

  const donationColumns: GridColDef<DonationItem>[] = [
    { field: "date", headerName: "Date", width: 120 },
    {
      field: "amount",
      headerName: "Amount",
      width: 120,
      valueFormatter: (v) => (v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"),
    },
    { field: "designation", headerName: "Designation", flex: 1, minWidth: 140 },
    {
      field: "campaign",
      headerName: "Campaign",
      width: 160,
      valueGetter: (_, row) => row.campaign?.name ?? "—",
    },
    {
      field: "receiptSent",
      headerName: "Receipt",
      width: 90,
      renderCell: (params) => (params.value ? "Yes" : "No"),
    },
  ];

  const interactionColumns: GridColDef<InteractionItem>[] = [
    { field: "date", headerName: "Date", width: 120 },
    { field: "type", headerName: "Type", width: 100 },
    { field: "notes", headerName: "Notes", flex: 1, minWidth: 200 },
  ];

  return (
    <div className="p-6">
      <Link
        href="/advancement/donors"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-neon-cyan mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to donors
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white mb-1">
            {donor.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Mail className="w-4 h-4" />
              {donor.email}
            </span>
            {donor.lastContactDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Last contact: {donor.lastContactDate}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerateOutreach}
          disabled={aiLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {aiLoading ? "Generating…" : "Generate Personalized Outreach"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl glass border border-neon-cyan/20 p-4 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-cyan-400" />
          <div>
            <p className="text-slate-400 text-sm">Lifetime value</p>
            <p className="text-white font-semibold">
              ${donor.lifetimeValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="rounded-xl glass border border-neon-cyan/20 p-4 flex items-center gap-3">
          <Heart className="w-8 h-8 text-amber-400" />
          <div>
            <p className="text-slate-400 text-sm">Affinity score</p>
            <p className="text-white font-semibold">{donor.affinityScore.toFixed(1)}</p>
          </div>
        </div>
        <div className="rounded-xl glass border border-neon-cyan/20 p-4">
          <p className="text-slate-400 text-sm mb-1">Tags</p>
          <p className="text-white">
            {donor.tags?.length ? donor.tags.join(", ") : "—"}
          </p>
        </div>
      </div>

      {aiResult && (
        <div className="rounded-xl glass border border-amber-500/30 bg-amber-500/5 p-6 mb-8">
          <h2 className="font-display text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            AI outreach draft
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-slate-400 text-sm mb-1">Next gift likelihood</p>
              <p className="text-white font-semibold">
                {(aiResult.nextGiftLikelihood * 100).toFixed(0)}%
              </p>
              {aiResult.factors.length > 0 && (
                <>
                  <p className="text-slate-400 text-sm mt-3 mb-1">Factors</p>
                  <ul className="text-slate-300 text-sm list-disc list-inside">
                    {aiResult.factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </>
              )}
              {aiResult.recommendations.length > 0 && (
                <>
                  <p className="text-slate-400 text-sm mt-3 mb-1">Recommendations</p>
                  <ul className="text-slate-300 text-sm list-disc list-inside">
                    {aiResult.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-2">Draft message</p>
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 text-sm whitespace-pre-wrap">
                {aiResult.draftMessage || "No draft generated."}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="font-display text-lg font-semibold text-white mb-3">Donations</h2>
        <DashboardDataGrid<DonationItem>
          columns={donationColumns}
          rows={donor.donations}
          getRowId={(row) => row.id}
          pageSize={5}
        />
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-white mb-3">Interaction history</h2>
        <DashboardDataGrid<InteractionItem>
          columns={interactionColumns}
          rows={donor.interactions}
          getRowId={(row) => row.id}
          pageSize={5}
        />
      </div>
    </div>
  );
}
