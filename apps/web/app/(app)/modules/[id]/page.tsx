"use client";

/**
 * LMS Module view: dynamic content, adaptive pathways, and real-time AI branching.
 * StudentCoach + DynamicModuleBrancher provide alternative content and micro-scaffolds
 * when friction is detected or requested.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Sparkles, BookOpen, GitBranch, ChevronRight, FileText, Wifi } from "lucide-react";
import { runDynamicBrancher } from "@/app/actions/dynamic-module-brancher";
import { autoRemediateContent } from "@/app/actions/auto-remediate-content";
import type { ModuleDetailPayload } from "@/app/api/modules/[id]/route";

const MODULE_QUERY_KEY = ["module-detail"] as const;

type ContentView = "original" | "simplified" | "lowBandwidth";
type Remediated = { altText: string; simplified: string; lowBandwidthText: string; voiceFallbackSummary?: string };

async function fetchModule(id: string): Promise<ModuleDetailPayload> {
  const res = await fetch(`/api/modules/${id}`);
  if (!res.ok) throw new Error(res.status === 404 ? "Module not found" : "Failed to fetch module");
  return res.json();
}

export default function ModuleViewPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const id = params.id as string;

  const { data: moduleData, isLoading, error } = useQuery({
    queryKey: [...MODULE_QUERY_KEY, id],
    queryFn: () => fetchModule(id),
    enabled: !!id,
  });

  const [branchContent, setBranchContent] = useState<string | null>(null);
  const [pathwayStep, setPathwayStep] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [contentView, setContentView] = useState<ContentView>("original");
  const [remediated, setRemediated] = useState<Remediated | null>(null);
  const [remediateLoading, setRemediateLoading] = useState(false);
  useEffect(() => {
    if (moduleData?.myProgress?.masteryScore != null)
      setProgress(Math.round(moduleData.myProgress.masteryScore * 100));
  }, [moduleData?.myProgress?.masteryScore]);

  useEffect(() => {
    if (!id || !moduleData) return;
    const dyn = moduleData.dynamicContent as { remediated?: Remediated } | null;
    if (dyn?.remediated && typeof dyn.remediated === "object") {
      const r = dyn.remediated;
      setRemediated({
        altText: typeof r.altText === "string" ? r.altText : "",
        simplified: typeof r.simplified === "string" ? r.simplified : "",
        lowBandwidthText: typeof r.lowBandwidthText === "string" ? r.lowBandwidthText : "",
        voiceFallbackSummary: typeof r.voiceFallbackSummary === "string" ? r.voiceFallbackSummary : undefined,
      });
    }
  }, [id, moduleData]);

  const runRemediate = () => {
    setRemediateLoading(true);
    autoRemediateContent(id)
      .then((res) => {
        if (res.ok) {
          setRemediated({
            altText: res.altText,
            simplified: res.simplified,
            lowBandwidthText: res.lowBandwidthText,
            voiceFallbackSummary: res.voiceFallbackSummary,
          });
          setContentView("simplified");
          queryClient.invalidateQueries({ queryKey: [...MODULE_QUERY_KEY, id] });
        }
      })
      .finally(() => setRemediateLoading(false));
  };

  const branchMutation = useMutation({
    mutationFn: () =>
      runDynamicBrancher({
        studentId: userId ?? "",
        moduleId: id,
        courseId: moduleData?.courseId ?? "",
        currentProgress: progress,
        frictionSignals: [
          { signalType: "DWELL_TIME", payload: { durationSeconds: 120 } },
        ],
        moduleTitle: moduleData?.title,
        moduleContentSummary:
          typeof moduleData?.contentJson === "object"
            ? JSON.stringify(moduleData.contentJson).slice(0, 300)
            : undefined,
      }),
    onSuccess: (result) => {
      if (result.ok && result.alternativeContent) {
        setBranchContent(result.alternativeContent);
        if (result.pathwayStep != null) setPathwayStep(result.pathwayStep);
        queryClient.invalidateQueries({ queryKey: [...MODULE_QUERY_KEY, id] });
      }
    },
  });

  if (isLoading || !moduleData) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-slate-400">
        {isLoading ? "Loading module…" : "Module not found."}
      </div>
    );
  }

  if (error) {
    const is404 = (error as Error).message === "Module not found";
    return (
      <div className="space-y-4 p-4">
        <Link href="/courses" className="text-neon-cyan hover:underline text-sm">
          ← Back to courses
        </Link>
        {is404 && (
          <p className="text-slate-400 text-sm">
            This may be a programme module.{" "}
            <Link href={`/modules/${id}/syllabus`} className="text-neon-cyan hover:underline">
              Open syllabus
            </Link>
          </p>
        )}
        <p className="text-amber-400">
          {is404 ? "Module not found." : "Failed to load module."}
        </p>
      </div>
    );
  }

  const pathways = (moduleData.adaptivePathways as { condition?: string; path?: string }[] | null) ?? [];
  const dynamicContent = moduleData.dynamicContent as Record<string, unknown> | null;
  const appliedRecs = dynamicContent?.appliedRecommendations as { title?: string; suggestion?: string }[] | undefined;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <Link
          href={`/courses/${moduleData.courseId}`}
          className="text-slate-400 hover:text-white text-sm mb-2 inline-block"
        >
          ← Back to {moduleData.courseTitle}
        </Link>
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-neon-cyan/80" />
          {moduleData.title}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {moduleData.courseTitle} · {moduleData.contentType ?? "Content"} · {moduleData._count.assignments} assignment(s)
        </p>
        {moduleData.myProgress?.masteryScore != null && (
          <p className="text-slate-500 text-xs mt-1">
            Your mastery: {Math.round((moduleData.myProgress.masteryScore ?? 0) * 100)}%
          </p>
        )}
      </div>

      {/* Main content */}
      <div className="glass rounded-xl border border-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Content</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runRemediate}
              disabled={remediateLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              {remediateLoading ? "Generating…" : "Simplify this content"}
            </button>
            {remediated && (
              <>
                <button
                  type="button"
                  onClick={() => setContentView("original")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    contentView === "original"
                      ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
                      : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-300"
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setContentView("simplified")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    contentView === "simplified"
                      ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
                      : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-300"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Simplified
                </button>
                <button
                  type="button"
                  onClick={() => setContentView("lowBandwidth")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border ${
                    contentView === "lowBandwidth"
                      ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40"
                      : "bg-white/5 text-slate-400 border-white/10 hover:text-slate-300"
                  }`}
                >
                  <Wifi className="w-3.5 h-3.5" />
                  Low-bandwidth
                </button>
              </>
            )}
          </div>
        </div>
        {contentView === "simplified" && remediated?.simplified ? (
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap">
            {remediated.simplified}
          </div>
        ) : contentView === "lowBandwidth" && remediated?.lowBandwidthText ? (
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap">
            {remediated.lowBandwidthText}
          </div>
        ) : moduleData.contentJson ? (
          <div className="prose prose-invert prose-sm max-w-none text-slate-200">
            {typeof moduleData.contentJson === "string" ? (
              <p className="whitespace-pre-wrap">{moduleData.contentJson}</p>
            ) : (
              <pre className="bg-white/5 rounded-lg p-4 overflow-x-auto text-sm">
                {JSON.stringify(moduleData.contentJson, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No content yet. Your instructor may add material here.</p>
        )}
      </div>

      {/* AI-generated alternative / micro-scaffold (from DynamicModuleBrancher) */}
      {branchContent && (
        <div className="rounded-xl border border-neon-purple/30 bg-neon-purple/5 p-5">
          <div className="flex items-center gap-2 text-neon-purple font-medium text-sm mb-2">
            <Sparkles className="w-4 h-4" />
            AI suggestion for you
          </div>
          <p className="text-slate-200 text-sm whitespace-pre-wrap">{branchContent}</p>
        </div>
      )}

      {/* Applied recommendations (from Faculty Orchestrator) */}
      {appliedRecs && appliedRecs.length > 0 && (
        <div className="glass rounded-xl border border-white/5 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Instructor recommendations applied</h3>
          <ul className="space-y-2">
            {appliedRecs.map((r, i) => (
              <li key={i} className="text-slate-400 text-sm">
                <span className="text-slate-300">{r.title ?? "Suggestion"}</span>
                {r.suggestion && <span className="block mt-1 text-slate-500">{r.suggestion}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Adaptive pathways */}
      {pathways.length > 0 && (
        <div className="glass rounded-xl border border-white/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-3">
            <GitBranch className="w-4 h-4" />
            Adaptive pathways
          </h3>
          <ul className="space-y-2">
            {pathways.map((p, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-lg p-2 text-sm ${
                  pathwayStep === i ? "bg-neon-cyan/10 border border-neon-cyan/30" : "bg-white/5"
                }`}
              >
                {pathwayStep === i && <ChevronRight className="w-4 h-4 text-neon-cyan" />}
                <span className="text-slate-500">If:</span>
                <span className="text-slate-200">{p.condition ?? "—"}</span>
                <span className="text-slate-500">→</span>
                <span className="text-slate-300">{p.path ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Trigger branching: get AI help */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => branchMutation.mutate()}
          disabled={branchMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {branchMutation.isPending ? "Getting AI suggestion…" : "I need a different explanation"}
        </button>
        <Link
          href={`/modules/${id}/syllabus`}
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 border border-white/20 hover:bg-white/15"
        >
          View syllabus (programme)
        </Link>
      </div>
    </div>
  );
}
