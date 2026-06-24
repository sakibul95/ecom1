"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShoppingBag, SlidersHorizontal, X } from "lucide-react"
import { Header } from "@/components/boty/header"
import { Footer } from "@/components/boty/footer"
import type { Product } from "@/lib/types"

const categories = ["all", "serums", "moisturizers", "cleansers", "oils", "masks", "toners"]

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)

  const [selectedCategory, setSelectedCategory] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Fetch products from API ─────────────────────────────────────────────────
  useEffect(() => {
    const url =
      selectedCategory === "all"
        ? "/api/products"
        : `/api/products?category=${encodeURIComponent(selectedCategory)}`

    setFetching(true)
    setFetchError(null)

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setProducts(json.data)
      })
      .catch((err: Error) => setFetchError(err.message))
      .finally(() => setFetching(false))
  }, [selectedCategory])

  // ── Intersection observer for entrance animation ────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    if (gridRef.current) observer.observe(gridRef.current)
    return () => { if (gridRef.current) observer.unobserve(gridRef.current) }
  }, [])

  // Reset animation when category changes
  useEffect(() => {
    setIsVisible(false)
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [selectedCategory])

  return (
    <main className="min-h-screen">
      <Header />

      <div className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Page header */}
          <div className="text-center mb-12">
            <span className="text-sm tracking-[0.3em] uppercase text-primary mb-4 block">
              Our Collection
            </span>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground mb-4 text-balance">
              Shop All Products
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Discover our complete range of natural skincare essentials
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-border/50">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden inline-flex items-center gap-2 text-sm text-foreground"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>

            {/* Desktop categories */}
            <div className="hidden lg:flex items-center gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm capitalize transition-colors ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground/70 hover:text-foreground shadow-sm"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <span className="text-sm text-muted-foreground">
              {fetching ? "Loading…" : `${products.length} ${products.length === 1 ? "product" : "products"}`}
            </span>
          </div>

          {/* Mobile filters drawer */}
          {showFilters && (
            <div className="lg:hidden fixed inset-0 z-50 bg-background">
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-serif text-2xl text-foreground">Filters</h2>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="p-2 text-foreground/70 hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category)
                        setShowFilters(false)
                      }}
                      className={`w-full px-6 py-4 rounded-2xl text-left capitalize transition-colors ${
                        selectedCategory === category
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground shadow-sm"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* States */}
          {fetching && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-3xl bg-card animate-pulse aspect-[3/4]" />
              ))}
            </div>
          )}

          {!fetching && fetchError && (
            <p className="text-center text-destructive py-20">{fetchError}</p>
          )}

          {!fetching && !fetchError && products.length === 0 && (
            <p className="text-center text-muted-foreground py-20">
              No products found in this category.
            </p>
          )}

          {/* Product grid */}
          {!fetching && !fetchError && products.length > 0 && (
            <div ref={gridRef} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={index}
                  isVisible={isVisible}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  )
}

function ProductCard({
  product,
  index,
  isVisible,
}: {
  product: Product
  index: number
  isVisible: boolean
}) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const router = useRouter()

  return (
    <Link
      href={`/product/${product.id}`}
      className={`group transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="bg-card rounded-3xl overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-[1.02]">
        {/* Image */}
        <div className="relative aspect-square bg-muted overflow-hidden">
          {/* Skeleton */}
          <div
            className={`absolute inset-0 bg-linear-to-br from-muted via-muted/50 to-muted animate-pulse transition-opacity duration-500 ${
              imageLoaded ? "opacity-0" : "opacity-100"
            }`}
          />
          <Image
            src={product.image || "/placeholder.svg"}
            alt={product.name}
            fill
            className={`object-cover transition-all duration-500 group-hover:scale-105 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
          />
          {/* Badge */}
          {product.badge && (
            <span
              className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs tracking-wide ${
                product.badge === "Sale"
                  ? "bg-destructive/10 text-destructive"
                  : product.badge === "New"
                  ? "bg-primary/10 text-primary"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {product.badge}
            </span>
          )}
          {/* Quick buy now */}
          <button
            type="button"
            className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 shadow-sm"
            onClick={(e) => {
              e.preventDefault()
              router.push(`/buynow?id=${product.id}&qty=1`)
            }}
            aria-label="Buy now"
          >
            <ShoppingBag className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Info */}
        <div className="p-6">
          <h3 className="font-serif text-xl text-foreground mb-1">{product.name}</h3>
          <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium text-foreground">৳{product.price}</span>
            {product.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                ৳{product.originalPrice}
              </span>
            )}
            {product.discount && (
              <span className="text-xs font-semibold text-white bg-primary px-1.5 py-0.5 rounded">
                {product.discount}% OFF
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
