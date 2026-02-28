"use client";

/**
 * Faculty Orchestrator: AI-powered course health and evidence-based redesign suggestions.
 * One-click "Apply Recommendation" persists suggestions to module dynamicContent.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  BookOpen,
  AlertTriangle,
  FileText,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { runOrchestrator, applyOrchestratorRecommendation } from "@/app/actions/faculty-orchestrator";
import type { Recommendation } from "@/lib/ai/faculty-orchestrator";

const ORCHESTRATOR_KEY = ["faculty-orchestrator"] as const;

export default function FacultyOrchestratorPage() {
  const queryClient = useQueryClient();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ORCHESTRATOR_KEY,
    queryFn: async () => {
      const result = await runOrchestrator();
      if (!result.ok) throw new Error(result.error);
      return result;
    },
  });

  const applyMutation = useMutation({
    mutationFn: (rec: Recommendation) => applyOrchestratorRecommendation(rec),
    onSuccess: (_, rec) => {
      setAppliedIds((prev) => new Set(prev).add(rec.id));
      queryClient.invalidateQueries({ queryKey: ORCHESTRATOR_KEY });
    },
  });

  const courseHealth = data?.courseHealth ?? [];
  const recommendations = data?.recommendations ?? [];
  const summary = data?.summary;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "redesign":
        return <FileText className="w-4 h-4 text-amber-400" />;
      case "dropout_risk":
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-neon-cyan" />;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/faculty/dashboard"
            className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
          >
            ← Faculty Dashboard
          </Link>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-neon-cyan" />
            Faculty Orchestrator
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-driven course health and evidence-based redesign suggestions
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {isLoading ? "Analyzing…" : "Refresh analysis"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm">
          {(error as Error).message}
        </div>
      )}

      {summary && (
        <div className="glass rounded-xl border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-neon-purple" />
            AI summary
          </h2>
          <p className="text-slate-200 text-sm leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Course health overview */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Course health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courseHealth.length === 0 && !isLoading && (
            <p className="text-slate-500 text-sm col-span-full">
              No courses found. Create a course to see health metrics.
            </p>
          )}
          {courseHealth.map((h) => (
            <div
              key={h.courseId}
              className="glass rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-white text-sm truncate">{h.courseTitle}</h3>
                <Link
                  href={`/courses/${h.courseId}`}
                  className="text-neon-cyan text-xs hover:underline shrink-0"
                >
                  Open
                </Link>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-slate-400">
                <li>{h.moduleCount} modules</li>
                <li>
                  <span className={h.frictionStudentCount > 0 ? "text-amber-400" : ""}>
                    {h.frictionStudentCount} students with friction (30d)
                  </span>
                </li>
                <li>
                  {h.pendingBriefsCount > 0 ? (
                    <span className="text-rose-400">{h.pendingBriefsCount} pending briefs</span>
                  ) : (
                    "No pending briefs"
                  )}
                </li>
                <li>
                  Avg mastery:{" "}
                  {h.avgMasteryScore != null
                    ? `${Math.round(h.avgMasteryScore * 100)}%`
                    : "—"}
                </li>
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations with Apply buttons */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recommendations</h2>
        {recommendations.length === 0 && !isLoading && (
          <p className="text-slate-500 text-sm">
            No recommendations right now. Run analysis after students engage with modules.
          </p>
        )}
        <ul className="space-y-4">
          {recommendations.map((rec) => {
            const applied = appliedIds.has(rec.id);
            return (
              <li
                key={rec.id}
                className="glass rounded-xl border border-white/5 p-4 flex flex-col sm:flex-row sm:items-start gap-4"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="rounded-lg bg-white/5 p-2 shrink-0">
                    {getTypeIcon(rec.type)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">{rec.title}</h3>
                    <p className="text-slate-400 text-sm mt-1">{rec.description}</p>
                    <p className="text-slate-500 text-xs mt-2">
                      {rec.courseTitle}
                      {rec.moduleTitle && ` · ${rec.moduleTitle}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {rec.moduleId && (
                    <Link
                      href={`/modules/${rec.moduleId}`}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 border border-white/20 hover:bg-white/15"
                    >
                      View module
                    </Link>
                  )}
                  {applied ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Applied
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => applyMutation.mutate(rec)}
                      disabled={applyMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-neon-cyan/20 px-3 py-1.5 text-xs font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
