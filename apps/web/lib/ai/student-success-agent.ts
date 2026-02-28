/**
 * StudentSuccessAgent: privacy-first, culturally sensitive nudges (wellness, motivation, time management).
 * Uses LLM_Router; auto-detects equity needs from EquityMetric and suggests adaptations.
 * Integrates with StudentCoach, skills graph, and wellness logging.
 */

import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";
import type {
  StudentSuccessInput,
  StudentSuccessNudge,
  StudentSuccessOutput,
} from "@/lib/ai/student-success-types";
import type { WellnessNudgeType } from "@prisma/client";

const SYSTEM_PROMPT = `You are the Student Success agent for an inclusive LMS. Your role is to generate brief, supportive nudges that are:
- Privacy-first: never assume or mention specific diagnoses; keep tone general and supportive.
- Culturally sensitive: avoid assumptions about culture, family, or background; use inclusive language.
- Proactive but gentle: offer wellness check-ins, motivation, and time-management tips without being pushy.

You will receive:
1. The student's current context (progress, recent activity, current focus).
2. Optional equity flags (first-generation, low-income, neurodiverse, caregiver, etc.) — use these only to suggest supportive adaptations, never to label or stereotype.
3. Preferred language if set.

Output a single JSON object (no markdown, no code fence) with this exact structure:
{
  "nudgeType": "WELLNESS_CHECKIN" | "MOTIVATION" | "TIME_MANAGEMENT" | "STRESS_RELIEF" | "EQUITY_SUPPORT" | "OTHER",
  "message": "string - the actual nudge text to show the student (1-3 sentences max)",
  "suggestedAdaptations": ["optional array of short adaptation tips based on equity context, or empty array"],
  "ctaLabel": "optional string - e.g. 'Log how I feel' or null"
}

Rules:
- nudgeType should match the primary intent (e.g. WELLNESS_CHECKIN for "How are you doing?", MOTIVATION for progress-based encouragement).
- If equity flags are present, include 1-2 brief suggestedAdaptations (e.g. "Short focus blocks may help" for neurodiverse; "Flexible deadlines" for caregiver) — never mention the flag explicitly in the message.
- message must be ready to display; no placeholders.
- Output only the JSON object.`;

function buildUserPrompt(input: StudentSuccessInput, equitySummary: string, preferredLanguage: string | null): string {
  const ctx = input.context;
  const parts = [
    "Current context:",
    `- Progress: ${ctx.progressPercent ?? "unknown"}%`,
    ctx.recentActivitySummary ? `- Recent: ${ctx.recentActivitySummary}` : "",
    ctx.currentFocus ? `- Current focus: ${ctx.currentFocus}` : "",
    ctx.timeOfDay ? `- Time of day: ${ctx.timeOfDay}` : "",
    "",
    equitySummary ? `Equity context (use only for gentle adaptation suggestions): ${equitySummary}` : "No equity flags provided.",
    preferredLanguage ? `Preferred language: ${preferredLanguage}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

function parseNudge(raw: string): StudentSuccessNudge | null {
  const trimmed = raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const validTypes: WellnessNudgeType[] = [
      "WELLNESS_CHECKIN",
      "MOTIVATION",
      "TIME_MANAGEMENT",
      "STRESS_RELIEF",
      "EQUITY_SUPPORT",
      "OTHER",
    ];
    const nudgeType = validTypes.includes(parsed.nudgeType as WellnessNudgeType)
      ? (parsed.nudgeType as WellnessNudgeType)
      : "OTHER";
    return {
      nudgeType,
      message: typeof parsed.message === "string" ? parsed.message : "You've got this. Take a moment when you need it.",
      suggestedAdaptations: Array.isArray(parsed.suggestedAdaptations)
        ? (parsed.suggestedAdaptations as string[]).filter((s) => typeof s === "string")
        : undefined,
      ctaLabel: typeof parsed.ctaLabel === "string" ? parsed.ctaLabel : undefined,
    };
  } catch {
    return null;
  }
}

export async function runStudentSuccessAgent(input: StudentSuccessInput): Promise<StudentSuccessOutput> {
  const [prefs, equity] = await Promise.all([
    prisma.studentPreference.findUnique({
      where: {
        tenantId_studentId: { tenantId: input.tenantId, studentId: input.studentId },
      },
    }),
    prisma.equityMetric.findUnique({
      where: {
        tenantId_studentId: { tenantId: input.tenantId, studentId: input.studentId },
      },
    }),
  ]);

  const preferredLanguage = prefs?.preferredLanguage ?? null;
  const equityParts: string[] = [];
  if (equity) {
    if (equity.firstGen) equityParts.push("first-generation student");
    if (equity.lowIncome) equityParts.push("may have financial constraints");
    if (equity.neurodiverse) equityParts.push("neurodiverse");
    if (equity.caregiver) equityParts.push("caregiver");
    if (equity.refugeeOrDisplaced) equityParts.push("refugee or displaced");
    const other = equity.otherFlags as Record<string, boolean> | null;
    if (other && typeof other === "object") {
      Object.entries(other).filter(([, v]) => v).forEach(([k]) => equityParts.push(k));
    }
  }
  const equitySummary = equityParts.length ? equityParts.join("; ") : "";

  const userPrompt = buildUserPrompt(input, equitySummary, preferredLanguage);
  const routerResult = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 512,
    cachePrefix: "student-success",
  });

  if (!routerResult.ok) {
    return { ok: false, error: routerResult.error };
  }

  const nudge = parseNudge(routerResult.text);
  if (!nudge) {
    return { ok: false, error: "Failed to parse student success nudge from AI response." };
  }

  const wellnessLog = await prisma.wellnessLog.create({
    data: {
      tenantId: input.tenantId,
      studentId: input.studentId,
      nudgeType: nudge.nudgeType,
      message: nudge.message,
      response: null,
    },
  });

  return {
    ok: true,
    nudge,
    wellnessLogId: wellnessLog.id,
  };
}
