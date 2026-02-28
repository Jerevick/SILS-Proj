"use client";

/**
 * Phase 12: Modern SpeedGrader — side-by-side submission viewer, interactive rubric,
 * AI Grade Now, inline feedback, and finalize grade with real-time SIS sync.
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Sparkles, CheckCircle, FileText, Video, Image, Send } from "lucide-react";
import { runAIGrading, finalizeGrade, updateSubmissionDraft } from "@/app/actions/grading-actions";
import type { SpeedGraderSubmissionPayload } from "@/app/api/submissions/[submissionId]/route";
import type { AIGradingCriterionResult } from "@/lib/ai/ai-grading-types";

const SUBMISSION_QUERY_KEY = ["submission"] as const;

async function fetchSubmission(id: string): Promise<SpeedGraderSubmissionPayload> {
  const res = await fetch(`/api/submissions/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch submission");
  }
  return res.json();
}

type CriterionRow = {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  points: number;
  feedback: string;
};

export default function SpeedGraderPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const submissionId = params.submissionId as string;

  const { data: submission, isLoading, error } = useQuery({
    queryKey: [...SUBMISSION_QUERY_KEY, submissionId],
    queryFn: () => fetchSubmission(submissionId),
    enabled: !!submissionId,
  });

  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [criterionScores, setCriterionScores] = useState<Record<string, { points: number; feedback: string }>>({});

  useEffect(() => {
    if (!submission) return;
    setGrade(submission.grade ?? "");
    setFeedback(submission.feedback ?? "");
    const rubric = submission.assignment.rubric ?? submission.rubrics?.[0];
    const criteria = rubric?.criteria;
    const arr = Array.isArray(criteria) ? criteria : [];
    const aiCriteria = (submission.aiGrade as { criteria?: AIGradingCriterionResult[] })?.criteria ?? [];
    const next: Record<string, { points: number; feedback: string }> = {};
    arr.forEach((c: { id?: string; name?: string }) => {
      const id = String(c.id ?? c.name ?? "");
      const ai = aiCriteria.find((a) => a.criterionId === id);
      next[id] = {
        points: ai?.points ?? 0,
        feedback: ai?.feedback ?? "",
      };
    });
    if (Object.keys(next).length) setCriterionScores(next);
  }, [submission?.id, submission?.grade, submission?.feedback, submission?.aiGrade, submission?.assignment?.rubric, submission?.rubrics]);

  const rubricCriteria: CriterionRow[] = useMemo(() => {
    if (!submission) return [];
    const rubric = submission.assignment.rubric ?? submission.rubrics?.[0];
    const criteria = rubric?.criteria;
    const arr = Array.isArray(criteria) ? criteria : [];
    return arr.map((c: { id?: string; name?: string; description?: string; maxPoints?: number }) => {
      const id = String(c.id ?? c.name ?? "");
      const scores = criterionScores[id];
      return {
        id,
        name: c.name ?? "Criterion",
        description: c.description,
        maxPoints: typeof c.maxPoints === "number" ? c.maxPoints : 10,
        points: scores?.points ?? 0,
        feedback: scores?.feedback ?? "",
      };
    });
  }, [submission, criterionScores]);

  const aiSuggestedComments = useMemo(() => {
    const ai = submission?.aiGrade as { suggestedComments?: string[] } | null;
    return Array.isArray(ai?.suggestedComments) ? ai.suggestedComments : [];
  }, [submission?.aiGrade]);

  const assignmentId = submission?.assignment?.id;
  const courseId = submission?.assignment?.module?.courseId;
  const rubricId = submission?.assignment?.rubric?.id ?? submission?.rubrics?.[0]?.id;
  const backUrl = courseId && assignmentId
    ? `/courses/${courseId}/assignments/${assignmentId}/submissions`
    : "/courses";

  const aiGradeMutation = useMutation({
    mutationFn: () => runAIGrading(submissionId, rubricId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SUBMISSION_QUERY_KEY, submissionId] });
    },
  });

  const draftMutation = useMutation({
    mutationFn: () =>
      updateSubmissionDraft(submissionId, {
        grade: grade || null,
        feedback: feedback || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SUBMISSION_QUERY_KEY, submissionId] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () =>
      finalizeGrade(submissionId, {
        grade: grade || null,
        feedback: feedback || null,
      }),
    onSuccess: (result) => {
      if (result?.ok) {
        queryClient.invalidateQueries({ queryKey: [...SUBMISSION_QUERY_KEY, submissionId] });
        router.push(backUrl);
      }
    },
  });

  const handleFinalize = () => finalizeMutation.mutate();

  if (isLoading || !submission) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        {isLoading ? "Loading SpeedGrader…" : "Submission not found."}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Link href={backUrl} className="text-neon-cyan hover:underline text-sm">
          ← Back to submissions
        </Link>
        <p className="text-amber-400">{(error as Error).message}</p>
      </div>
    );
  }

  const attachments = (submission.attachmentsJson as { type?: string; url?: string; name?: string }[]) ?? [];
  const isFinalized = !!submission.gradeFinalizedAt;
  const hasAiGrade = submission.aiGrade != null;

  return (
    <div className="space-y-4 p-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link href={backUrl} className="text-slate-400 hover:text-white text-sm mb-1 inline-block">
            ← Back to submissions
          </Link>
          <h1 className="font-display text-xl font-bold text-white">
            SpeedGrader · {submission.assignment.title}
          </h1>
          <p className="text-slate-500 text-sm">
            {submission.assignment.module.course.title} · Student: {submission.studentId}
            {isFinalized && (
              <span className="ml-2 text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Finalized
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Submission viewer */}
        <div className="rounded-xl glass border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 text-slate-300 font-medium">
            <FileText className="w-4 h-4" />
            Submission
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {submission.content ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <pre className="whitespace-pre-wrap text-slate-200 bg-white/5 rounded-lg p-4 text-sm">
                  {submission.content}
                </pre>
              </div>
            ) : (
              <p className="text-slate-500 text-sm">No text content.</p>
            )}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-slate-400 text-sm font-medium">Attachments</p>
                <ul className="space-y-2">
                  {attachments.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300 text-sm">
                      {a.type === "media" || (a.url && /\.(mp4|webm|mov)$/i.test(a.url)) ? (
                        <Video className="w-4 h-4 text-neon-cyan" />
                      ) : /\.(jpg|jpeg|png|gif|webp)$/i.test(a.name ?? a.url ?? "") ? (
                        <Image className="w-4 h-4 text-neon-cyan" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-500" />
                      )}
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neon-cyan hover:underline truncate"
                      >
                        {a.name ?? a.url ?? "Attachment"}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right: Rubric + grade + AI + actions */}
        <div className="space-y-4">
          <div className="rounded-xl glass border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-slate-300 font-medium">Rubric & Grade</span>
              {rubricId && (
                <button
                  type="button"
                  onClick={() => aiGradeMutation.mutate()}
                  disabled={aiGradeMutation.isPending || isFinalized}
                  className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-3 py-1.5 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiGradeMutation.isPending ? "Grading…" : "AI Grade Now"}
                </button>
              )}
            </div>
            <div className="p-4 space-y-4">
              {rubricCriteria.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-white/10">
                        <th className="py-2 pr-2">Criterion</th>
                        <th className="py-2 w-20 text-center">Points</th>
                        <th className="py-2">Feedback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubricCriteria.map((row) => (
                        <tr key={row.id} className="border-b border-white/5">
                          <td className="py-2 pr-2">
                            <span className="text-slate-200">{row.name}</span>
                            {row.description && (
                              <p className="text-slate-500 text-xs mt-0.5">{row.description}</p>
                            )}
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={row.maxPoints}
                              value={criterionScores[row.id]?.points ?? row.points}
                              onChange={(e) =>
                                setCriterionScores((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...prev[row.id],
                                    points: Math.max(0, Math.min(row.maxPoints, Number(e.target.value) || 0)),
                                    feedback: prev[row.id]?.feedback ?? row.feedback,
                                  },
                                }))
                              }
                              disabled={isFinalized}
                              className="w-14 rounded bg-white/10 border border-white/20 px-2 py-1 text-slate-200 text-center"
                            />
                            <span className="text-slate-500 text-xs ml-1">/ {row.maxPoints}</span>
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              value={criterionScores[row.id]?.feedback ?? row.feedback}
                              onChange={(e) =>
                                setCriterionScores((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...prev[row.id],
                                    points: prev[row.id]?.points ?? row.points,
                                    feedback: e.target.value,
                                  },
                                }))
                              }
                              disabled={isFinalized}
                              placeholder="Feedback"
                              className="w-full rounded bg-white/10 border border-white/20 px-2 py-1 text-slate-200 text-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">
                  No rubric attached. Attach a rubric to the assignment to use AI grading.
                </p>
              )}

              <div>
                <label className="block text-slate-500 text-xs mb-1">Overall grade</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={isFinalized}
                  placeholder="e.g. 85 or A"
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-500 text-xs mb-1">Overall feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={isFinalized}
                  rows={4}
                  placeholder="Comments for the student"
                  className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-slate-200 text-sm resize-y"
                />
              </div>

              {hasAiGrade && submission.confidenceScore != null && (
                <p className="text-slate-500 text-xs">
                  AI confidence: {Math.round(submission.confidenceScore * 100)}%
                </p>
              )}

              {aiSuggestedComments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-slate-500 text-xs font-medium">Suggested comments</p>
                  <ul className="space-y-1">
                    {aiSuggestedComments.map((comment, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => setFeedback((f) => (f ? `${f}\n\n${comment}` : comment))}
                          disabled={isFinalized}
                          className="text-left text-sm text-neon-cyan hover:underline block w-full rounded bg-white/5 px-2 py-1.5"
                        >
                          {comment}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!isFinalized && (
              <>
                <button
                  type="button"
                  onClick={() => draftMutation.mutate()}
                  disabled={draftMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-slate-300 border border-white/20 hover:bg-white/15 disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={handleFinalize}
                  disabled={finalizeMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white border border-emerald-500 hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  Finalize grade
                </button>
              </>
            )}
            {isFinalized && (
              <p className="text-emerald-400 text-sm flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Grade finalized and synced to SIS (if linked).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
