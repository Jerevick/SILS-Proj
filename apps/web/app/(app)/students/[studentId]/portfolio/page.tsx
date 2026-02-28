"use client";

/**
 * Phase 9: Proof-of-Mastery portfolio — competencies, verifiable credentials, export & share.
 * AI-powered job mapping section (vector similarity).
 */

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { portfolioByStudentKey, PORTFOLIO_QUERY_KEY } from "@/lib/query-keys";

const JOB_QUERIES = [
  "Data analyst",
  "Software engineer",
  "Project manager",
  "UX designer",
];

type PortfolioData = {
  studentId: string;
  competencies: Array<{
    id: string;
    competencyId: string;
    code: string;
    title: string;
    programme: string | null;
    programmeCode: string | null;
    masteryLevel: number;
    evidenceJson: unknown;
    lastUpdated: string;
  }>;
  credentials: Array<{
    id: string;
    competencyId: string;
    competencyCode: string;
    competencyTitle: string;
    programme: string | null;
    issuedAt: string;
    blockchainTx: string | null;
    status: string;
  }>;
};

async function fetchPortfolio(studentId: string): Promise<PortfolioData> {
  const res = await fetch(`/api/students/${studentId}/portfolio`);
  if (!res.ok) throw new Error("Failed to load portfolio");
  return res.json();
}

async function searchCompetencies(
  query: string,
  studentId: string
): Promise<{ results: Array<{ competency?: { title: string }; similarity: number }> }> {
  const res = await fetch("/api/competencies/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, studentId, limit: 6, minMastery: 0.3 }),
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function issueCredential(
  studentId: string,
  competencyId: string
): Promise<{ id: string; vcJwt?: string; issuedAt: string }> {
  const res = await fetch("/api/competencies/issue-credential", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, competencyId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to issue credential");
  }
  return res.json();
}

export default function StudentPortfolioPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const queryClient = useQueryClient();
  const [jobQuery, setJobQuery] = useState(JOB_QUERIES[0]);
  const [exportedJwt, setExportedJwt] = useState<string | null>(null);

  const { data: portfolio, isLoading, error } = useQuery({
    queryKey: portfolioByStudentKey(studentId),
    queryFn: () => fetchPortfolio(studentId),
    enabled: !!studentId,
  });

  const jobMappingQuery = useQuery({
    queryKey: [...PORTFOLIO_QUERY_KEY, "job-mapping", studentId, jobQuery],
    queryFn: () => searchCompetencies(jobQuery, studentId),
    enabled: !!studentId && !!jobQuery,
  });

  const issueMutation = useMutation({
    mutationFn: ({ competencyId }: { competencyId: string }) =>
      issueCredential(studentId, competencyId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: portfolioByStudentKey(studentId) });
      if (result.vcJwt) setExportedJwt(result.vcJwt);
    },
  });

  const jobResults = jobMappingQuery.data?.results ?? [];

  if (!studentId) {
    return (
      <div className="min-h-screen bg-[var(--space-black)] text-white p-6">
        <p className="text-slate-400">Missing student ID.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--space-black)] text-white p-6">
        <p className="text-slate-400">Loading portfolio…</p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-[var(--space-black)] text-white p-6">
        <p className="text-amber-400">Failed to load portfolio.</p>
        <Link href="/progress/me" className="text-neon-cyan hover:underline mt-2 inline-block">
          Back to progress
        </Link>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/students/${studentId}/portfolio`
      : "";

  return (
    <div className="min-h-screen bg-[var(--space-black)] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">
              Proof of Mastery
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Portfolio · Verifiable credentials · Shareable link
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (shareUrl) navigator.clipboard.writeText(shareUrl);
              }}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white border border-white/20 hover:bg-white/15"
            >
              Copy share link
            </button>
            <Link
              href="/skills/graph"
              className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
            >
              Skills graph
            </Link>
          </div>
        </div>

        {/* Competencies */}
        <section className="glass rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Competencies</h2>
          {portfolio.competencies.length === 0 ? (
            <p className="text-slate-500 text-sm">No competency records yet.</p>
          ) : (
            <ul className="space-y-3">
              {portfolio.competencies.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3 border border-white/5"
                >
                  <div>
                    <span className="font-medium text-white">{c.title}</span>
                    <span className="text-slate-400 text-sm ml-2">
                      {c.code} · {c.programme ?? "—"} · {(c.masteryLevel * 100).toFixed(0)}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => issueMutation.mutate({ competencyId: c.competencyId })}
                    disabled={issueMutation.isPending}
                    className="rounded-lg bg-neon-purple/20 px-3 py-1.5 text-sm text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
                  >
                    Issue VC
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Verifiable credentials */}
        <section className="glass rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Verifiable credentials
          </h2>
          {portfolio.credentials.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No credentials yet. Issue a VC from a competency above.
            </p>
          ) : (
            <ul className="space-y-3">
              {portfolio.credentials.map((vc) => (
                <li
                  key={vc.id}
                  className="rounded-lg bg-white/5 px-4 py-3 border border-white/5 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-white">{vc.competencyTitle}</span>
                    <span className="text-slate-400 text-sm ml-2">
                      {vc.competencyCode} · {new Date(vc.issuedAt).toLocaleDateString()}
                    </span>
                    {vc.blockchainTx && (
                      <p className="text-slate-500 text-xs mt-1">Tx: {vc.blockchainTx.slice(0, 20)}…</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Export VC */}
        {exportedJwt && (
          <section className="glass rounded-xl border border-neon-cyan/30 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Exported VC (JWT)</h2>
            <p className="text-slate-400 text-sm mb-2">
              Copy or download this verifiable credential.
            </p>
            <textarea
              readOnly
              className="w-full h-24 rounded-lg bg-black/30 border border-white/10 p-3 text-xs text-slate-300 font-mono break-all"
              value={exportedJwt}
            />
            <button
              type="button"
              onClick={() => setExportedJwt(null)}
              className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/15"
            >
              Dismiss
            </button>
          </section>
        )}

        {/* Job mapping */}
        <section className="glass rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            Job mapping (AI-powered)
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Roles that match your demonstrated competencies (vector similarity).
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {JOB_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setJobQuery(q)}
                className={`rounded-lg px-3 py-1.5 text-sm border ${
                  jobQuery === q
                    ? "bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          {jobMappingQuery.isLoading && (
            <p className="text-slate-500 text-sm">Loading…</p>
          )}
          {jobResults.length > 0 && !jobMappingQuery.isLoading && (
            <ul className="space-y-2">
              {jobResults.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 border border-white/5"
                >
                  <span className="text-slate-200">{r.competency?.title ?? "—"}</span>
                  <span className="text-neon-cyan text-sm">
                    {(r.similarity * 100).toFixed(0)}% match
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-slate-500 text-sm">
          <Link href="/progress/me" className="text-neon-cyan hover:underline">
            My progress
          </Link>
          {" · "}
          <Link href="/skills/graph" className="text-neon-cyan hover:underline">
            Skills graph
          </Link>
        </p>
      </div>
    </div>
  );
}
