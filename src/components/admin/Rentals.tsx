"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Mail, MapPin, Phone, Repeat, Search, Undo2 } from "lucide-react";
import type { Ctx } from "@/components/admin/AdminDashboard";
import { StatusPill } from "@/components/OrderTracker";
import { ProductArt } from "@/components/ProductArt";
import type { AdminRental } from "@/lib/adminTypes";
import { formatDate, inr } from "@/lib/pricing";
import type { Phase } from "@/lib/rentals";

export const RENTAL_FILTERS = ["Active rentals", "Awaiting delivery", "Plan ended", "Return scheduled", "Returned", "Cancelled", "All"] as const;
type Filter = (typeof RENTAL_FILTERS)[number];

/** "Active rentals" means items that are with a customer right now, the same count the Overview card shows. */
const withCustomer: Phase[] = ["Active", "Plan ended", "Return scheduled"];
const inFilter = (f: Filter, r: AdminRental) => f === "All" || (f === "Active rentals" ? withCustomer.includes(r.phase) : r.phase === f);

const phaseStyle: Record<Phase, string> = {
  "Awaiting delivery": "bg-sun/25 text-[#7a5200]",
  Active: "bg-mint text-forest",
  "Plan ended": "bg-coral/15 text-coral-deep",
  "Return scheduled": "bg-[#dbe7f3] text-[#27506f]",
  Returned: "bg-sand text-ink-soft",
  Cancelled: "bg-sand text-ink-soft",
};

type Sort = "ending" | "rentHigh" | "newest";
const sorts: Record<Sort, string> = { ending: "Plan ending soonest", rentHigh: "Highest rent", newest: "Newest delivery date" };

export function Rentals({ data, go, preset }: Ctx) {
  const [filter, setFilter] = useState<Filter>((RENTAL_FILTERS as readonly string[]).includes(preset ?? "") ? (preset as Filter) : "Active rentals");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("ending");
  const art = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const counts = useMemo(() => Object.fromEntries(RENTAL_FILTERS.map((f) => [f, data.rentals.filter((r) => inFilter(f, r)).length])), [data.rentals]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = data.rentals.filter(
      (r) => inFilter(filter, r) && (!term || [r.name, r.orderId, r.customer?.name ?? "", r.customer?.phone ?? "", r.customer?.email ?? "", r.city].some((v) => v.toLowerCase().includes(term))),
    );
    const by: Record<Sort, (a: AdminRental, b: AdminRental) => number> = {
      ending: (a, b) => a.endDate.localeCompare(b.endDate),
      rentHigh: (a, b) => b.rentPerMonth * b.qty - a.rentPerMonth * a.qty,
      newest: (a, b) => b.startDate.localeCompare(a.startDate),
    };
    return [...list].sort(by[sort]);
  }, [data.rentals, filter, q, sort]);

  const rent = rows.reduce((s, r) => s + r.rentPerMonth * r.qty, 0);
  const deposit = rows.reduce((s, r) => s + r.deposit * r.qty, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search rentals</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, customer, phone, order ID" className="w-full rounded-full border border-line bg-paper py-2.5 pl-10 pr-4 text-sm outline-none focus:border-moss" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort rentals" className="rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-semibold">
          {(Object.keys(sorts) as Sort[]).map((k) => <option key={k} value={k}>Sort: {sorts[k]}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter rentals">
        {RENTAL_FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === f ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>
            {f} <span className={filter === f ? "text-white/80" : "text-moss"}>{counts[f]}</span>
          </button>
        ))}
      </div>
      {filter === "Active rentals" && <p className="text-xs text-ink-soft">Items with customers right now: active, plan ended and waiting for pickup, plus pickups already booked.</p>}

      <p className="text-sm text-ink-soft"><span className="font-semibold text-ink">{rows.length}</span> {rows.length === 1 ? "rental" : "rentals"} &middot; {inr(rent)} monthly rent &middot; {inr(deposit)} deposit held</p>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-line bg-paper px-5 py-10 text-center text-sm text-ink-soft">No rentals match this filter.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const p = art.get(r.productId);
            const live = withCustomer.includes(r.phase);
            return (
              <li key={r.id} className="overflow-hidden rounded-3xl border border-line bg-paper">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
                  <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-sand">{p ? <ProductArt kind={p.art} tint={p.tint} className="h-20 w-20" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{r.qty > 1 ? `${r.qty} x ` : ""}{r.name}</p>
                        <p className="text-xs text-ink-soft">Order {r.orderId} <StatusPill status={r.orderStatus} /></p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${phaseStyle[r.phase]}`}>{r.phase}</span>
                    </div>
                    <p className="mt-1.5 text-sm"><span className="font-semibold">{inr(r.rentPerMonth)}</span> / month for {r.months} months{r.qty > 1 ? ` each, ${inr(r.rentPerMonth * r.qty)} total` : ""}. Deposit {inr(r.deposit * r.qty)}.</p>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" role="img" aria-label={`Plan ${Math.round(r.progress * 100)} percent used`}>
                      <div className="h-full rounded-full bg-moss" style={{ width: `${Math.round(r.progress * 100)}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
                      <span>{r.phase === "Awaiting delivery" ? `Delivery ${formatDate(r.startDate)}, ${r.slot}` : `Started ${formatDate(r.startDate)}`}</span>
                      <span>{r.phase === "Plan ended" ? `Ended ${formatDate(r.endDate)}` : `Ends ${formatDate(r.endDate)}${live && r.phase !== "Return scheduled" ? ` (${r.daysLeft} days left)` : ""}`}</span>
                    </div>

                    {(r.extensions.length > 0 || r.returnRequest) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {r.extensions.length > 0 && <span className="flex items-center gap-1 rounded-full bg-sand px-3 py-1 font-semibold"><Repeat className="h-3 w-3" /> Extended {r.extensions.reduce((s, e) => s + e.addedMonths, 0)} months</span>}
                        {r.returnRequest && <span className="flex items-center gap-1 rounded-full bg-[#dbe7f3] px-3 py-1 font-semibold text-[#27506f]"><Undo2 className="h-3 w-3" /> Pickup {formatDate(r.returnRequest.date)}, {r.returnRequest.slot}{r.returnRequest.earlyClosureFee > 0 ? `, early closure fee ${inr(r.returnRequest.earlyClosureFee)}` : ""}</span>}
                      </div>
                    )}

                    <div className="mt-3 grid gap-1 rounded-2xl bg-cream px-3.5 py-2.5 text-xs text-ink-soft sm:grid-cols-2">
                      <p className="font-semibold text-ink">{r.customer?.name ?? "Customer"}</p>
                      {r.customer?.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {r.customer.phone}</p>}
                      {r.customer?.email && <p className="flex items-center gap-1.5 break-all"><Mail className="h-3 w-3 shrink-0" /> {r.customer.email}</p>}
                      {r.address && <p className="flex items-start gap-1.5 sm:col-span-2"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {r.address}</p>}
                      {r.deliveredAt && <p className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> Delivered {formatDate(r.deliveredAt.slice(0, 10))}</p>}
                      {r.returnedAt && <p className="flex items-center gap-1.5"><Undo2 className="h-3 w-3" /> Returned {formatDate(r.returnedAt.slice(0, 10))}</p>}
                    </div>
                  </div>
                </div>
                {(r.phase === "Awaiting delivery" || live) && (
                  <div className="flex flex-wrap gap-2 border-t border-line bg-cream/60 px-4 py-3 sm:px-5">
                    {r.phase === "Awaiting delivery" ? (
                      <button onClick={() => go("orders")} className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral">Manage this order</button>
                    ) : (
                      <button onClick={() => go("schedule")} className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">{r.phase === "Return scheduled" ? "Process pickup" : "Process return"} in Schedule</button>
                    )}
                    <button onClick={() => go("repairs")} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-moss hover:text-forest">Repairs</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
