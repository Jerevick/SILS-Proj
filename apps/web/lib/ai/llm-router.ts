/**
 * LLM Router: complexity scoring, Redis cache, fallback between Claude / GPT / Grok.
 * Used by StudentCoachAgent and other AI features. Rate limiting is applied at the route level.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const CACHE_TTL_SECONDS = 300; // 5 minutes for generic prompts

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
  /** System prompt (or instruction set) */
  systemPrompt: string;
  /** User/assistant messages or single user prompt */
  messages: { role: "user" | "assistant"; content: string }[];
  /** Optional: force provider (otherwise router picks by complexity) */
  preferredProvider?: LLMProvider;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Cache key prefix (e.g. "coach", "router-test"). Omit to skip cache. */
  cachePrefix?: string;
}

export interface RouterResponse {
  ok: true;
  text: string;
  provider: LLMProvider;
  cached: boolean;
  complexityScore: number;
}

export interface RouterError {
  ok: false;
  error: string;
  provider?: LLMProvider;
}

export type RouterResult = RouterResponse | RouterError;

/**
 * Heuristic complexity score 1–10 from prompt content (length + reasoning keywords).
 * Higher = prefer Claude for reasoning; lower = can use GPT for speed/cost.
 */
function scoreComplexity(systemPrompt: string, lastUserMessage: string): number {
  const combined = `${systemPrompt}\n${lastUserMessage}`.toLowerCase();
  const reasoningKeywords = [
    "reason",
    "analyze",
    "explain why",
    "decide",
    "recommend",
    "strategy",
    "intervention",
    "scaffold",
    "mastery",
    "friction",
  ];
  let score = 1;
  // Length factor (cap at 5)
  score += Math.min(5, Math.floor(combined.length / 500));
  // Keyword factor
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

/** Call Claude (Anthropic). */
async function callClaude(req: RouterRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const anthropic = new Anthropic({ apiKey });
  const lastUser = req.messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: req.maxTokens ?? 1024,
    system: req.systemPrompt,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const block = message.content.find((b) => b.type === "text");
  return block && "text" in block ? block.text : "";
}

/** Call OpenAI GPT-4. */
async function callOpenAI(req: RouterRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const { OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: req.maxTokens ?? 1024,
    messages: [
      { role: "system", content: req.systemPrompt },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });
  const content = response.choices[0]?.message?.content;
  return content ?? "";
}

/** Pick provider by complexity and preference. */
function selectProvider(
  complexity: number,
  preferred?: LLMProvider
): LLMProvider {
  if (preferred) return preferred;
  // Prefer Claude for high-complexity reasoning
  if (complexity >= 6) return "claude";
  if (complexity >= 3) return "claude";
  return "openai";
}

/**
 * Run the LLM router: cache lookup, complexity score, provider selection, fallback on failure.
 */
export async function runLLMRouter(req: RouterRequest): Promise<RouterResult> {
  const lastUser = req.messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const complexityScore = scoreComplexity(req.systemPrompt, lastUser);
  const provider = selectProvider(complexityScore, req.preferredProvider);

  if (req.cachePrefix) {
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

  const providers: LLMProvider[] =
    provider === "claude"
      ? ["claude", "openai"]
      : ["openai", "claude"];
  let lastError: Error | null = null;

  for (const p of providers) {
    try {
      const text =
        p === "claude"
          ? await callClaude(req)
          : await callOpenAI(req);
      if (req.cachePrefix) {
        const key = cacheKey(req.cachePrefix, req);
        await setCached(key, text);
      }
      return {
        ok: true,
        text,
        provider: p,
        cached: false,
        complexityScore,
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
