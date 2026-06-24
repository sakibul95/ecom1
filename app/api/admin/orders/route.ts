import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { isAdminAuthorized } from "@/lib/admin-auth"
import { rateLimit, getClientIp, ADMIN_ORDERS_LIST_LIMIT } from "@/lib/rate-limit"
import type { Order, ApiResponse } from "@/lib/types"

// ─── GET /api/admin/orders ────────────────────────────────────────────────────
// Returns all orders, newest first.
//
// Auth: Bearer token — Authorization: Bearer <ADMIN_API_KEY>
//
// Query params:
//   status   — filter by order status (optional)
//              one of: pending | confirmed | shipped | delivered | cancelled
//   page     — 1-based page number (default: 1)
//   pageSize — records per page, max 100 (default: 50)
//
// Response: ApiResponse<{ orders: Order[]; total: number; page: number; pageSize: number }>
//
// Rate limit: 30 req / minute

interface OrdersListData {
  orders: Order[]
  total: number
  page: number
  pageSize: number
}

const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const
type OrderStatus = (typeof VALID_STATUSES)[number]

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<OrdersListData>>> {
  // ── 1. Auth check ─────────────────────────────────────────────────────────
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. A valid Bearer token is required." },
      { status: 401 }
    )
  }

  // ── 2. Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(ip, ADMIN_ORDERS_LIST_LIMIT)

  const headers = {
    "X-RateLimit-Limit": String(ADMIN_ORDERS_LIST_LIMIT.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  }

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...headers, "Retry-After": "60" } }
    )
  }

  // ── 3. Parse & validate query params ──────────────────────────────────────
  const { searchParams } = new URL(request.url)

  // status filter (optional)
  const statusParam = searchParams.get("status")?.trim().toLowerCase() ?? null
  if (statusParam && !VALID_STATUSES.includes(statusParam as OrderStatus)) {
    return NextResponse.json(
      {
        error: `Invalid status. Allowed values: ${VALID_STATUSES.join(", ")}.`,
      },
      { status: 400, headers }
    )
  }
  const status = statusParam as OrderStatus | null

  // pagination
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10)
  const rawPageSize = parseInt(searchParams.get("pageSize") ?? "50", 10)

  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize >= 1 && rawPageSize <= 100
      ? rawPageSize
      : 50

  const offset = (page - 1) * pageSize

  // ── 4. Query database ─────────────────────────────────────────────────────
  try {
    // Build WHERE clause dynamically (only one optional filter for now).
    const conditions: string[] = []
    const params: unknown[] = []

    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    // Total count (same filter, no pagination).
    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM orders ${whereClause}`,
      params
    )
    const total = parseInt(countResult.rows[0]?.total ?? "0", 10)

    // Paginated rows.
    params.push(pageSize, offset)
    const { rows } = await query<Order>(
      `SELECT
         id, name, phone, address, email, note,
         delivery_zone   AS "deliveryZone",
         product_id      AS "productId",
         quantity, subtotal,
         delivery_charge AS "deliveryCharge",
         total, status,
         created_at      AS "createdAt"
       FROM orders
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    return NextResponse.json(
      { data: { orders: rows, total, page, pageSize } },
      { status: 200, headers }
    )
  } catch (err) {
    console.error("[GET /api/admin/orders] DB error:", err)
    return NextResponse.json(
      { error: "Failed to fetch orders. Please try again." },
      { status: 500, headers }
    )
  }
}
