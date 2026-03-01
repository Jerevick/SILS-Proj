/**
 * AI Orchestrator — core service (singleton, tenant-aware).
 * Multi-agent: Planner → Executor (tools + LLM) → Reviewer → Summarizer.
 * Supports all actions: generate_course, adaptive_pathway, grade_submission, detect_friction_and_intervene,
 * proactive_insights, global_chat, health_check, semantic_search.
 */

import { runLLMRouter, type RouterResult, FALLBACK_OPENAI_MODEL } from "@/lib/ai/llm-router";
import { runTool, toAnthropicTools, type ToolResult } from "@/lib/ai/tools";
import {
  ORCHESTRATOR_SYSTEM,
  PLANNER_AGENT_SYSTEM,
  EXECUTOR_AGENT_SYSTEM,
  REVIEWER_AGENT_SYSTEM,
  SUMMARIZER_AGENT_SYSTEM,
  getPromptForAction,
  REFUSAL_INSTRUCTION,
  PEDAGOGICAL_CHECK,
} from "@/lib/ai/prompts";
import { LogSystemEvent } from "@/app/actions/monitoring-actions";
import { runAISystemOrchestrator } from "@/lib/ai/system-orchestrator";

export type OrchestratorAction =
  | "generate_course"
  | "generate_module"
  | "adaptive_pathway"
  | "grade_submission"
  | "detect_friction_and_intervene"
  | "proactive_insights"
  | "global_chat"
  | "health_check"
  | "semantic_search";

export type OrchestratorInput = {
  action: OrchestratorAction;
  payload: Record<string, unknown>;
  tenantId: string;
  userId: string;
  /** When true, skip reviewer/summarizer and return raw executor output (faster). */
  skipReview?: boolean;
};

export type OrchestratorSuccess = {
  ok: true;
  result: unknown;
  summary?: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number };
  latencyMs: number;
};

export type OrchestratorFailure = {
  ok: false;
  error: string;
  code?: string;
};

export type OrchestratorOutput = OrchestratorSuccess | OrchestratorFailure;

const DEFAULT_MAX_TOKENS = 2048;

/** PII redaction: mask email and full name patterns. */
function redactPII(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, "[NAME]");
}

/** Safety check: refuse harmful or off-scope requests. */
function shouldRefuse(payload: Record<string, unknown>, action: string): string | null {
  const str = JSON.stringify(payload).toLowerCase();
  if (/\b(grade\s*manipulation|change\s*grade|override\s*grade)\b/.test(str) && action !== "grade_submission") return "Grade manipulation not allowed.";
  if (/\b(other\s*user|another\s*student|pii\s*request)\b/.test(str)) return "Access to other users' data is not allowed.";
  return null;
}

/** Run planner: get steps from LLM (optional; for complex actions we can skip and run executor directly). */
async function runPlanner(action: string, payload: Record<string, unknown>, tenantId: string): Promise<string[]> {
  const llm: RouterResult = await runLLMRouter({
    systemPrompt: PLANNER_AGENT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Task: action=${action}, payload=${JSON.stringify(redactPII(JSON.stringify(payload)))}. Output a JSON array of steps.`,
      },
    ],
    preferredProvider: "claude",
    maxTokens: 1024,
  });
  if (!llm.ok) return [];
  try {
    const raw = llm.text.replace(/^[\s\S]*?(\[[\s\S]*\])[\s\S]*$/m, "$1").trim();
    const steps = JSON.parse(raw) as Array<{ id: string; description: string }>;
    return Array.isArray(steps) ? steps.map((s) => s.description ?? s.id) : [];
  } catch {
    return [];
  }
}

/** Run executor: call tools and LLM. */
async function runExecutor(
  action: string,
  payload: Record<string, unknown>,
  tenantId: string,
  steps: string[]
): Promise<{ result: unknown; usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number }; model?: string }> {
  const tools = toAnthropicTools();
  const userContent = steps.length
    ? `Action: ${action}. Payload: ${JSON.stringify(payload)}. Steps to execute: ${steps.join("; ")}. Use the provided tools and return results.`
    : `Action: ${action}. Payload: ${JSON.stringify(payload)}. Use the provided tools as needed and return structured results.`;

  const llm: RouterResult = await runLLMRouter({
    systemPrompt: EXECUTOR_AGENT_SYSTEM + "\n\n" + getPromptForAction(action),
    messages: [{ role: "user", content: userContent }],
    preferredProvider: "claude",
    maxTokens: DEFAULT_MAX_TOKENS,
    tools,
    openaiModel: FALLBACK_OPENAI_MODEL,
  });

  if (!llm.ok) {
    return { result: { error: llm.error } };
  }

  const toolResults: Array<{ name: string; result: ToolResult }> = [];
  if (llm.toolCalls?.length) {
    for (const tc of llm.toolCalls) {
      const args = { ...(tc.input as Record<string, unknown>), tenantId } as Record<string, unknown>;
      const res = await runTool(tc.name, args, tenantId);
      toolResults.push({ name: tc.name, result: res });
    }
  }

  return {
    result: toolResults.length ? toolResults : (llm.text ? { text: llm.text } : {}),
    usage: llm.usage,
    model: llm.provider,
  };
}

/** Run reviewer: validate executor output. */
async function runReviewer(
  action: string,
  executorOutput: unknown,
  tenantId: string
): Promise<{ approved: boolean; issues: string[]; suggestions: string[] }> {
  const llm: RouterResult = await runLLMRouter({
    systemPrompt: REVIEWER_AGENT_SYSTEM + "\n\n" + PEDAGOGICAL_CHECK + "\n\n" + REFUSAL_INSTRUCTION,
    messages: [
      {
        role: "user",
        content: `Action: ${action}. Executor output: ${JSON.stringify(executorOutput)}. Validate and output JSON: { "approved": boolean, "issues": string[], "suggestions": string[] }.`,
      },
    ],
    preferredProvider: "claude",
    maxTokens: 512,
  });
  if (!llm.ok) return { approved: true, issues: [], suggestions: [] };
  try {
    const raw = llm.text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, "$1").trim();
    const parsed = JSON.parse(raw) as { approved?: boolean; issues?: string[]; suggestions?: string[] };
    return {
      approved: parsed.approved !== false,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return { approved: true, issues: [], suggestions: [] };
  }
}

/** Run summarizer: format final response. */
async function runSummarizer(
  action: string,
  executorOutput: unknown,
  review: { approved: boolean; issues: string[]; suggestions: string[] },
  tenantId: string
): Promise<string> {
  const llm: RouterResult = await runLLMRouter({
    systemPrompt: SUMMARIZER_AGENT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Action: ${action}. Executor output: ${JSON.stringify(executorOutput)}. Review: approved=${review.approved}, issues=${JSON.stringify(review.issues)}. Format a clear, actionable summary for the user. Use markdown. Include deep links (e.g. /progress/STUDENT_ID) when relevant.`,
      },
    ],
    preferredProvider: "claude",
    maxTokens: 1024,
  });
  return llm.ok ? llm.text : String(executorOutput);
}

/** Action-specific fast paths (no full multi-agent loop). */
async function runActionFastPath(
  action: OrchestratorAction,
  payload: Record<string, unknown>,
  tenantId: string,
  userId: string
): Promise<OrchestratorOutput | null> {
  switch (action) {
    case "proactive_insights": {
      const dryRun = payload.dryRun === true;
      const out = await runAISystemOrchestrator({ tenantId, dryRun });
      if (!out.ok) return { ok: false, error: out.error };
      return {
        ok: true,
        result: {
          insightsGenerated: out.insightsGenerated,
          insightsStored: out.insightsStored,
          insightsAutoApplied: out.insightsAutoApplied,
          summary: out.summary,
        },
        summary: out.summary,
        latencyMs: 0,
      };
    }
    case "health_check": {
      const { RunFullSystemHealthCheck } = await import("@/app/actions/monitoring-actions");
      const health = await RunFullSystemHealthCheck({ tenantId, logToSystem: true });
      return {
        ok: true,
        result: health,
        summary: health.summary,
        latencyMs: 0,
      };
    }
    case "global_chat": {
      const message = (payload.message as string) || (payload.query as string) || "";
      const history = (payload.history as Array<{ role: string; content: string }>) || [];
      const llm: RouterResult = await runLLMRouter({
        systemPrompt: ORCHESTRATOR_SYSTEM + "\n\nAnswer concisely. Use tenant context. Suggest SILS links when relevant.",
        messages: [...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: message }],
        preferredProvider: "claude",
        maxTokens: 1024,
        temperature: 0.3,
      });
      if (!llm.ok) return { ok: false, error: llm.error };
      return {
        ok: true,
        result: { text: llm.text },
        summary: llm.text,
        model: llm.provider,
        usage: llm.usage,
        latencyMs: 0,
      };
    }
    default:
      return null;
  }
}

/** Main entry: run orchestrator for the given action. */
export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const start = Date.now();
  const { action, payload, tenantId, userId, skipReview = false } = input;

  const refusal = shouldRefuse(payload, action);
  if (refusal) {
    await LogSystemEvent({
      tenantId,
      source: "ai_orchestrator",
      level: "warn",
      message: "Orchestrator refusal",
      metadata: { action, reason: refusal, userId },
    });
    return { ok: false, error: refusal, code: "REFUSED" };
  }

  const fast = await runActionFastPath(action, payload, tenantId, userId);
  if (fast) {
    if (fast.ok) (fast as OrchestratorSuccess).latencyMs = Date.now() - start;
    return fast;
  }

  const steps = await runPlanner(action, payload, tenantId);
  const { result: executorResult, usage, model } = await runExecutor(action, payload, tenantId, steps);

  let finalResult: unknown = executorResult;
  let summary: string | undefined;

  if (!skipReview) {
    const review = await runReviewer(action, executorResult, tenantId);
    if (!review.approved && review.issues.length > 0) {
      await LogSystemEvent({
        tenantId,
        source: "ai_orchestrator",
        level: "warn",
        message: "Reviewer flagged executor output",
        metadata: { action, issues: review.issues },
      });
    }
    summary = await runSummarizer(action, executorResult, review, tenantId);
    finalResult = { result: executorResult, summary, review: { issues: review.issues, suggestions: review.suggestions } };
  } else {
    finalResult = executorResult;
  }

  const latencyMs = Date.now() - start;
  await LogSystemEvent({
    tenantId,
    source: "ai_orchestrator",
    level: "info",
    message: `Orchestrator completed: ${action}`,
    metadata: { action, userId, latencyMs, model, usage },
  });

  return {
    ok: true,
    result: finalResult,
    summary,
    model,
    usage,
    latencyMs,
  };
}

/** Singleton getter (for future use if we need a shared instance). */
let _instance: { run: (input: OrchestratorInput) => Promise<OrchestratorOutput> } | null = null;

export function getOrchestrator(): { run: (input: OrchestratorInput) => Promise<OrchestratorOutput> } {
  if (!_instance) {
    _instance = { run: runOrchestrator };
  }
  return _instance;
}
