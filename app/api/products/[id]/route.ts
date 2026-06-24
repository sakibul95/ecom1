import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { rateLimit, getClientIp, PRODUCT_DETAIL_LIMIT } from "@/lib/rate-limit"
import type { ProductDetail, ApiResponse } from "@/lib/types"

// ─── GET /api/products/:id ────────────────────────────────────────────────────
// Returns the full detail record for a single product.
//
// Response: ApiResponse<ProductDetail>
//
// Rate limit: 60 req / minute per IP (see lib/rate-limit.ts)

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<ProductDetail>>> {
  // ── 1. Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(ip, PRODUCT_DETAIL_LIMIT)

  const headers = {
    "X-RateLimit-Limit": String(PRODUCT_DETAIL_LIMIT.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  }

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...headers, "Retry-After": "60" } }
    )
  }

  // ── 2. Validate the ID param ──────────────────────────────────────────────
  const { id } = await context.params

  // Product IDs are slugs: lowercase letters, numbers, and hyphens only.
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    return NextResponse.json(
      { error: "Invalid product ID format." },
      { status: 400, headers }
    )
  }

  // ── 3. Query database ─────────────────────────────────────────────────────
  try {
    const { rows } = await query<ProductDetail>(
      `SELECT id, name, description, tagline, price,
              original_price    AS "originalPrice",
              discount, image, badge, category,
              default_qty       AS "defaultQty",
              sizes, details,
              how_to_use        AS "howToUse",
              ingredients,
              delivery_info     AS "deliveryInfo"
       FROM products
       WHERE id = $1 AND is_active = true
       LIMIT 1`,
      [id]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404, headers }
      )
    }

    return NextResponse.json({ data: rows[0] }, { status: 200, headers })
  } catch (err) {
    console.error(`[GET /api/products/${id}] DB error:`, err)
    return NextResponse.json(
      { error: "Failed to fetch product. Please try again." },
      { status: 500, headers }
    )
  }
}
