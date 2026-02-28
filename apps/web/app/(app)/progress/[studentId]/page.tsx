"use client";

/**
 * N-of-1 mastery dashboard: real-time progress per module with visual pathway
 * and predicted gaps. Lecturer or student (self) only.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { BookOpen, AlertTriangle, Target } from "lucide-react";
import type { ProgressPayload } from "@/app/api/progress/[studentId]/route";

const PROGRESS_QUERY_KEY = ["progress"] as const;

async function fetchProgress(studentId: string): Promise<ProgressPayload> {
  const res = await fetch(`/api/progress/${studentId}`);
  if (!res.ok) throw new Error("Failed to fetch progress");
  return res.json();
}

export default function ProgressDashboardPage() {
  const params = useParams();
  const studentId = params.studentId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: [...PROGRESS_QUERY_KEY, studentId],
    queryFn: () => fetchProgress(studentId),
    enabled: !!studentId,
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-400">
        {isLoading ? "Loading progress…" : "No progress data."}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <Link href="/student/dashboard" className="text-neon-cyan hover:underline text-sm">
          ← Back
        </Link>
        <p className="text-amber-400">{(error as Error).message}</p>
      </div>
    );
  }

  const { modules, predictedGaps } = data;
  const chartData = modules.map((m) => ({
    name: m.moduleTitle.length > 20 ? m.moduleTitle.slice(0, 20) + "…" : m.moduleTitle,
    fullName: m.moduleTitle,
    mastery: Math.round((m.masteryScore ?? 0) * 100),
    courseTitle: m.courseTitle,
    isGap: predictedGaps.includes(m.moduleId),
  }));

  const avgMastery =
    modules.length > 0
      ? modules.reduce((acc, m) => acc + (m.masteryScore ?? 0) * 100, 0) / modules.length
      : 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <Link
          href="/student/dashboard"
          className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
        >
          ← Back to dashboard
        </Link>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Target className="w-8 h-8 text-neon-cyan" />
          N-of-1 Progress
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Mastery by module · Predicted gaps highlighted
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl border border-white/5 p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wider">Modules with progress</p>
          <p className="text-2xl font-semibold text-white mt-1">{modules.length}</p>
        </div>
        <div className="glass rounded-xl border border-white/5 p-4">
          <p className="text-slate-500 text-xs uppercase tracking-wider">Average mastery</p>
          <p className="text-2xl font-semibold text-neon-cyan mt-1">
            {Math.round(avgMastery)}%
          </p>
        </div>
      </div>

      {/* Recharts: mastery per module */}
      {chartData.length > 0 && (
        <div className="glass rounded-xl border border-white/5 p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Mastery by module
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
              >
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  width={75}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="rounded-lg bg-space-900 border border-white/10 p-3 shadow-xl">
                        <p className="font-medium text-white text-sm">{p.fullName}</p>
                        <p className="text-slate-400 text-xs mt-1">{p.courseTitle}</p>
                        <p className="text-neon-cyan text-sm mt-1">Mastery: {p.mastery}%</p>
                        {p.isGap && (
                          <p className="text-amber-400 text-xs mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Predicted gap
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="mastery" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isGap ? "#f59e0b" : "rgba(0, 245, 255, 0.6)"}
                      stroke={entry.isGap ? "#f59e0b" : "rgba(0, 245, 255, 0.8)"}
                    />
                  ))}
                </Bar>
                <Legend
                  formatter={() => (
                    <span className="text-slate-400 text-xs">
                      Cyan = on track · Amber = predicted gap
                    </span>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Predicted gaps */}
      {predictedGaps.length > 0 && (
        <div className="glass rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Predicted gaps
          </h2>
          <p className="text-slate-400 text-sm mb-3">
            Modules where mastery is low or friction signals are high. Consider review or AI support.
          </p>
          <ul className="space-y-2">
            {modules
              .filter((m) => predictedGaps.includes(m.moduleId))
              .map((m) => (
                <li key={m.moduleId} className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 text-sm">{m.moduleTitle}</span>
                  <Link
                    href={`/modules/${m.moduleId}`}
                    className="text-neon-cyan text-xs hover:underline"
                  >
                    Open module
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}

      {modules.length === 0 && (
        <div className="glass rounded-xl border border-white/5 p-6 text-center text-slate-500 text-sm">
          No module progress yet. Progress is recorded as you work through course modules
          and when AI branching or interventions run.
        </div>
      )}
    </div>
  );
}
