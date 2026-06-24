# Boty — Natural Skincare eCommerce Template

A complete, polished skincare/eCommerce **front-end** built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **shadcn/ui**. This document explains the architecture, where every file lives, how data flows, how to modify the template, and — most importantly — **how to run it locally without Vercel**.

---

## 1. TL;DR — The Most Important Thing to Understand

> **This template has NO backend and NO database.**

There is no API, no server, no database, no authentication, and no payment processing. Everything is:

- **Static product data** — hardcoded as JavaScript arrays/objects inside component files.
- **Client-side state** — the shopping cart lives entirely in browser memory via React Context (it resets on page refresh).
- **Static assets** — images and videos served from the `public/` folder.

This means the project is a pure Next.js frontend. It runs anywhere Node.js runs — **you do not need Vercel** to develop, build, or host it. See [Section 7](#7-running-locally-without-vercel).

If you want a *real* store (persistent products, orders, checkout, accounts), see [Section 8 — Adding a Real Backend](#8-adding-a-real-backend--database).

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI runtime | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 (config lives in `app/globals.css`, not a `tailwind.config.js`) |
| Components | shadcn/ui (Radix primitives) in `components/ui/` |
| Icons | `lucide-react` |
| Fonts | `next/font/google` — DM Sans (body) + Playfair Display (headings) |
| State | React Context (cart only) |
| Analytics | `@vercel/analytics` (optional — safe to remove) |

---

## 3. Project Structure — Where Everything Is

```
.
├── app/                          # Next.js App Router (pages + layout + styles)
│   ├── layout.tsx                # Root layout: fonts, metadata, <CartProvider> wraps the app
│   ├── globals.css               # Tailwind v4 import + ALL design tokens (colors, fonts, animations)
│   ├── page.tsx                  # Home page — composes all the section components
│   ├── shop/
│   │   └── page.tsx              # "Shop All" page (its OWN hardcoded product list + filters)
│   └── product/
│       └── [id]/
│           └── page.tsx          # Dynamic product detail page (its OWN hardcoded product map)
│
├── components/
│   ├── boty/                     # ← All the custom storefront components live here
│   │   ├── header.tsx            # Top nav + cart button
│   │   ├── hero.tsx              # Hero section (video/image)
│   │   ├── trust-badges.tsx      # "cruelty-free / vegan" strip
│   │   ├── product-grid.tsx      # Home page product grid (its OWN hardcoded product list)
│   │   ├── feature-section.tsx   # Marketing/feature blocks
│   │   ├── testimonials.tsx      # Customer quotes
│   │   ├── cta-banner.tsx        # Call-to-action banner
│   │   ├── newsletter.tsx        # Email signup (UI only — does not submit anywhere)
│   │   ├── footer.tsx            # Footer links
│   │   ├── cart-context.tsx      # ← THE CART "BACKEND": React Context + in-memory state
│   │   └── cart-drawer.tsx       # Slide-out cart UI, reads from cart-context
│   │
│   ├── ui/                       # shadcn/ui primitives (button, dialog, drawer, etc.) — don't edit unless needed
│   └── theme-provider.tsx        # next-themes wrapper (light/dark support)
│
├── hooks/                        # use-mobile, use-toast
├── lib/
│   └── utils.ts                  # cn() helper for merging Tailwind classes
├── public/
│   └── images/                   # All product photos, hero media, videos
│
├── next.config.mjs               # Next.js config (images unoptimized, TS build errors ignored)
├── package.json                  # Scripts + dependencies
├── postcss.config.mjs            # PostCSS (Tailwind v4 plugin)
└── tsconfig.json                 # TypeScript config + "@/..." path alias
```

### The `@/` import alias
`@/` maps to the project root (configured in `tsconfig.json`). So `@/components/boty/header` → `./components/boty/header.tsx`.

---

## 4. How the "Backend" and "Database" Actually Work

There is no server or DB. Here is what plays those roles instead:

### 4.1 Product "database" = hardcoded arrays (in THREE places)

> ⚠️ **Important gotcha:** product data is currently duplicated across three files. There is no single source of truth. If you change a product, you may need to update it in more than one place.

| File | What it holds | Shape |
|------|---------------|-------|
| `components/boty/product-grid.tsx` | Products shown on the **home page** grid (categorised cream/oil/serum) | `products` array |
| `app/shop/page.tsx` | Products shown on the **/shop** page (more categories + filters) | `products` array |
| `app/product/[id]/page.tsx` | Full detail content (tagline, ingredients, sizes, etc.) for **product pages** | `products` object keyed by `id` |

A product object roughly looks like:

```ts
{
  id: "radiance-serum",          // used in the URL: /product/radiance-serum
  name: "Radiance Serum",
  description: "Vitamin C brightening formula",
  price: 68,
  originalPrice: null,           // set a number to show a strikethrough "sale" price
  image: "/images/products/serum-bottles-1.png",
  badge: "Bestseller",           // "Bestseller" | "New" | "Sale" | null
  category: "serum"
}
```

The detail page (`app/product/[id]/page.tsx`) reads the `[id]` from the URL with `useParams()` and looks it up in its `products` object. If the id isn't found, it falls back to `"radiance-serum"`.

### 4.2 Cart "backend" = React Context (in-memory)

`components/boty/cart-context.tsx` is the closest thing to application logic. It exposes a `useCart()` hook with:

```ts
items          // CartItem[] currently in the cart
addItem(item)  // add a product (auto-increments quantity if already present)
removeItem(id)
updateQuantity(id, qty)
clearCart()
isOpen / setIsOpen   // controls the cart drawer
itemCount      // total quantity (for the header badge)
subtotal       // computed price total
```

- It's wired in at `app/layout.tsx` via `<CartProvider>`, so any component can call `useCart()`.
- **State is held in `useState` — it is NOT persisted.** Refreshing the page empties the cart. (To persist it, sync to `localStorage` or a real backend — see Section 8.)
- `cart-drawer.tsx` is the visual cart that reads this context.

### 4.3 Forms (newsletter, "Buy Now", "Add to Cart" on detail page)
These are **UI-only**. The newsletter doesn't POST anywhere, and "Buy Now" / the detail-page "Add to Cart" currently just show a visual confirmation. Wire them to a real endpoint when you add a backend.

---

## 5. Styling & Design System

All design tokens live in **`app/globals.css`** (Tailwind v4 has no `tailwind.config.js`).

- **Colors** are defined as CSS variables and exposed to Tailwind via the `@theme inline` block. Use semantic classes like `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground` — **not** raw colors like `bg-white`.
- **Fonts** are loaded in `app/layout.tsx` and exposed as `--font-dm-sans` / `--font-playfair`. Use `font-sans` (DM Sans) and the serif headings via the configured classes.
- **Custom utilities** used throughout: `boty-shadow`, `boty-transition`, and the `animate-blur-in` keyframe animation — all defined in `globals.css`.

To change the whole look, edit the token values at the top of `app/globals.css`.

---

## 6. Common Modifications — Recipes

### Add or edit a product
1. Add the product image to `public/images/products/`.
2. Add an entry to the `products` array in `components/boty/product-grid.tsx` (home) and/or `app/shop/page.tsx` (shop page).
3. Add a matching entry (same `id`) to the `products` object in `app/product/[id]/page.tsx` so its detail page works.

### Change a price or mark something on sale
Edit `price` (and set `originalPrice` to show a strikethrough) in the relevant file(s) above.

### Edit home page section order
Reorder the components inside `app/page.tsx`.

### Change nav links / logo
Edit `components/boty/header.tsx` (and `footer.tsx` for footer links).

### Make the cart persist across refreshes
In `cart-context.tsx`, load initial `items` from `localStorage` and write to it inside a `useEffect` whenever `items` changes.

### Remove Vercel Analytics
Delete the `<Analytics />` import and usage in `app/layout.tsx`, then `pnpm remove @vercel/analytics`. Nothing else depends on it.

---

## 7. Running Locally Without Vercel

This is a standard Next.js app. **No Vercel account, CLI, or environment variables are required.**

### Prerequisites
- **Node.js 18.18+** (Node 20 LTS recommended). Check with `node -v`.
- A package manager. This repo uses **pnpm**, but npm/yarn/bun also work.

### Step 1 — Install a package manager (if needed)
```bash
# pnpm (recommended for this repo)
npm install -g pnpm
```

### Step 2 — Install dependencies
```bash
pnpm install
# or: npm install   /   yarn   /   bun install
```

### Step 3 — Start the dev server
```bash
pnpm dev
# or: npm run dev
```
Open **http://localhost:3000**. Hot reload is on — edits appear instantly.

### Step 4 — Production build (optional, to test the real output)
```bash
pnpm build      # compiles an optimized production build
pnpm start      # serves it at http://localhost:3000
```

That's it — the running app is fully self-contained. Because there's no database or secrets, there is nothing else to configure.

### Available scripts (`package.json`)
| Script | What it does |
|--------|--------------|
| `pnpm dev` | Start the dev server with hot reload |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |

### Notes for local / self-hosting
- `next.config.mjs` sets `images.unoptimized: true`, so the Next.js Image Optimization server isn't required — images work on any static or Node host.
- `typescript.ignoreBuildErrors: true` means the build won't fail on TS errors. For a stricter local workflow, set it to `false`.
- You can host the production build on **any** Node server (a VPS, Docker, Render, Railway, your own machine) — Vercel is optional.
- Want a fully static export? Because there's no server code, you can add `output: "export"` to `next.config.mjs` and run `pnpm build` to get a static site in `out/` that any static host (Nginx, GitHub Pages, S3, etc.) can serve.

---

## 8. Adding a Real Backend + Database

When you're ready to turn this template into a functioning store, here's the recommended path:

1. **Pick a database.** A serverless Postgres like **Neon** is a good default. Create your tables (e.g. `products`, `orders`, `order_items`).
2. **Move product data out of the component files** into the database. Replace the hardcoded `products` arrays with data fetched on the server.
   - In the App Router, make the page a **Server Component** and query the DB directly, or fetch via a Route Handler in `app/api/`.
3. **Persist the cart** — either in `localStorage` (quick) or server-side tied to a session/user.
4. **Add checkout** with **Stripe** (Stripe Checkout is the simplest path) to handle payments and create orders.
5. **Add auth** if you need accounts/order history (e.g. Better Auth on Neon, or Supabase Auth).
6. **Add env vars** — once you introduce a DB, Stripe, etc., you'll have secrets (connection strings, API keys). Put them in a local `.env.local` file (never commit it). This is the point where you *can* optionally deploy to Vercel and set the same vars there, but you can equally run them on any host.

The UI in this template is already structured to make this migration straightforward: swap the hardcoded arrays for fetched data, and wire the cart/checkout buttons to your new endpoints.

---

## 9. Quick Reference — "Where do I change X?"

| I want to change... | Go to... |
|---------------------|----------|
| A product's price, name, image | `product-grid.tsx`, `app/shop/page.tsx`, `app/product/[id]/page.tsx` |
| Product detail copy (ingredients, how-to-use) | `app/product/[id]/page.tsx` |
| Home page layout / section order | `app/page.tsx` |
| Colors, fonts, animations | `app/globals.css` |
| Fonts loaded | `app/layout.tsx` |
| Cart logic | `components/boty/cart-context.tsx` |
| Cart drawer UI | `components/boty/cart-drawer.tsx` |
| Nav / header | `components/boty/header.tsx` |
| Footer | `components/boty/footer.tsx` |
| Page title / SEO metadata | `app/layout.tsx` (`metadata` export) |
| Images & videos | `public/images/` |
| Next.js build settings | `next.config.mjs` |
