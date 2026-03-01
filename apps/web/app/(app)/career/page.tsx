"use client";

/**
 * Phase 26: Student & Alumni Career Hub.
 * - AI Career Coach chat (run AlumniCareerAgent for current user)
 * - Smart job board with personalized matching
 * - Resume builder linked to skills graph (competencies + VCs)
 * - Mentorship matching section
 * Scoped: Career Services, Alumni Relations, OWNER, ADMIN, LEARNER.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Briefcase,
  Sparkles,
  FileText,
  Users,
  Loader2,
  MessageSquare,
  ExternalLink,
  Award,
} from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { canAccessCareer } from "@/lib/alumni-career-auth";
import { runAlumniCareerAgent } from "@/app/actions/alumni-career-actions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type OpportunityRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  type: string;
  description: string | null;
  expiresAt: string;
  createdAt: string;
};

async function fetchOpportunities(): Promise<OpportunityRow[]> {
  const res = await fetch("/api/career/opportunities");
  if (!res.ok) throw new Error("Failed to fetch opportunities");
  const data = await res.json();
  return data.opportunities ?? [];
}

export default function CareerHubPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canAccess = me?.kind === "tenant" && canAccessCareer(me.role);

  const { data: opportunities = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["career", "opportunities"],
    queryFn: fetchOpportunities,
    enabled: !!canAccess,
  });

  const [coachLoading, setCoachLoading] = React.useState(false);
  const [coachResult, setCoachResult] = React.useState<{
    careerRecommendations: string[];
    jobMatches: { opportunityId: string; title: string; company: string; location: string | null; type: string; matchScore: number; reason: string }[];
    outreachMessage: string;
    suggestedMentors: { alumniId: string; name: string; currentRole: string | null; currentEmployer: string | null; graduationYear: number; reason: string }[];
    verifiedCredentialsToAttach: { competencyId: string; competencyTitle: string; issuedAt: string }[];
  } | null>(null);
  const [coachError, setCoachError] = React.useState<string | null>(null);

  const handleRunCareerCoach = async () => {
    setCoachLoading(true);
    setCoachError(null);
    setCoachResult(null);
    try {
      const result = await runAlumniCareerAgent({});
      if (result.ok) {
        setCoachResult({
          careerRecommendations: result.careerRecommendations,
          jobMatches: result.jobMatches,
          outreachMessage: result.outreachMessage,
          suggestedMentors: result.suggestedMentors,
          verifiedCredentialsToAttach: result.verifiedCredentialsToAttach,
        });
        queryClient.invalidateQueries({ queryKey: ["career", "opportunities"] });
      } else {
        setCoachError(result.error);
      }
    } catch (e) {
      setCoachError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCoachLoading(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="p-6">
        <p className="text-slate-400">You do not have permission to access the Career Hub.</p>
      </div>
    );
  }

  const matchChartData =
    coachResult?.jobMatches.map((j) => ({
      name: j.title.length > 20 ? j.title.slice(0, 18) + "…" : j.title,
      score: j.matchScore * 100,
      fullTitle: j.title,
    })) ?? [];

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Briefcase className="w-7 h-7 text-cyan-400" />
          Career Hub
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          AI Career Coach, personalized job matching, resume builder, and mentorship.
        </p>
      </div>

      {/* AI Career Coach */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
          <MessageSquare className="w-5 h-5 text-neon-cyan" />
          AI Career Coach
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Get personalized career recommendations, job matches from the skills graph, and an outreach message. Your verified credentials are suggested for applications.
        </p>
        <button
          type="button"
          onClick={handleRunCareerCoach}
          disabled={coachLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-50"
        >
          {coachLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {coachLoading ? "Generating…" : "Get career recommendations"}
        </button>
        {coachError && <p className="text-rose-400 text-sm mt-2">{coachError}</p>}

        {coachResult && (
          <div className="mt-6 space-y-6">
            {coachResult.careerRecommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Recommendations</h3>
                <ul className="list-disc list-inside text-slate-300 text-sm space-y-1">
                  {coachResult.careerRecommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {coachResult.outreachMessage && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Outreach message (for applications)</h3>
                <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-600 text-slate-200 text-sm whitespace-pre-wrap">
                  {coachResult.outreachMessage}
                </div>
              </div>
            )}
            {coachResult.verifiedCredentialsToAttach.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  Verified credentials to attach
                </h3>
                <ul className="text-slate-300 text-sm space-y-1">
                  {coachResult.verifiedCredentialsToAttach.map((c) => (
                    <li key={c.competencyId}>
                      {c.competencyTitle} — issued {new Date(c.issuedAt).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Job matches chart (Recharts) */}
      {coachResult && matchChartData.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Job match scores</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matchChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  content={({ payload }) =>
                    payload?.[0] ? (
                      <div className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm">
                        <p className="text-white font-medium">{payload[0].payload.fullTitle}</p>
                        <p className="text-cyan-400">Match: {(payload[0].payload.score as number).toFixed(0)}%</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {matchChartData.map((_, i) => (
                    <Cell key={i} fill="rgba(0, 245, 255, 0.6)" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Smart job board */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Briefcase className="w-5 h-5 text-cyan-400" />
          Job board
        </h2>
        {jobsLoading ? (
          <p className="text-slate-500 text-sm">Loading opportunities…</p>
        ) : opportunities.length === 0 ? (
          <p className="text-slate-500 text-sm">No open opportunities right now. Check back later.</p>
        ) : (
          <ul className="space-y-4">
            {opportunities.map((job) => {
              const match = coachResult?.jobMatches.find((m) => m.opportunityId === job.id);
              return (
                <li
                  key={job.id}
                  className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 hover:border-cyan-500/30 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{job.title}</p>
                      <p className="text-slate-400 text-sm">{job.company}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
                        {job.location && <span>{job.location}</span>}
                        <span>{job.type.replace(/_/g, " ")}</span>
                        <span>Expires {job.expiresAt}</span>
                      </div>
                      {match && (
                        <p className="text-cyan-400 text-xs mt-2">Match: {(match.matchScore * 100).toFixed(0)}% — {match.reason}</p>
                      )}
                    </div>
                  </div>
                  {job.description && (
                    <p className="text-slate-400 text-sm mt-2 line-clamp-2">{job.description}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Resume builder linked to skills graph */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
          <FileText className="w-5 h-5 text-amber-400" />
          Resume builder
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Your competencies and verified credentials from the skills graph can be used to build a resume. Add them to applications from the Career Coach above.
        </p>
        <Link
          href="/progress/me"
          className="inline-flex items-center gap-2 text-neon-cyan hover:underline text-sm"
        >
          View my progress & competencies <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Mentorship matching */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Users className="w-5 h-5 text-purple-400" />
          Mentorship matching
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Connect with alumni mentors. Run the AI Career Coach above to get suggested mentors, or browse the alumni directory.
        </p>
        {coachResult?.suggestedMentors && coachResult.suggestedMentors.length > 0 ? (
          <ul className="space-y-3">
            {coachResult.suggestedMentors.map((m) => (
              <li key={m.alumniId} className="flex items-center justify-between rounded-lg bg-slate-800/40 p-3">
                <div>
                  <p className="font-medium text-white">{m.name}</p>
                  <p className="text-slate-400 text-sm">
                    {m.currentRole ?? "Alumni"} {m.currentEmployer ? `at ${m.currentEmployer}` : ""} · Class of {m.graduationYear}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">{m.reason}</p>
                </div>
                <Link
                  href={`/alumni?q=${encodeURIComponent(m.name)}`}
                  className="text-neon-cyan hover:underline text-sm"
                >
                  View directory
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link href="/alumni" className="inline-flex items-center gap-2 text-neon-cyan hover:underline text-sm">
            Browse alumni directory <ExternalLink className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
