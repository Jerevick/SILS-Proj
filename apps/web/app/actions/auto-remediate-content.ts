"use server";

/**
 * AutoRemediateContent: generates alt-text, simplified version, and low-bandwidth text/voice fallback for a module.
 * Input: content_id (module id). Stores results in Module.dynamicContent.remediated for use by Simplify/Low-Bandwidth toggles.
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import { runLLMRouter } from "@/lib/ai/llm-router";

export type AutoRemediateResult = {
  ok: true;
  altText: string;
  simplified: string;
  lowBandwidthText: string;
  voiceFallbackSummary?: string;
};

export async function autoRemediateContent(contentId: string): Promise<
  | AutoRemediateResult
  | { ok: false; error: string }
> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false, error: "Unauthorized" };

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false, error: "Tenant not found" };

  const moduleRow = await prisma.module.findFirst({
    where: {
      id: contentId,
      course: { tenantId: tenantResult.context.tenantId },
    },
    select: { id: true, title: true, contentJson: true, dynamicContent: true },
  });

  if (!moduleRow) return { ok: false, error: "Module not found" };

  const rawContent =
    typeof moduleRow.contentJson === "string"
      ? moduleRow.contentJson
      : typeof moduleRow.contentJson === "object" && moduleRow.contentJson !== null
        ? JSON.stringify(moduleRow.contentJson)
        : "";
  const contentPreview = rawContent.slice(0, 6000);
  const title = moduleRow.title || "Untitled module";

  const systemPrompt = `You are an accessibility and inclusion assistant for learning content. Given a learning module's title and content, produce the following in a single JSON object (no markdown, no code fence):

{
  "altText": "1-3 sentences describing the content for screen readers or when images/media are unavailable",
  "simplified": "A simplified, plain-language version of the main ideas (2-5 short paragraphs). Use clear vocabulary and short sentences.",
  "lowBandwidthText": "A concise text-only summary suitable for low bandwidth (key points only, minimal prose)",
  "voiceFallbackSummary": "One short paragraph that could be read aloud as an audio fallback"
}

Rules:
- Be accurate and preserve learning objectives; do not omit key concepts.
- Use inclusive, clear language. Avoid jargon in simplified and lowBandwidthText.
- Output only the JSON object.`;

  const userPrompt = `Module title: ${title}\n\nContent:\n${contentPreview}`;

  const routerResult = await runLLMRouter({
    systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: "auto-remediate",
  });

  if (!routerResult.ok) {
    return { ok: false, error: routerResult.error };
  }

  const trimmed = routerResult.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Failed to parse remediation from AI response." };
  }

  const altText = typeof parsed.altText === "string" ? parsed.altText : "";
  const simplified = typeof parsed.simplified === "string" ? parsed.simplified : "";
  const lowBandwidthText = typeof parsed.lowBandwidthText === "string" ? parsed.lowBandwidthText : "";
  const voiceFallbackSummary =
    typeof parsed.voiceFallbackSummary === "string" ? parsed.voiceFallbackSummary : undefined;

  const existingDynamic = (moduleRow.dynamicContent as Record<string, unknown>) ?? {};
  const remediated = {
    altText,
    simplified,
    lowBandwidthText,
    voiceFallbackSummary,
    generatedAt: new Date().toISOString(),
  };

  await prisma.module.update({
    where: { id: contentId },
    data: {
      dynamicContent: {
        ...existingDynamic,
        remediated,
      },
    },
  });

  return {
    ok: true,
    altText,
    simplified,
    lowBandwidthText,
    voiceFallbackSummary,
  };
}

/** Get remediated content for a module (from dynamicContent.remediated) without generating. */
export async function getRemediatedContent(contentId: string): Promise<
  | { ok: true; remediated: { altText: string; simplified: string; lowBandwidthText: string; voiceFallbackSummary?: string } }
  | { ok: false; error: string }
> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false, error: "Unauthorized" };

  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false, error: "Tenant not found" };

  const moduleRow = await prisma.module.findFirst({
    where: {
      id: contentId,
      course: { tenantId: tenantResult.context.tenantId },
    },
    select: { dynamicContent: true },
  });

  if (!moduleRow) return { ok: false, error: "Module not found" };

  const dyn = moduleRow.dynamicContent as { remediated?: Record<string, unknown> } | null;
  const r = dyn?.remediated;
  if (!r || typeof r !== "object") {
    return { ok: false, error: "No remediated content yet" };
  }

  return {
    ok: true,
    remediated: {
      altText: typeof r.altText === "string" ? r.altText : "",
      simplified: typeof r.simplified === "string" ? r.simplified : "",
      lowBandwidthText: typeof r.lowBandwidthText === "string" ? r.lowBandwidthText : "",
      voiceFallbackSummary: typeof r.voiceFallbackSummary === "string" ? r.voiceFallbackSummary : undefined,
    },
  };
}
