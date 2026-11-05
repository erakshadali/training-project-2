import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductsView } from "@/components/ProductsView";

export const metadata: Metadata = { title: "Shop furniture and appliances on rent" };

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-20 text-ink-soft sm:px-6">Loading products...</div>}>
      <ProductsView />
    </Suspense>
  );
}
