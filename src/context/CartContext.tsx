"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { City, TenureMonths } from "@/data/config";
import { useCatalog } from "@/context/CatalogContext";
import { lineTotals, type CartLine } from "@/lib/pricing";

const CART_KEY = "rentease.cart.v1";
const CITY_KEY = "rentease.city.v1";

type CartContextValue = {
  lines: CartLine[];
  count: number;
  rentPerMonth: number;
  deposit: number;
  city: City;
  setCity: (c: City) => void;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (productId: string, months: TenureMonths, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  setMonths: (productId: string, months: TenureMonths) => void;
  remove: (productId: string) => void;
  clear: () => void;
  ready: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked; the cart still works for this visit */
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { getProductById, areas } = useCatalog();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [city, setCityState] = useState<City>("Noida");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = read<CartLine[]>(CART_KEY, []).filter((l) => getProductById(l.productId));
    const savedCity = read<string>(CITY_KEY, "Noida");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage once on mount
    setLines(saved);
    if (areas.includes(savedCity)) setCityState(savedCity);
    else if (areas.length) setCityState(areas[0]);
    setReady(true);
  }, [getProductById, areas]);

  useEffect(() => {
    if (ready) write(CART_KEY, lines);
  }, [lines, ready]);

  const setCity = useCallback((c: City) => {
    setCityState(c);
    write(CITY_KEY, c);
  }, []);

  const add = useCallback((productId: string, months: TenureMonths, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, months, qty: Math.min(l.qty + qty, 10) } : l,
        );
      }
      return [...prev, { productId, months, qty: Math.min(qty, 10) }];
    });
    setDrawerOpen(true);
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, 10) } : l)),
    );
  }, []);

  const setMonths = useCallback((productId: string, months: TenureMonths) => {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, months } : l)));
  }, []);

  const remove = useCallback((productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    let rentPerMonth = 0;
    let deposit = 0;
    let count = 0;
    for (const line of lines) {
      const product = getProductById(line.productId);
      if (!product) continue;
      const t = lineTotals(product, line);
      rentPerMonth += t.rent;
      deposit += t.deposit;
      count += line.qty;
    }
    return {
      lines,
      count,
      rentPerMonth,
      deposit,
      city,
      setCity,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add,
      setQty,
      setMonths,
      remove,
      clear,
      ready,
    };
  }, [lines, city, setCity, drawerOpen, add, setQty, setMonths, remove, clear, ready, getProductById]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
