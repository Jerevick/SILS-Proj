"use client";

/**
 * Phase 10: Full-screen XR lab viewer.
 * Loads scene from scene_config (A-Frame/WebXR), tracks interactions,
 * "End Session" → RecordXRSession, AI buttons → GenerateAIScenario.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { XR_LAB_DETAIL_QUERY_KEY, XR_LABS_QUERY_KEY } from "@/lib/xr-labs-query";
import type { XRLabDetail } from "@/app/api/xr/labs/[labId]/route";
import { RecordXRSession, GenerateAIScenario } from "@/app/actions/xr-lab-actions";
import { sceneConfigToHtml } from "@/components/xr/scene-from-config";
import { Sparkles, LogOut, TrendingDown, TrendingUp, Loader2 } from "lucide-react";

const AFRAME_CDN = "https://aframe.io/releases/1.4.2/aframe.min.js";

async function fetchLab(labId: string): Promise<XRLabDetail> {
  const res = await fetch(`/api/xr/labs/${labId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to load lab");
  }
  return res.json();
}

export default function XRLabViewerPage() {
  const params = useParams();
  const labId = typeof params?.labId === "string" ? params.labId : "";
  const queryClient = useQueryClient();
  const sessionStartedAt = useRef<string | null>(null);
  const [correctActions, setCorrectActions] = useState(0);
  const [errors, setErrors] = useState(0);
  const [sceneConfig, setSceneConfig] = useState<Record<string, unknown> | null>(null);
  const [aframeLoaded, setAframeLoaded] = useState(false);
  const sceneContainerRef = useRef<HTMLDivElement>(null);

  const { data: lab, isLoading, error } = useQuery({
    queryKey: XR_LAB_DETAIL_QUERY_KEY(labId),
    queryFn: () => fetchLab(labId),
    enabled: !!labId,
  });

  useEffect(() => {
    if (lab) {
      setSceneConfig(lab.sceneConfig ?? {});
    }
  }, [lab?.id]);

  useEffect(() => {
    if (!labId || aframeLoaded) return;
    const script = document.createElement("script");
    script.src = AFRAME_CDN;
    script.onload = () => setAframeLoaded(true);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [labId, aframeLoaded]);

  useEffect(() => {
    if (lab && !sessionStartedAt.current) {
      sessionStartedAt.current = new Date().toISOString();
    }
  }, [lab]);

  const recordSession = useMutation({
    mutationFn: async () => {
      const started = sessionStartedAt.current ?? new Date().toISOString();
      const ended = new Date().toISOString();
      const timeSpentSeconds = Math.round(
        (new Date(ended).getTime() - new Date(started).getTime()) / 1000
      );
      return RecordXRSession({
        labId,
        startedAt: started,
        endedAt: ended,
        interactionData: {
          correctActions,
          errors,
          timeSpentSeconds,
        },
        performanceMetrics: {
          correctCount: correctActions,
          errorCount: errors,
          timeSpentSeconds,
          completionRatio: errors === 0 ? Math.min(1, (correctActions + 1) / 5) : Math.max(0, 1 - errors * 0.2),
        },
      });
    },
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: XR_LABS_QUERY_KEY });
        window.location.href = "/xr/labs";
      }
    },
  });

  const generateScenario = useMutation({
    mutationFn: async (direction: "simpler" | "harder") => {
      const started = sessionStartedAt.current ?? new Date().toISOString();
      const timeSpentSeconds = Math.round(
        (new Date().getTime() - new Date(started).getTime()) / 1000
      );
      return GenerateAIScenario({
        labId,
        currentSceneConfig: sceneConfig ?? lab!.sceneConfig ?? {},
        performanceSoFar: { correctActions, errors, timeSpentSeconds },
        direction,
      });
    },
    onSuccess: (result) => {
      if (result.ok && result.sceneConfig) {
        setSceneConfig(result.sceneConfig);
      }
    },
  });

  const handleEndSession = useCallback(() => {
    recordSession.mutate();
  }, [recordSession]);

  const sceneHtml =
    sceneConfig !== null ? sceneConfigToHtml(sceneConfig) : "";

  if (!labId) {
    return (
      <div className="min-h-screen bg-space-950 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-slate-400">Missing lab ID</p>
        <Link href="/xr/labs" className="text-neon-cyan hover:underline">← Back to labs</Link>
      </div>
    );
  }

  if (isLoading || !lab) {
    return (
      <div className="min-h-screen bg-space-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-space-950 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-400">
          {error instanceof Error ? error.message : "Failed to load lab"}
        </p>
        <Link href="/xr/labs" className="text-neon-cyan hover:underline">
          ← Back to labs
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black z-[100]">
      {/* Full-screen A-Frame scene */}
      <div
        ref={sceneContainerRef}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      >
        {aframeLoaded && sceneHtml && (
          <div
            dangerouslySetInnerHTML={{
              __html: `
                <a-scene
                  embedded
                  loading-screen="enabled: false"
                  renderer="antialias: true; colorManagement: true"
                  vr-mode-ui="enabled: true"
                  device-orientation-permission-ui="enabled: false"
                >
                  <a-entity position="0 0 0" rotation="0 0 0" id="rig" movement-controls>
                    <a-entity camera position="0 1.6 0" look-controls wasd-controls="acceleration: 20">
                    </a-entity>
                  </a-entity>
                  ${sceneHtml}
                </a-scene>
              `,
            }}
          />
        )}
      </div>

      {/* Overlay: back link, session stats, End Session, AI controls */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 bg-gradient-to-b from-black/80 to-transparent"
        style={{ pointerEvents: "none" }}
      >
        <div className="flex items-center gap-3" style={{ pointerEvents: "auto" }}>
          <Link
            href="/xr/labs"
            className="text-slate-300 hover:text-white text-sm flex items-center gap-1"
          >
            ← Labs
          </Link>
          <span className="text-slate-500 text-sm">|</span>
          <span className="text-slate-300 text-sm font-medium truncate max-w-[180px]">
            {lab.title}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>✓ {correctActions}</span>
          <span>✗ {errors}</span>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-center gap-2 p-4 bg-gradient-to-t from-black/90 to-transparent"
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex flex-wrap items-center justify-center gap-2"
          style={{ pointerEvents: "auto" }}
        >
          <button
            type="button"
            onClick={() => setCorrectActions((n) => n + 1)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm hover:bg-emerald-500/30"
          >
            + Correct
          </button>
          <button
            type="button"
            onClick={() => setErrors((n) => n + 1)}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 text-sm hover:bg-red-500/30"
          >
            + Error
          </button>
          <span className="w-px h-6 bg-white/20" />
          <button
            type="button"
            onClick={() => generateScenario.mutate("simpler")}
            disabled={generateScenario.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-sm hover:bg-amber-500/30 disabled:opacity-50"
          >
            {generateScenario.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            Make it simpler
          </button>
          <button
            type="button"
            onClick={() => generateScenario.mutate("harder")}
            disabled={generateScenario.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/40 text-sm hover:bg-violet-500/30 disabled:opacity-50"
          >
            {generateScenario.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
            Increase difficulty
          </button>
          <span className="w-px h-6 bg-white/20" />
          <button
            type="button"
            onClick={handleEndSession}
            disabled={recordSession.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50 font-medium"
          >
            {recordSession.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            End Session
          </button>
        </div>
      </div>

      {/* AI badge */}
      <div
        className="absolute top-14 right-4 z-10 flex items-center gap-1.5 text-xs text-slate-500"
        style={{ pointerEvents: "auto" }}
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
        AI can adapt this scene to your level
      </div>
    </div>
  );
}
