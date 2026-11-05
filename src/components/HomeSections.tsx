"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, BadgeCheck, CalendarClock, Check, ChevronDown, Truck, Wrench, Undo2, Wallet } from "lucide-react";
import { ProductArt } from "@/components/ProductArt";
import { ProductCard } from "@/components/ProductCard";
import { Counter, Reveal } from "@/components/motion";
import { categories } from "@/data/products";
import { useCatalog } from "@/context/CatalogContext";
import { tenures } from "@/data/config";
import { inr } from "@/lib/pricing";
import { useCart } from "@/context/CartContext";

const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

export function Hero() {
  const { city } = useCart();
  const { areas: cities } = useCatalog();
  return (
    <section className="relative overflow-hidden bg-forest text-white">
      <div className="grain absolute inset-0 opacity-20" aria-hidden />
      <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-moss/60 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 left-1/3 h-[24rem] w-[24rem] rounded-full bg-coral/20 blur-3xl" aria-hidden />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-20">
        <div>
          <p className="rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide" style={delay(0)}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-sun" aria-hidden /> Now delivering in {city}
          </p>

          <h1 className="font-display mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {["Make a home,", "not a", "purchase."].map((w, i) => (
              <span key={i} className="block overflow-hidden pb-1">
                <span className={`line-up block ${i === 2 ? "text-sun" : ""}`} style={delay(0.05 + i * 0.08)}>{w}</span>
              </span>
            ))}
          </h1>

          <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-white/80" style={delay(0.2)}>
            Rent beds, sofas, fridges, washing machines and more by the month. Free delivery, free installation, free repairs and
            a deposit that comes back to you.
          </p>

          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={delay(0.3)}>
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3.5 font-semibold text-white transition hover:bg-coral-deep"
            >
              Start renting
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href="/#how-it-works" className="rounded-full border border-white/30 px-6 py-3.5 font-semibold transition hover:bg-white/10">
              See how it works
            </Link>
          </div>

          <ul className="rise mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75" style={delay(0.4)}>
            {["Free delivery", "Free repairs", "Refundable deposit", "Cancel after your plan"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-sun" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto h-[22rem] w-full max-w-xl sm:h-[28rem]" aria-hidden>
          <div className="absolute inset-x-6 bottom-4 top-6 rounded-[2.5rem] bg-cream/95 shadow-2xl" />
          <div className="pop absolute left-0 top-10 w-[58%]" style={delay(0.15)}>
            <div className="float-slow"><ProductArt kind="sofa" tint="#2f6f62" /></div>
          </div>
          <div className="pop absolute right-2 top-0 w-[38%]" style={delay(0.25)}>
            <div className="float-mid"><ProductArt kind="fridge" tint="#9fb7c4" /></div>
          </div>
          <div className="pop absolute bottom-6 right-4 w-[46%]" style={delay(0.35)}>
            <div className="float-fast"><ProductArt kind="bed" tint="#b9855a" /></div>
          </div>
          <div className="pop absolute bottom-10 left-3 w-[34%]" style={delay(0.45)}>
            <div className="float-mid"><ProductArt kind="washer" tint="#d6dde2" /></div>
          </div>
          <div className="rise absolute -left-2 top-[46%] rounded-2xl bg-white px-4 py-3 text-ink shadow-xl" style={delay(0.6)}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-moss">Sofa from</p>
            <p className="text-xl font-bold leading-tight">{inr(719)}<span className="text-xs font-medium text-ink-soft">/mo</span></p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border-t border-white/10 bg-forest-deep py-3 text-sm text-white/70">
        <div className="marquee flex w-max gap-10 whitespace-nowrap pr-10">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex gap-10" aria-hidden={k === 1}>
              {["Free delivery and installation", "Free maintenance for the whole rental", "Fully refundable deposit", "3, 6 and 12 month plans", "Move house? We pick it up", ...cities.map((c) => `Delivering in ${c}`)].map((t) => (
                <span key={t + k} className="flex items-center gap-10">
                  {t} <span className="text-sun">&#9679;</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RoomStudioBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
      <Reveal>
        <div className="relative grid items-center gap-8 overflow-hidden rounded-[2.5rem] bg-forest p-8 text-white sm:p-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="grain absolute inset-0 opacity-20" aria-hidden />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-wide text-sun">New: Room Studio</p>
            <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Try furniture in your own hall, in 3D</h2>
            <p className="mt-3 max-w-lg text-white/80">Upload a photo of your empty room. Pieces stand on your floor at their real size, and we check what fits and what suits your colours.</p>
            <ul className="mt-5 space-y-1.5 text-sm text-white/85">
              {["Real-size 3D furniture in the right perspective", "Fit and colour check for every piece", "One click to furnish the room, or add it all to your cart"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 text-sun" /> {t}</li>
              ))}
            </ul>
            <Link href="/room-studio" className="group mt-7 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3.5 font-semibold text-white transition hover:bg-coral-deep">
              Open Room Studio <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="relative mx-auto h-56 w-full max-w-md sm:h-64" aria-hidden>
            <div className="absolute inset-x-4 bottom-0 top-4 rounded-[2rem] bg-cream/95" />
            <div className="float-slow absolute bottom-6 left-3 w-[62%]"><ProductArt kind="sofa" tint="#2f6f62" /></div>
            <div className="float-mid absolute right-3 top-2 w-[34%]"><ProductArt kind="shelf" tint="#b08a62" /></div>
            <div className="float-fast absolute bottom-4 right-4 w-[30%]"><ProductArt kind="desk" tint="#7a5a3c" /></div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function CategoryTiles() {
  const tiles = [
    { href: "/products?category=furniture", title: "Furniture", sub: "Beds, sofas, tables, wardrobes", art: "sofa" as const, tint: "#2f6f62", bg: "bg-mint" },
    { href: "/products?category=appliances", title: "Appliances", sub: "Fridges, washers, TVs, ACs", art: "washer" as const, tint: "#9fb7c4", bg: "bg-sand" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
      <Reveal>
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Shop by category</h2>
        <p className="mt-2 text-ink-soft">Everything you need for a flat, a hostel room or a studio.</p>
      </Reveal>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {tiles.map((t, i) => (
          <Reveal key={t.title} delay={i * 0.1}>
            <Link
              href={t.href}
              className={`group relative flex h-64 items-center overflow-hidden rounded-[2rem] ${t.bg} p-8 transition hover:shadow-[0_24px_50px_-24px_rgba(13,59,51,0.45)]`}
            >
              <div className="relative z-10 max-w-[55%]">
                <h3 className="font-display text-3xl font-semibold">{t.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{t.sub}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest">
                  Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
                </span>
              </div>
              <ProductArt
                kind={t.art}
                tint={t.tint}
                className="absolute -right-6 bottom-0 h-[110%] w-[62%] transition-transform duration-500 group-hover:-translate-y-2 group-hover:scale-105"
              />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const steps = [
  { icon: Truck, title: "Pick and schedule", text: "Choose what you need, pick a plan of 3, 6 or 12 months and a delivery day that suits you." },
  { icon: Wrench, title: "We deliver and set up", text: "Our team delivers, assembles and installs everything. No tools, no waiting around." },
  { icon: BadgeCheck, title: "Live with it", text: "Something not working? Raise a request and we repair or replace it at no charge." },
  { icon: Undo2, title: "Extend, return or move", text: "Keep it going, or schedule a pickup. Your deposit comes back after the return check." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-24 sm:px-6">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-wide text-coral-deep">How it works</p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          From cart to cosy in four simple steps
        </h2>
      </Reveal>
      <div className="relative mt-10 grid gap-5 md:grid-cols-4">
        <div className="absolute left-0 right-0 top-9 hidden h-px bg-line md:block" aria-hidden />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.09}>
            <div className="relative h-full rounded-3xl border border-line bg-paper p-6">
              <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-forest text-white">
                <s.icon className="h-5 w-5" />
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-coral text-xs font-bold">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Featured() {
  const { products } = useCatalog();
  const [cat, setCat] = useState<(typeof categories)[number]["id"]>("all");
  const list = products.filter((p) => p.popular && (cat === "all" || p.category === cat)).slice(0, 6);
  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wide text-coral-deep">Most rented</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Popular right now</h2>
        </Reveal>
        <div className="flex gap-2" role="tablist" aria-label="Filter popular products">
          {categories.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cat === c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${cat === c.id ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-8 text-center">
        <Link href="/products" className="inline-flex items-center gap-2 rounded-full border border-forest px-6 py-3 font-semibold text-forest transition hover:bg-forest hover:text-white">
          See all {products.length} products <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export function RentVsBuy() {
  const [price, setPrice] = useState(25000);
  const [months, setMonths] = useState<number>(12);
  const rent = Math.round(price * 0.034 * (months >= 12 ? 0.8 : months >= 6 ? 0.9 : 1));
  const totalRent = rent * months;
  const resale = Math.round(price * (months >= 12 ? 0.55 : months >= 6 ? 0.65 : 0.75));
  const buyCost = price - resale;
  const better = totalRent < buyCost;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <div className="grid gap-8 overflow-hidden rounded-[2.5rem] bg-sand p-6 sm:p-10 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wide text-coral-deep">Rent or buy?</p>
          <h2 className="font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">See what you really spend</h2>
          <p className="mt-3 max-w-md text-ink-soft">
            Moving in a year? A purchase loses value the moment it leaves the shop. Slide to compare. This is an estimate to help
            you think, not a quote.
          </p>

          <label className="mt-8 block text-sm font-semibold" htmlFor="price">
            Price if you bought it new: <span className="text-forest">{inr(price)}</span>
          </label>
          <input
            id="price"
            type="range"
            min={5000}
            max={80000}
            step={1000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="mt-3 w-full accent-[#c24424]"
          />

          <div className="mt-6 flex gap-2" role="radiogroup" aria-label="How long will you need it">
            {tenures.map((t) => (
              <button
                key={t.months}
                role="radio"
                aria-checked={months === t.months}
                onClick={() => setMonths(t.months)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${months === t.months ? "bg-forest text-white" : "bg-paper text-ink-soft hover:bg-mint"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grid h-full gap-4 sm:grid-cols-2">
            <div className={`rounded-3xl p-6 transition ${better ? "bg-forest text-white" : "bg-paper"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${better ? "text-sun" : "text-moss"}`}>Rent with RentEase</p>
              <m.p key={totalRent} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display mt-3 text-4xl font-semibold">
                {inr(totalRent)}
              </m.p>
              <p className={`mt-1 text-sm ${better ? "text-white/75" : "text-ink-soft"}`}>{inr(rent)} a month for {months} months</p>
              <p className={`mt-4 text-xs ${better ? "text-white/60" : "text-ink-soft"}`}>Delivery, installation and repairs included.</p>
            </div>
            <div className={`rounded-3xl p-6 transition ${!better ? "bg-forest text-white" : "bg-paper"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${!better ? "text-sun" : "text-moss"}`}>Buy and resell later</p>
              <m.p key={buyCost} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display mt-3 text-4xl font-semibold">
                {inr(buyCost)}
              </m.p>
              <p className={`mt-1 text-sm ${!better ? "text-white/75" : "text-ink-soft"}`}>{inr(price)} now, about {inr(resale)} back on resale</p>
              <p className={`mt-4 text-xs ${!better ? "text-white/60" : "text-ink-soft"}`}>Plus repairs, transport and your time.</p>
            </div>
            <p className="rounded-2xl bg-mint px-5 py-4 text-sm font-medium text-forest sm:col-span-2">
              {better
                ? `For ${months} months, renting costs about ${inr(buyCost - totalRent)} less and nothing to haul around.`
                : `For this price and tenure buying works out cheaper by about ${inr(totalRent - buyCost)}, but you take on the repairs and the move.`}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Benefits() {
  const { products, areas: cities } = useCatalog();
  const items = [
    { icon: Truck, title: "Free delivery and setup", text: "Assembled and installed at your door at no cost." },
    { icon: Wrench, title: "Free maintenance", text: "Raise a request in your account and we fix or replace the item." },
    { icon: Wallet, title: "Refundable deposit", text: "Return the item in good condition and your deposit comes back." },
    { icon: CalendarClock, title: "Flexible plans", text: "3, 6 or 12 months. Longer plans cost less each month." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <Reveal>
        <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Why people rent with us</h2>
      </Reveal>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((b, i) => (
          <Reveal key={b.title} delay={i * 0.08}>
            <div className="h-full rounded-3xl border border-line bg-paper p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-forest">
                <b.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{b.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 rounded-3xl bg-forest p-8 text-center text-white sm:grid-cols-4">
        {[
          { n: products.length, s: "", l: "Products to rent" },
          { n: cities.length, s: "", l: "Cities served" },
          { n: tenures.length, s: "", l: "Flexible plans" },
          { n: 20, s: "%", l: "Off on 12 month plans" },
        ].map((x) => (
          <div key={x.l}>
            <Counter to={x.n} suffix={x.s} className="font-display text-4xl font-semibold text-sun" />
            <p className="mt-1 text-sm text-white/75">{x.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const faqs = [
  { q: "What is the security deposit?", a: "A refundable amount you pay with your first month. After your item is returned and checked, the deposit comes back to you. Small damage fees, if any, are shown before they are deducted." },
  { q: "Is delivery and installation really free?", a: "Yes. We deliver, assemble and install at no extra charge in every city we serve." },
  { q: "What if something stops working?", a: "Open My rentals, pick the item and raise a maintenance request. We repair or replace it at no charge as long as it is normal wear and tear." },
  { q: "Can I end my rental early?", a: "Yes. Schedule a pickup from your account. Closing before your plan ends adds a one month rent fee." },
  { q: "Can I extend my plan?", a: "Yes. From My rentals, choose Extend and pick a new tenure. A longer plan lowers your monthly rent." },
  { q: "Do you take real payments on this site?", a: "No. RentEase is a demo project for a full stack internship. Checkout is a simulation and nothing is charged." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto max-w-3xl px-4 pt-24 sm:px-6">
      <Reveal>
        <h2 className="font-display text-center text-3xl font-semibold tracking-tight sm:text-4xl">Questions, answered</h2>
      </Reveal>
      <div className="mt-8 space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={f.q} delay={i * 0.04}>
              <div className="rounded-2xl border border-line bg-paper">
                <button
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  {f.q}
                  <m.span animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDown className="h-5 w-5 text-moss" />
                  </m.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">{f.a}</p>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-coral px-6 py-14 text-center text-white sm:px-12">
          <div className="grain absolute inset-0 opacity-30" aria-hidden />
          <h2 className="font-display relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Furnish your place this weekend
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/90">Pick your items, choose a delivery day, and we handle the rest.</p>
          <Link
            href="/products"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-forest px-7 py-3.5 font-semibold text-white transition hover:bg-forest-deep"
          >
            Browse all products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
