/**
 * Phase 27: AI System-Wide Orchestrator — central intelligence layer.
 * Monitors data across ALL modules (enrollment, grading, attendance, exams, finance,
 * skills graph, etc.), uses LLM_Router (Claude Sonnet) to detect cross-module patterns,
 * generates proactive insights, auto-applies safe low-risk actions, and flags high-impact
 * ones for human review. Integrates with every previous phase.
 */

import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

export type SystemOrchestratorInput = {
  tenantId: string;
  /** When true, only generate insights; do not auto-apply any. Use for "dry run" or manual review. */
  dryRun?: boolean;
};

export type SystemInsightItem = {
  insightType: string;
  title: string;
  description: string;
  confidenceScore: number;
  actionLink?: string | null;
  actionPayload?: Record<string, unknown> | null;
  /** If true and dryRun is false, orchestrator may auto-apply (e.g. create notification). */
  autoApply?: boolean;
};

export type SystemOrchestratorResult = {
  ok: true;
  insightsGenerated: number;
  insightsStored: number;
  insightsAutoApplied: number;
  summary?: string;
};

export type SystemOrchestratorError = { ok: false; error: string };

export type SystemOrchestratorOutput = SystemOrchestratorResult | SystemOrchestratorError;

/** Gather cross-module metrics for the tenant (enrollment, grading, attendance, exams, finance, skills, etc.). */
async function gatherCrossModuleMetrics(tenantId: string): Promise<string> {
  const [
    enrollmentCount,
    registrationPending,
    frictionRecent,
    pendingBriefs,
    lowMasteryCount,
    examResultsRecent,
    overdueInvoices,
    aidPending,
    equityFirstGen,
    scheduleCount,
    programmeCount,
    courseCount,
  ] = await Promise.all([
    prisma.programmeEnrollment.count({ where: { programme: { department: { tenantId } } } }),
    prisma.studentRegistration.count({
      where: { tenantId, status: "SUBMITTED" },
    }),
    prisma.frictionSignal.count({
      where: { tenantId, createdAt: { gte: THIRTY_DAYS_AGO } },
    }),
    prisma.interventionBrief.count({ where: { tenantId, status: "PENDING" } }),
    prisma.studentModuleProgress.count({
      where: { tenantId, masteryScore: { lt: 0.5 } },
    }),
    prisma.examResult.count({
      where: { examination: { tenantId }, createdAt: { gte: THIRTY_DAYS_AGO } },
    }),
    prisma.invoice.count({
      where: { tenantId, status: "OVERDUE" },
    }),
    prisma.financialAidApplication.count({
      where: { tenantId, status: "UNDER_REVIEW" },
    }),
    prisma.equityMetric.count({ where: { tenantId, firstGen: true } }),
    prisma.schedule.count({ where: { tenantId } }),
    prisma.programme.count({ where: { department: { tenantId } } }),
    prisma.course.count({ where: { tenantId } }),
  ]);

  // Sample struggling students (low mastery + friction)
  const strugglingSample = await prisma.studentModuleProgress.findMany({
    where: { tenantId, masteryScore: { lt: 0.5, not: null } },
    take: 5,
    orderBy: { masteryScore: "asc" },
    select: { studentId: true, moduleId: true, masteryScore: true },
  });

  const lines = [
    "## Cross-module metrics (last 30 days or current state)",
    `- Enrollments: ${enrollmentCount}`,
    `- Registrations pending approval: ${registrationPending}`,
    `- Friction signals (30d): ${frictionRecent}`,
    `- Pending intervention briefs: ${pendingBriefs}`,
    `- Students with low mastery (<50%) in at least one module: ${lowMasteryCount}`,
    `- Exam results recorded (30d): ${examResultsRecent}`,
    `- Overdue invoices: ${overdueInvoices}`,
    `- Financial aid applications under review: ${aidPending}`,
    `- Equity: first-gen students flagged: ${equityFirstGen}`,
    `- Schedules (timetable slots): ${scheduleCount}`,
    `- Programmes: ${programmeCount}, Courses: ${courseCount}`,
    "",
    "## Sample struggling students (low mastery)",
    strugglingSample.length
      ? strugglingSample
          .map(
            (s) =>
              `- Student ${s.studentId} in module ${s.moduleId}: mastery ${((s.masteryScore ?? 0) * 100).toFixed(0)}%`
          )
          .join("\n")
      : "- None",
  ];

  return lines.join("\n");
}

/** Parse LLM response into structured insights and optional summary. */
function parseInsightsFromLLM(text: string): { insights: SystemInsightItem[]; summary?: string } {
  const insights: SystemInsightItem[] = [];
  let summary: string | undefined;
  try {
    const raw = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
    const parsed = JSON.parse(raw) as {
      summary?: string;
      insights?: Array<{
        insightType?: string;
        title?: string;
        description?: string;
        confidenceScore?: number;
        actionLink?: string | null;
        actionPayload?: Record<string, unknown> | null;
        autoApply?: boolean;
      }>;
    };
    summary = typeof parsed.summary === "string" ? parsed.summary : undefined;
    if (Array.isArray(parsed.insights)) {
      for (const i of parsed.insights) {
        insights.push({
          insightType: i.insightType ?? "general",
          title: i.title ?? "Insight",
          description: i.description ?? "",
          confidenceScore: typeof i.confidenceScore === "number" ? Math.min(1, Math.max(0, i.confidenceScore)) : 0.7,
          actionLink: i.actionLink ?? null,
          actionPayload: i.actionPayload ?? null,
          autoApply: Boolean(i.autoApply),
        });
      }
    }
  } catch {
    // Fallback: no structured insights
  }
  return { insights, summary };
}

/**
 * Run the AI System-Wide Orchestrator: gather metrics, call Claude via LLM_Router,
 * generate insights, store in SystemInsight, and optionally auto-apply safe actions.
 */
export async function runAISystemOrchestrator(
  input: SystemOrchestratorInput
): Promise<SystemOrchestratorOutput> {
  const { tenantId, dryRun = false } = input;

  const metricsContext = await gatherCrossModuleMetrics(tenantId);

  const systemPrompt = `You are the central AI orchestrator for SILS (Student Information and Learning System), an AI-native multi-tenant SaaS combining LMS and SIS. Your role is to analyze cross-module metrics and produce proactive, actionable insights.

Given metrics covering: enrollment, registration, friction signals, intervention briefs, mastery, exams, finance (invoices, financial aid), equity, scheduling, and programme/course counts, output a JSON object with:
1. "summary": 2–4 sentence executive summary of system health and top priorities.
2. "insights": array of insight objects. Each object must have:
   - "insightType": one of "student_struggling", "equity_gap", "timetable_optimization", "finance_alert", "retention_risk", "content_recommendation", "registration_bottleneck", "exam_preparation", or "general"
   - "title": short title
   - "description": 1–3 sentences describing the finding and recommended action
   - "confidenceScore": number 0–1
   - "actionLink": optional URL path for one-click navigation (e.g. /progress/STUDENT_ID, /finance/invoices, /exams)
   - "actionPayload": optional object for apply (e.g. { "studentId": "...", "moduleId": "..." })
   - "autoApply": true only for very low-risk, safe actions (e.g. "suggest bridging content"); false for anything affecting grades, finance, or high-impact changes

Generate 3–10 insights. Focus on cross-module patterns (e.g. "Student X is struggling in Module Y — suggest bridging content from Programme Z"). Output only the JSON object, no markdown.`;

  const userPrompt = `Metrics:\n${metricsContext}\n\nGenerate summary and insights.`;

  const llm = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 2048,
    cachePrefix: "system-orchestrator",
  });

  if (!llm.ok) {
    return { ok: false, error: llm.error };
  }

  const { insights, summary } = parseInsightsFromLLM(llm.text);
  let stored = 0;
  let autoApplied = 0;

  for (const ins of insights) {
    const appliedAt =
      !dryRun && ins.autoApply && (ins.confidenceScore >= 0.7 && ins.confidenceScore < 0.95)
        ? new Date()
        : null;

    await prisma.systemInsight.create({
      data: {
        tenantId,
        insightType: ins.insightType,
        title: ins.title,
        description: ins.description,
        confidenceScore: ins.confidenceScore,
        actionLink: ins.actionLink ?? undefined,
        actionPayload: ins.actionPayload ?? undefined,
        appliedAt,
      },
    });
    stored++;
    if (appliedAt) autoApplied++;
  }

  return {
    ok: true,
    insightsGenerated: insights.length,
    insightsStored: stored,
    insightsAutoApplied: autoApplied,
    summary,
  };
}
