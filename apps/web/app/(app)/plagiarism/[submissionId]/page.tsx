"use client";

/**
 * Phase 22: Plagiarism & Originality Report Viewer.
 * Side-by-side submission text with highlighted matches and match breakdown.
 * Scoped: only assigned lecturers (or ADMIN/OWNER) can view (enforced by API).
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ArrowLeft, AlertTriangle } from "lucide-react";
import type { PlagiarismReportApiPayload } from "@/app/api/plagiarism/submission/[submissionId]/route";

const REPORT_QUERY_KEY = ["plagiarism-report"] as const;

async function fetchReport(submissionId: string): Promise<PlagiarismReportApiPayload> {
  const res = await fetch(`/api/plagiarism/submission/${submissionId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load report");
  }
  return res.json();
}

/** Build highlighted spans for submission content from detailedMatches with startOffset/endOffset. */
function buildHighlightRanges(
  matches: PlagiarismReportApiPayload["detailedMatches"]
): Array<{ start: number; end: number; similarityPct: number }> {
  const ranges: Array<{ start: number; end: number; similarityPct: number }> = [];
  for (const m of matches) {
    if (typeof m.startOffset === "number" && typeof m.endOffset === "number" && m.endOffset > m.startOffset) {
      ranges.push({
        start: m.startOffset,
        end: m.endOffset,
        similarityPct: m.similarityPct,
      });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** Render content with optional highlight spans (merge overlapping). */
function renderContentWithHighlights(
  content: string,
  ranges: Array<{ start: number; end: number; similarityPct: number }>
) {
  if (ranges.length === 0) {
    return <span className="text-slate-200">{content}</span>;
  }
  const merged: Array<{ start: number; end: number; pct: number }> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
      last.pct = Math.max(last.pct, r.similarityPct);
    } else {
      merged.push({ start: r.start, end: r.end, pct: r.similarityPct });
    }
  }
  const parts: React.ReactNode[] = [];
  let idx = 0;
  for (const r of merged) {
    if (r.start > idx) {
      parts.push(
        <span key={`t-${idx}`} className="text-slate-200">
          {content.slice(idx, r.start)}
        </span>
      );
    }
    parts.push(
      <mark
        key={`h-${r.start}`}
        className="bg-amber-500/40 text-amber-100 rounded px-0.5"
        title={`${r.pct}% similarity`}
      >
        {content.slice(r.start, r.end)}
      </mark>
    );
    idx = r.end;
  }
  if (idx < content.length) {
    parts.push(
      <span key="tail" className="text-slate-200">
        {content.slice(idx)}
      </span>
    );
  }
  return <>{parts}</>;
}

export default function PlagiarismReportPage() {
  const params = useParams();
  const submissionId = params.submissionId as string;

  const { data: report, isLoading, error } = useQuery({
    queryKey: [...REPORT_QUERY_KEY, submissionId],
    queryFn: () => fetchReport(submissionId),
    enabled: !!submissionId,
  });

  const content = report?.submissionContent ?? "";
  const highlightRanges = report ? buildHighlightRanges(report.detailedMatches) : [];

  if (isLoading || !report) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        {isLoading ? "Loading originality report…" : "Report not found."}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Link
          href={`/grading/speedgrader/${submissionId}`}
          className="text-neon-cyan hover:underline text-sm inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to SpeedGrader
        </Link>
        <p className="text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {(error as Error).message}
        </p>
      </div>
    );
  }

  const scoreLabel =
    report.overallScore >= 50
      ? "High similarity"
      : report.overallScore >= 25
        ? "Medium similarity"
        : report.overallScore > 0
          ? "Low similarity"
          : "Original";
  const scoreColor =
    report.overallScore >= 50
      ? "text-red-400"
      : report.overallScore >= 25
        ? "text-amber-400"
        : report.overallScore > 0
          ? "text-yellow-400"
          : "text-emerald-400";

  return (
    <div className="space-y-6 p-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href={`/grading/speedgrader/${submissionId}`}
            className="text-slate-400 hover:text-white text-sm mb-1 inline-block flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back to SpeedGrader
          </Link>
          <h1 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            Originality Report
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Checked at {new Date(report.checkedAt).toLocaleString()} · Provider: {report.provider}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Overall similarity</p>
            <p className={`text-2xl font-bold ${scoreColor}`}>
              {Math.round(report.overallScore)}%
            </p>
            <p className={`text-sm ${scoreColor}`}>{scoreLabel}</p>
          </div>
          {report.reportUrl && (
            <a
              href={report.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-cyan hover:underline text-sm"
            >
              Open full report →
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Submission content with highlights */}
        <div className="rounded-xl glass border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-slate-300 font-medium">
            Submission text
          </div>
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {content ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {renderContentWithHighlights(content, highlightRanges)}
                </pre>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No text content in submission.</p>
            )}
          </div>
        </div>

        {/* Right: Match breakdown */}
        <div className="rounded-xl glass border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-slate-300 font-medium">
            Match breakdown
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {report.detailedMatches.length === 0 ? (
              <p className="text-slate-500 text-sm">No detailed matches reported.</p>
            ) : (
              <ul className="space-y-4">
                {report.detailedMatches.map((match, i) => (
                  <li
                    key={i}
                    className="border border-white/10 rounded-lg p-3 bg-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-200 font-medium text-sm">{match.source}</span>
                      <span
                        className={
                          match.similarityPct >= 50
                            ? "text-red-400"
                            : match.similarityPct >= 25
                              ? "text-amber-400"
                              : "text-slate-400"
                        }
                      >
                        {Math.round(match.similarityPct)}%
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap border-l-2 border-amber-500/50 pl-3">
                      {match.excerpt}
                    </p>
                    {match.sourceUrl && (
                      <a
                        href={match.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan hover:underline text-xs"
                      >
                        View source →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
