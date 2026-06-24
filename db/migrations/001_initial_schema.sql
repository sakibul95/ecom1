-- ─── Migration 001: Initial schema ──────────────────────────────────────────
-- Run this once against your Postgres database to set up the tables.
--
-- Usage:
--   psql $DATABASE_URL -f db/migrations/001_initial_schema.sql
--
-- Or paste it into your Neon / Supabase / other hosted Postgres SQL editor.

-- ─── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id            TEXT        PRIMARY KEY,           -- slug, e.g. "radiance-serum"
  name          TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  tagline       TEXT        NOT NULL DEFAULT '',
  price         INTEGER     NOT NULL CHECK (price > 0),          -- stored in lowest currency unit (paisa/cents)
  original_price INTEGER    CHECK (original_price > 0),          -- NULL = no discount shown
  discount      SMALLINT    CHECK (discount BETWEEN 0 AND 100),  -- percentage
  image         TEXT        NOT NULL DEFAULT '',   -- path under /public or absolute URL
  badge         TEXT        CHECK (badge IN ('Bestseller', 'New', 'Sale')),
  category      TEXT        NOT NULL,              -- "serums" | "moisturizers" | etc.
  default_qty   SMALLINT    NOT NULL DEFAULT 1 CHECK (default_qty > 0),
  sizes         TEXT[]      NOT NULL DEFAULT '{}', -- e.g. {"30ml","50ml"}
  details       TEXT        NOT NULL DEFAULT '',
  how_to_use    TEXT        NOT NULL DEFAULT '',
  ingredients   TEXT        NOT NULL DEFAULT '',
  delivery_info TEXT        NOT NULL DEFAULT '',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    SMALLINT    NOT NULL DEFAULT 0,    -- lower = appears first
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for category filtering (used by GET /api/products?category=)
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category) WHERE is_active = true;

-- ─── Orders ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL      PRIMARY KEY,
  name            TEXT        NOT NULL,
  phone           TEXT        NOT NULL,
  address         TEXT        NOT NULL,
  email           TEXT,
  note            TEXT,
  delivery_zone   TEXT        NOT NULL CHECK (delivery_zone IN ('inside-dhaka', 'outside-dhaka', 'outside-district')),
  product_id      TEXT        NOT NULL REFERENCES products(id),
  quantity        SMALLINT    NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  subtotal        INTEGER     NOT NULL CHECK (subtotal >= 0),
  delivery_charge INTEGER     NOT NULL CHECK (delivery_charge >= 0),
  total           INTEGER     NOT NULL CHECK (total >= 0),
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing orders by status (useful for admin dashboards later)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_phone  ON orders (phone);

-- ─── Auto-update updated_at on every write ────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ─── Seed: insert the one active product ─────────────────────────────────────
-- Mirrors the hardcoded data currently in order-form.tsx / buynow/page.tsx.
-- Remove or expand once you have real products.

INSERT INTO products (
  id, name, description, tagline,
  price, original_price, discount,
  image, badge, category, default_qty,
  sizes, details, how_to_use, ingredients, delivery_info,
  is_active, sort_order
) VALUES (
  'radiance-serum',
  'Radiance Serum',
  'Vitamin C brightening formula',
  'Illuminate your natural glow',
  1150, 1300, 11,
  '/images/products/cream-jars-colored.png',
  'Bestseller',
  'serums', 1,
  ARRAY['30ml', '50ml'],
  'Our Radiance Serum combines 15% stabilized Vitamin C with rosehip seed oil and sea buckthorn extract.',
  'Apply 3-4 drops to cleansed face morning and evening. Follow with moisturizer.',
  'Aqua, Ascorbic Acid (Vitamin C), Rosa Canina Seed Oil, Glycerin, Niacinamide, Tocopherol.',
  'Standard delivery 3-5 business days. Free delivery on orders over ৳2000.',
  true, 0
) ON CONFLICT (id) DO NOTHING;
