"use client";

import Link from "next/link";
import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductArt } from "@/components/ProductArt";
import { useCart } from "@/context/CartContext";
import { tenures, type TenureMonths } from "@/data/config";
import { useCatalog } from "@/context/CatalogContext";
import { inr, monthlyRent } from "@/lib/pricing";

export function CartView() {
  const { getProductById } = useCatalog();
  const { lines, setQty, setMonths, remove, rentPerMonth, deposit, city, ready } = useCart();

  if (!ready) return <div className="mx-auto max-w-5xl px-4 py-20 text-ink-soft sm:px-6">Loading your cart...</div>;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-sand text-moss"><ShoppingBag className="h-9 w-9" /></div>
        <h1 className="font-display mt-6 text-3xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-ink-soft">Add a few things and we will bring them to your door.</p>
        <Link href="/products" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">Browse products</Link>
      </div>
    );
  }

  const firstPayment = rentPerMonth + deposit;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Your cart</h1>
      <p className="mt-1 text-ink-soft">Delivering to {city}. Change the city from the menu at the top.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {lines.map((line) => {
              const p = getProductById(line.productId);
              if (!p) return null;
              return (
                <m.li
                  key={line.productId}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 60 }}
                  className="flex gap-4 rounded-3xl border border-line bg-paper p-4"
                >
                  <Link href={`/products/${p.slug}`} className="grid h-28 w-28 shrink-0 place-items-center rounded-2xl bg-sand sm:h-32 sm:w-32">
                    <ProductArt kind={p.art} tint={p.tint} className="h-24 w-24 sm:h-28 sm:w-28" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${p.slug}`} className="font-semibold hover:text-moss">{p.name}</Link>
                        <p className="text-sm text-ink-soft">Deposit {inr(p.deposit)} each</p>
                      </div>
                      <button onClick={() => remove(p.id)} className="text-ink-soft hover:text-coral-deep" aria-label={`Remove ${p.name}`}><Trash2 className="h-5 w-5" /></button>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={line.months}
                          onChange={(e) => setMonths(p.id, Number(e.target.value) as TenureMonths)}
                          className="rounded-full border border-line bg-cream px-3 py-2 text-sm font-medium"
                          aria-label={`Rental plan for ${p.name}`}
                        >
                          {tenures.map((t) => (<option key={t.months} value={t.months}>{t.label}</option>))}
                        </select>
                        <div className="flex items-center rounded-full border border-line">
                          <button onClick={() => setQty(p.id, line.qty - 1)} className="grid h-9 w-9 place-items-center" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                          <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                          <button onClick={() => setQty(p.id, line.qty + 1)} className="grid h-9 w-9 place-items-center" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-forest">
                        {inr(monthlyRent(p, line.months) * line.qty)}<span className="text-xs font-medium text-ink-soft"> /month</span>
                      </p>
                    </div>
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <aside className="h-fit rounded-3xl border border-line bg-paper p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-semibold">Order summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Monthly rent</dt><dd className="font-bold">{inr(rentPerMonth)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Refundable deposit</dt><dd className="font-semibold">{inr(deposit)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery and installation</dt><dd className="font-semibold text-moss">Free</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base">
              <dt className="font-semibold">Due at delivery</dt><dd className="font-bold text-forest">{inr(firstPayment)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">First month rent plus deposit. After that, {inr(rentPerMonth)} each month.</p>
          <Link href="/checkout" className="group mt-5 flex items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep">
            Continue to checkout <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link href="/products" className="mt-3 block text-center text-sm font-semibold text-moss hover:underline">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
