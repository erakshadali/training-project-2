"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { categories, products, type Category } from "@/data/products";
import { inr, monthlyRent } from "@/lib/pricing";

type Sort = "popular" | "low" | "high" | "name";

export function ProductsView() {
  const router = useRouter();
  const params = useSearchParams();
  const category = (params.get("category") as Category | null) ?? "all";
  const [query, setQuery] = useState("");
  const [sub, setSub] = useState<string>("all");
  const [maxRent, setMaxRent] = useState(1300);
  const [sort, setSort] = useState<Sort>("popular");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const inCategory = useMemo(() => products.filter((p) => category === "all" || p.category === category), [category]);
  const subcategories = useMemo(() => ["all", ...Array.from(new Set(inCategory.map((p) => p.subcategory)))], [inCategory]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = inCategory.filter(
      (p) =>
        (sub === "all" || p.subcategory === sub) &&
        monthlyRent(p, 12) <= maxRent &&
        (!q || p.name.toLowerCase().includes(q) || p.subcategory.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q)),
    );
    const sorted = [...filtered];
    if (sort === "low") sorted.sort((a, b) => a.rent - b.rent);
    else if (sort === "high") sorted.sort((a, b) => b.rent - a.rent);
    else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => Number(!!b.popular) - Number(!!a.popular));
    return sorted;
  }, [inCategory, query, sub, maxRent, sort]);

  function setCategory(id: string) {
    setSub("all");
    router.replace(id === "all" ? "/products" : `/products?category=${id}`, { scroll: false });
  }

  const filters = (
    <div className="space-y-7">
      <div>
        <h3 className="text-sm font-semibold">Category</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${category === c.id ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Type</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {subcategories.map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              aria-pressed={sub === s}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${sub === s ? "border-coral bg-coral/10 font-semibold text-coral-deep" : "border-line text-ink-soft hover:border-moss"}`}
            >
              {s === "all" ? "Everything" : s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="max" className="flex justify-between text-sm font-semibold">
          Max monthly rent <span className="text-forest">{inr(maxRent)}</span>
        </label>
        <input id="max" type="range" min={200} max={1300} step={50} value={maxRent} onChange={(e) => setMaxRent(Number(e.target.value))} className="mt-3 w-full accent-[#e5603a]" />
        <p className="mt-1 text-xs text-ink-soft">Based on the 12 month plan.</p>
      </div>
      <button
        onClick={() => {
          setQuery("");
          setSub("all");
          setMaxRent(1300);
          setSort("popular");
          setCategory("all");
        }}
        className="text-sm font-semibold text-coral-deep underline-offset-4 hover:underline"
      >
        Reset filters
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {category === "furniture" ? "Furniture on rent" : category === "appliances" ? "Appliances on rent" : "Everything on rent"}
        </h1>
        <p className="mt-2 text-ink-soft">Monthly plans from 3 to 12 months. Delivery, setup and repairs are always free.</p>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <span className="sr-only">Search products</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sofa, fridge, desk..."
            className="w-full rounded-full border border-line bg-paper py-3 pl-11 pr-4 outline-none transition focus:border-moss"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-ink-soft">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-line bg-paper px-4 py-3 font-medium outline-none focus:border-moss">
            <option value="popular">Most popular</option>
            <option value="low">Rent: low to high</option>
            <option value="high">Rent: high to low</option>
            <option value="name">Name A to Z</option>
          </select>
        </label>
        <button onClick={() => setFiltersOpen(true)} className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-3 text-sm font-semibold lg:hidden">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-line bg-paper p-6">{filters}</div>
        </aside>

        <div>
          <p className="mb-4 text-sm text-ink-soft" aria-live="polite">
            {list.length} {list.length === 1 ? "product" : "products"}
          </p>
          {list.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-paper p-12 text-center">
              <p className="font-semibold">Nothing matches those filters</p>
              <p className="mt-1 text-sm text-ink-soft">Try a higher rent limit or a different search.</p>
            </div>
          ) : (
            <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {list.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-forest-deep/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFiltersOpen(false)} />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-cream p-6"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">Filters</h2>
                <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="grid h-9 w-9 place-items-center rounded-full hover:bg-sand">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {filters}
              <button onClick={() => setFiltersOpen(false)} className="mt-6 w-full rounded-full bg-forest py-3 font-semibold text-white">
                Show {list.length} {list.length === 1 ? "product" : "products"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
