/**
 * FacultyOrchestrator: Analyzes course/module data across sections to generate
 * evidence-based redesign suggestions, dropout predictions, and content recommendations.
 * Lecturer-scoped (courses they own or teach).
 */

import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";

export type OrchestratorInput = {
  tenantId: string;
  /** Clerk user ID of the lecturer; only their courses are analyzed. */
  lecturerId: string;
};

export type CourseHealthSummary = {
  courseId: string;
  courseTitle: string;
  moduleCount: number;
  /** Count of students with friction signals in last 30 days. */
  frictionStudentCount: number;
  /** Count of pending intervention briefs. */
  pendingBriefsCount: number;
  /** Average mastery (0–1) across students who have progress. */
  avgMasteryScore: number | null;
};

export type Recommendation = {
  id: string;
  type: "redesign" | "dropout_risk" | "content";
  courseId: string;
  courseTitle: string;
  moduleId?: string;
  moduleTitle?: string;
  title: string;
  description: string;
  /** Optional: structured payload for "Apply" (e.g. add scaffold, adjust content). */
  applyPayload?: Record<string, unknown>;
};

export type OrchestratorResult = {
  ok: true;
  courseHealth: CourseHealthSummary[];
  recommendations: Recommendation[];
  /** Raw AI summary for dashboard. */
  summary?: string;
};

export type OrchestratorError = { ok: false; error: string };

export type FacultyOrchestratorOutput = OrchestratorResult | OrchestratorError;

/** Fetch courses created by or linked to this lecturer (tenant-scoped). */
async function getLecturerCourses(tenantId: string, lecturerId: string) {
  const courses = await prisma.course.findMany({
    where: { tenantId, createdBy: lecturerId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { _count: { select: { assignments: true } } },
      },
      _count: { select: { gradebookEntries: true } },
    },
  });
  return courses;
}

/** Aggregate friction and progress for a course. */
async function getCourseSignals(tenantId: string, courseId: string) {
  const [signals, briefs, progress] = await Promise.all([
    prisma.frictionSignal.count({
      where: {
        tenantId,
        courseId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.interventionBrief.count({
      where: { tenantId, courseId, status: "PENDING" },
    }),
    prisma.studentModuleProgress.findMany({
      where: { tenantId, module: { courseId } },
      select: { masteryScore: true },
    }),
  ]);

  const uniqueStudents = await prisma.frictionSignal.groupBy({
    by: ["studentId"],
    where: {
      tenantId,
      courseId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  const avgMastery =
    progress.length > 0
      ? progress.reduce((acc, p) => acc + (p.masteryScore ?? 0), 0) / progress.length
      : null;

  return {
    frictionCount: signals,
    frictionStudentCount: uniqueStudents.length,
    pendingBriefsCount: briefs,
    avgMasteryScore: avgMastery,
  };
}

/**
 * Run Faculty Orchestrator: gather course health, then LLM to generate
 * recommendations and summary.
 */
export async function runFacultyOrchestrator(
  input: OrchestratorInput
): Promise<FacultyOrchestratorOutput> {
  const courses = await getLecturerCourses(input.tenantId, input.lecturerId);
  if (courses.length === 0) {
    return {
      ok: true,
      courseHealth: [],
      recommendations: [],
      summary: "No courses found for this lecturer.",
    };
  }

  const courseHealth: CourseHealthSummary[] = [];
  for (const c of courses) {
    const stats = await getCourseSignals(input.tenantId, c.id);
    courseHealth.push({
      courseId: c.id,
      courseTitle: c.title,
      moduleCount: c.modules.length,
      frictionStudentCount: stats.frictionStudentCount,
      pendingBriefsCount: stats.pendingBriefsCount,
      avgMasteryScore: stats.avgMasteryScore,
    });
  }

  const healthContext = courseHealth
    .map(
      (h) =>
        `- ${h.courseTitle}: ${h.moduleCount} modules, ${h.frictionStudentCount} students with friction (30d), ${h.pendingBriefsCount} pending briefs, avg mastery ${h.avgMasteryScore != null ? (h.avgMasteryScore * 100).toFixed(0) + "%" : "N/A"}`
    )
    .join("\n");

  const systemPrompt = `You are a Faculty Orchestrator for an LMS. Given course health data (friction signals, pending intervention briefs, average mastery), output a JSON object with:
1. "summary": 2–3 sentence summary of overall course health.
2. "recommendations": array of objects, each with: "type" ("redesign" | "dropout_risk" | "content"), "courseId", "courseTitle", "moduleId" (optional), "moduleTitle" (optional), "title", "description", and optionally "applyPayload" (object with keys like "suggestion" for one-click apply).
Keep 3–8 recommendations. Focus on courses with high friction or low mastery. Output only the JSON object, no markdown.`;

  const userPrompt = `Course health:\n${healthContext}\n\nGenerate summary and recommendations.`;

  const llm = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 1024,
  });

  let recommendations: Recommendation[] = [];
  let summary: string | undefined;

  if (llm.ok) {
    try {
      const raw = llm.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
      const parsed = JSON.parse(raw) as { summary?: string; recommendations?: Recommendation[] };
      summary = typeof parsed.summary === "string" ? parsed.summary : undefined;
      if (Array.isArray(parsed.recommendations)) {
        recommendations = parsed.recommendations.map((r, i) => {
          const courseId =
            r.courseId ??
            courseHealth.find((h) => h.courseTitle === r.courseTitle)?.courseId ??
            "";
          return {
            id: `rec-${i}-${courseId}`,
            type: r.type ?? "content",
            courseId,
            courseTitle: r.courseTitle ?? "",
            moduleId: r.moduleId,
            moduleTitle: r.moduleTitle,
            title: r.title ?? "Recommendation",
            description: r.description ?? "",
            applyPayload: r.applyPayload,
          };
        });
      }
    } catch {
      summary = llm.text.slice(0, 500);
    }
  }

  return {
    ok: true,
    courseHealth,
    recommendations,
    summary,
  };
}
