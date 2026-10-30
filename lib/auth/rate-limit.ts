type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next: Entry = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
  }
  current.count += 1;
  buckets.set(key, current);
  const allowed = current.count <= limit;
  return { allowed, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
