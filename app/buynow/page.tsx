"use client"

import { useState, useEffect, Suspense } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Minus, Plus, CheckCircle2 } from "lucide-react"
import { Header } from "@/components/boty/header"
import { Footer } from "@/components/boty/footer"
import type { Product, DeliveryZone, DeliveryOption } from "@/lib/types"

// ─── Static delivery options ──────────────────────────────────────────────────
// These match the server-side DELIVERY_CHARGES map in /api/orders/route.ts

const deliveryOptions: DeliveryOption[] = [
  { id: "inside-dhaka",    label: "ঢাকা সিটির ভেতরে", charge: 50  },
  { id: "outside-dhaka",   label: "ঢাকা সিটির বাইরে", charge: 80  },
  { id: "outside-district",label: "ঢাকা জেলার বাইরে", charge: 100 },
]

// ─── Default export — wraps the page in Suspense ─────────────────────────────
// Required because useSearchParams() opts out of static prerendering.

export default function BuyNowPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen">
        <Header />
        <div className="pt-28 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Loading…</p>
        </div>
        <Footer />
      </main>
    }>
      <BuyNowContent />
    </Suspense>
  )
}

// ─── Inner component — allowed to call useSearchParams() ─────────────────────

function BuyNowContent() {
  const searchParams = useSearchParams()

  // ── Product list fetched from API ─────────────────────────────────────────
  const [products, setProducts]     = useState<Product[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetching, setFetching]     = useState(true)

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setProducts(json.data)
      })
      .catch((err: Error) => setFetchError(err.message))
      .finally(() => setFetching(false))
  }, [])

  // Form state
  const [name, setName]       = useState("")
  const [phone, setPhone]     = useState("")
  const [address, setAddress] = useState("")
  const [email, setEmail]     = useState("")
  const [note, setNote]       = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [delivery, setDelivery] = useState<DeliveryZone>("inside-dhaka")
  const [submitted, setSubmitted] = useState(false)

  // ── Selection state — initialised after products load ────────────────────
  const [selectedProduct, setSelectedProduct] = useState<string>("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // Once products arrive, seed selection from URL params or default to first
  useEffect(() => {
    if (products.length === 0) return

    const paramId  = searchParams.get("id")
    const paramQty = parseInt(searchParams.get("qty") ?? "1", 10)

    const defaults = Object.fromEntries(
      products.map((p) => [p.id, p.defaultQty ?? 1])
    )

    const targetId = products.find((p) => p.id === paramId)?.id ?? products[0].id
    if (paramId && defaults[paramId] !== undefined) {
      defaults[paramId] = Math.max(1, isNaN(paramQty) ? 1 : paramQty)
    }

    setSelectedProduct(targetId)
    setQuantities(defaults)
  }, [products, searchParams])

  // Sync if the user navigates to buynow with different params without unmounting
  useEffect(() => {
    if (products.length === 0) return
    const id  = searchParams.get("id")
    const qty = parseInt(searchParams.get("qty") ?? "1", 10)
    if (id && products.find((p) => p.id === id)) {
      setSelectedProduct(id)
      setQuantities((prev) => ({
        ...prev,
        [id]: Math.max(1, isNaN(qty) ? 1 : qty),
      }))
    }
  }, [searchParams, products])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const changeQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] ?? 1) + delta),
    }))
  }

  const activeProduct   = products.find((p) => p.id === selectedProduct)
  const activeQty       = quantities[selectedProduct] ?? 1
  const subtotal        = (activeProduct?.price ?? 0) * activeQty
  const deliveryCharge  = deliveryOptions.find((d) => d.id === delivery)?.charge ?? 50
  const total           = subtotal + deliveryCharge

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name || !phone || !address) return

    setLoading(true)
    setError(null)
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
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Order failed")
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (fetching) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="pt-28 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground animate-pulse">Loading products…</p>
        </div>
        <Footer />
      </main>
    )
  }

  if (fetchError || products.length === 0) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="pt-28 pb-20 flex items-center justify-center">
          <p className="text-destructive">{fetchError ?? "No products available."}</p>
        </div>
        <Footer />
      </main>
    )
  }

  if (submitted) {
    return (
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col items-center justify-center gap-4 text-center">
          <CheckCircle2 className="w-16 h-16 text-primary" />
          <h2 className="font-serif text-4xl text-foreground">
            অর্ডার সফল হয়েছে!
          </h2>
          <p className="text-muted-foreground text-lg max-w-sm">
            আমাদের একজন কাস্টমার প্রতিনিধি আপনাকে কল করে অর্ডার কনফার্ম করবে।
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-4 px-8 py-3 rounded-full border border-foreground/20 text-sm text-foreground hover:bg-foreground/5 transition-colors"
          >
            আবার অর্ডার করুন
          </button>
        </div>
      </section>
    )
  }

  return (

    <main className="min-h-screen">
          <Header />

<br/>
    <section className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* ── LEFT: Order form ─────────────────────────────────────────── */}
          <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
            <h2 className="font-serif text-2xl text-foreground text-center mb-8">
              অর্ডার করতে নিচের তথ্যগুলি দিন
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
                <label className="text-sm text-foreground font-medium">
                  নাম
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="আপনার নাম"
                  required
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>

              {/* Phone */}
              <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
                <label className="text-sm text-foreground font-medium">
                  মোবাইল নাম্বার
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="১১ ডিজিট মোবাইল নাম্বার"
                  required
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>

              {/* Address */}
              <div className="grid grid-cols-[6rem_1fr] items-start gap-3">
                <label className="text-sm text-foreground font-medium pt-2.5">
                  ঠিকানা
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="বাসা নম্বর, গ্রাম/সেক্টর, উপজেলা, জেলা"
                  required
                  rows={3}
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                />
              </div>

              {/* Email */}
              <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
                <label className="text-sm text-foreground font-medium">
                  ইমেইল
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="আপনার ইমেইল (ঐচ্ছিক)"
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>

              {/* Note */}
              <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
                <label className="text-sm text-foreground font-medium">
                  অর্ডার নোট
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="স্পেশাল কিছু বলতে চাইলে লিখুন (ঐচ্ছিক)"
                  className="w-full border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
              </div>

              {/* Delivery Zone */}
              <div className="space-y-2 pt-1">
                <p className="text-sm text-foreground font-medium">
                  ডেলিভারি এলাকা
                </p>
                <div className="space-y-2">
                  {deliveryOptions.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                        delivery === opt.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="flex items-center gap-3 text-sm text-foreground">
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            delivery === opt.id
                              ? "border-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {delivery === opt.id && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </span>
                        {opt.label}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        ৳{opt.charge}
                      </span>
                      <input
                        type="radio"
                        name="delivery"
                        value={opt.id}
                        checked={delivery === opt.id}
                        onChange={() => setDelivery(opt.id)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-4 text-base font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "অর্ডার হচ্ছে..." : `অর্ডার কনফার্ম করুন ${total.toLocaleString("bn-BD")} TK`}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                আমাদের একজন কাস্টমার প্রতিনিধি আপনাকে কল করে অর্ডার কনফার্ম করবে।
              </p>
            </form>
          </div>

          {/* ── RIGHT: Product selection + summary ───────────────────────── */}
          <div className="space-y-4">
            <h2 className="font-serif text-2xl text-accent-foreground">পণ্য বাছাই করুন</h2>

            {/* Product cards */}
            {products.map((product) => {
              const isSelected = selectedProduct === product.id
              const qty = quantities[product.id] ?? 1
              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product.id)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedProduct(product.id)
                  }}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      // ? "border-primary bg-primary/5 shadow-sm"
                      ? "border-border hover:border-primary/40 bg-card"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  {/* Radio dot */}
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {isSelected && (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </span>

                  {/* Product image */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        ৳{product.price.toLocaleString("bn-BD")}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        ৳{product.originalPrice}
                      </span>
                      <span className="text-xs font-semibold text-white bg-primary px-1.5 py-0.5 rounded">
                        {product.discount}% OFF
                      </span>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">Quantity:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            changeQty(product.id, -1)
                          }}
                          aria-label="Decrease quantity"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="w-3 h-3 text-foreground" />
                        </button>
                        <span className="text-sm font-medium text-foreground w-4 text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            changeQty(product.id, 1)
                          }}
                          aria-label="Increase quantity"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3 text-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Order Summary */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>মোট</span>
                <span className="text-foreground font-medium">
                  ৳{subtotal.toLocaleString("bn-BD")}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>ডেলিভারি চার্জ</span>
                <span className="text-foreground font-medium">
                  ৳{deliveryCharge}
                </span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-base font-bold text-foreground">
                <span>Total</span>
                <span>৳{total.toLocaleString("bn-BD")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
          <Footer />
    </main>
  )
}
