# Backend — PostgreSQL Integration & API Layer

This document covers every file added or changed to connect the Next.js project to a PostgreSQL database, expose REST API routes, and enforce rate limiting.

---

## 1. What Was Added and Why

| File                                   | Purpose                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/types.ts`                         | Single source of truth for all shared TypeScript types (Product, Order, Cart, API wrappers). Eliminates the current 3× duplication of inline types across component files. |
| `lib/db.ts`                            | Postgres connection pool via `pg` (node-postgres). Exposes a `query()` helper for parameterized queries. Handles hot-reload pool reuse in development.                     |
| `lib/rate-limit.ts`                    | In-process sliding-window rate limiter. No external dependency. Centralises per-route limits and provides a `getClientIp()` helper.                                        |
| `app/api/products/route.ts`            | `GET /api/products` — list all active products, with optional `?category=` filter.                                                                                         |
| `app/api/products/[id]/route.ts`       | `GET /api/products/:id` — single product detail (full `ProductDetail` shape including sizes, ingredients, etc.).                                                           |
| `app/api/orders/route.ts`              | `POST /api/orders` — create a new order. Validates input, re-fetches price from DB (never trusts the client), computes totals server-side.                                 |
| `db/migrations/001_initial_schema.sql` | One-time SQL migration: creates `products` and `orders` tables, indexes, update triggers, and seeds the one currently active product.                                      |
| `.env.example`                         | Template for `.env.local` showing required environment variables.                                                                                                          |

---

## 2. Setup

### 2.1 Create the database

Use any Postgres provider: **local**, **Neon** (serverless, free tier), **Supabase**, **Railway**, etc.

```bash
# Local example
createdb boty
```

### 2.2 Run the migration

```bash
psql $DATABASE_URL -f db/migrations/001_initial_schema.sql
```

Or paste the file contents into your provider's SQL editor.

### 2.3 Configure environment variables

```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL
```

`.env.local` is already in `.gitignore`. Never commit real credentials.

### 2.4 Install dependencies (already done if you ran `npm install`)

```bash
npm install
```

`pg@8.13.3` and `@types/pg@8.11.11` were added as exact-version dependencies.

---

## 3. API Reference

All endpoints return JSON in one of two shapes:

```ts
// Success
{ "data": <payload> }

// Error
{ "error": "<human-readable message>" }
```

All responses include rate-limit headers:

| Header                  | Meaning                                         |
| ----------------------- | ----------------------------------------------- |
| `X-RateLimit-Limit`     | Max requests allowed in the window              |
| `X-RateLimit-Remaining` | Requests left in the current window             |
| `X-RateLimit-Reset`     | Unix timestamp (seconds) when the window resets |

---

### GET /api/products

Returns all active products.

**Query params**

| Param      | Type   | Required | Description                                                                                                            |
| ---------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `category` | string | No       | Filter by category. Allowed: `serums`, `moisturizers`, `cleansers`, `oils`, `masks`, `toners`, `cream`, `serum`, `oil` |

**Rate limit:** 60 requests / minute per IP

**Example**

```bash
curl /api/products
curl "/api/products?category=serums"
```

**Response 200**

```json
{
  "data": [
    {
      "id": "radiance-serum",
      "name": "Radiance Serum",
      "description": "Vitamin C brightening formula",
      "price": 1150,
      "originalPrice": 1300,
      "discount": 11,
      "image": "/images/products/cream-jars-colored.png",
      "badge": "Bestseller",
      "category": "serums",
      "defaultQty": 1
    }
  ]
}
```

---

### GET /api/products/:id

Returns the full detail record for a single product.

**Rate limit:** 60 requests / minute per IP

**Example**

```bash
curl /api/products/radiance-serum
```

**Response 200**

```json
{
  "data": {
    "id": "radiance-serum",
    "name": "Radiance Serum",
    "tagline": "Illuminate your natural glow",
    "price": 1150,
    "sizes": ["30ml", "50ml"],
    "details": "...",
    "howToUse": "...",
    "ingredients": "...",
    "deliveryInfo": "..."
  }
}
```

**Response 404** — product ID not found or inactive.

---

### POST /api/orders

Creates a new order. Totals are computed server-side from the DB price — client-submitted prices are ignored.

**Rate limit:** 5 requests / minute per IP

**Request body (JSON)**

| Field          | Type   | Required | Validation                                              |
| -------------- | ------ | -------- | ------------------------------------------------------- |
| `name`         | string | ✅       | max 100 chars                                           |
| `phone`        | string | ✅       | BD mobile format: `01[3-9]XXXXXXXX`                     |
| `address`      | string | ✅       | max 500 chars                                           |
| `email`        | string | No       | valid email format                                      |
| `note`         | string | No       | max 500 chars                                           |
| `deliveryZone` | string | ✅       | `inside-dhaka` \| `outside-dhaka` \| `outside-district` |
| `productId`    | string | ✅       | slug: lowercase letters, numbers, hyphens               |
| `quantity`     | number | ✅       | integer 1–99                                            |

**Example**

```bash
curl -X POST /api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmed Rahman",
    "phone": "01712345678",
    "address": "House 12, Road 5, Dhanmondi, Dhaka",
    "deliveryZone": "inside-dhaka",
    "productId": "radiance-serum",
    "quantity": 2
  }'
```

**Response 201**

```json
{
  "data": {
    "id": 1,
    "name": "Ahmed Rahman",
    "phone": "01712345678",
    "address": "...",
    "deliveryZone": "inside-dhaka",
    "productId": "radiance-serum",
    "quantity": 2,
    "subtotal": 2300,
    "deliveryCharge": 50,
    "total": 2350,
    "status": "pending",
    "createdAt": "2026-06-24T10:00:00Z"
  }
}
```

**Response 422** — validation error with a specific message.
**Response 429** — rate limit exceeded.

---

## 4. Architecture Decisions

### Why `pg` (node-postgres) instead of an ORM?

The project is straightforward — two tables, simple queries. An ORM (Prisma, Drizzle) adds a code-generation step, a migration runner, and an abstraction layer that makes debugging harder. Raw `pg` with parameterized queries is simpler, explicit, and has zero extra build dependencies.

### Why in-process rate limiting instead of Redis?

For a single Next.js server instance (which covers local dev, a VPS, Railway, Render, and most small deployments), in-process rate limiting works perfectly and adds no infrastructure dependency. The state lives in a `Map` in the Node.js process.

**If you scale to multiple instances or use Vercel Edge Functions**, swap `lib/rate-limit.ts` for an atomic Redis solution like [Upstash Ratelimit](https://github.com/upstash/ratelimit). The API route code doesn't change — only the `rateLimit()` function implementation.

### Why sliding window instead of fixed window?

A fixed window allows a burst of `2 × limit` requests at the boundary (end of one window + start of the next). A sliding window prevents this by measuring from the current moment backwards, giving a more accurate and fairer limit.

### Why is price re-fetched from the database on order creation?

Never trust prices from the client — a user could modify the request payload to submit `price: 0`. The server always fetches the current price from the `products` table and computes `subtotal` and `total` itself.

### Why are totals stored on the `orders` row?

Product prices can change over time. Storing `subtotal`, `delivery_charge`, and `total` at the moment of order creation preserves the historical record, which is essential for invoicing and dispute resolution.

---

## 5. Connecting the Frontend

The API routes are ready. To wire the existing UI components to the backend, two changes are needed:

### 5.1 Order form submission (`order-form.tsx` and `buynow/page.tsx`)

Replace the current `setSubmitted(true)` no-op with a real `fetch`:

```ts
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!name || !phone || !address) return;

  setLoading(true);
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        address,
        email: email || undefined,
        note: note || undefined,
        deliveryZone: delivery,
        productId: selectedProduct,
        quantity: activeQty,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Order failed");
    setSubmitted(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong");
  } finally {
    setLoading(false);
  }
};
```

### 5.2 Product data (`shop/page.tsx`, `product-grid.tsx`, `product/[id]/page.tsx`)

Convert these pages/components from hardcoded data to fetching from the API:

**Server Component example (shop page):**

```ts
// app/shop/page.tsx  — remove "use client", fetch on the server
export default async function ShopPage() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products`, {
    next: { revalidate: 60 }, // ISR: re-fetch at most every 60 seconds
  });
  const { data: products } = await res.json();
  // ... render with fetched products
}
```

**Product detail page:**

```ts
// app/product/[id]/page.tsx
export default async function ProductPage({ params }) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/products/${params.id}`,
  );
  if (!res.ok) notFound();
  const { data: product } = await res.json();
  // ... render with fetched product
}
```

---

## 6. Database Schema Quick Reference

```sql
-- products
id            TEXT PRIMARY KEY          -- slug
name          TEXT NOT NULL
price         INTEGER NOT NULL          -- in paisa/cents (×100 if using USD)
original_price INTEGER                  -- NULL = no strikethrough price
discount      SMALLINT                  -- percentage 0-100
image         TEXT                      -- /public path or absolute URL
badge         TEXT                      -- 'Bestseller' | 'New' | 'Sale' | NULL
category      TEXT NOT NULL
default_qty   SMALLINT DEFAULT 1
sizes         TEXT[]                    -- {"30ml","50ml"}
details       TEXT
how_to_use    TEXT
ingredients   TEXT
delivery_info TEXT
is_active     BOOLEAN DEFAULT true
sort_order    SMALLINT DEFAULT 0        -- display order

-- orders
id              SERIAL PRIMARY KEY
name / phone / address / email / note   -- customer fields
delivery_zone   TEXT                    -- 'inside-dhaka' | ...
product_id      TEXT REFERENCES products(id)
quantity        SMALLINT
subtotal        INTEGER                 -- price × qty
delivery_charge INTEGER
total           INTEGER
status          TEXT DEFAULT 'pending'  -- 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

## 7. Adding More Products

1. Write an `INSERT` statement (follow the seed in `001_initial_schema.sql`).
2. Place the product image in `public/images/products/`.
3. The product will appear in `GET /api/products` immediately.

To add a full product variant (detail page, ingredients, etc.), populate the `tagline`, `details`, `how_to_use`, `ingredients`, `delivery_info`, and `sizes` columns.
