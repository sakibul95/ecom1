"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ChevronLeft, Minus, Plus, ChevronDown,
  Leaf, Heart, Award, Recycle, Star,
} from "lucide-react"
import { Header } from "@/components/boty/header"
import { Footer } from "@/components/boty/footer"
import type { ProductDetail } from "@/lib/types"

// ─── Static UI data ───────────────────────────────────────────────────────────

const benefits = [
  { icon: Leaf,   label: "100% Natural"   },
  { icon: Heart,  label: "Cruelty-Free"   },
  { icon: Recycle,label: "Eco-Friendly"   },
  { icon: Award,  label: "Expert Approved"},
]

type AccordionSection = "details" | "howToUse" | "ingredients" | "deliveryInfo"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductPage() {
  const params   = useParams()
  const router   = useRouter()
  const productId = params.id as string

  const [product, setProduct]           = useState<ProductDetail | null>(null)
  const [fetchError, setFetchError]     = useState<string | null>(null)
  const [fetching, setFetching]         = useState(true)

  const [selectedSize, setSelectedSize] = useState<string>("")
  const [quantity, setQuantity]         = useState(1)
  const [openAccordion, setOpenAccordion] = useState<AccordionSection | null>("details")

  // ── Fetch product detail ──────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0)
    setFetching(true)
    setFetchError(null)

    fetch(`/api/products/${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        const p: ProductDetail = json.data
        setProduct(p)
        setSelectedSize(p.sizes?.[0] ?? "")
        setQuantity(p.defaultQty ?? 1)
      })
      .catch((err: Error) => setFetchError(err.message))
      .finally(() => setFetching(false))
  }, [productId])

  const toggleAccordion = (section: AccordionSection) =>
    setOpenAccordion(openAccordion === section ? null : section)

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (fetching) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="pt-28 pb-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 animate-pulse">
              <div className="aspect-square rounded-3xl bg-muted" />
              <div className="space-y-4">
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-10 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-8 w-1/4 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (fetchError || !product) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="pt-28 pb-20 flex flex-col items-center gap-4 text-center px-6">
          <p className="text-destructive text-lg">{fetchError ?? "Product not found."}</p>
          <button
            type="button"
            onClick={() => router.push("/shop")}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm"
          >
            Back to Shop
          </button>
        </div>
        <Footer />
      </main>
    )
  }

  // ── Accordion items ───────────────────────────────────────────────────────
  const accordionItems: { key: AccordionSection; title: string; content: string | undefined }[] = [
    { key: "details",      title: "Details",           content: product.details      },
    { key: "howToUse",     title: "How to Use",         content: product.howToUse     },
    { key: "ingredients",  title: "Ingredients",        content: product.ingredients  },
    { key: "deliveryInfo", title: "Delivery & Returns", content: product.deliveryInfo },
  ]

  return (
    <main className="min-h-screen">
      <Header />

      <div className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Back link */}
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Shop
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
            {/* Product image */}
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-card shadow-sm">
              <Image
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Product info */}
            <div className="flex flex-col">
              {/* Header */}
              <div className="mb-8">
                <span className="text-sm tracking-[0.3em] uppercase text-primary mb-2 block">
                  {product.category}
                </span>
                <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-3">
                  {product.name}
                </h1>
                {product.tagline && (
                  <p className="text-lg text-muted-foreground italic mb-4">
                    {product.tagline}
                  </p>
                )}

                {/* Star rating (static display) */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">(128 reviews)</span>
                </div>

                <p className="text-foreground/80 leading-relaxed">{product.description}</p>
              </div>

              {/* Price */}
              <div className="flex items-center gap-3 mb-8">
                <span className="text-3xl font-medium text-foreground">৳{product.price}</span>
                {product.originalPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    ৳{product.originalPrice}
                  </span>
                )}
                {product.discount && (
                  <span className="text-sm font-semibold text-white bg-primary px-2 py-0.5 rounded-full">
                    {product.discount}% OFF
                  </span>
                )}
              </div>

              {/* Size selector */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <label className="text-sm font-medium text-foreground mb-3 block">Size</label>
                  <div className="flex gap-3">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`px-6 py-3 rounded-full text-sm transition-colors shadow-sm ${
                          selectedSize === size
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-foreground hover:bg-card/80"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity selector */}
              <div className="mb-8">
                <label className="text-sm font-medium text-foreground mb-3 block">Quantity</label>
                <div className="inline-flex items-center gap-4 bg-card rounded-full px-2 py-2 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-foreground">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Buy Now button */}
              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <button
                  type="button"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm tracking-wide transition-colors shadow-sm bg-primary text-primary-foreground hover:bg-primary/80"
                  onClick={() => router.push(`/buynow?id=${product.id}&qty=${quantity}`)}
                >
                  Buy Now
                </button>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                {benefits.map((benefit) => (
                  <div
                    key={benefit.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-md"
                  >
                    <benefit.icon className="w-5 h-5 text-primary" />
                    <span className="text-xs text-muted-foreground text-center">{benefit.label}</span>
                  </div>
                ))}
              </div>

              {/* Accordion */}
              <div className="border-t border-border/50">
                {accordionItems.map((item) =>
                  item.content ? (
                    <div key={item.key} className="border-b border-border/50">
                      <button
                        type="button"
                        onClick={() => toggleAccordion(item.key)}
                        className="w-full flex items-center justify-between py-5 text-left"
                      >
                        <span className="font-medium text-foreground">{item.title}</span>
                        <ChevronDown
                          className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                            openAccordion === item.key ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          openAccordion === item.key ? "max-h-96 pb-5" : "max-h-0"
                        }`}
                      >
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
