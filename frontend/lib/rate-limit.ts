import { redis } from './redis'

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

/**
 * Standard rate limiter using Redis (Upstash)
 * This works across multiple server instances (Edge functions, Vercel, etc.)
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${key}`;

  try {
    // We use a simple window-based limit
    // A better approach would be sliding window, but fixed window is sufficient for base production.
    const count = await redis.incr(fullKey);

    if (count === 1) {
      await redis.pexpire(fullKey, windowMs);
    }

    const ttl = await redis.pttl(fullKey);
    const reset = now + Math.max(0, ttl);

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        reset
      };
    }

    return {
      allowed: true,
      remaining: limit - count,
      reset
    };
  } catch (err) {
    console.error('Rate limit error (Redis):', err);
    // Fallback to allowed in case of Redis failure to prevent blocking legitimate traffic
    return { allowed: true, remaining: 1, reset: now + windowMs };
  }
}

export function getClientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
