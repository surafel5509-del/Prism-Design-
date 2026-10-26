const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): { ok: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

// periodic cleanup so the map cannot grow unbounded
if (typeof setInterval !== 'undefined') {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }, 120_000);
  if (typeof t === 'object' && 'unref' in t) (t as { unref: () => void }).unref();
}
