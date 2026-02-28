"use client";

/**
 * Phase 18: Exam calendar and list view with filters (term, school, department, type).
 * AI-powered scheduling lives in [examId] page and results page.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarDays,
  Filter,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listExaminations, type ExaminationListItem, type ExaminationFilters } from "@/app/actions/exam-actions";
import { listAcademicTerms } from "@/app/actions/calendar-actions";
import type { AcademicTermListItem } from "@/app/actions/calendar-actions";
import type { ExamType, ExaminationStatus } from "@prisma/client";

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  MIDTERM: "Midterm",
  FINAL: "Final",
  PRACTICAL: "Practical",
  PROJECT: "Project",
};

const STATUS_LABELS: Record<ExaminationStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ExamsPage() {
  const [termId, setTermId] = useState<string>("");
  const [examType, setExamType] = useState<ExamType | "">("");
  const [status, setStatus] = useState<ExaminationStatus | "">("");

  const { data: terms, isLoading: termsLoading } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async (): Promise<AcademicTermListItem[]> => {
      const r = await listAcademicTerms();
      if (r && "ok" in r && !r.ok) throw new Error(r.error);
      return (r as AcademicTermListItem[]) ?? [];
    },
  });

  const filters: ExaminationFilters = {};
  if (termId) filters.termId = termId;
  if (examType) filters.examType = examType as ExamType;
  if (status) filters.status = status as ExaminationStatus;

  const { data: exams, isLoading: examsLoading, error } = useQuery({
    queryKey: ["examinations", filters],
    queryFn: async (): Promise<ExaminationListItem[]> => {
      const r = await listExaminations(filters);
      if (r && "ok" in r && !r.ok) throw new Error(r.error);
      return (r as ExaminationListItem[]) ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Examinations
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <Select value={termId || "all"} onValueChange={(v) => setTermId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {terms?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={examType || "all"} onValueChange={(v) => setExamType((v === "all" ? "" : v) as ExamType | "")}>
            <SelectTrigger className="w-[130px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(EXAM_TYPE_LABELS) as ExamType[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {EXAM_TYPE_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(v) => setStatus((v === "all" ? "" : v) as ExaminationStatus | "")}>
            <SelectTrigger className="w-[130px] border-white/20 bg-space-800 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABELS) as ExaminationStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {STATUS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm" className="border-neon-cyan/40 text-neon-cyan">
            <Link href="/exams/results">
              <ClipboardList className="h-4 w-4 mr-1" /> Results & AI
            </Link>
          </Button>
        </div>
      </div>

      {termsLoading && <p className="text-slate-400">Loading terms…</p>}
      {examsLoading && <p className="text-slate-400">Loading examinations…</p>}
      {error && (
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Failed to load examinations."}
        </p>
      )}

      {exams && exams.length === 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="h-14 w-14 text-slate-500 mb-4" />
            <p className="text-slate-400 text-center max-w-md">
              No examinations match your filters. Create exams from a term dashboard or use AI scheduling on an exam page.
            </p>
            <Button asChild className="mt-4 bg-neon-cyan text-space-900 hover:bg-neon-cyanDim">
              <Link href="/admin/calendar">Manage terms</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {exams && exams.length > 0 && (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <Card
              key={exam.id}
              className="border-white/10 bg-space-800/50 hover:bg-space-800/70 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                      {exam.title}
                      <span className="text-xs font-normal text-slate-500">
                        {exam.programme.code} · {exam.module.title}
                      </span>
                    </CardTitle>
                    <p className="text-sm text-slate-400 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3" />
                        {formatDate(exam.date)}
                      </span>
                      <span>{exam.durationMinutes} min</span>
                      {exam.location && <span>{exam.location}</span>}
                      {exam.proctoringRequired && (
                        <span className="text-amber-400/90">Proctored</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        exam.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : exam.status === "SCHEDULED"
                            ? "bg-neon-cyan/20 text-neon-cyan"
                            : exam.status === "CANCELLED"
                              ? "bg-slate-500/20 text-slate-400"
                              : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {STATUS_LABELS[exam.status]}
                    </span>
                    <span className="rounded-full px-2.5 py-1 text-xs bg-white/10 text-slate-300">
                      {EXAM_TYPE_LABELS[exam.examType]}
                    </span>
                    <Button asChild variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                      <Link href={`/exams/${exam.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-slate-500">
                {exam._count.seatings > 0 && (
                  <span>Seating: {exam._count.seatings} students</span>
                )}
                {exam._count.specialArrangements > 0 && (
                  <span className="ml-4">Special arrangements: {exam._count.specialArrangements}</span>
                )}
                {exam._count.results > 0 && (
                  <span className="ml-4">Results: {exam._count.results}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
