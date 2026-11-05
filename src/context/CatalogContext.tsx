"use client";

import { createContext, useContext, useMemo } from "react";
import type { Product } from "@/data/products";

type CatalogValue = {
  products: Product[];
  getProductById: (id: string) => Product | undefined;
};

const CatalogContext = createContext<CatalogValue | null>(null);

/** Gives client components the catalog that the server loaded from MongoDB. */
export function CatalogProvider({ products, children }: { products: Product[]; children: React.ReactNode }) {
  const value = useMemo<CatalogValue>(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return { products, getProductById: (id) => byId.get(id) };
  }, [products]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return ctx;
}
