"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { useCart } from "./cart-context"
import type { Product } from "@/lib/types"

type Category = "cream" | "oil" | "serum"

const categories = [
  { value: "cream"  as Category, label: "Cream" },
  { value: "oil"    as Category, label: "Oil"   },
  { value: "serum"  as Category, label: "Serum" },
]

// Map UI category labels to the API `category` query param values
const CATEGORY_API_MAP: Record<Category, string> = {
  cream: "moisturizers",
  oil:   "oils",
  serum: "serums",
}

export function ProductGrid() {
  const [selectedCategory, setSelectedCategory] = useState<Category>("serum")
  const [products, setProducts]                 = useState<Product[]>([])
  const [fetching, setFetching]                 = useState(true)

  const [isVisible, setIsVisible]           = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [headerVisible, setHeaderVisible]   = useState(false)

  const gridRef   = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const { addItem } = useCart()

  // ── Fetch products when category changes ─────────────────────────────────
  useEffect(() => {
    const apiCategory = CATEGORY_API_MAP[selectedCategory]
    setFetching(true)

    fetch(`/api/products?category=${encodeURIComponent(apiCategory)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setProducts(json.data ?? [])
      })
      .catch(() => setProducts([]))
      .finally(() => setFetching(false))
  }, [selectedCategory])

  const handleCategoryChange = (category: Category) => {
    if (category !== selectedCategory) {
      setIsTransitioning(true)
      setTimeout(() => {
        setSelectedCategory(category)
        setTimeout(() => setIsTransitioning(false), 50)
      }, 300)
    }
  }

  // ── Intersection observers ────────────────────────────────────────────────
  useEffect(() => {
    const gridObserver = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1 }
    )
    const headerObserver = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHeaderVisible(true) },
      { threshold: 0.1 }
    )

    if (gridRef.current)   gridObserver.observe(gridRef.current)
    if (headerRef.current) headerObserver.observe(headerRef.current)

    return () => {
      if (gridRef.current)   gridObserver.unobserve(gridRef.current)
      if (headerRef.current) headerObserver.unobserve(headerRef.current)
    }
  }, [])

  return (
    <section className="py-24 bg-card">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div ref={headerRef} className="text-center mb-16">
          <span className={`text-sm tracking-[0.3em] uppercase text-primary mb-4 block ${headerVisible ? 'animate-blur-in opacity-0' : 'opacity-0'}`} style={headerVisible ? { animationDelay: '0.2s', animationFillMode: 'forwards' } : {}}>
            Our Collection
          </span>
          <h2 className={`font-serif leading-tight text-foreground mb-4 text-balance text-7xl ${headerVisible ? 'animate-blur-in opacity-0' : 'opacity-0'}`} style={headerVisible ? { animationDelay: '0.4s', animationFillMode: 'forwards' } : {}}>
            Gentle essentials
          </h2>
          <p className={`text-lg text-muted-foreground max-w-md mx-auto ${headerVisible ? 'animate-blur-in opacity-0' : 'opacity-0'}`} style={headerVisible ? { animationDelay: '0.6s', animationFillMode: 'forwards' } : {}}>
            Thoughtfully crafted products for your daily skincare ritual
          </p>
        </div>

        {/* Segmented Control */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-background rounded-full p-1 gap-1 relative">
            {/* Animated background slide */}
            <div
              className="absolute top-1 bottom-1 bg-foreground rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{
                left: selectedCategory === 'cream' ? '4px' : selectedCategory === 'oil' ? 'calc(33.333% + 2px)' : 'calc(66.666%)',
                width: 'calc(33.333% - 4px)'
              }}
            />
            {categories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => handleCategoryChange(category.value)}
                className={`relative z-10 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === category.value
                    ? "text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div 
          ref={gridRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {fetching
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-3xl bg-muted animate-pulse aspect-square" />
              ))
            : products.map((product, index) => (
            <Link
              key={`${selectedCategory}-${product.id}`}
            <Link
              key={`${selectedCategory}-${product.id}`}
              href={`/product/${product.id}`}
              className={`group transition-all duration-500 ease-out ${
                isVisible && !isTransitioning ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{ transitionDelay: isTransitioning ? '0ms' : `${index * 80}ms` }}
            >
              <div className="bg-background rounded-3xl overflow-hidden boty-shadow boty-transition group-hover:scale-[1.02]">
                {/* Image */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  <Image
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    fill
                    className="object-cover boty-transition group-hover:scale-105"
                  />
                  {/* Badge */}
                  {product.badge && (
                    <span
                      className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs tracking-wide bg-white text-black ${
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
                  {/* Quick add button */}
                  <button
                    type="button"
                    className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 boty-transition boty-shadow"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      addItem({
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        price: product.price,
                        image: product.image
                      })
                    }}
                    aria-label="Add to cart"
                  >
                    <ShoppingBag className="w-4 h-4 text-foreground" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="font-serif text-lg text-foreground mb-1">{product.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">${product.price}</span>
                    {product.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        ${product.originalPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 bg-transparent border border-foreground/20 text-foreground px-8 py-4 rounded-full text-sm tracking-wide boty-transition hover:bg-foreground/5"
          >
            View All Products
          </Link>
        </div>
      </div>
    </section>
  )
}
