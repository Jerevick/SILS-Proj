"use client";

/**
 * Admin Equity Dashboard — completion rates by demographics, AI insights on equity gaps.
 * Platform admin: select institution and view equity metrics + AI-generated recommendations.
 */

import { useState, useEffect } from "react";
import { AdminShell } from "../components/admin-shell";
import { BarChart3, Sparkles, Users, Loader2 } from "lucide-react";
import { getEquityInsights } from "@/app/actions/admin-equity";
import type { EquityDashboardPayload } from "@/app/api/admin/equity/route";

type Institution = { id: string; name: string; slug: string };

export default function AdminEquityPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [data, setData] = useState<EquityDashboardPayload | null>(null);
  const [insights, setInsights] = useState<{ summary: string; gaps: string[]; recommendations: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/institutions")
      .then((r) => r.json())
      .then((rows: { id: string; name: string; slug: string }[]) => {
        setInstitutions(rows);
        if (rows.length > 0 && !selectedTenantId) setSelectedTenantId(rows[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedTenantId) {
      setData(null);
      setInsights(null);
      return;
    }
    setData(null);
    setInsights(null);
    fetch(`/api/admin/equity?tenantId=${encodeURIComponent(selectedTenantId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [selectedTenantId]);

  const handleGenerateInsights = () => {
    if (!data) return;
    setInsightsLoading(true);
    const summary = [
      `Institution: ${data.tenantName}.`,
      `Total learners: ${data.totalLearners}. Learners with equity data: ${data.learnersWithEquityData}.`,
      `Overall completion rate: ${data.completionRateOverall}%.`,
      `First-gen: ${data.byDemographic.firstGen.count} students, ${data.byDemographic.firstGen.rate}% completion.`,
      `Low-income: ${data.byDemographic.lowIncome.count} students, ${data.byDemographic.lowIncome.rate}% completion.`,
      `Neurodiverse: ${data.byDemographic.neurodiverse.count} students, ${data.byDemographic.neurodiverse.rate}% completion.`,
      `Caregiver: ${data.byDemographic.caregiver.count} students, ${data.byDemographic.caregiver.rate}% completion.`,
    ].join(" ");
    getEquityInsights(data.tenantId, summary).then((res) => {
      setInsightsLoading(false);
      if (res.ok) setInsights(res.insights);
    });
  };

  return (
    <AdminShell activeNav="equity">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-neon-cyan/80" />
            Equity Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Completion rates by demographics and AI insights on equity gaps.
          </p>
        </div>

        <div className="rounded-xl glass-card border border-white/10 p-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Institution</label>
          <select
            value={selectedTenantId ?? ""}
            onChange={(e) => setSelectedTenantId(e.target.value || null)}
            className="w-full max-w-md rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
          >
            <option value="">Select…</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading institutions…
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-slate-500 text-xs">Total learners</p>
                <p className="font-display text-2xl font-bold text-white mt-1">{data.totalLearners}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-slate-500 text-xs">With equity data</p>
                <p className="font-display text-2xl font-bold text-white mt-1">{data.learnersWithEquityData}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-slate-500 text-xs">Overall completion</p>
                <p className="font-display text-2xl font-bold text-neon-cyan mt-1">{data.completionRateOverall}%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleGenerateInsights}
                  disabled={insightsLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
                >
                  {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {insightsLoading ? "Generating…" : "AI insights"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Completion by demographic
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(
                  [
                    ["First-generation", data.byDemographic.firstGen],
                    ["Low-income", data.byDemographic.lowIncome],
                    ["Neurodiverse", data.byDemographic.neurodiverse],
                    ["Caregiver", data.byDemographic.caregiver],
                  ] as const
                ).map(([label, d]) => (
                  <div key={label} className="rounded-lg bg-white/5 p-3">
                    <p className="text-slate-400 text-xs">{label}</p>
                    <p className="text-white font-medium mt-1">
                      {d.count} students · {d.rate}% completion
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {d.completed} completed
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {insights && (
              <div className="rounded-xl border border-neon-purple/20 bg-neon-purple/5 p-6">
                <h2 className="text-sm font-semibold text-neon-purple mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI insights on equity gaps
                </h2>
                <p className="text-slate-200 text-sm mb-4">{insights.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Gaps</p>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {insights.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Recommendations</p>
                    <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                      {insights.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && selectedTenantId && !data && (
          <div className="rounded-xl glass-card border border-white/10 p-8 text-center text-slate-500">
            No equity data for this institution yet.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
