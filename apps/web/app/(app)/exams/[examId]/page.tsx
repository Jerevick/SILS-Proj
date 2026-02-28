"use client";

/**
 * Phase 18: Rich exam management dashboard — AI scheduling insights, seating plan,
 * special arrangements, proctoring controls. Integrates with calendar (Phase 16).
 */

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  MapPin,
  Clock,
  Shield,
  Sparkles,
  Calendar,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getExamination,
  AIExamScheduler,
  syncExaminationToCalendar,
  updateExamination,
} from "@/app/actions/exam-actions";
import { listAcademicTerms } from "@/app/actions/calendar-actions";
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
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ExamDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const examId = params.examId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["examination", examId],
    queryFn: async () => {
      const r = await getExamination(examId);
      if (!r.ok) throw new Error(r.error);
      return r.examination;
    },
    enabled: !!examId,
  });

  const { data: terms } = useQuery({
    queryKey: ["academic-terms"],
    queryFn: async () => {
      const r = await listAcademicTerms();
      if (r && "ok" in r && !r.ok) throw new Error(r.error);
      return (r as Awaited<ReturnType<typeof listAcademicTerms>>) ?? [];
    },
  });

  const runSchedulerMutation = useMutation({
    mutationFn: (termId: string) => AIExamScheduler(termId),
    onSuccess: (r) => {
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["examination", examId] });
        queryClient.invalidateQueries({ queryKey: ["examinations"] });
        toast.success(`AI scheduled ${r.scheduled} exam(s) for the term.`);
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Scheduler failed"),
  });

  const syncCalendarMutation = useMutation({
    mutationFn: () => syncExaminationToCalendar(examId),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Exam synced to calendar.");
      } else toast.error(r.error);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <p className="text-slate-400">Loading examination…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <p className="text-amber-400">
          {error instanceof Error ? error.message : "Examination not found."}
        </p>
        <Button asChild variant="outline">
          <Link href="/exams">Back to exams</Link>
        </Button>
      </div>
    );
  }

  const exam = data;
  const insights = (exam.aiScheduleInsights as Record<string, string> | null) ?? {};
  const programme = exam.programme as { id: string; name: string; code: string; department?: { name: string; school?: { name: string } } };
  const module = exam.module as { id: string; title: string; lecturerId?: string };
  const term = exam.term as { id: string; name: string; startDate: Date; endDate: Date };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="text-slate-400 hover:text-white">
          <Link href="/exams" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            {exam.title}
          </h1>
          <p className="text-slate-400 mt-1">
            {programme?.name} · {module?.title} · {term?.name}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-neon-cyan/20 text-neon-cyan">
              {EXAM_TYPE_LABELS[exam.examType]}
            </span>
            <span
              className={
                exam.status === "COMPLETED"
                  ? "rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-400"
                  : exam.status === "SCHEDULED"
                    ? "rounded-full px-2.5 py-1 text-xs font-medium bg-neon-cyan/20 text-neon-cyan"
                    : "rounded-full px-2.5 py-1 text-xs font-medium bg-slate-500/20 text-slate-400"
              }
            >
              {STATUS_LABELS[exam.status]}
            </span>
            {exam.proctoringRequired && (
              <span className="rounded-full px-2.5 py-1 text-xs font-medium border border-amber-500/50 text-amber-400">
                <Shield className="h-3 w-3 inline mr-1" /> Proctored
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-slate-300"
            onClick={() => syncCalendarMutation.mutate()}
            disabled={syncCalendarMutation.isPending}
          >
            <Calendar className="h-4 w-4 mr-1" /> Sync to calendar
          </Button>
          <Button asChild size="sm" className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim">
            <Link href={`/exams/results?examId=${exam.id}`}>
              <FileText className="h-4 w-4 mr-1" /> Results & AI analysis
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/10 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-neon-cyan" />
              Date & time
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-slate-200">{formatDate(exam.date)}</p>
            <p className="text-slate-400 mt-1">{exam.durationMinutes} minutes</p>
            {exam.location && (
              <p className="text-slate-400 flex items-center gap-1 mt-1">
                <MapPin className="h-3.5 w-3" /> {exam.location}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-neon-cyan" />
              Seating & arrangements
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-slate-200">
              {exam.seatings?.length ?? 0} students with seating assigned
            </p>
            <p className="text-slate-400 mt-1">
              {exam.specialArrangements?.length ?? 0} special arrangement(s)
            </p>
            {exam.specialArrangements && exam.specialArrangements.length > 0 && (
              <ul className="mt-2 space-y-1 text-slate-400">
                {(exam.specialArrangements as Array<{ studentId: string; arrangementType: string; notes?: string }>).slice(0, 5).map((a, i) => (
                  <li key={i}>
                    {a.arrangementType}
                    {a.notes ? ` — ${a.notes}` : ""}
                  </li>
                ))}
                {exam.specialArrangements.length > 5 && (
                  <li className="text-slate-500">+{exam.specialArrangements.length - 5} more</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {Object.keys(insights).length > 0 && (
        <Card className="border-neon-cyan/20 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-neon-cyan" />
              AI scheduling insights
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-300 space-y-2">
            {Object.entries(insights).map(([key, value]) => (
              <p key={key}>
                <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>{" "}
                {String(value)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {terms && terms.length > 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              AI exam scheduler
            </CardTitle>
            <p className="text-slate-400 text-sm">
              Run AI to schedule all exams for a term (room availability, workload balance, equity).
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {terms.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  className="border-neon-cyan/40 text-neon-cyan"
                  onClick={() => runSchedulerMutation.mutate(t.id)}
                  disabled={runSchedulerMutation.isPending}
                >
                  Schedule {t.name}
                </Button>
              ))}
            </div>
            {runSchedulerMutation.isPending && (
              <p className="text-slate-400 text-sm mt-2">Scheduling…</p>
            )}
          </CardContent>
        </Card>
      )}

      {exam.seatings && exam.seatings.length > 0 && (
        <Card className="border-white/10 bg-space-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">
              Seating plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-white/10">
                    <th className="py-2 pr-4">Seat</th>
                    <th className="py-2 pr-4">Room</th>
                    <th className="py-2">Student ID</th>
                  </tr>
                </thead>
                <tbody>
                  {(exam.seatings as Array<{ seatNumber: string; room: string | null; studentId: string }>).map((s, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 pr-4 text-slate-200">{s.seatNumber}</td>
                      <td className="py-2 pr-4 text-slate-400">{s.room ?? exam.location ?? "—"}</td>
                      <td className="py-2 text-slate-400 font-mono text-xs">{s.studentId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
