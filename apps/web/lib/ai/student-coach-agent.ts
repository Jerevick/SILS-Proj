/**
 * StudentCoachAgent: detects friction, decides real-time action via LLM Router (Claude),
 * updates student_mastery_state and optionally creates intervention briefs.
 * Called from server action (and optionally from API).
 */

import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import type {
  StudentCoachInput,
  CoachDecision,
  StudentCoachOutput,
  FrictionSignalInput,
} from "@/lib/ai/student-coach-types";
import type { FrictionSignalType, InterventionBriefType } from "@prisma/client";

const SYSTEM_PROMPT = `You are the StudentCoach agent for an LMS. Given a student's current progress in a module and recent friction signals (e.g. long dwell time, quiz errors, help-seeking), decide the best real-time action.

Output a single JSON object (no markdown, no code fence) with this exact structure:
{
  "action": "micro_scaffold" | "alternative_explanation" | "branching_pathway" | "lecturer_intervention" | "none",
  "content": "string - the actual text to show the student (hint, alternative explanation, or pathway suggestion) or empty if action is none",
  "createInterventionBrief": boolean,
  "briefSummary": "string - optional; short summary for lecturer when createInterventionBrief is true",
  "suggestedMasteryLevel": "struggling" | "on_track" | "mastered" | null,
  "skillsUpdated": ["optional array of skill names or ids"]
}

Rules:
- Prefer micro_scaffold or alternative_explanation for mild friction; use lecturer_intervention only when the student is stuck or at-risk.
- content must be helpful, concise, and ready to display to the student (or brief for lecturer).
- If createInterventionBrief is true, provide briefSummary for the lecturer.
- suggestedMasteryLevel should reflect the inferred state from signals and progress.
- Output only the JSON object.`;

function buildUserPrompt(input: StudentCoachInput): string {
  const signalsDesc = input.frictionSignals.length
    ? input.frictionSignals
        .map(
          (s) =>
            `- ${s.signalType}: ${JSON.stringify(s.payload ?? {})}`
        )
        .join("\n")
    : "No recent friction signals.";
  return [
    `Module: ${input.moduleTitle ?? "Unknown"} (progress: ${input.currentProgress}%)`,
    "",
    "Friction signals:",
    signalsDesc,
  ].join("\n");
}

function parseCoachDecision(raw: string): CoachDecision | null {
  const trimmed = raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const action = parsed.action as string;
    const validActions = [
      "micro_scaffold",
      "alternative_explanation",
      "branching_pathway",
      "lecturer_intervention",
      "none",
    ];
    return {
      action: validActions.includes(action) ? (action as CoachDecision["action"]) : "none",
      content: typeof parsed.content === "string" ? parsed.content : "",
      createInterventionBrief: Boolean(parsed.createInterventionBrief),
      briefSummary:
        typeof parsed.briefSummary === "string" ? parsed.briefSummary : undefined,
      suggestedMasteryLevel:
        typeof parsed.suggestedMasteryLevel === "string"
          ? parsed.suggestedMasteryLevel
          : undefined,
      skillsUpdated: Array.isArray(parsed.skillsUpdated)
        ? (parsed.skillsUpdated as string[])
        : undefined,
    };
  } catch {
    return null;
  }
}

function toBriefType(action: CoachDecision["action"]): InterventionBriefType {
  switch (action) {
    case "micro_scaffold":
      return "MICRO_SCAFFOLD";
    case "alternative_explanation":
      return "ALTERNATIVE_EXPLANATION";
    case "branching_pathway":
      return "BRANCHING_PATHWAY";
    case "lecturer_intervention":
      return "LECTURER_INTERVENTION";
    default:
      return "LECTURER_INTERVENTION";
  }
}

/**
 * Persist friction signals to the database (for analytics and agent context).
 */
async function persistFrictionSignals(
  tenantId: string,
  studentId: string,
  moduleId: string | null,
  courseId: string | null,
  signals: FrictionSignalInput[]
): Promise<void> {
  if (signals.length === 0) return;
  await prisma.frictionSignal.createMany({
    data: signals.map((s) => ({
      tenantId,
      studentId,
      moduleId,
      courseId,
      signalType: s.signalType,
      payload: s.payload ?? undefined,
    })),
  });
}

/**
 * Run the StudentCoach agent: LLM decision, persist signals, update mastery state, create brief if needed.
 */
export async function runStudentCoachAgent(
  input: StudentCoachInput
): Promise<StudentCoachOutput> {
  // 1. Persist incoming friction signals
  await persistFrictionSignals(
    input.tenantId,
    input.studentId,
    input.moduleId,
    input.courseId,
    input.frictionSignals
  );

  // 2. Call LLM Router (Claude Sonnet for reasoning)
  const routerResult = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: "student-coach",
  });

  if (!routerResult.ok) {
    return { ok: false, error: routerResult.error };
  }

  const decision = parseCoachDecision(routerResult.text);
  if (!decision) {
    return {
      ok: false,
      error: "Failed to parse coach decision from AI response.",
    };
  }

  let interventionBriefCreated = false;
  if (decision.createInterventionBrief && decision.briefSummary) {
    await prisma.interventionBrief.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        moduleId: input.moduleId,
        courseId: input.courseId,
        briefType: toBriefType(decision.action),
        content: decision.briefSummary,
        status: "PENDING",
      },
    });
    interventionBriefCreated = true;
  }

  // 4. Upsert student mastery state
  const stateJson = {
    masteryLevel: decision.suggestedMasteryLevel ?? undefined,
    skills: decision.skillsUpdated ?? [],
    lastInterventionAt: new Date().toISOString(),
    lastAction: decision.action,
  };
  const moduleId = input.moduleId ?? null;
  const existing = await prisma.studentMasteryState.findFirst({
    where: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      moduleId,
    },
  });
  if (existing) {
    await prisma.studentMasteryState.update({
      where: { id: existing.id },
      data: { stateJson, courseId: input.courseId },
    });
  } else {
    await prisma.studentMasteryState.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        moduleId,
        courseId: input.courseId,
        stateJson,
      },
    });
  }

  // 5. Notification: in a full implementation we would trigger in-app or email here.
  const notificationTriggered = interventionBriefCreated;

  return {
    ok: true,
    decision,
    interventionBriefCreated,
    notificationTriggered,
  };
}
