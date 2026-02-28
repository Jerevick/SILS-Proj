"use client";

/**
 * Phase 9: Interactive skills graph — competency backbone with vector-powered similarity search.
 * Recharts visualisation + job mapping from PGVector search.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import Link from "next/link";
import { COMPETENCIES_QUERY_KEY } from "@/lib/query-keys";

const JOB_QUERIES = [
  "Data analyst",
  "Software engineer",
  "Project manager",
  "UX designer",
  "Machine learning engineer",
];

async function fetchCompetencies(programmeId?: string): Promise<{
  competencies: Array<{
    id: string;
    code: string;
    title: string;
    description: string | null;
    credits: number;
    programmeId: string;
    programme?: { id: string; name: string; code: string };
  }>;
}> {
  const url = programmeId
    ? `/api/competencies?programmeId=${encodeURIComponent(programmeId)}`
    : "/api/competencies";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch competencies");
  return res.json();
}

async function searchCompetencies(query: string, studentId?: string): Promise<{
  results: Array<{
    id: string;
    competencyId: string;
    masteryLevel: number;
    similarity: number;
    competency: { code: string; title: string; programme: string | null } | null;
  }>;
}> {
  const res = await fetch("/api/competencies/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query.trim(),
      studentId: studentId || undefined,
      limit: 15,
      minMastery: 0,
    }),
  });
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return data;
}

export default function SkillsGraphPage() {
  const queryClient = useQueryClient();
  const [programmeFilter, setProgrammeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      competencyId: string;
      masteryLevel: number;
      similarity: number;
      competency: { code: string; title: string; programme: string | null } | null;
    }>
  >([]);
  const [jobMappingQuery, setJobMappingQuery] = useState(JOB_QUERIES[0]);
  const [jobResults, setJobResults] = useState<typeof searchResults>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: [...COMPETENCIES_QUERY_KEY, programmeFilter || "all"],
    queryFn: () => fetchCompetencies(programmeFilter || undefined),
  });

  const searchMutation = useMutation({
    mutationFn: (q: string) => searchCompetencies(q),
    onSuccess: (data) => setSearchResults(data.results ?? []),
  });

  const jobMappingMutation = useMutation({
    mutationFn: (q: string) => searchCompetencies(q),
    onSuccess: (data) => setJobResults(data.results ?? []),
  });

  const competencies = data?.competencies ?? [];
  const chartData = competencies.slice(0, 12).map((c) => ({
    name: c.code.length > 10 ? c.code.slice(0, 10) + "…" : c.code,
    fullName: c.title,
    credits: c.credits,
    count: 1,
  }));

  const programmeCounts = competencies.reduce<Record<string, number>>((acc, c) => {
    const prog = c.programme?.name ?? "Other";
    acc[prog] = (acc[prog] ?? 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(programmeCounts).map(([name, value]) => ({ name, value }));

  const COLORS = ["#00f5ff", "#a855f7", "#ec4899", "#22c55e", "#eab308"];

  return (
    <div className="min-h-screen bg-[var(--space-black)] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-1">
            Competency Graph
          </h1>
          <p className="text-slate-400 text-sm">
            Lifelong learning backbone — skills, programmes, and AI-powered job mapping.
          </p>
        </div>

        {/* Vector similarity search */}
        <section className="glass rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            Similarity search (PGVector)
          </h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search competencies by description or role…"
              className="flex-1 min-w-[200px] rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-slate-500 focus:border-neon-cyan/50 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchMutation.mutate(searchQuery);
              }}
            />
            <button
              type="button"
              onClick={() => searchMutation.mutate(searchQuery)}
              disabled={searchMutation.isPending || !searchQuery.trim()}
              className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
            >
              {searchMutation.isPending ? "Searching…" : "Search"}
            </button>
          </div>
          {searchResults.length > 0 && (
            <ul className="mt-4 space-y-2">
              {searchResults.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 border border-white/5"
                >
                  <span className="text-slate-200">
                    {r.competency?.title ?? r.competencyId}
                  </span>
                  <span className="text-neon-cyan text-sm">
                    {(r.similarity * 100).toFixed(0)}% match · mastery {(r.masteryLevel * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Job mapping */}
        <section className="glass rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            AI-powered job mapping
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Relevant competencies for common roles (vector similarity).
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {JOB_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setJobMappingQuery(q);
                  jobMappingMutation.mutate(q);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm border transition-colors ${
                  jobMappingQuery === q
                    ? "bg-neon-purple/20 border-neon-purple/50 text-white"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          {jobMappingMutation.isPending && (
            <p className="text-slate-500 text-sm">Loading job mapping…</p>
          )}
          {jobResults.length > 0 && !jobMappingMutation.isPending && (
            <ul className="space-y-2">
              {jobResults.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 border border-white/5"
                >
                  <span className="text-slate-200">{r.competency?.title}</span>
                  <span className="text-neon-cyan text-sm">
                    {(r.similarity * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Programme filter */}
        <div className="flex gap-2 items-center">
          <label className="text-slate-400 text-sm">Programme (optional):</label>
          <input
            type="text"
            placeholder="Programme ID"
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-white text-sm w-48"
            value={programmeFilter}
            onChange={(e) => setProgrammeFilter(e.target.value)}
          />
        </div>

        {/* Charts */}
        {error && (
          <p className="text-amber-400">Failed to load competencies. Try again.</p>
        )}
        {isLoading && <p className="text-slate-400">Loading competencies…</p>}

        {competencies.length > 0 && (
          <>
            <section className="glass rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Competencies by programme
              </h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "rgba(3,0,20,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                      labelFormatter={(_, payload) => payload[0]?.payload?.fullName}
                    />
                    <Bar dataKey="credits" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {pieData.length > 0 && (
              <section className="glass rounded-xl border border-white/10 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Distribution by programme
                </h2>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name} (${value})`}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip
                        contentStyle={{ background: "rgba(3,0,20,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </>
        )}

        <p className="text-slate-500 text-sm">
          <Link href="/programmes" className="text-neon-cyan hover:underline">
            Programmes
          </Link>
          {" · "}
          <Link href="/progress/me" className="text-neon-cyan hover:underline">
            My progress
          </Link>
        </p>
      </div>
    </div>
  );
}
