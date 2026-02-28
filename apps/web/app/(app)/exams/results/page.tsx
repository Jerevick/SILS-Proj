"use client";

/**
 * Phase 18: Results entry + AI analysis panel with actionable recommendations.
 * Enter/load exam results, run AIResultAnalyzer for patterns, gaps, equity, remediation.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ClipboardList,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listExaminations,
  getExamination,
  saveExamResults,
  AIResultAnalyzer,
  type ResultDataItem,
  type AIResultAnalysisOutput,
} from "@/app/actions/exam-actions";
import type { ExaminationListItem } from "@/app/actions/exam-actions";

export default function ExamResultsPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const examIdParam = searchParams.get("examId");

  const [selectedExamId, setSelectedExamId] = useState<string>(examIdParam || "");
  const [resultsRows, setResultsRows] = useState<ResultDataItem[]>([]);
  const [analysis, setAnalysis] = useState<AIResultAnalysisOutput | null>(null);

  const { data: exams } = useQuery({
    queryKey: ["examinations"],
    queryFn: async (): Promise<ExaminationListItem[]> => {
      const r = await listExaminations({});
      if (r && "ok" in r && !r.ok) throw new Error(r.error);
      return (r as ExaminationListItem[]) ?? [];
    },
  });

  const { data: examDetail } = useQuery({
    queryKey: ["examination", selectedExamId],
    queryFn: async () => {
      if (!selectedExamId) return null;
      const r = await getExamination(selectedExamId);
      if (!r.ok) return null;
      return r.examination;
    },
    enabled: !!selectedExamId,
  });

  useEffect(() => {
    if (examIdParam) setSelectedExamId(examIdParam);
  }, [examIdParam]);

  useEffect(() => {
    if (examDetail?.results && Array.isArray(examDetail.results)) {
      setResultsRows(
        (examDetail.results as Array<{ studentId: string; score: number | null; grade: string | null; feedback: string | null }>).map(
          (r) => ({
            studentId: r.studentId,
            score: r.score ?? undefined,
            grade: r.grade ?? undefined,
            feedback: r.feedback ?? undefined,
          })
        )
      );
    } else if (examDetail?.seatings && (examDetail.seatings as unknown[]).length > 0) {
      setResultsRows(
        (examDetail.seatings as Array<{ studentId: string }>).map((s) => ({
          studentId: s.studentId,
          score: undefined,
          grade: undefined,
          feedback: undefined,
        }))
      );
    } else {
      setResultsRows([]);
    }
    if (examDetail?.aiResultAnalysis) {
      setAnalysis(examDetail.aiResultAnalysis as unknown as AIResultAnalysisOutput);
    } else {
      setAnalysis(null);
    }
  }, [examDetail]);

  const saveMutation = useMutation({
    mutationFn: () => saveExamResults(selectedExamId, resultsRows),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["examination", selectedExamId] });
        toast.success("Results saved.");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => AIResultAnalyzer(selectedExamId, resultsRows),
    onSuccess: (r) => {
      if (r.ok) {
        setAnalysis(r.analysis);
        queryClient.invalidateQueries({ queryKey: ["examination", selectedExamId] });
        toast.success("AI analysis complete.");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const updateRow = (index: number, field: keyof ResultDataItem, value: string | number | undefined) => {
    setResultsRows((prev) => {
      const next = [...prev];
      if (!next[index]) next[index] = { studentId: "" };
      (next[index] as Record<string, unknown>)[field] = value === "" ? undefined : value;
      return next;
    });
  };

  const addRow = () => {
    setResultsRows((prev) => [...prev, { studentId: "", score: undefined, grade: undefined, feedback: undefined }]);
  };

  const removeRow = (index: number) => {
    setResultsRows((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedExam = exams?.find((e) => e.id === selectedExamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
          <Link href="/exams" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to exams
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Exam results & AI analysis
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="rounded-lg border border-white/20 bg-space-800 text-slate-200 px-3 py-2 text-sm min-w-[200px]"
          >
            <option value="">Select exam</option>
            {exams?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.term.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedExamId && (
        <Card className="border-white/10 bg-space-800/50">
          <CardContent className="py-12 text-center text-slate-400">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p>Select an exam to enter results and run AI analysis.</p>
          </CardContent>
        </Card>
      )}

      {selectedExamId && (
        <>
          <Card className="border-white/10 bg-space-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-neon-cyan" />
                Results entry
              </CardTitle>
              <p className="text-slate-400 text-sm">
                {selectedExam?.title} · Add student ID, score/grade, and optional feedback. Save then run AI analysis.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-white/10">
                      <th className="py-2 pr-2">Student ID</th>
                      <th className="py-2 pr-2">Score</th>
                      <th className="py-2 pr-2">Grade</th>
                      <th className="py-2 pr-2">Feedback</th>
                      <th className="py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {resultsRows.map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-1.5 pr-2">
                          <Input
                            value={row.studentId}
                            onChange={(e) => updateRow(i, "studentId", e.target.value)}
                            placeholder="user_..."
                            className="h-8 border-white/20 bg-transparent text-slate-200 font-mono text-xs"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            type="number"
                            value={row.score ?? ""}
                            onChange={(e) => updateRow(i, "score", e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="0–100"
                            className="h-8 border-white/20 bg-transparent text-slate-200 w-20"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            value={row.grade ?? ""}
                            onChange={(e) => updateRow(i, "grade", e.target.value)}
                            placeholder="A, B+, …"
                            className="h-8 border-white/20 bg-transparent text-slate-200 w-20"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            value={row.feedback ?? ""}
                            onChange={(e) => updateRow(i, "feedback", e.target.value)}
                            placeholder="Optional"
                            className="h-8 border-white/20 bg-transparent text-slate-200"
                          />
                        </td>
                        <td className="py-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-red-400 h-8 w-8 p-0"
                            onClick={() => removeRow(i)}
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-slate-300"
                  onClick={addRow}
                >
                  Add row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" /> Save results
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-neon-cyan/40 text-neon-cyan"
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending || resultsRows.filter((r) => r.studentId).length === 0}
                >
                  <Sparkles className="h-4 w-4 mr-1" /> Run AI analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          {analysis && (
            <Card className="border-neon-cyan/20 bg-space-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-neon-cyan" />
                  AI analysis & recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-slate-300">{analysis.summary}</p>
                </div>
                {analysis.performancePatterns?.length > 0 && (
                  <div>
                    <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3.5 w-3" /> Performance patterns
                    </p>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {analysis.performancePatterns.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.knowledgeGaps?.length > 0 && (
                  <div>
                    <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                      <AlertCircle className="h-3.5 w-3" /> Knowledge gaps
                    </p>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {analysis.knowledgeGaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.equityInsights?.length > 0 && (
                  <div>
                    <p className="text-slate-500 font-medium mb-1">Equity insights</p>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {analysis.equityInsights.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.remediationSuggestions?.length > 0 && (
                  <div>
                    <p className="text-slate-500 font-medium flex items-center gap-1 mb-1">
                      <Lightbulb className="h-3.5 w-3" /> Remediation suggestions
                    </p>
                    <ul className="space-y-2">
                      {analysis.remediationSuggestions.map((s, i) => (
                        <li
                          key={i}
                          className={`rounded-lg p-2 border ${
                            s.priority === "high"
                              ? "border-amber-500/30 bg-amber-500/5"
                              : s.priority === "medium"
                                ? "border-neon-cyan/20 bg-neon-cyan/5"
                                : "border-white/10 bg-white/5"
                          }`}
                        >
                          {s.studentId && (
                            <span className="font-mono text-xs text-slate-500 block mb-0.5">{s.studentId}</span>
                          )}
                          <span className="text-slate-300">{s.suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
