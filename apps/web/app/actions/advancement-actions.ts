"use server";

/**
 * Phase 25: Advancement CRM server actions.
 * - AdvancementCRMAgent: Uses LLM_Router to analyze giving history, predict next gift likelihood,
 *   and generate personalized outreach messages. Returns recommendations and draft communication.
 * Scoped: Advancement Officer, Development Director, Dean (school scope), OWNER, ADMIN.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { canAccessAdvancement } from "@/lib/advancement-auth";
import { runLLMRouter } from "@/lib/ai/llm-router";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdvancementCRMAgentResult =
  | {
      ok: true;
      donorId?: string;
      campaignId?: string;
      nextGiftLikelihood: number; // 0–1
      factors: string[];
      recommendations: string[];
      draftMessage: string;
    }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// AdvancementCRMAgent
// ---------------------------------------------------------------------------

/**
 * AdvancementCRMAgent: Analyzes giving history and donor/campaign context via LLM_Router,
 * returns next gift likelihood, factors, recommendations, and a personalized outreach draft.
 */
export async function runAdvancementCRMAgent(input: {
  donorId?: string;
  campaignId?: string;
}): Promise<AdvancementCRMAgentResult> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return { ok: false, error: "Unauthorized" };
  }

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) {
    return { ok: false, error: "Tenant not found" };
  }

  if (!canAccessAdvancement(tenantResult.context.role)) {
    return { ok: false, error: "You do not have permission to run advancement AI." };
  }

  const { tenantId } = tenantResult.context;

  if (!input.donorId && !input.campaignId) {
    return { ok: false, error: "Provide either donorId or campaignId." };
  }

  let donorContext: string;
  let donorName = "";
  let campaignName = "";

  if (input.donorId) {
    const donor = await prisma.donor.findFirst({
      where: { id: input.donorId, tenantId },
      include: {
        donations: {
          include: { campaign: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 20,
        },
        advancementInteractions: { orderBy: { date: "desc" }, take: 10 },
      },
    });
    if (!donor) {
      return { ok: false, error: "Donor not found." };
    }
    donorName = donor.name;
    const lifetimeValue = Number(donor.lifetimeValue);
    const affinityScore = donor.affinityScore;
    const lastContact = donor.lastContactDate?.toISOString().slice(0, 10) ?? "Never";
    const tags = donor.tags?.length ? donor.tags.join(", ") : "None";
    const donationSummary = donor.donations
      .map(
        (d) =>
          `${d.date.toISOString().slice(0, 10)}: $${Number(d.amount).toFixed(2)}${d.campaign?.name ? ` (${d.campaign.name})` : ""}`
      )
      .join("\n");
    const interactionSummary =
      donor.advancementInteractions.length > 0
        ? donor.advancementInteractions
            .map(
              (i) =>
                `${i.date.toISOString().slice(0, 10)}: ${i.type} - ${(i.notes ?? "").slice(0, 80)}`
            )
            .join("\n")
        : "No interactions recorded.";
    donorContext = [
      `Donor: ${donor.name} (${donor.email})`,
      `Lifetime value: $${lifetimeValue.toFixed(2)}`,
      `Affinity score: ${affinityScore}`,
      `Last contact: ${lastContact}`,
      `Tags: ${tags}`,
      "Recent donations:",
      donationSummary || "None",
      "Recent interactions:",
      interactionSummary,
    ].join("\n");
  } else {
    donorContext = "No specific donor; analyzing campaign context.";
  }

  if (input.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, tenantId },
      include: {
        donations: { include: { donor: true }, orderBy: { date: "desc" } },
        school: { select: { name: true } },
      },
    });
    if (!campaign) {
      return { ok: false, error: "Campaign not found." };
    }
    campaignName = campaign.name;
    const goal = Number(campaign.goalAmount);
    const totalRaised = campaign.donations.reduce((s, d) => s + Number(d.amount), 0);
    const progressPct = goal > 0 ? (totalRaised / goal) * 100 : 0;
    donorContext += [
      "",
      "Campaign context:",
      `Campaign: ${campaign.name}`,
      `Goal: $${goal.toFixed(2)}`,
      `Raised: $${totalRaised.toFixed(2)} (${progressPct.toFixed(0)}%)`,
      `Status: ${campaign.status}`,
      `Donor count: ${campaign.donations.length}`,
    ].join("\n");
  }

  const systemPrompt = `You are an advancement (fundraising) CRM assistant. Given donor and/or campaign context, output a JSON object (no markdown, no code fence) with:
{
  "nextGiftLikelihood": number between 0 and 1 (probability of next gift in next 12 months),
  "factors": ["3-5 short factors that influence this likelihood"],
  "recommendations": ["2-4 actionable recommendations for the officer"],
  "draftMessage": "A short, personalized outreach message (2-4 sentences) suitable for email or call. Be warm, specific to their giving history, and include a clear but soft ask."
}
Consider: lifetime value, affinity score, recency of last contact, donation frequency, campaign alignment. Be concise and professional. Output only the JSON object.`;

  const userPrompt = `Analyze the following donor/campaign data and provide likelihood, factors, recommendations, and a draft outreach message.\n\n${donorContext}`;

  const result = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: "advancement-crm",
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const trimmed = result.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  let parsed: {
    nextGiftLikelihood: number;
    factors: string[];
    recommendations: string[];
    draftMessage: string;
  };
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    parsed = {
      nextGiftLikelihood:
        typeof raw.nextGiftLikelihood === "number"
          ? Math.max(0, Math.min(1, raw.nextGiftLikelihood))
          : 0.5,
      factors: Array.isArray(raw.factors) ? (raw.factors as string[]) : [],
      recommendations: Array.isArray(raw.recommendations)
        ? (raw.recommendations as string[])
        : [],
      draftMessage: typeof raw.draftMessage === "string" ? raw.draftMessage : "",
    };
  } catch {
    return { ok: false, error: "Failed to parse AI response." };
  }

  return {
    ok: true,
    donorId: input.donorId,
    campaignId: input.campaignId,
    nextGiftLikelihood: parsed.nextGiftLikelihood,
    factors: parsed.factors,
    recommendations: parsed.recommendations,
    draftMessage: parsed.draftMessage,
  };
}
