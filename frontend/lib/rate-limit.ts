type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

type Bucket = {
  count: number;
  reset: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    const reset = now + windowMs;
    buckets.set(key, { count: 1, reset });
    return { allowed: true, remaining: limit - 1, reset };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, reset: bucket.reset };
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.count, reset: bucket.reset };
}

export function getClientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
