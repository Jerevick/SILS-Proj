/**
 * LiveClassCoHost: Real-time AI assistant during live classes.
 * Consumes chat/questions and session context, suggests answers, time cues, and nudges.
 * Can be invoked by lecturer or by students (e.g. "Ask AI" in sidebar).
 */

import { runLLMRouter } from "@/lib/ai/llm-router";

export interface LiveClassCoHostInput {
  /** Session title / topic */
  sessionTitle: string;
  /** Recent in-session chat or Q&A messages */
  recentMessages: { role: "lecturer" | "student"; content: string }[];
  /** Optional: current slide or topic label */
  currentTopic?: string;
  /** Optional: elapsed minutes */
  elapsedMinutes?: number;
  /** Question or request from user (lecturer or student) */
  userRequest: string;
  /** Who is asking: "lecturer" | "student" */
  askerRole: "lecturer" | "student";
}

export interface LiveClassCoHostOutput {
  ok: true;
  /** Direct response to show in UI */
  response: string;
  /** Optional: suggested follow-up for lecturer (e.g. "Consider a quick poll on X") */
  lecturerSuggestion?: string;
  /** Optional: type for UI styling */
  type?: "answer" | "summary" | "nudge" | "time_cue" | "general";
}

export interface LiveClassCoHostError {
  ok: false;
  error: string;
}

const SYSTEM_PROMPT = `You are an AI co-host for a live classroom session. You help the lecturer and students in real time.

When a lecturer asks: provide concise answers, time cues ("Consider wrapping this topic in 5 min"), or suggestions (polls, recap).
When a student asks: provide a short, clear answer suitable for the current topic, or suggest they ask the lecturer if it's off-topic or needs human judgment.

Output a single JSON object (no markdown, no code fence):
{
  "response": "string - the main text to show",
  "lecturerSuggestion": "string or null - only when asker is lecturer or when you have a tip for them",
  "type": "answer" | "summary" | "nudge" | "time_cue" | "general"
}

Rules:
- Be brief. Real-time use; 1-3 sentences for response.
- For students: do not replace the lecturer; complement. If the question is about logistics or clarification, answer it; if it's deep content, suggest raising hand or using Q&A.
- For lecturers: time_cue when elapsed time suggests wrapping or transitioning.`;

function buildUserPrompt(input: LiveClassCoHostInput): string {
  const ctx = [
    `Session: ${input.sessionTitle}`,
    input.currentTopic ? `Current topic: ${input.currentTopic}` : null,
    input.elapsedMinutes != null
      ? `Elapsed: ${input.elapsedMinutes} minutes`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const recent =
    input.recentMessages.length > 0
      ? "\nRecent context:\n" +
        input.recentMessages
          .slice(-10)
          .map((m) => `[${m.role}]: ${m.content}`)
          .join("\n")
      : "";
  return `${ctx}${recent}\n\n[${input.askerRole} request]: ${input.userRequest}`;
}

export async function runLiveClassCoHost(
  input: LiveClassCoHostInput
): Promise<LiveClassCoHostOutput | LiveClassCoHostError> {
  const result = await runLLMRouter({
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    preferredProvider: "claude",
    maxTokens: 512,
    cachePrefix: undefined,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const trimmed = result.text
    .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1")
    .trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const response =
      typeof parsed.response === "string" ? parsed.response : "No response.";
    const lecturerSuggestion =
      typeof parsed.lecturerSuggestion === "string"
        ? parsed.lecturerSuggestion
        : undefined;
    const type = ["answer", "summary", "nudge", "time_cue", "general"].includes(
      String(parsed.type)
    )
      ? (parsed.type as LiveClassCoHostOutput["type"])
      : "general";
    return {
      ok: true,
      response,
      lecturerSuggestion,
      type,
    };
  } catch {
    return {
      ok: true,
      response: result.text.slice(0, 500),
      type: "general",
    };
  }
}
