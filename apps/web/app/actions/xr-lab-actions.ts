"use server";

/**
 * Phase 10: XR Lab server actions.
 * - RecordXRSession: saves interaction data, performance metrics, and updates StudentCompetency/mastery.
 * - GenerateAIScenario: uses LLM_Router to dynamically modify scene_config based on student performance.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { getEmbeddingOrNull } from "@/lib/embeddings";
import { toVectorString } from "@/lib/competency-vector";
import { runLLMRouter } from "@/lib/ai/llm-router";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordXRSessionInput = {
  labId: string;
  /** When the session started (ISO string). */
  startedAt: string;
  /** When the session ended (ISO string). */
  endedAt: string;
  /** Raw interaction events: time spent per zone, correct/incorrect actions, errors. */
  interactionData: Record<string, unknown>;
  /** Derived: e.g. { score, correctCount, errorCount, completionRatio, timeSpentSeconds }. */
  performanceMetrics: Record<string, unknown>;
};

export type RecordXRSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export type GenerateAIScenarioInput = {
  labId: string;
  /** Current scene_config JSON (A-Frame/Three.js) to modify. */
  currentSceneConfig: Record<string, unknown>;
  /** Recent performance in this session for context. */
  performanceSoFar?: { correctActions: number; errors: number; timeSpentSeconds: number };
  /** "simpler" | "harder" */
  direction: "simpler" | "harder";
};

export type GenerateAIScenarioResult =
  | { ok: true; sceneConfig: Record<string, unknown> }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// RecordXRSession
// ---------------------------------------------------------------------------

/**
 * Records an XR session, persists interaction and performance data,
 * and updates StudentCompetency (mastery + vector) for competencies linked to the lab.
 */
export async function RecordXRSession(
  input: RecordXRSessionInput
): Promise<RecordXRSessionResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const { tenantId } = tenantResult.context;

  const lab = await prisma.xR_Lab.findFirst({
    where: { id: input.labId },
    include: {
      programme: { include: { competencies: true } },
    },
  });

  if (!lab) {
    return { ok: false, error: "XR Lab not found" };
  }

  // Ensure student is enrolled in the programme (optional: allow if lab is tenant-visible)
  const enrollment = await prisma.programmeEnrollment.findUnique({
    where: {
      programmeId_studentId: { programmeId: lab.programmeId, studentId: userId },
    },
  });

  // Allow recording even without enrollment (e.g. demo or instructor-assigned); for strict filtering use API list.
  // if (!enrollment) return { ok: false, error: "Not enrolled in this programme" };

  const session = await prisma.xRSession.create({
    data: {
      xrLabId: lab.id,
      tenantId,
      studentId: userId,
      startedAt: new Date(input.startedAt),
      endedAt: new Date(input.endedAt),
      interactionData: input.interactionData as object,
      performanceMetrics: input.performanceMetrics as object,
    },
  });

  // Update StudentCompetency from lab.masteryMetrics and performance
  const masteryMetrics = lab.masteryMetrics as {
    competencyIds?: string[];
    weightCorrect?: number;
    weightTime?: number;
    weightErrors?: number;
    masteryDelta?: number;
  } | null;

  const metrics = input.performanceMetrics as {
    score?: number;
    correctCount?: number;
    errorCount?: number;
    completionRatio?: number;
    timeSpentSeconds?: number;
  };
  const correctCount = metrics?.correctCount ?? 0;
  const errorCount = metrics?.errorCount ?? 0;
  const timeSpent = metrics?.timeSpentSeconds ?? 0;
  const completionRatio = metrics?.completionRatio ?? metrics?.score ?? 0.5;

  const competencyIds: string[] =
    Array.isArray(masteryMetrics?.competencyIds) && masteryMetrics.competencyIds.length > 0
      ? masteryMetrics.competencyIds
      : lab.programme.competencies.map((c) => c.id);

  if (competencyIds.length === 0) {
    return { ok: true, sessionId: session.id };
  }

  const weightCorrect = masteryMetrics?.weightCorrect ?? 0.5;
  const weightErrors = masteryMetrics?.weightErrors ?? -0.2;
  const weightTime = masteryMetrics?.weightTime ?? 0.1;
  const masteryDelta = masteryMetrics?.masteryDelta ?? 0.15;

  // Simple composite: higher correct + completion, lower errors -> small mastery increase
  const rawDelta =
    (completionRatio * 0.4 + Math.min(1, correctCount / 10) * weightCorrect) +
    (errorCount > 0 ? errorCount * weightErrors : 0) +
    Math.min(0.1, (timeSpent / 600) * weightTime);
  const delta = Math.max(-0.2, Math.min(masteryDelta, rawDelta));

  for (const competencyId of competencyIds) {
    const competency = await prisma.competency.findFirst({
      where: { id: competencyId },
    });
    if (!competency) continue;

    const existing = await prisma.studentCompetency.findUnique({
      where: {
        tenantId_studentId_competencyId: {
          tenantId,
          studentId: userId,
          competencyId,
        },
      },
    });

    const newLevel = Math.min(
      1,
      Math.max(0, (existing?.masteryLevel ?? 0) + delta)
    );

    const evidenceJson = {
      source: "xr_lab",
      xrLabId: lab.id,
      sessionId: session.id,
      endedAt: input.endedAt,
      performanceMetrics: input.performanceMetrics,
    };

    await prisma.studentCompetency.upsert({
      where: {
        tenantId_studentId_competencyId: {
          tenantId,
          studentId: userId,
          competencyId,
        },
      },
      create: {
        tenantId,
        studentId: userId,
        competencyId,
        masteryLevel: newLevel,
        evidenceJson: evidenceJson as object,
      },
      update: {
        masteryLevel: newLevel,
        evidenceJson: evidenceJson as object,
      },
    });

    const textForEmbedding = `${competency.title} ${competency.description ?? ""} ${competency.code}`.trim();
    const embedding = await getEmbeddingOrNull(textForEmbedding);
    if (embedding?.length) {
      const vectorStr = toVectorString(embedding);
      await prisma.$executeRawUnsafe(
        `UPDATE "StudentCompetency" SET "vectorEmbedding" = $1::vector, "lastUpdated" = NOW() WHERE "tenantId" = $2 AND "studentId" = $3 AND "competencyId" = $4`,
        vectorStr,
        tenantId,
        userId,
        competencyId
      );
    }
  }

  return { ok: true, sessionId: session.id };
}

// ---------------------------------------------------------------------------
// GenerateAIScenario
// ---------------------------------------------------------------------------

const GENERATE_SCENARIO_SYSTEM = `You are an expert in immersive learning design. You modify XR/WebXR scene configurations (A-Frame or Three.js style) to adapt difficulty.

Given:
1. The current scene_config (JSON) describing the immersive lab scene (entities, objects, scripts, difficulty parameters).
2. The student's recent performance (correct actions, errors, time spent).
3. A direction: "simpler" (reduce difficulty, add hints, fewer steps) or "harder" (increase difficulty, fewer hints, more steps).

Output a valid JSON object that is the modified scene_config. Preserve all required structure and keys; only change values that affect difficulty (e.g. hint visibility, number of steps, time limits, complexity of tasks). Do not add commentary; output only the JSON object.`;

/**
 * Dynamically modifies scene_config using LLM based on student performance and requested direction.
 */
export async function GenerateAIScenario(
  input: GenerateAIScenarioInput
): Promise<GenerateAIScenarioResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  const lab = await prisma.xR_Lab.findFirst({
    where: { id: input.labId },
  });
  if (!lab) {
    return { ok: false, error: "XR Lab not found" };
  }

  const performanceSummary = input.performanceSoFar
    ? `Performance: ${input.performanceSoFar.correctActions} correct actions, ${input.performanceSoFar.errors} errors, ${input.performanceSoFar.timeSpentSeconds}s spent.`
    : "No performance data yet.";

  const userMessage = `Current scene_config:
${JSON.stringify(input.currentSceneConfig, null, 2)}

${performanceSummary}

Direction: Make the experience ${input.direction}.

Return only the modified scene_config as a single JSON object, no markdown or explanation.`;

  const result = await runLLMRouter({
    systemPrompt: GENERATE_SCENARIO_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 4096,
    cachePrefix: "xr-scenario",
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  let text = result.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  try {
    const sceneConfig = JSON.parse(text) as Record<string, unknown>;
    return { ok: true, sceneConfig };
  } catch {
    return { ok: false, error: "LLM did not return valid JSON scene_config" };
  }
}
