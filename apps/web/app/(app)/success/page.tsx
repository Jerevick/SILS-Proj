"use client";

/**
 * Student Success Dashboard — personalized AI nudges, wellness check-in, progress insights, equity support.
 * Integrates with StudentSuccessAgent (LLM_Router), WellnessLogs, StudentPreferences, EquityMetrics.
 */

import { useState, useEffect } from "react";
import {
  Heart,
  Sparkles,
  TrendingUp,
  Shield,
  MessageCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { runStudentSuccess, logWellnessResponse, getSuccessDashboardData, upsertStudentPreference } from "@/app/actions/student-success";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { GoToLmsBanner } from "@/components/dashboard/go-to-lms-banner";

type WellnessLogItem = {
  id: string;
  nudgeType: string;
  message: string;
  response: string | null;
  createdAt: string;
};

export default function StudentSuccessPage() {
  const [data, setData] = useState<{
    recentWellnessLogs: WellnessLogItem[];
    preference: { preferredLanguage: string | null; lowBandwidthMode: boolean; accessibilitySettings: unknown } | null;
    modulesInProgress: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [nudge, setNudge] = useState<{
    nudgeType: string;
    message: string;
    suggestedAdaptations?: string[];
    ctaLabel?: string;
  } | null>(null);
  const [wellnessLogId, setWellnessLogId] = useState<string | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);

  const { data: statsData } = useDashboardStats("student");
  const stats = statsData?.stats ?? [];

  useEffect(() => {
    getSuccessDashboardData().then((res) => {
      if (res.ok) {
        setData({
          recentWellnessLogs: res.recentWellnessLogs,
          preference: res.preference,
          modulesInProgress: res.modulesInProgress,
        });
        setLowBandwidth(res.preference?.lowBandwidthMode ?? false);
      }
      setLoading(false);
    });
  }, []);

  const handleGetNudge = () => {
    setNudgeLoading(true);
    setNudge(null);
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    runStudentSuccess({
      context: {
        progressPercent: typeof stats[3]?.value === "number" ? stats[3].value : stats[3]?.value !== "—" ? Number(stats[3]?.value) : undefined,
        recentActivitySummary: data?.modulesInProgress
          ? `You have ${data.modulesInProgress} module(s) in progress.`
          : undefined,
        timeOfDay,
      },
    }).then((res) => {
      setNudgeLoading(false);
      if (res.ok) {
        setNudge(res.nudge);
        setWellnessLogId(res.wellnessLogId);
        setResponseText("");
        setData((prev) =>
          prev
            ? {
                ...prev,
                recentWellnessLogs: [
                  {
                    id: res.wellnessLogId,
                    nudgeType: res.nudge.nudgeType,
                    message: res.nudge.message,
                    response: null,
                    createdAt: new Date().toISOString(),
                  },
                  ...prev.recentWellnessLogs,
                ].slice(0, 5),
              }
            : prev
        );
      }
    });
  };

  const handleLogResponse = () => {
    if (!wellnessLogId || !responseText.trim()) return;
    setSubmittingResponse(true);
    logWellnessResponse(wellnessLogId, responseText.trim()).then(() => {
      setSubmittingResponse(false);
      setResponseText("");
      setWellnessLogId(null);
      getSuccessDashboardData().then((r) => r.ok && setData({
        recentWellnessLogs: r.recentWellnessLogs,
        preference: r.preference,
        modulesInProgress: r.modulesInProgress,
      }));
    });
  };

  const handleToggleLowBandwidth = () => {
    const next = !lowBandwidth;
    setLowBandwidth(next);
    upsertStudentPreference({ lowBandwidthMode: next }).then((res) => {
      if (!res.ok) setLowBandwidth(!next);
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <GoToLmsBanner />
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Heart className="w-7 h-7 text-rose-400/80" />
            Student Success
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Personalized nudges, wellness check-in, and inclusive support.
          </p>
        </div>

        {/* AI Nudge card */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
            <Sparkles className="w-4 h-4 text-neon-purple" />
            Today&apos;s nudge
          </h2>
          {nudge ? (
            <div className="space-y-3">
              <p className="text-slate-200 text-sm whitespace-pre-wrap">{nudge.message}</p>
              {nudge.suggestedAdaptations && nudge.suggestedAdaptations.length > 0 && (
                <div className="rounded-lg bg-neon-cyan/10 border border-neon-cyan/20 p-3">
                  <p className="text-xs font-medium text-neon-cyan mb-1">Suggestions for you</p>
                  <ul className="text-slate-300 text-sm list-disc list-inside space-y-0.5">
                    {nudge.suggestedAdaptations.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {nudge.ctaLabel && (
                <div className="flex flex-wrap gap-2 items-end">
                  <input
                    type="text"
                    placeholder="e.g. I'm doing okay"
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 w-48"
                  />
                  <button
                    type="button"
                    onClick={handleLogResponse}
                    disabled={submittingResponse || !responseText.trim()}
                    className="rounded-lg bg-neon-cyan/20 px-3 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/40 hover:bg-neon-cyan/30 disabled:opacity-50"
                  >
                    {submittingResponse ? "Saving…" : nudge.ctaLabel}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm mb-3">
              Get a short, supportive nudge — wellness, motivation, or time management.
            </p>
          )}
          <button
            type="button"
            onClick={handleGetNudge}
            disabled={nudgeLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 disabled:opacity-50"
          >
            {nudgeLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {nudgeLoading ? "Getting your nudge…" : nudge ? "Get another nudge" : "Get today's nudge"}
          </button>
        </div>

        {/* Wellness check-in & recent */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
            <MessageCircle className="w-4 h-4 text-rose-400/80" />
            Wellness check-in
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Your recent wellness nudges and responses are private and used only to support you.
          </p>
          {data?.recentWellnessLogs && data.recentWellnessLogs.length > 0 ? (
            <ul className="space-y-3">
              {data.recentWellnessLogs.map((log) => (
                <li key={log.id} className="rounded-lg bg-white/5 border border-white/5 p-3 text-sm">
                  <p className="text-slate-300">{log.message}</p>
                  {log.response && (
                    <p className="text-slate-500 mt-1 italic">You: {log.response}</p>
                  )}
                  <p className="text-slate-600 text-xs mt-1">
                    {new Date(log.createdAt).toLocaleDateString()} · {log.nudgeType.replace(/_/g, " ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm">No wellness logs yet. Use &quot;Get today&apos;s nudge&quot; above.</p>
          )}
        </div>

        {/* Progress insights */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
            <TrendingUp className="w-4 h-4 text-neon-cyan" />
            Progress at a glance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(stats.length ? stats : [
              { label: "Enrolled courses", value: "—" },
              { label: "Assignments due", value: "—" },
              { label: "Completed", value: "—" },
              { label: "Progress", value: "—" },
            ]).map((s, i) => (
              <div key={i} className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-slate-400 text-xs">{s.label}</p>
                <p className="text-white font-medium">{s.value}</p>
              </div>
            ))}
          </div>
          {data?.modulesInProgress != null && data.modulesInProgress > 0 && (
            <p className="text-slate-500 text-sm mt-3">
              You have <strong className="text-slate-300">{data.modulesInProgress}</strong> module(s) in progress. Keep going at your own pace.
            </p>
          )}
        </div>

        {/* Equity support & accessibility */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-3">
            <Shield className="w-4 h-4 text-amber-400/80" />
            Accessibility & preferences
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            Nudges can include gentle, personalized adaptations. Use low-bandwidth mode across the app for lighter content where available.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lowBandwidth}
              onChange={handleToggleLowBandwidth}
              className="rounded border-white/20 bg-white/5 text-neon-cyan focus:ring-neon-cyan/50"
            />
            <span className="text-slate-300 text-sm">Enable low-bandwidth mode</span>
          </label>
          <p className="text-slate-600 text-xs mt-2">
            When enabled, content pages can show simplified text and lighter media.
          </p>
        </div>
      </div>
    </>
  );
}
