/**
 * HuddleModerator: Uses LLM_Router to summarize huddle messages in real-time
 * and detect "points of confusion" for the lecturer/moderator.
 * Called from API when moderator requests a summary or on a time/size trigger.
 */

import { runLLMRouter } from "@/lib/ai/llm-router";

export interface HuddleModeratorInput {
  /** Recent messages (authorId, content, createdAt) — last N or since last summary */
  messages: { authorId: string; content: string; createdAt: string }[];
  /** Optional: previous summary for incremental update */
  previousSummary?: string;
  /** Optional: previous points of confusion */
  previousConfusionPoints?: string[];
}

export interface HuddleModeratorOutput {
  ok: true;
  /** Short running summary of the discussion */
  summary: string;
  /** Detected points of confusion or open questions (for lecturer follow-up) */
  pointsOfConfusion: string[];
  /** Suggested next prompt for the moderator (e.g. "Ask if anyone needs clarification on X") */
  suggestedPrompt?: string;
}

export interface HuddleModeratorError {
  ok: false;
  error: string;
}

const SYSTEM_PROMPT = `You are an AI moderator for a live student huddle (small-group discussion). Given the recent messages, produce:
1. A brief running summary of the discussion (2-4 sentences).
2. A list of "points of confusion" — topics where students seem stuck, disagree, or are asking for clarification. Keep each item one short sentence. If none, return an empty array.
3. Optionally one suggested prompt the human moderator could use to unblock the discussion.

Output a single JSON object (no markdown, no code fence) with this exact structure:
{
  "summary": "string",
  "pointsOfConfusion": ["string", "..."],
  "suggestedPrompt": "string or null"
}

Rules:
- Be concise. Summary should capture main ideas and decisions, not every message.
- Points of confusion should be actionable for the lecturer.
- suggestedPrompt can be null if the discussion is clear.`;

function buildUserPrompt(input: HuddleModeratorInput): string {
  const recent = input.messages
    .slice(-50)
    .map(
      (m) =>
        `[${new Date(m.createdAt).toISOString()}] ${m.authorId}: ${m.content}`
    )
    .join("\n");
  const prev = input.previousSummary
    ? `\n\nPrevious summary:\n${input.previousSummary}`
    : "";
  const prevConfusion =
    input.previousConfusionPoints?.length
      ? `\n\nPreviously noted confusion:\n${input.previousConfusionPoints.join("\n")}`
      : "";
  return `Recent huddle messages:\n${recent}${prev}${prevConfusion}`;
}

export async function runHuddleModerator(
  input: HuddleModeratorInput
): Promise<HuddleModeratorOutput | HuddleModeratorError> {
  if (input.messages.length === 0) {
    return {
      ok: true,
      summary: "No messages yet.",
      pointsOfConfusion: [],
    };
  }

  const result = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    preferredProvider: "claude",
    maxTokens: 1024,
    cachePrefix: undefined, // Real-time; skip cache
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const trimmed = result.text
    .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1")
    .trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const summary =
      typeof parsed.summary === "string" ? parsed.summary : "No summary.";
    const pointsOfConfusion = Array.isArray(parsed.pointsOfConfusion)
      ? (parsed.pointsOfConfusion as string[])
      : [];
    const suggestedPrompt =
      typeof parsed.suggestedPrompt === "string"
        ? parsed.suggestedPrompt
        : undefined;
    return {
      ok: true,
      summary,
      pointsOfConfusion,
      suggestedPrompt: suggestedPrompt || undefined,
    };
  } catch {
    return {
      ok: false,
      error: "Failed to parse AI moderator response.",
    };
  }
}
