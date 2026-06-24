import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { rateLimit, getClientIp, ORDER_CREATE_LIMIT } from "@/lib/rate-limit"
import type { CreateOrderPayload, Order, ApiResponse } from "@/lib/types"

// ─── Delivery charge lookup ───────────────────────────────────────────────────
// Mirrors the client-side constants so the server recomputes the total
// independently — the client-submitted price is never trusted.
const DELIVERY_CHARGES: Record<string, number> = {
  "inside-dhaka": 50,
  "outside-dhaka": 80,
  "outside-district": 100,
}

const VALID_DELIVERY_ZONES = Object.keys(DELIVERY_CHARGES)

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Creates a new order.
//
// Request body (JSON):
//   name          string   (required)
//   phone         string   (required, 11-digit BD mobile)
//   address       string   (required)
//   email         string   (optional)
//   note          string   (optional)
//   deliveryZone  string   (required, one of VALID_DELIVERY_ZONES)
//   productId     string   (required, slug format)
//   quantity      number   (required, 1-99)
//
// Response: ApiResponse<Order>
//
// Rate limit: 5 req / minute per IP — prevents order spam (see lib/rate-limit.ts)

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Order>>> {
  // ── 1. Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(ip, ORDER_CREATE_LIMIT)

  const headers = {
    "X-RateLimit-Limit": String(ORDER_CREATE_LIMIT.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  }

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many order submissions. Please wait a minute and try again." },
      { status: 429, headers: { ...headers, "Retry-After": "60" } }
    )
  }

  // ── 2. Parse request body ─────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers }
    )
  }

  // ── 3. Validate payload ───────────────────────────────────────────────────
  const validationError = validateOrderPayload(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422, headers })
  }

  const payload = body as CreateOrderPayload

  // ── 4. Look up the product price from the DB ──────────────────────────────
  // Never trust prices from the client — recompute from the DB record.
  let productPrice: number
  try {
    const { rows } = await query<{ price: number }>(
      "SELECT price FROM products WHERE id = $1 AND is_active = true LIMIT 1",
      [payload.productId]
    )
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Product not found or unavailable." },
        { status: 404, headers }
      )
    }
    productPrice = rows[0].price
  } catch (err) {
    console.error("[POST /api/orders] Product lookup error:", err)
    return NextResponse.json(
      { error: "Failed to verify product. Please try again." },
      { status: 500, headers }
    )
  }

  // ── 5. Compute totals server-side ─────────────────────────────────────────
  const deliveryCharge = DELIVERY_CHARGES[payload.deliveryZone]
  const subtotal = productPrice * payload.quantity
  const total = subtotal + deliveryCharge

  // ── 6. Insert order ───────────────────────────────────────────────────────
  try {
    const { rows } = await query<Order>(
      `INSERT INTO orders
         (name, phone, address, email, note, delivery_zone,
          product_id, quantity, subtotal, delivery_charge, total, status)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING
         id, name, phone, address, email, note,
         delivery_zone     AS "deliveryZone",
         product_id        AS "productId",
         quantity, subtotal,
         delivery_charge   AS "deliveryCharge",
         total, status,
         created_at        AS "createdAt"`,
      [
        payload.name.trim(),
        payload.phone.trim(),
        payload.address.trim(),
        payload.email?.trim() || null,
        payload.note?.trim() || null,
        payload.deliveryZone,
        payload.productId,
        payload.quantity,
        subtotal,
        deliveryCharge,
        total,
      ]
    )

    return NextResponse.json({ data: rows[0] }, { status: 201, headers })
  } catch (err) {
    console.error("[POST /api/orders] Insert error:", err)
    return NextResponse.json(
      { error: "Failed to place order. Please try again." },
      { status: 500, headers }
    )
  }
}

// ─── Validation helper ────────────────────────────────────────────────────────

function validateOrderPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Request body must be a JSON object."

  const b = body as Record<string, unknown>

  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return "name is required."
  }
  if (b.name.trim().length > 100) return "name must be 100 characters or fewer."

  if (typeof b.phone !== "string" || !/^01[3-9]\d{8}$/.test(b.phone.trim())) {
    return "phone must be a valid 11-digit Bangladeshi mobile number (e.g. 01XXXXXXXXX)."
  }

  if (typeof b.address !== "string" || b.address.trim().length === 0) {
    return "address is required."
  }
  if (b.address.trim().length > 500) return "address must be 500 characters or fewer."

  if (b.email !== undefined && b.email !== null && b.email !== "") {
    if (typeof b.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
      return "email must be a valid email address."
    }
  }

  if (b.note !== undefined && b.note !== null && typeof b.note === "string" && b.note.length > 500) {
    return "note must be 500 characters or fewer."
  }

  if (!VALID_DELIVERY_ZONES.includes(b.deliveryZone as string)) {
    return `deliveryZone must be one of: ${VALID_DELIVERY_ZONES.join(", ")}.`
  }

  if (typeof b.productId !== "string" || !/^[a-z0-9-]+$/.test(b.productId)) {
    return "productId must be a valid slug (lowercase letters, numbers, hyphens)."
  }

  const qty = Number(b.quantity)
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return "quantity must be an integer between 1 and 99."
  }

  return null // all good
}
