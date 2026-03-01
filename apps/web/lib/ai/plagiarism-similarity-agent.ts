/**
 * Phase 22: PlagiarismSimilarityAgent — lightweight AI similarity check via LLM_Router.
 * Analyzes submission text for potential plagiarism indicators (common phrases, web-like text,
 * repeated patterns) and returns overall similarity score + detailed matches with excerpts.
 * Used when Turnitin/Copyleaks are not configured; production can swap in LTI/API stubs.
 */

import { runLLMRouter } from "@/lib/ai/llm-router";
import type {
  PlagiarismMatch,
  PlagiarismReportPayload,
  PlagiarismSimilarityInput,
  PlagiarismSimilarityOutput,
} from "./plagiarism-types";

const SYSTEM_PROMPT = `You are an academic originality checker. Analyze the given student submission text for potential plagiarism indicators.

Consider:
- Phrases that sound generic or commonly found in essays (e.g. "It is widely known that", "In conclusion")
- Suspiciously formal or template-like passages
- Repeated sentence structures that might indicate copy-paste
- You do NOT have access to the internet or a database; base analysis only on the text's style and common patterns.

Output a single JSON object (no markdown, no code fence) with this exact structure:
{
  "overallScore": number between 0 and 100 (0 = highly original, 100 = highly similar to common/generic text; typical range 5–40 for normal essays),
  "detailedMatches": [
    {
      "source": "string - short label e.g. 'Generic essay phrase', 'Common conclusion'",
      "similarityPct": number 0-100 for this match,
      "excerpt": "string - the exact or paraphrased passage from the submission that triggered this match",
      "startOffset": number optional - approximate character index of excerpt start in the submission (0-based),
      "endOffset": number optional - approximate character index of excerpt end
    }
  ]
}

Rules:
- Include at most 5–8 detailedMatches. Focus on the most significant overlaps.
- overallScore should reflect the aggregate similarity (not average of matches).
- If the text is short (< 100 chars), return overallScore 0 and empty detailedMatches.
- Output only the JSON object.`;

function parsePlagiarismResult(raw: string, contentLength: number): PlagiarismReportPayload | null {
  const trimmed = raw.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const overallScore =
      typeof parsed.overallScore === "number"
        ? Math.max(0, Math.min(100, parsed.overallScore))
        : 0;
    const rawMatches = Array.isArray(parsed.detailedMatches) ? parsed.detailedMatches : [];
    const detailedMatches: PlagiarismMatch[] = rawMatches
      .filter((m): m is Record<string, unknown> => m != null && typeof m === "object")
      .slice(0, 10)
      .map((m) => ({
        source: typeof m.source === "string" ? m.source : "Unknown",
        similarityPct:
          typeof m.similarityPct === "number"
            ? Math.max(0, Math.min(100, m.similarityPct))
            : 0,
        excerpt: typeof m.excerpt === "string" ? m.excerpt : "",
        startOffset: typeof m.startOffset === "number" ? m.startOffset : undefined,
        endOffset: typeof m.endOffset === "number" ? m.endOffset : undefined,
        sourceUrl: typeof m.sourceUrl === "string" ? m.sourceUrl : undefined,
      }))
      .filter((m) => m.excerpt.length > 0);

    return { overallScore, detailedMatches };
  } catch {
    return null;
  }
}

export async function runPlagiarismSimilarityAgent(
  input: PlagiarismSimilarityInput
): Promise<PlagiarismSimilarityOutput> {
  const text = (input.contentText || "").trim();
  if (!text) {
    return { ok: true, payload: { overallScore: 0, detailedMatches: [] } };
  }

  const userPrompt = `Analyze the following submission text for originality.\n\nSubmission text:\n${text.slice(0, 15000)}`;

  const routerResult = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    preferredProvider: "claude",
    maxTokens: 2048,
    cachePrefix: "plagiarism",
  });

  if (!routerResult.ok) {
    return { ok: false, error: routerResult.error };
  }

  const payload = parsePlagiarismResult(routerResult.text, text.length);
  if (!payload) {
    return { ok: false, error: "Failed to parse plagiarism analysis response." };
  }

  return { ok: true, payload };
}
