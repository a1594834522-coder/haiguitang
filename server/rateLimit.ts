/** 令牌桶限流，按 key（IP 等）独立计数，定期清理闲置桶。 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; updated: number }>()

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    setInterval(() => this.sweep(), 60_000).unref()
  }

  static perMinute(n: number) {
    return new RateLimiter(n, n / 60_000)
  }

  take(key: string): boolean {
    const now = Date.now()
    const b = this.buckets.get(key) ?? { tokens: this.capacity, updated: now }
    b.tokens = Math.min(this.capacity, b.tokens + (now - b.updated) * this.refillPerMs)
    b.updated = now
    const ok = b.tokens >= 1
    if (ok) b.tokens -= 1
    this.buckets.set(key, b)
    return ok
  }

  private sweep() {
    const now = Date.now()
    for (const [k, b] of this.buckets) {
      if (b.tokens + (now - b.updated) * this.refillPerMs >= this.capacity) this.buckets.delete(k)
    }
  }
}
