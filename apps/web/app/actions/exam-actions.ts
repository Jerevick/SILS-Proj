"use server";

/**
 * Phase 18: Comprehensive AI-Powered Examination Management.
 * - List/create/update examinations; scope by term, school, department, type.
 * - AIExamScheduler(term_id): LLM + optimization for scheduling, seating, special arrangements.
 * - AIResultAnalyzer(examination_id, results_data): deep analysis, remediation, StudentCompetency updates.
 * Roles: OWNER, ADMIN, INSTRUCTOR (Registrar / Exam Officer / HoD / Lecturer).
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { updateMasteryFromLMSInternal } from "@/lib/competency-actions";
import type { ExamType, ExaminationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExaminationFilters = {
  termId?: string;
  schoolId?: string;
  departmentId?: string;
  programmeId?: string;
  examType?: ExamType;
  status?: ExaminationStatus;
};

export type ExaminationListItem = {
  id: string;
  title: string;
  examType: ExamType;
  date: Date;
  durationMinutes: number;
  location: string | null;
  proctoringRequired: boolean;
  status: ExaminationStatus;
  programmeId: string;
  programme: { name: string; code: string };
  module: { id: string; title: string };
  term: { id: string; name: string };
  _count: { seatings: number; specialArrangements: number; results: number };
};

export type CreateExaminationInput = {
  programmeId: string;
  moduleId: string;
  termId: string;
  title: string;
  examType: ExamType;
  date: string;
  durationMinutes?: number;
  location?: string | null;
  proctoringRequired?: boolean;
  status?: ExaminationStatus;
};

export type UpdateExaminationInput = Partial<CreateExaminationInput> & { examinationId: string };

export type ResultDataItem = { studentId: string; score?: number; grade?: string; feedback?: string };

export type AIResultAnalysisOutput = {
  summary: string;
  performancePatterns: string[];
  knowledgeGaps: string[];
  equityInsights: string[];
  remediationSuggestions: Array<{ studentId?: string; suggestion: string; priority: "high" | "medium" | "low" }>;
  competencyUpdates: Array<{ studentId: string; competencyId?: string; programmeModuleId: string; masteryDelta: number }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return {
    ok: true as const,
    userId,
    orgId,
    tenantId: tenantResult.context.tenantId,
    role: tenantResult.context.role,
  };
}

/** Only OWNER, ADMIN, or INSTRUCTOR can manage exams (Registrar, Exam Officer, HoD, Lecturer). */
function canManageExams(role: string): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
}

// ---------------------------------------------------------------------------
// List examinations (with filters)
// ---------------------------------------------------------------------------

export async function listExaminations(
  filters?: ExaminationFilters
): Promise<ExaminationListItem[] | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const where: Parameters<typeof prisma.examination.findMany>[0]["where"] = {
      tenantId: ctx.tenantId,
    };
    if (filters?.termId) where.termId = filters.termId;
    if (filters?.examType) where.examType = filters.examType;
    if (filters?.status) where.status = filters.status;
    if (filters?.programmeId) where.programmeId = filters.programmeId;
    if (filters?.departmentId || filters?.schoolId) {
      where.programme = {
        ...(filters.departmentId && { departmentId: filters.departmentId }),
        ...(filters.schoolId && { department: { schoolId: filters.schoolId } }),
      };
    }

    const exams = await prisma.examination.findMany({
      where,
      orderBy: [{ date: "asc" }, { title: "asc" }],
      include: {
        programme: { select: { name: true, code: true } },
        module: { select: { id: true, title: true } },
        term: { select: { id: true, name: true } },
        _count: { select: { seatings: true, specialArrangements: true, results: true } },
      },
    });

    return exams.map((e) => ({
      id: e.id,
      title: e.title,
      examType: e.examType,
      date: e.date,
      durationMinutes: e.durationMinutes,
      location: e.location,
      proctoringRequired: e.proctoringRequired,
      status: e.status,
      programmeId: e.programmeId,
      programme: e.programme,
      module: e.module,
      term: e.term,
      _count: e._count,
    }));
  } catch (e) {
    console.error("listExaminations error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to list examinations." };
  }
}

// ---------------------------------------------------------------------------
// Get single examination (for dashboard)
// ---------------------------------------------------------------------------

export async function getExamination(examId: string) {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };

  const exam = await prisma.examination.findFirst({
    where: { id: examId, tenantId: ctx.tenantId },
    include: {
      programme: { select: { id: true, name: true, code: true, department: { select: { name: true, school: { select: { name: true } } } } } },
      module: { select: { id: true, title: true, lecturerId: true } },
      term: { select: { id: true, name: true, startDate: true, endDate: true } },
      seatings: true,
      specialArrangements: true,
      results: true,
    },
  });
  if (!exam) return { ok: false as const, error: "Examination not found." };
  return { ok: true as const, examination: exam };
}

// ---------------------------------------------------------------------------
// Create / Update examination
// ---------------------------------------------------------------------------

export async function createExamination(
  input: CreateExaminationInput
): Promise<{ ok: true; examinationId: string } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageExams(ctx.role)) return { ok: false, error: "Insufficient role to create examinations." };

  const programme = await prisma.programme.findFirst({
    where: { id: input.programmeId, department: { tenantId: ctx.tenantId } },
    include: { department: true },
  });
  if (!programme) return { ok: false, error: "Programme not found." };

  const module = await prisma.programmeModule.findFirst({
    where: { id: input.moduleId, programmeId: input.programmeId },
  });
  if (!module) return { ok: false, error: "Programme module not found." };

  const term = await prisma.academicTerm.findFirst({
    where: { id: input.termId, tenantId: ctx.tenantId },
  });
  if (!term) return { ok: false, error: "Academic term not found." };

  const date = new Date(input.date);
  if (isNaN(date.getTime())) return { ok: false, error: "Invalid exam date." };

  try {
    const exam = await prisma.examination.create({
      data: {
        tenantId: ctx.tenantId,
        programmeId: input.programmeId,
        moduleId: input.moduleId,
        termId: input.termId,
        title: input.title.trim(),
        examType: input.examType,
        date,
        durationMinutes: input.durationMinutes ?? 120,
        location: input.location?.trim() || null,
        proctoringRequired: input.proctoringRequired ?? false,
        status: input.status ?? "DRAFT",
      },
    });
    return { ok: true, examinationId: exam.id };
  } catch (e) {
    console.error("createExamination error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create examination." };
  }
}

export async function updateExamination(
  input: UpdateExaminationInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageExams(ctx.role)) return { ok: false, error: "Insufficient role to update examinations." };

  const existing = await prisma.examination.findFirst({
    where: { id: input.examinationId, tenantId: ctx.tenantId },
  });
  if (!existing) return { ok: false, error: "Examination not found." };

  const data: Partial<{
    title: string;
    examType: ExamType;
    date: Date;
    durationMinutes: number;
    location: string | null;
    proctoringRequired: boolean;
    status: ExaminationStatus;
    programmeId: string;
    moduleId: string;
    termId: string;
  }> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.examType !== undefined) data.examType = input.examType;
  if (input.date !== undefined) data.date = new Date(input.date);
  if (input.durationMinutes !== undefined) data.durationMinutes = input.durationMinutes;
  if (input.location !== undefined) data.location = input.location?.trim() || null;
  if (input.proctoringRequired !== undefined) data.proctoringRequired = input.proctoringRequired;
  if (input.status !== undefined) data.status = input.status;
  if (input.programmeId !== undefined) data.programmeId = input.programmeId;
  if (input.moduleId !== undefined) data.moduleId = input.moduleId;
  if (input.termId !== undefined) data.termId = input.termId;

  try {
    await prisma.examination.update({ where: { id: input.examinationId }, data });
    return { ok: true };
  } catch (e) {
    console.error("updateExamination error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update examination." };
  }
}

// ---------------------------------------------------------------------------
// AI Exam Scheduler (term_id)
// Uses LLM to suggest schedule respecting room availability, faculty workload, student balance, equity.
// Auto-generates seating plans and special arrangements from EquityMetric / preferences.
// ---------------------------------------------------------------------------

export async function AIExamScheduler(termId: string): Promise<
  | { ok: true; scheduled: number; insights: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageExams(ctx.role)) return { ok: false, error: "Insufficient role to run AI scheduler." };

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, tenantId: ctx.tenantId },
    include: { programmeModules: { include: { programme: { select: { id: true, name: true, code: true, departmentId: true } } } } },
  });
  if (!term) return { ok: false, error: "Academic term not found." };

  const existingExams = await prisma.examination.findMany({
    where: { termId, tenantId: ctx.tenantId },
    include: { module: true, programme: true },
  });

  const modulesToSchedule = term.programmeModules.filter(
    (pm) => !existingExams.some((e) => e.moduleId === pm.id)
  );
  if (modulesToSchedule.length === 0) {
    return { ok: true, scheduled: 0, insights: { message: "All modules for this term already have exams or no modules in term." } };
  }

  const registrations = await prisma.studentRegistration.findMany({
    where: { termId, status: "APPROVED" },
    select: { studentId: true, programmeId: true, registeredModules: true },
  });

  const equityMetrics = await prisma.equityMetric.findMany({
    where: { tenantId: ctx.tenantId },
    select: { studentId: true, firstGen: true, lowIncome: true, neurodiverse: true, caregiver: true },
  });

  const systemPrompt = `You are an academic exam scheduler. Given:
- Academic term: ${term.name} (${term.startDate.toISOString().slice(0, 10)} to ${term.endDate.toISOString().slice(0, 10)})
- Programme modules that need exams (no exam yet): ${JSON.stringify(modulesToSchedule.map((m) => ({ id: m.id, title: m.title, programme: m.programme?.name })))}
- Existing exams in this term (do not double-book): ${JSON.stringify(existingExams.map((e) => ({ title: e.title, date: e.date, moduleId: e.moduleId })))}
- Student registrations (approved): ${registrations.length} registrations
- Equity flags (students who may need special arrangements): ${JSON.stringify(equityMetrics.slice(0, 50))}

Output a JSON object only, no markdown:
{
  "schedule": [ { "moduleId": "<id>", "title": "<exam title>", "examType": "MIDTERM"|"FINAL"|"PRACTICAL"|"PROJECT", "date": "YYYY-MM-DD", "durationMinutes": 120, "location": "Room A", "proctoringRequired": false } ],
  "insights": { "conflictAvoidance": "<short note>", "workloadBalance": "<short note>", "equityConsiderations": "<short note>" }
}
Rules: spread exams across term dates; avoid same day for same student (use registeredModules); prefer FINAL for end of term; suggest locations like "Room A", "Room B" if unknown.`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: "Generate the exam schedule JSON for this term." }],
    maxTokens: 2048,
    cachePrefix: "exam-scheduler",
  });

  if (!result.ok) return { ok: false, error: result.error };

  let parsed: { schedule?: Array<{ moduleId: string; title: string; examType: ExamType; date: string; durationMinutes?: number; location?: string; proctoringRequired?: boolean }>; insights?: Record<string, string> };
  try {
    const raw = result.text.replace(/```json?\s*|\s*```/g, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "AI did not return valid JSON schedule." };
  }

  const schedule = parsed.schedule ?? [];
  const insights = parsed.insights ?? {};
  let scheduled = 0;

  for (const item of schedule) {
    const pm = modulesToSchedule.find((m) => m.id === item.moduleId);
    if (!pm || !item.date) continue;
    const date = new Date(item.date);
    if (isNaN(date.getTime())) continue;

    const exam = await prisma.examination.create({
      data: {
        tenantId: ctx.tenantId,
        programmeId: pm.programmeId,
        moduleId: pm.id,
        termId,
        title: item.title || `${pm.title} Exam`,
        examType: item.examType ?? "FINAL",
        date,
        durationMinutes: item.durationMinutes ?? 120,
        location: item.location ?? null,
        proctoringRequired: item.proctoringRequired ?? false,
        status: "SCHEDULED",
        aiScheduleInsights: insights,
      },
    });
    scheduled++;

    const studentsInModule = registrations
      .filter((r) => {
        const enrolled = (r.registeredModules as { enrolled?: string[] })?.enrolled ?? [];
        return enrolled.includes(pm.id);
      })
      .map((r) => r.studentId);

    let seatNum = 1;
    for (const studentId of studentsInModule) {
      await prisma.examSeating.upsert({
        where: {
          examinationId_studentId: { examinationId: exam.id, studentId },
        },
        create: {
          examinationId: exam.id,
          studentId,
          seatNumber: String(seatNum++),
          room: item.location ?? null,
        },
        update: { seatNumber: String(seatNum++), room: item.location ?? null },
      });
    }

    const needArrangement = equityMetrics.filter((eq) => studentsInModule.includes(eq.studentId));
    for (const eq of needArrangement) {
      const types: string[] = [];
      if (eq.neurodiverse) types.push("SEPARATE_ROOM");
      if (eq.caregiver) types.push("REST_BREAKS");
      if (types.length > 0) {
        const existing = await prisma.specialArrangement.findFirst({
          where: { examinationId: exam.id, studentId: eq.studentId },
        });
        if (!existing) {
          await prisma.specialArrangement.create({
            data: {
              studentId: eq.studentId,
              examinationId: exam.id,
              arrangementType: types[0],
              notes: "AI-suggested from equity flags",
            },
          });
        }
      }
    }
  }

  return { ok: true, scheduled, insights };
}

// ---------------------------------------------------------------------------
// AI Result Analyzer (examination_id, results_data)
// Deep analysis: performance patterns, knowledge gaps, equity insights.
// Generates remediation suggestions and updates StudentCompetency mastery + vector.
// ---------------------------------------------------------------------------

export async function AIResultAnalyzer(
  examinationId: string,
  resultsData: ResultDataItem[]
): Promise<{ ok: true; analysis: AIResultAnalysisOutput } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageExams(ctx.role)) return { ok: false, error: "Insufficient role to run result analysis." };

  const examination = await prisma.examination.findFirst({
    where: { id: examinationId, tenantId: ctx.tenantId },
    include: {
      module: { include: { programme: { include: { competencies: true } } } },
      programme: true,
    },
  });
  if (!examination) return { ok: false, error: "Examination not found." };

  const equityMetrics = await prisma.equityMetric.findMany({
    where: { tenantId: ctx.tenantId, studentId: { in: resultsData.map((r) => r.studentId) } },
  });

  const systemPrompt = `You are an academic result analyst. Given:
- Examination: ${examination.title} (${examination.examType}), module: ${examination.module.title}
- Results (studentId, score, grade, feedback): ${JSON.stringify(resultsData)}
- Equity flags for some students: ${JSON.stringify(equityMetrics)}

Produce a JSON object only, no markdown:
{
  "summary": "2-3 sentence overall summary of cohort performance",
  "performancePatterns": ["pattern1", "pattern2"],
  "knowledgeGaps": ["gap1", "gap2"],
  "equityInsights": ["insight1"],
  "remediationSuggestions": [ { "studentId": "optional", "suggestion": "text", "priority": "high"|"medium"|"low" } ],
  "competencyUpdates": [ { "studentId": "...", "programmeModuleId": "${examination.moduleId}", "masteryDelta": 0.1 } ]
}
Focus on actionable insights. masteryDelta is -0.2 to 0.2 adjustment suggestion.`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: "Analyze these exam results and output the JSON." }],
    maxTokens: 2048,
    cachePrefix: "exam-result-analysis",
  });

  if (!result.ok) return { ok: false, error: result.error };

  let analysis: AIResultAnalysisOutput;
  try {
    const raw = result.text.replace(/```json?\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(raw);
    analysis = {
      summary: parsed.summary ?? "No summary generated.",
      performancePatterns: Array.isArray(parsed.performancePatterns) ? parsed.performancePatterns : [],
      knowledgeGaps: Array.isArray(parsed.knowledgeGaps) ? parsed.knowledgeGaps : [],
      equityInsights: Array.isArray(parsed.equityInsights) ? parsed.equityInsights : [],
      remediationSuggestions: Array.isArray(parsed.remediationSuggestions) ? parsed.remediationSuggestions : [],
      competencyUpdates: Array.isArray(parsed.competencyUpdates) ? parsed.competencyUpdates : [],
    };
  } catch {
    return { ok: false, error: "AI did not return valid analysis JSON." };
  }

  await prisma.examination.update({
    where: { id: examinationId },
    data: { aiResultAnalysis: analysis as unknown as object },
  });

  for (const up of analysis.competencyUpdates) {
    if (!up.studentId || !up.programmeModuleId) continue;
    const delta = Math.max(-0.2, Math.min(0.2, Number(up.masteryDelta) || 0));
    if (delta === 0) continue;
    const res = resultsData.find((r) => r.studentId === up.studentId);
    const grade = res?.grade ?? (res?.score != null ? String(res.score) : undefined);
    await updateMasteryFromLMSInternal(ctx.tenantId, up.studentId, up.programmeModuleId, {
      grade,
      completedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  return { ok: true, analysis };
}

// ---------------------------------------------------------------------------
// Save exam results (for results entry page)
// ---------------------------------------------------------------------------

export async function saveExamResults(
  examinationId: string,
  results: ResultDataItem[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageExams(ctx.role)) return { ok: false, error: "Insufficient role." };

  const exam = await prisma.examination.findFirst({
    where: { id: examinationId, tenantId: ctx.tenantId },
  });
  if (!exam) return { ok: false, error: "Examination not found." };

  for (const r of results) {
    await prisma.examResult.upsert({
      where: {
        examinationId_studentId: { examinationId, studentId: r.studentId },
      },
      create: {
        examinationId,
        studentId: r.studentId,
        score: r.score ?? null,
        grade: r.grade ?? null,
        feedback: r.feedback ?? null,
      },
      update: {
        score: r.score ?? null,
        grade: r.grade ?? null,
        feedback: r.feedback ?? null,
      },
    });
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sync exam to calendar (Phase 16)
// ---------------------------------------------------------------------------

export async function syncExaminationToCalendar(examinationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const exam = await prisma.examination.findFirst({
    where: { id: examinationId, tenantId: ctx.tenantId },
  });
  if (!exam) return { ok: false, error: "Examination not found." };

  const startTime = new Date(exam.date);
  startTime.setHours(9, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + exam.durationMinutes * 60 * 1000);

  const existing = await prisma.calendarEvent.findFirst({
    where: {
      tenantId: ctx.tenantId,
      type: "EXAM",
      title: { contains: exam.title },
      startTime: { gte: new Date(exam.date), lt: new Date(new Date(exam.date).setHours(23, 59, 59)) },
    },
  });

  if (existing) {
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { title: `Exam: ${exam.title}`, startTime, endTime },
    });
  } else {
    await prisma.calendarEvent.create({
      data: {
        tenantId: ctx.tenantId,
        title: `Exam: ${exam.title}`,
        startTime,
        endTime,
        type: "EXAM",
      },
    });
  }
  return { ok: true };
}
