import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth"
import { rateLimit, getClientIp, ADMIN_PRODUCT_UPLOAD_LIMIT } from "@/lib/rate-limit"
import type { CreateProductPayload, Product, ApiResponse } from "@/lib/types"

// ─── POST /api/admin/products ─────────────────────────────────────────────────
// Creates a new product record.
//
// Auth: Bearer token — Authorization: Bearer <ADMIN_API_KEY>
//
// Request body (JSON): CreateProductPayload
//   id            string   (required, slug: lowercase letters, numbers, hyphens)
//   name          string   (required)
//   description   string   (required)
//   tagline       string   (optional)
//   price         number   (required, > 0)
//   originalPrice number   (optional)
//   discount      number   (optional, 0-100)
//   image         string   (required, URL)
//   badge         string   (optional)
//   category      string   (required)
//   defaultQty    number   (optional, default 1)
//   sizes         string[] (optional)
//   details       string   (optional)
//   howToUse      string   (optional)
//   ingredients   string   (optional)
//   deliveryInfo  string   (optional)
//   sortOrder     number   (optional)
//   isActive      boolean  (optional, default true)
//
// Response: ApiResponse<Product>
//
// Rate limit: 30 req / minute (admin tooling only — not called from the UI)

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Product>>> {
  // ── 1. Auth check ─────────────────────────────────────────────────────────
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized. A valid Bearer token is required." },
      { status: 401 }
    )
  }

  // ── 2. Rate limiting ──────────────────────────────────────────────────────
  const ip = getClientIp(request)
  const rl = rateLimit(ip, ADMIN_PRODUCT_UPLOAD_LIMIT)

  const headers = {
    "X-RateLimit-Limit": String(ADMIN_PRODUCT_UPLOAD_LIMIT.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
  }

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { ...headers, "Retry-After": "60" } }
    )
  }

  // ── 3. Parse request body ─────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers }
    )
  }

  // ── 4. Validate payload ───────────────────────────────────────────────────
  const validationError = validateProductPayload(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422, headers })
  }

  const p = body as CreateProductPayload

  // ── 5. Insert product ─────────────────────────────────────────────────────
  try {
    const { rows } = await query<Product>(
      `INSERT INTO products
         (id, name, description, tagline, price, original_price, discount,
          image, badge, category, default_qty, sizes, details,
          how_to_use, ingredients, delivery_info, sort_order, is_active)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18)
       ON CONFLICT (id) DO NOTHING
       RETURNING
         id, name, description, price,
         original_price  AS "originalPrice",
         discount, image, badge, category,
         default_qty     AS "defaultQty"`,
      [
        p.id.trim(),
        p.name.trim(),
        p.description.trim(),
        p.tagline?.trim() ?? null,
        p.price,
        p.originalPrice ?? null,
        p.discount ?? null,
        p.image.trim(),
        p.badge?.trim() ?? null,
        p.category.trim().toLowerCase(),
        p.defaultQty ?? 1,
        p.sizes && p.sizes.length > 0 ? JSON.stringify(p.sizes) : null,
        p.details?.trim() ?? null,
        p.howToUse?.trim() ?? null,
        p.ingredients?.trim() ?? null,
        p.deliveryInfo?.trim() ?? null,
        p.sortOrder ?? 0,
        p.isActive ?? true,
      ]
    )

    // ON CONFLICT DO NOTHING returns no rows if the ID already existed.
    if (rows.length === 0) {
      return NextResponse.json(
        { error: `A product with id "${p.id}" already exists.` },
        { status: 409, headers }
      )
    }

    return NextResponse.json({ data: rows[0] }, { status: 201, headers })
  } catch (err) {
    console.error("[POST /api/admin/products] DB error:", err)
    return NextResponse.json(
      { error: "Failed to create product. Please try again." },
      { status: 500, headers }
    )
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateProductPayload(body: unknown): string | null {
  if (!body || typeof body !== "object") return "Request body must be a JSON object."

  const b = body as Record<string, unknown>

  // id — slug format
  if (typeof b.id !== "string" || !/^[a-z0-9-]+$/.test(b.id.trim())) {
    return "id is required and must be a slug (lowercase letters, numbers, hyphens only)."
  }
  if (b.id.trim().length > 100) return "id must be 100 characters or fewer."

  // name
  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return "name is required."
  }
  if (b.name.trim().length > 200) return "name must be 200 characters or fewer."

  // description
  if (typeof b.description !== "string" || b.description.trim().length === 0) {
    return "description is required."
  }

  // price
  const price = Number(b.price)
  if (!Number.isFinite(price) || price <= 0) {
    return "price must be a positive number."
  }

  // originalPrice (optional)
  if (b.originalPrice !== undefined && b.originalPrice !== null) {
    const op = Number(b.originalPrice)
    if (!Number.isFinite(op) || op <= 0) {
      return "originalPrice must be a positive number."
    }
  }

  // discount (optional, 0–100)
  if (b.discount !== undefined && b.discount !== null) {
    const d = Number(b.discount)
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      return "discount must be a number between 0 and 100."
    }
  }

  // image — basic URL check
  if (typeof b.image !== "string" || b.image.trim().length === 0) {
    return "image is required."
  }

  // category
  if (typeof b.category !== "string" || b.category.trim().length === 0) {
    return "category is required."
  }

  // defaultQty (optional)
  if (b.defaultQty !== undefined && b.defaultQty !== null) {
    const qty = Number(b.defaultQty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return "defaultQty must be an integer between 1 and 99."
    }
  }

  // sizes (optional array of strings)
  if (b.sizes !== undefined && b.sizes !== null) {
    if (!Array.isArray(b.sizes) || !b.sizes.every((s) => typeof s === "string")) {
      return "sizes must be an array of strings."
    }
  }

  // sortOrder (optional)
  if (b.sortOrder !== undefined && b.sortOrder !== null) {
    if (!Number.isInteger(Number(b.sortOrder))) {
      return "sortOrder must be an integer."
    }
  }

  // isActive (optional boolean)
  if (b.isActive !== undefined && b.isActive !== null) {
    if (typeof b.isActive !== "boolean") {
      return "isActive must be a boolean."
    }
  }

  return null // all good
}
