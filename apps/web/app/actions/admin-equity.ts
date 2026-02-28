"use server";

/**
 * Admin Equity: get AI-generated insights on equity gaps for a tenant.
 * Platform admin only. Uses LLM_Router for culturally aware, actionable insights.
 */

import { auth } from "@clerk/nextjs/server";
import { canViewInstitutions } from "@/lib/platform-auth";
import { runLLMRouter } from "@/lib/ai/llm-router";

export type EquityInsightsPayload = {
  summary: string;
  gaps: string[];
  recommendations: string[];
};

export async function getEquityInsights(
  tenantId: string,
  dataSummary: string
): Promise<{ ok: true; insights: EquityInsightsPayload } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId || !(await canViewInstitutions(userId))) {
    return { ok: false, error: "Forbidden" };
  }

  const systemPrompt = `You are an equity analyst for education. Given a short summary of completion rates and demographic counts for one institution, output a JSON object (no markdown, no code fence) with:
{
  "summary": "2-3 sentences summarizing equity posture and main observation",
  "gaps": ["list of 2-5 specific equity gaps or disparities observed"],
  "recommendations": ["list of 2-5 actionable, inclusive recommendations for the institution"]
}
Be culturally aware, avoid stereotyping, and focus on structural support and access rather than deficit framing. Output only the JSON object.`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: dataSummary }],
    preferredProvider: "claude",
    maxTokens: 512,
    cachePrefix: "equity-insights",
  });

  if (!result.ok) return { ok: false, error: result.error };

  const trimmed = result.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const insights: EquityInsightsPayload = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      gaps: Array.isArray(parsed.gaps) ? (parsed.gaps as string[]) : [],
      recommendations: Array.isArray(parsed.recommendations) ? (parsed.recommendations as string[]) : [],
    };
    return { ok: true, insights };
  } catch {
    return { ok: false, error: "Failed to parse AI insights." };
  }
}
