/**
 * LLM Router: Anthropic primary, OpenAI fallback, cost tracking, streaming support.
 * Used by AI Orchestrator, StudentCoachAgent, and other AI features. Rate limiting at route level.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CACHE_TTL_SECONDS = 300;

/** Default models: Claude 3.5 Sonnet primary, GPT-4o fallback for orchestrator. */
export const DEFAULT_CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const FALLBACK_OPENAI_MODEL = "gpt-4o";

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis !== null) return redis;
  if (REDIS_URL && REDIS_TOKEN) {
    redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
    return redis;
  }
  return null;
}

export type LLMProvider = "claude" | "openai" | "grok";

export interface RouterRequest {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  preferredProvider?: LLMProvider;
  maxTokens?: number;
  cachePrefix?: string;
  temperature?: number;
  openaiModel?: string;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required: string[];
    };
  }>;
}

export interface RouterResponse {
  ok: true;
  text: string;
  provider: LLMProvider;
  cached: boolean;
  complexityScore: number;
  usage?: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number };
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

export interface RouterError {
  ok: false;
  error: string;
  provider?: LLMProvider;
}

export type RouterResult = RouterResponse | RouterError;

function scoreComplexity(systemPrompt: string, lastUserMessage: string): number {
  const combined = `${systemPrompt}\n${lastUserMessage}`.toLowerCase();
  const reasoningKeywords = [
    "reason", "analyze", "explain why", "decide", "recommend", "strategy",
    "intervention", "scaffold", "mastery", "friction",
  ];
  let score = 1;
  score += Math.min(5, Math.floor(combined.length / 500));
  const matches = reasoningKeywords.filter((k) => combined.includes(k));
  score += Math.min(4, matches.length);
  return Math.min(10, Math.max(1, score));
}

function cacheKey(prefix: string, req: RouterRequest): string {
  const payload = JSON.stringify({
    p: req.preferredProvider ?? "auto",
    s: req.systemPrompt,
    m: req.messages,
    t: req.maxTokens ?? 1024,
  });
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, 32);
  return `sils:llm:${prefix}:${hash}`;
}

async function getCached(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get<string>(key);
    return typeof raw === "string" ? raw : null;
  } catch {
    return null;
  }
}

async function setCached(key: string, value: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: CACHE_TTL_SECONDS });
  } catch {
    // ignore
  }
}

/** Cost estimate (USD) per 1M input/output tokens (approximate). */
function estimateCostUsd(prov: LLMProvider, inputTokens: number, outputTokens: number): number {
  if (prov === "claude") return (inputTokens / 1e6) * 3 + (outputTokens / 1e6) * 15;
  return (inputTokens / 1e6) * 2.5 + (outputTokens / 1e6) * 10;
}

async function callClaude(req: RouterRequest): Promise<{
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey });
  const tools = req.tools?.length
    ? req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
    : undefined;
  const message = await anthropic.messages.create({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.2,
    system: req.systemPrompt,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(tools?.length ? { tools, tool_choice: "auto" as const } : {}),
  });
  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  const toolUseBlocks = message.content.filter((b) => b.type === "tool_use") as Array<{
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  const toolCalls = toolUseBlocks.length
    ? toolUseBlocks.map((b) => ({ id: b.id, name: b.name, input: b.input }))
    : undefined;
  const usage = message.usage
    ? { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }
    : undefined;
  return { text, usage, toolCalls };
}

async function callOpenAI(req: RouterRequest): Promise<{
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const { OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });
  const model = req.openaiModel ?? DEFAULT_OPENAI_MODEL;
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string | unknown[] }> = [
    { role: "system", content: req.systemPrompt },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const options: Parameters<typeof openai.chat.completions.create>[0] = {
    model,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.2,
    messages,
  };
  const response = await openai.chat.completions.create(options);
  const choice = response.choices[0];
  const content = choice?.message?.content ?? "";
  const toolCalls = choice?.message?.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function?.name ?? "",
    input: (() => {
      try {
        return JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
      } catch {
        return {};
      }
    })(),
  }));
  const usage = response.usage
    ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
    : undefined;
  return { text: typeof content === "string" ? content : "", usage, toolCalls };
}

function selectProvider(complexity: number, preferred?: LLMProvider): LLMProvider {
  if (preferred) return preferred;
  if (complexity >= 6) return "claude";
  if (complexity >= 3) return "claude";
  return "openai";
}

/**
 * Run the LLM router: cache lookup, complexity score, provider selection, fallback on failure.
 * Cost tracking: estimatedCostUsd attached to usage when available.
 */
export async function runLLMRouter(req: RouterRequest): Promise<RouterResult> {
  const lastUser = req.messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const complexityScore = scoreComplexity(req.systemPrompt, lastUser);
  const provider = selectProvider(complexityScore, req.preferredProvider);

  if (req.cachePrefix && !req.tools?.length) {
    const key = cacheKey(req.cachePrefix, req);
    const cached = await getCached(key);
    if (cached) {
      return {
        ok: true,
        text: cached,
        provider,
        cached: true,
        complexityScore,
      };
    }
  }

  const providers: LLMProvider[] = provider === "claude" ? ["claude", "openai"] : ["openai", "claude"];
  let lastError: Error | null = null;

  for (const p of providers) {
    try {
      const result =
        p === "claude"
          ? await callClaude(req)
          : await callOpenAI({ ...req, openaiModel: req.openaiModel ?? (provider === "claude" ? FALLBACK_OPENAI_MODEL : DEFAULT_OPENAI_MODEL) });
      const text = result.text;
      if (req.cachePrefix && !req.tools?.length) {
        const key = cacheKey(req.cachePrefix, req);
        await setCached(key, text);
      }
      const estimatedCostUsd = result.usage
        ? estimateCostUsd(p, result.usage.inputTokens, result.usage.outputTokens)
        : undefined;
      return {
        ok: true,
        text,
        provider: p,
        cached: false,
        complexityScore,
        usage: result.usage ? { ...result.usage, estimatedCostUsd } : undefined,
        toolCalls: result.toolCalls,
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }

  return {
    ok: false,
    error: lastError?.message ?? "LLM request failed",
    provider,
  };
}

/**
 * Stream LLM response (Anthropic primary). No tool-use in stream mode.
 * For chat/generation actions (e.g. global_chat streaming).
 */
export async function* streamLLM(
  req: Omit<RouterRequest, "tools" | "cachePrefix">
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield JSON.stringify({ error: "ANTHROPIC_API_KEY not set" });
    return;
  }
  const anthropic = new Anthropic({ apiKey });
  const stream = anthropic.messages.stream({
    model: DEFAULT_CLAUDE_MODEL,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.2,
    system: req.systemPrompt,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}
