"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Minus, Plus, ShieldCheck, Truck, Wrench } from "lucide-react";
import { ProductArt } from "@/components/ProductArt";
import { ProductCard } from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import { tenures, type TenureMonths } from "@/data/config";
import { products, type Product } from "@/data/products";
import { inr, monthlyRent } from "@/lib/pricing";

export function ProductDetail({ product }: { product: Product }) {
  const { add, city } = useCart();
  const [months, setMonths] = useState<TenureMonths>(12);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const rent = monthlyRent(product, months);
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);

  function onAdd() {
    add(product.id, months, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
        <Link href="/products" className="hover:text-forest">Shop</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/products?category=${product.category}`} className="capitalize hover:text-forest">{product.category}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-ink">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative grid aspect-square place-items-center overflow-hidden rounded-[2.5rem] bg-sand lg:sticky lg:top-24 lg:self-start">
          <div className="grain absolute inset-0 opacity-70" aria-hidden />
          <div className="absolute h-2/3 w-2/3 rounded-full opacity-30 blur-3xl" style={{ background: product.tint }} aria-hidden />
          <motion.div key={months} initial={{ y: 10, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} className="float-slow relative w-[86%]">
            <ProductArt kind={product.art} tint={product.tint} />
          </motion.div>
          {product.popular && <span className="absolute left-5 top-5 rounded-full bg-coral px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Popular</span>}
        </motion.div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-moss">{product.subcategory}</p>
          <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-ink-soft">{product.description}</p>

          <div className="mt-6 rounded-3xl border border-line bg-paper p-5 sm:p-6">
            <fieldset>
              <legend className="text-sm font-semibold">Choose your plan</legend>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {tenures.map((t) => {
                  const selected = months === t.months;
                  return (
                    <label key={t.months} className={`relative cursor-pointer rounded-2xl border-2 p-3 text-center transition ${selected ? "border-forest bg-mint/50" : "border-line hover:border-moss"}`}>
                      <input type="radio" name="tenure" value={t.months} checked={selected} onChange={() => setMonths(t.months)} className="sr-only" />
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="mt-1 block text-sm font-bold text-forest">{inr(monthlyRent(product, t.months))}</span>
                      <span className="block text-[11px] text-ink-soft">per month</span>
                      {t.discount > 0 && <span className="absolute -top-2 right-2 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">Save {Math.round(t.discount * 100)}%</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-5 flex items-end justify-between border-t border-line pt-5">
              <div>
                <p className="text-sm text-ink-soft">Monthly rent</p>
                <AnimatePresence mode="popLayout">
                  <motion.p key={rent * qty} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="font-display text-4xl font-semibold text-forest">
                    {inr(rent * qty)}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="text-right text-sm">
                <p className="text-ink-soft">Refundable deposit</p>
                <p className="text-lg font-bold">{inr(product.deposit * qty)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-line">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-12 w-12 place-items-center" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(10, q + 1))} className="grid h-12 w-12 place-items-center" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onAdd}
                className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 font-semibold text-white transition ${added ? "bg-moss" : "bg-coral hover:bg-coral-deep"}`}
              >
                {added ? <><Check className="h-5 w-5" /> Added to cart</> : "Add to cart"}
              </motion.button>
            </div>
            <p className="mt-3 text-center text-xs text-ink-soft">Delivering to {city}. Free delivery and installation.</p>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Truck, t: "Free delivery" },
              { icon: Wrench, t: "Free repairs" },
              { icon: ShieldCheck, t: "Deposit refundable" },
            ].map((x) => (
              <li key={x.t} className="flex items-center gap-2 rounded-2xl bg-sand px-4 py-3 text-sm font-medium">
                <x.icon className="h-4 w-4 text-moss" /> {x.t}
              </li>
            ))}
          </ul>

          <h2 className="font-display mt-9 text-xl font-semibold">What you get</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {product.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-moss" /> {f}
              </li>
            ))}
          </ul>

          <h2 className="font-display mt-9 text-xl font-semibold">Specifications</h2>
          <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper text-sm">
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-semibold">You might also need</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
