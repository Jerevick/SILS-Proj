"use server";

/**
 * Phase 29: Production monitoring — centralized logging and AI-powered health check.
 * LogSystemEvent is used by all agents and server actions for audit trail.
 * RunFullSystemHealthCheck runs across all modules (DB, Auth, Stripe, Daily, Redis, AI).
 */

import { prisma } from "@/lib/db";

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogSystemEventInput = {
  tenantId?: string | null;
  source: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown> | null;
};

/** Centralized logging used by all agents and server actions. */
export async function LogSystemEvent(input: LogSystemEventInput) {
  try {
    await prisma.systemLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        source: input.source,
        level: input.level,
        message: input.message,
        metadata: input.metadata ?? undefined,
      },
    });
    return { ok: true as const };
  } catch (e) {
    console.error("[LogSystemEvent] failed:", e);
    return { ok: false as const, error: String(e) };
  }
}

/** Record an error event for the monitoring dashboard (uncaught errors, API failures). */
export async function LogErrorEvent(params: {
  message: string;
  stack?: string | null;
  code?: string | null;
  source?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await prisma.errorEvent.create({
      data: {
        tenantId: params.tenantId ?? null,
        message: params.message,
        stack: params.stack ?? null,
        code: params.code ?? null,
        source: params.source ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
    return { ok: true as const };
  } catch (e) {
    console.error("[LogErrorEvent] failed:", e);
    return { ok: false as const, error: String(e) };
  }
}

export type HealthCheckItem = {
  name: string;
  status: "ok" | "degraded" | "error" | "skipped";
  message?: string;
  latencyMs?: number;
};

export type RunFullSystemHealthCheckResult = {
  ok: boolean;
  timestamp: string;
  checks: HealthCheckItem[];
  summary: string;
};

/**
 * AI-powered full system health check across all modules.
 * Checks: Database, Clerk env, Stripe (optional), Daily.co (optional), Redis (optional), AI/LLM (optional).
 * Logs results via LogSystemEvent for audit trail.
 */
export async function RunFullSystemHealthCheck(options?: {
  tenantId?: string | null;
  logToSystem?: boolean;
}): Promise<RunFullSystemHealthCheckResult> {
  const tenantId = options?.tenantId ?? null;
  const logToSystem = options?.logToSystem ?? true;
  const timestamp = new Date().toISOString();
  const checks: HealthCheckItem[] = [];

  const log = async (source: string, level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!logToSystem) return;
    await LogSystemEvent({
      tenantId,
      source: "health_check",
      level,
      message: `[${source}] ${message}`,
      metadata: meta ?? undefined,
    });
  };

  // 1. Database (Neon Postgres)
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - dbStart;
    checks.push({ name: "Database (Neon)", status: "ok", latencyMs });
    await log("db", "info", "Database connectivity OK", { latencyMs });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    checks.push({ name: "Database (Neon)", status: "error", message: err });
    await log("db", "error", `Database check failed: ${err}`);
  }

  // 2. Clerk (auth) — env presence only; no live API call without auth
  const clerkOk =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
  if (clerkOk) {
    checks.push({ name: "Clerk (Auth)", status: "ok", message: "Keys configured" });
    await log("clerk", "info", "Clerk keys present");
  } else {
    checks.push({
      name: "Clerk (Auth)",
      status: "error",
      message: "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY",
    });
    await log("clerk", "error", "Clerk keys missing");
  }

  // 3. Stripe (optional)
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = await import("stripe").then((m) => new m.default(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-11-20.acacia" }));
      await stripe.balance.retrieve();
      checks.push({ name: "Stripe", status: "ok" });
      await log("stripe", "info", "Stripe API OK");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      checks.push({ name: "Stripe", status: "degraded", message: err });
      await log("stripe", "warn", `Stripe check failed: ${err}`);
    }
  } else {
    checks.push({ name: "Stripe", status: "skipped", message: "Not configured" });
  }

  // 4. Upstash Redis (optional — rate limit + cache)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      await redis.ping();
      checks.push({ name: "Redis (Upstash)", status: "ok" });
      await log("redis", "info", "Redis ping OK");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      checks.push({ name: "Redis (Upstash)", status: "degraded", message: err });
      await log("redis", "warn", `Redis check failed: ${err}`);
    }
  } else {
    checks.push({ name: "Redis (Upstash)", status: "skipped", message: "Not configured" });
  }

  // 5. AI/LLM (optional — at least one provider for orchestrator)
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  if (hasAnthropic || hasOpenAI) {
    checks.push({
      name: "AI (LLM)",
      status: "ok",
      message: hasAnthropic && hasOpenAI ? "Anthropic + OpenAI" : hasAnthropic ? "Anthropic" : "OpenAI",
    });
    await log("ai", "info", "LLM provider(s) configured");
  } else {
    checks.push({ name: "AI (LLM)", status: "degraded", message: "No ANTHROPIC_API_KEY or OPENAI_API_KEY" });
    await log("ai", "warn", "No LLM keys configured");
  }

  // 6. Daily.co (optional — live video)
  if (process.env.DAILY_API_KEY) {
    try {
      const res = await fetch("https://api.daily.co/v1/me", {
        headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}` },
      });
      if (res.ok) {
        checks.push({ name: "Daily.co", status: "ok" });
        await log("daily", "info", "Daily.co API OK");
      } else {
        checks.push({ name: "Daily.co", status: "degraded", message: `HTTP ${res.status}` });
        await log("daily", "warn", `Daily.co returned ${res.status}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      checks.push({ name: "Daily.co", status: "degraded", message: err });
      await log("daily", "warn", `Daily.co check failed: ${err}`);
    }
  } else {
    checks.push({ name: "Daily.co", status: "skipped", message: "Not configured" });
  }

  const hasError = checks.some((c) => c.status === "error");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const summary = hasError
    ? "One or more critical checks failed."
    : hasDegraded
      ? "System operational with degraded optional services."
      : "All configured systems healthy.";

  return {
    ok: !hasError,
    timestamp,
    checks,
    summary,
  };
}
