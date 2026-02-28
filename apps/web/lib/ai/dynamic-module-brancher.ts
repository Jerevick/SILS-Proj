/**
 * DynamicModuleBrancher: Uses StudentCoach Agent + LLM Router to fork content in real-time
 * based on friction signals. Returns AI-generated alternative content, micro-scaffolds,
 * and pathway steps for the learner view.
 */

import { prisma } from "@/lib/db";
import { runStudentCoachAgent } from "@/lib/ai/student-coach-agent";
import { runLLMRouter } from "@/lib/ai/llm-router";
import type { StudentCoachInput, FrictionSignalInput } from "@/lib/ai/student-coach-types";

export type DynamicBrancherInput = {
  studentId: string;
  tenantId: string;
  moduleId: string;
  courseId: string;
  currentProgress: number;
  frictionSignals: FrictionSignalInput[];
  moduleTitle?: string;
  /** Existing module content (e.g. contentJson) for context when generating alternatives. */
  moduleContentSummary?: string;
};

export type BrancherResult = {
  ok: true;
  /** Coach decision (action, content, suggestedMasteryLevel). */
  decision: import("@/lib/ai/student-coach-types").CoachDecision;
  /** AI-generated alternative content / micro-scaffold to show (if any). */
  alternativeContent?: string;
  /** Current pathway step index for adaptive_pathways. */
  pathwayStep?: number;
  /** Whether an intervention brief was created for lecturer. */
  interventionBriefCreated: boolean;
};

export type BrancherError = { ok: false; error: string };

export type DynamicBrancherOutput = BrancherResult | BrancherError;

const EXPAND_CONTENT_SYSTEM = `You are an instructional designer. Given a short hint or suggestion from a learning coach agent, expand it into a clear, concise block of content to show the student (alternative explanation, micro-scaffold, or pathway hint). Output only the content text, no JSON. Keep it under 200 words.`;

/**
 * Run the dynamic brancher: StudentCoach first, then optionally expand content via LLM,
 * upsert StudentModuleProgress, and return content for the UI.
 */
export async function runDynamicModuleBrancher(
  input: DynamicBrancherInput
): Promise<DynamicBrancherOutput> {
  const coachInput: StudentCoachInput = {
    studentId: input.studentId,
    tenantId: input.tenantId,
    moduleId: input.moduleId,
    courseId: input.courseId,
    currentProgress: input.currentProgress,
    frictionSignals: input.frictionSignals,
    moduleTitle: input.moduleTitle,
  };

  const coachResult = await runStudentCoachAgent(coachInput);
  if (!coachResult.ok) {
    return { ok: false, error: coachResult.error };
  }

  const { decision } = coachResult;
  let alternativeContent: string | undefined = decision.content;

  // Optionally expand brief coach content into richer alternative content via LLM
  if (
    decision.action !== "none" &&
    decision.content &&
    (decision.action === "alternative_explanation" || decision.action === "micro_scaffold")
  ) {
    const expandResult = await runLLMRouter({
      systemPrompt: EXPAND_CONTENT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Module context: ${input.moduleTitle ?? "Unknown"}. Coach suggestion: ${decision.content}${input.moduleContentSummary ? `\nOriginal content summary: ${input.moduleContentSummary}` : ""}`,
        },
      ],
      preferredProvider: "claude",
      maxTokens: 512,
    });
    if (expandResult.ok && expandResult.text.trim()) {
      alternativeContent = expandResult.text.trim();
    }
  }

  // Resolve pathway step from adaptive_pathways if branching_pathway
  let pathwayStep: number | undefined;
  const moduleRecord = await prisma.module.findUnique({
    where: { id: input.moduleId },
    select: { adaptivePathways: true },
  });
  const pathways = moduleRecord?.adaptivePathways as
    | { condition: string; path: string; steps?: unknown[] }[]
    | null;
  if (decision.action === "branching_pathway" && pathways?.length) {
    pathwayStep = 0;
  }

  // Upsert StudentModuleProgress
  const frictionEntry = {
    at: new Date().toISOString(),
    signalTypes: input.frictionSignals.map((s) => s.signalType),
    payload: input.frictionSignals[0]?.payload,
  };
  const masteryScore =
    decision.suggestedMasteryLevel === "mastered"
      ? 1
      : decision.suggestedMasteryLevel === "on_track"
        ? 0.7
        : decision.suggestedMasteryLevel === "struggling"
          ? 0.3
          : null;

  const unique = {
    tenantId: input.tenantId,
    studentId: input.studentId,
    moduleId: input.moduleId,
  };

  const existing = await prisma.studentModuleProgress.findUnique({
    where: { tenantId_studentId_moduleId: unique },
  });

  const frictionHistory = existing?.frictionHistory as unknown[] | null;
  const nextHistory = Array.isArray(frictionHistory)
    ? [...frictionHistory.slice(-19), frictionEntry]
    : [frictionEntry];

  await prisma.studentModuleProgress.upsert({
    where: { tenantId_studentId_moduleId: unique },
    create: {
      ...unique,
      masteryScore: masteryScore ?? undefined,
      currentPathwayStep: pathwayStep ?? undefined,
      frictionHistory: nextHistory as object,
    },
    update: {
      masteryScore: masteryScore ?? undefined,
      currentPathwayStep: pathwayStep ?? existing?.currentPathwayStep ?? undefined,
      frictionHistory: nextHistory as object,
    },
  });

  return {
    ok: true,
    decision,
    alternativeContent: alternativeContent || decision.content || undefined,
    pathwayStep,
    interventionBriefCreated: coachResult.interventionBriefCreated,
  };
}
