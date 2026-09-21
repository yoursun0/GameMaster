import 'server-only';

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly capacityPerMinute: number,
  ) {}

  take(key: string, cost = 1): { ok: true } | { ok: false; retryAfterSec: number } {
    const now = this.now();
    const refillPerMs = this.capacityPerMinute / 60_000;
    const current = this.buckets.get(key) ?? {
      tokens: this.capacityPerMinute,
      updatedAt: now,
    };
    const elapsed = Math.max(0, now - current.updatedAt);
    const tokens = Math.min(
      this.capacityPerMinute,
      current.tokens + elapsed * refillPerMs,
    );
    if (tokens < cost) {
      const retryAfterSec = Math.ceil((cost - tokens) / refillPerMs / 1000);
      this.buckets.set(key, { tokens, updatedAt: now });
      return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
    }
    this.buckets.set(key, { tokens: tokens - cost, updatedAt: now });
    return { ok: true };
  }
}
