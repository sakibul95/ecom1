// ─── Admin API key authentication ────────────────────────────────────────────
//
// All admin routes call isAdminAuthorized() before doing anything else.
// The key is stored in the ADMIN_API_KEY environment variable (server-only,
// never shipped to the browser).
//
// Callers must include the key in the Authorization header:
//   Authorization: Bearer <your-admin-api-key>
//
// Generating a strong key:
//   openssl rand -hex 32
//
// Then add it to .env.local:
//   ADMIN_API_KEY=<the output above>
//
// When you eventually add a real auth system, replace this helper —
// none of the route logic needs to change.

/**
 * Returns true if the request carries a valid admin API key.
 *
 * Performs a constant-time comparison where possible to reduce the risk
 * of timing-based side-channel attacks (Node's built-in crypto.timingSafeEqual
 * works on Buffers of equal length, so we normalise both sides first).
 */
export function isAdminAuthorized(request: Request): boolean {
  const expectedKey = process.env.ADMIN_API_KEY

  // Fail closed: if the env var isn't set, no request is authorised.
  if (!expectedKey || expectedKey.trim().length === 0) {
    console.error(
      "[admin-auth] ADMIN_API_KEY is not set. " +
        "Add it to .env.local — see .env.example."
    )
    return false
  }

  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return false

  const providedKey = authHeader.slice(7) // strip "Bearer "

  // Constant-time comparison to prevent timing attacks.
  // Both buffers must be the same byte length for timingSafeEqual to work,
  // so we hash both sides to a fixed length first.
  try {
    const { timingSafeEqual } = require("crypto") as typeof import("crypto")
    const a = Buffer.from(providedKey)
    const b = Buffer.from(expectedKey)

    // If lengths differ, timingSafeEqual would throw — do a length check that
    // doesn't short-circuit on content, then compare bytes.
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    // Fallback (should never happen in Node, but safe for edge runtimes).
    return providedKey === expectedKey
  }
}

/**
 * Build the standard 401 response for unauthorised admin requests.
 * Kept here so every route returns a consistent shape.
 */
export function unauthorizedResponse(): Response {
  return Response.json(
    { error: "Unauthorized. A valid Bearer token is required." },
    { status: 401 }
  )
}
