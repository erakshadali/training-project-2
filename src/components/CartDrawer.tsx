"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { tenures, type TenureMonths } from "@/data/config";
import { useCatalog } from "@/context/CatalogContext";
import { ProductArt } from "@/components/ProductArt";
import { inr, monthlyRent } from "@/lib/pricing";

export function CartDrawer() {
  const { getProductById } = useCatalog();
  const { drawerOpen, closeDrawer, lines, setQty, setMonths, remove, rentPerMonth, deposit, count } = useCart();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen, closeDrawer]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <m.div
            key="scrim"
            className="fixed inset-0 z-50 bg-forest-deep/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
          />
          <m.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-xl font-semibold">Your cart {count > 0 && <span className="text-moss">({count})</span>}</h2>
              <button onClick={closeDrawer} className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand" aria-label="Close cart">
                <X className="h-5 w-5" />
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="grid flex-1 place-items-center px-8 text-center">
                <div>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sand text-moss">
                    <ShoppingBag className="h-7 w-7" />
                  </div>
                  <p className="mt-4 font-semibold">Your cart is empty</p>
                  <p className="mt-1 text-sm text-ink-soft">Pick something you need for a few months, not forever.</p>
                  <Link
                    href="/products"
                    onClick={closeDrawer}
                    className="mt-5 inline-block rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral"
                  >
                    Browse products
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  <AnimatePresence initial={false}>
                    {lines.map((line) => {
                      const p = getProductById(line.productId);
                      if (!p) return null;
                      return (
                        <m.li
                          key={line.productId}
                          layout
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 60, height: 0, marginBottom: 0 }}
                          className="flex gap-3 rounded-2xl border border-line bg-paper p-3"
                        >
                          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-sand">
                            <ProductArt kind={p.art} tint={p.tint} className="h-16 w-16" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-semibold">{p.name}</p>
                              <button onClick={() => remove(p.id)} className="text-ink-soft hover:text-coral-deep" aria-label={`Remove ${p.name}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <select
                              value={line.months}
                              onChange={(e) => setMonths(p.id, Number(e.target.value) as TenureMonths)}
                              className="mt-1 rounded-lg border border-line bg-cream px-2 py-1 text-xs font-medium"
                              aria-label="Rental tenure"
                            >
                              {tenures.map((t) => (
                                <option key={t.months} value={t.months}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-2 rounded-full border border-line px-1">
                                <button onClick={() => setQty(p.id, line.qty - 1)} className="grid h-7 w-7 place-items-center" aria-label="Decrease quantity">
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-4 text-center text-sm font-semibold">{line.qty}</span>
                                <button onClick={() => setQty(p.id, line.qty + 1)} className="grid h-7 w-7 place-items-center" aria-label="Increase quantity">
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <p className="text-sm font-bold text-forest">
                                {inr(monthlyRent(p, line.months) * line.qty)}
                                <span className="text-xs font-medium text-ink-soft">/mo</span>
                              </p>
                            </div>
                          </div>
                        </m.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>

                <div className="border-t border-line bg-paper px-5 py-4">
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-ink-soft">Monthly rent</dt>
                      <dd className="font-bold">{inr(rentPerMonth)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-soft">Refundable deposit</dt>
                      <dd className="font-semibold">{inr(deposit)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-soft">Delivery and installation</dt>
                      <dd className="font-semibold text-moss">Free</dd>
                    </div>
                  </dl>
                  <Link
                    href="/cart"
                    onClick={closeDrawer}
                    className="mt-4 block rounded-full bg-coral py-3 text-center font-semibold text-white transition hover:bg-coral-deep"
                  >
                    View cart and checkout
                  </Link>
                </div>
              </>
            )}
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}
