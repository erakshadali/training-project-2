"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { MapPin, Menu, ShoppingBag, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/context/CatalogContext";
import type { City } from "@/data/config";

const links = [
  { href: "/products", label: "Shop all" },
  { href: "/products?category=furniture", label: "Furniture" },
  { href: "/products?category=appliances", label: "Appliances" },
  { href: "/#how-it-works", label: "How it works" },
];

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl ${light ? "bg-white text-forest" : "bg-forest text-white"}`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
          <path d="M2 14a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3H2z" />
          <path d="M5 17v2M19 17v2" />
        </svg>
      </span>
      <span className={`font-display text-xl font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Rent<span className={light ? "text-sun" : "text-coral-deep"}>Ease</span>
      </span>
    </span>
  );
}

export function Header() {
  const { count, openDrawer, city, setCity } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { areas: cities } = useCatalog();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="RentEase home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => {
            const active = l.href === pathname;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-sand ${active ? "text-forest" : "text-ink-soft"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <label className="relative hidden items-center sm:flex">
            <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-coral-deep" aria-hidden />
            <span className="sr-only">Delivery city</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value as City)}
              className="appearance-none rounded-full border border-line bg-paper py-2 pl-9 pr-8 text-sm font-medium text-ink outline-none transition hover:border-moss focus:border-moss"
            >
              {cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="hidden rounded-full bg-sun/30 px-3.5 py-2 text-sm font-semibold text-[#7a5200] transition hover:bg-sun/50 sm:block">
                  Admin
                </Link>
              )}
              <Link href="/account" className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand sm:block">
                {user.name.split(" ")[0]}&apos;s rentals
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  router.push("/");
                  router.refresh();
                }}
                className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand sm:block"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand sm:block">
                Log in
              </Link>
              <Link href="/register" className="hidden rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white sm:block">
                Sign up
              </Link>
            </>
          )}

          <button
            onClick={openDrawer}
            className="relative grid h-10 w-10 place-items-center rounded-full bg-forest text-white transition hover:bg-forest-deep"
            aria-label={`Open cart, ${count} items`}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            <AnimatePresence>
              {count > 0 && (
                <m.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-bold text-white"
                >
                  {count}
                </m.span>
              )}
            </AnimatePresence>
          </button>

          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-line lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-cream lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-sand">
                  {l.label}
                </Link>
              ))}
              {user ? (
                <>
                  {user.role === "admin" && (
                    <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-semibold text-[#7a5200] hover:bg-sand">
                      Admin dashboard
                    </Link>
                  )}
                  <Link href="/account" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-sand">
                    My rentals
                  </Link>
                  <button
                    onClick={async () => {
                      setOpen(false);
                      await logout();
                      router.push("/");
                      router.refresh();
                    }}
                    className="rounded-xl px-3 py-3 text-left font-medium hover:bg-sand"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-sand">Log in</Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-sand">Sign up</Link>
                </>
              )}
              <label className="mt-1 flex items-center gap-2 px-3 py-2 text-sm">
                <MapPin className="h-4 w-4 text-coral-deep" aria-hidden /> Delivering to
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value as City)}
                  className="ml-auto rounded-full border border-line bg-paper px-3 py-1.5"
                >
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
