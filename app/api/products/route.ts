import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { rateLimit, getClientIp, PRODUCTS_LIMIT } from "@/lib/rate-limit"
import type { Product, ApiResponse } from "@/lib/types"

// ─── GET /api/products ────────────────────────────────────────────────────────
// Returns all products, optionally filtered by ?category=<value>
//
// Query params:
//   category  — filter by product category (optional)
//
// Response: ApiResponse<Product[]>
//
// Rate limit: 60 req / minute per IP (see lib/rate-limit.ts)

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Product[]>>> {
  // ── 1. Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(ip, PRODUCTS_LIMIT)

  const headers = {
    "X-RateLimit-Limit": String(PRODUCTS_LIMIT.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  }

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...headers, "Retry-After": "60" } }
    )
  }

  // ── 2. Parse & validate query params ──────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")?.trim().toLowerCase() ?? null

  // // Only allow known categories to avoid arbitrary DB queries.
  // const ALLOWED_CATEGORIES = ["serums", "moisturizers", "cleansers", "oils", "masks", "toners", "cream", "serum", "oil"]
  // if (category && !ALLOWED_CATEGORIES.includes(category)) {
  //   return NextResponse.json(
  //     { error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}` },
  //     { status: 400, headers }
  //   )
  // }

  // ── 3. Query database ─────────────────────────────────────────────────────
  try {
    const sql = category != null && category != "all"
      ? `SELECT id, name, description, price, original_price AS "originalPrice",
                discount, image, badge, category, default_qty AS "defaultQty"
         FROM products
         WHERE category = $1 AND is_active = true
         ORDER BY sort_order ASC, created_at DESC`
      : `SELECT id, name, description, price, original_price AS "originalPrice",
                discount, image, badge, category, default_qty AS "defaultQty"
         FROM products
         WHERE is_active = true
         ORDER BY sort_order ASC, created_at DESC`

    const params = category ? [category] : []
    const { rows } = await query<Product>(sql, params)

    return NextResponse.json({ data: rows }, { status: 200, headers })
  } catch (err) {
    console.error("[GET /api/products] DB error:", err)
    return NextResponse.json(
      { error: "Failed to fetch products. Please try again." },
      { status: 500, headers }
    )
  }
}
