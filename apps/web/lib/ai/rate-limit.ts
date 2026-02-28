/**
 * Rate limiting for AI routes: per-user and per-tenant.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set; otherwise no-op (allow all) for dev.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
let userLimiter: Ratelimit | null = null;
let tenantLimiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (redis !== null) return redis;
  if (REDIS_URL && REDIS_TOKEN) {
    redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
    return redis;
  }
  return null;
}

/** Per-user: 60 requests per minute (burst-friendly sliding window) */
function getUserLimiter(): Ratelimit | null {
  if (userLimiter !== null) return userLimiter;
  const r = getRedis();
  if (!r) return null;
  userLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "sils:ai:user",
  });
  return userLimiter;
}

/** Per-tenant: 1000 requests per minute */
function getTenantLimiter(): Ratelimit | null {
  if (tenantLimiter !== null) return tenantLimiter;
  const r = getRedis();
  if (!r) return null;
  tenantLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(1000, "1 m"),
    prefix: "sils:ai:tenant",
  });
  return tenantLimiter;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; error: string; retryAfter?: number };

/**
 * Check per-user and per-tenant rate limits. Call before processing AI request.
 * If Redis is not configured, returns ok: true (no rate limiting in dev).
 */
export async function checkAiRateLimit(
  userId: string,
  tenantId: string | null
): Promise<RateLimitResult> {
  const uLimiter = getUserLimiter();
  if (uLimiter) {
    const uRes = await uLimiter.limit(userId);
    if (!uRes.success) {
      return {
        ok: false,
        error: "Rate limit exceeded (per user). Try again later.",
        retryAfter: uRes.reset - Math.floor(Date.now() / 1000),
      };
    }
  }

  if (tenantId) {
    const tLimiter = getTenantLimiter();
    if (tLimiter) {
      const tRes = await tLimiter.limit(tenantId);
      if (!tRes.success) {
        return {
          ok: false,
          error: "Tenant AI quota exceeded. Try again later.",
          retryAfter: tRes.reset - Math.floor(Date.now() / 1000),
        };
      }
    }
  }

  return { ok: true, remaining: 60 };
}
