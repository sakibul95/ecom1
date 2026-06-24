// ─── Shared domain types ─────────────────────────────────────────────────────
// Single source of truth — replaces duplicated inline types across:
//   components/boty/order-form.tsx
//   app/buynow/page.tsx
//   app/product/[id]/page.tsx
//   app/shop/page.tsx
//   components/boty/product-grid.tsx

// ── Products ──────────────────────────────────────────────────────────────────

/** Minimal shape used in grids and order forms */
export interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number | null
  discount: number | null
  image: string
  badge: string | null
  category: string
  defaultQty: number
}

/** Extended shape for the detail page */
export interface ProductDetail extends Product {
  tagline: string
  sizes: string[]
  details: string
  howToUse: string
  ingredients: string
  deliveryInfo: string
}

// ── Admin — product upload ────────────────────────────────────────────────────

/**
 * Payload for POST /api/admin/products.
 * All fields that map to nullable DB columns are optional here.
 */
export interface CreateProductPayload {
  id: string          // slug, e.g. "rose-face-serum"
  name: string
  description: string
  tagline?: string
  price: number
  originalPrice?: number
  discount?: number
  image: string       // URL or relative path
  badge?: string
  category: string
  defaultQty?: number // defaults to 1 in the DB if omitted
  sizes?: string[]
  details?: string
  howToUse?: string
  ingredients?: string
  deliveryInfo?: string
  sortOrder?: number
  isActive?: boolean  // defaults to true
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type DeliveryZone = "inside-dhaka" | "outside-dhaka" | "outside-district"

export interface DeliveryOption {
  id: DeliveryZone
  label: string
  charge: number
}

/** Payload the client sends to POST /api/orders */
export interface CreateOrderPayload {
  name: string
  phone: string
  address: string
  email?: string
  note?: string
  deliveryZone: DeliveryZone
  productId: string
  quantity: number
}

/** Row returned from the orders table */
export interface Order {
  id: number
  name: string
  phone: string
  address: string
  email: string | null
  note: string | null
  deliveryZone: DeliveryZone
  productId: string
  quantity: number
  subtotal: number
  deliveryCharge: number
  total: number
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  createdAt: string
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string
  name: string
  description: string
  price: number
  quantity: number
  image: string
}

// ── API response wrappers ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  error?: never
}

export interface ApiError {
  error: string
  data?: never
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
