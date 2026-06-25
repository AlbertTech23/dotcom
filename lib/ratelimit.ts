import { Ratelimit, type Duration } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Per-user API rate limiting (H2c/M4), backed by Upstash Redis over REST so it
// works on Edge, Node and Vercel functions alike.
//
// FAIL-OPEN by design: if the Upstash env vars are absent (local dev / not yet
// provisioned) or Redis is unreachable, requests are allowed through. A rate
// limiter must never take the app down or cause a self-inflicted outage — auth
// and validation still apply as the real security boundary.

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = url && token ? new Redis({ url, token }) : null

export type LimiterName = 'routing' | 'location' | 'scan'

// Sliding-window budgets per authenticated user.
const CONFIG: Record<LimiterName, { tokens: number; window: Duration }> = {
  routing:  { tokens: 15,  window: '1 m' },  // protects the paid ORS quota
  location: { tokens: 40,  window: '1 m' },  // legit interval is ~2-4/min
  scan:     { tokens: 120, window: '1 m' },  // generous, for rapid boarding scans
}

const limiters: Record<LimiterName, Ratelimit> | null = redis
  ? {
      routing:  new Ratelimit({ redis, prefix: 'rl:routing',  limiter: Ratelimit.slidingWindow(CONFIG.routing.tokens,  CONFIG.routing.window) }),
      location: new Ratelimit({ redis, prefix: 'rl:location', limiter: Ratelimit.slidingWindow(CONFIG.location.tokens, CONFIG.location.window) }),
      scan:     new Ratelimit({ redis, prefix: 'rl:scan',     limiter: Ratelimit.slidingWindow(CONFIG.scan.tokens,     CONFIG.scan.window) }),
    }
  : null

export interface RateResult {
  success: boolean
  limit: number
  remaining: number
  /** epoch ms when the window resets */
  reset: number
}

/** Consume one token for (name, key). Returns success=true when allowed. */
export async function rateLimit(name: LimiterName, key: string): Promise<RateResult> {
  if (!limiters) return { success: true, limit: 0, remaining: 0, reset: 0 }
  try {
    const r = await limiters[name].limit(key)
    return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset }
  } catch (e) {
    console.error('[ratelimit]', name, e)
    return { success: true, limit: 0, remaining: 0, reset: 0 } // fail open
  }
}

/** True when Upstash is configured (useful for diagnostics / tests). */
export function isRateLimitConfigured(): boolean {
  return limiters !== null
}
