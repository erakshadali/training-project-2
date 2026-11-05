"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { Product } from "@/data/products";
import { ProductArt } from "@/components/ProductArt";
import { useCart } from "@/context/CartContext";
import { inr, monthlyRent } from "@/lib/pricing";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add } = useCart();
  const cheapest = monthlyRent(product, 12);
  const soldOut = product.stock <= 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-[0_1px_0_rgba(19,35,31,0.04)] transition-shadow hover:shadow-[0_18px_40px_-18px_rgba(13,59,51,0.35)]"
    >
      <Link href={`/products/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-sand">
          <div className="grain absolute inset-0 opacity-70" aria-hidden />
          <div
            className="absolute -bottom-10 h-40 w-40 rounded-full opacity-30 blur-2xl transition-transform duration-500 group-hover:scale-125"
            style={{ background: product.tint }}
            aria-hidden
          />
          <ProductArt
            kind={product.art}
            tint={product.tint}
            className="relative h-[82%] w-[82%] transition-transform duration-500 group-hover:scale-105"
          />
          {soldOut && (
            <span className="absolute right-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Sold out</span>
          )}
          {product.popular && (
            <span className="absolute left-3 top-3 rounded-full bg-coral px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Popular
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-moss">{product.subcategory}</p>
        <Link href={`/products/${product.slug}`} className="font-semibold leading-snug text-ink hover:text-moss">
          {product.name}
        </Link>
        <p className="line-clamp-2 text-sm text-ink-soft">{product.blurb}</p>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-xs text-ink-soft">from</p>
            <p className="text-lg font-bold leading-none text-forest">
              {inr(cheapest)}
              <span className="text-xs font-medium text-ink-soft"> /month</span>
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => add(product.id, 12)}
            disabled={soldOut}
            className="flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-not-allowed disabled:bg-ink-soft/40 disabled:hover:bg-ink-soft/40"
            aria-label={`Add ${product.name} to cart`}
          >
            <Plus className="h-4 w-4" /> {soldOut ? "Sold out" : "Rent"}
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
