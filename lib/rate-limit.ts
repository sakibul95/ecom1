// ─── In-process sliding-window rate limiter ───────────────────────────────────
//
// Why this approach?
// - No external Redis/upstash dependency — works anywhere Node runs.
// - "Sliding window" is fairer than fixed-window (no burst at boundary).
// - State lives in the server process; this is fine for a single-instance
//   deployment. For multi-instance / edge deployments, swap the store for
//   an atomic Redis ZADD/ZREMRANGEBYSCORE pipeline instead.
//
// How it works:
//   For each key (e.g. IP address) we store a sorted list of recent hit
//   timestamps. On each request we:
//     1. Drop timestamps older than `windowMs`.
//     2. Count the remaining hits.
//     3. If count >= limit → reject with 429.
//     4. Otherwise → record the new timestamp and allow.
//
// Memory management:
//   A single global cleanup interval sweeps the map every 5 minutes and
//   deletes entries whose last hit is older than `windowMs`. This prevents
//   unbounded growth if the server runs for a long time.

interface HitRecord {
  timestamps: number[]
}

const store = new Map<string, HitRecord>()

const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000 // 5 minutes

// Only register the cleanup timer once, even across hot reloads.
if (typeof global !== "undefined") {
  const g = global as typeof global & { _rlCleanup?: NodeJS.Timeout }
  if (!g._rlCleanup) {
    g._rlCleanup = setInterval(() => {
      const now = Date.now()
      for (const [key, record] of store) {
        // Keep entries that have at least one hit within the last 10 minutes.
        if (record.timestamps.length === 0 || now - record.timestamps.at(-1)! > 10 * 60_000) {
          store.delete(key)
        }
      }
    }, CLEANUP_INTERVAL_MS)
    // Don't keep the Node process alive just for cleanup.
    if (g._rlCleanup.unref) g._rlCleanup.unref()
  }
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed within `windowMs`. */
  limit: number
  /** Rolling time window in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean
  /** How many requests the caller has made in the current window. */
  remaining: number
  /** Epoch ms when the oldest hit in the window expires. */
  resetAt: number
}

/**
 * Check (and record) a hit for the given `key`.
 *
 * @param key     Unique identifier — typically the caller's IP address.
 * @param options `limit` and `windowMs` for this particular route.
 *
 * @example
 * const result = rateLimit(ip, { limit: 10, windowMs: 60_000 })
 * if (!result.allowed) return new Response("Too many requests", { status: 429 })
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = options
  const now = Date.now()
  const windowStart = now - windowMs

  const record = store.get(key) ?? { timestamps: [] }

  // Slide the window — drop hits older than windowStart.
  record.timestamps = record.timestamps.filter((t) => t > windowStart)

  const currentCount = record.timestamps.length

  if (currentCount >= limit) {
    store.set(key, record)
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.timestamps[0] + windowMs, // oldest hit's expiry
    }
  }

  // Record this hit and allow.
  record.timestamps.push(now)
  store.set(key, record)

  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetAt: record.timestamps[0] + windowMs,
  }
}

/**
 * Convenience helper: extract the client IP from a Next.js Request.
 *
 * Priority order:
 *   1. x-forwarded-for (set by most reverse proxies / Vercel)
 *   2. x-real-ip (Nginx convention)
 *   3. Fall back to "unknown"
 *
 * For multi-instance deployments behind a load balancer this is sufficient.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first entry.
    return forwarded.split(",")[0].trim()
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

// ─── Pre-configured limiters for each route ──────────────────────────────────
// Centralising the limits here makes them easy to audit and adjust.

/** GET /api/products — generous limit for browsing */
export const PRODUCTS_LIMIT: RateLimitOptions = {
  limit: 60,
  windowMs: 60_000, // 60 requests per minute
}

/** GET /api/products/:id — per product detail fetch */
export const PRODUCT_DETAIL_LIMIT: RateLimitOptions = {
  limit: 60,
  windowMs: 60_000,
}

/** POST /api/orders — strict to prevent order spam */
export const ORDER_CREATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 60_000, // 5 order submissions per minute per IP
}

/** POST /api/admin/products — admin upload endpoint (low limit, key-gated) */
export const ADMIN_PRODUCT_UPLOAD_LIMIT: RateLimitOptions = {
  limit: 30,
  windowMs: 60_000, // 30 requests per minute (admin tooling / scripts)
}

/** GET /api/admin/orders — admin orders list (low limit, key-gated) */
export const ADMIN_ORDERS_LIST_LIMIT: RateLimitOptions = {
  limit: 30,
  windowMs: 60_000,
}
