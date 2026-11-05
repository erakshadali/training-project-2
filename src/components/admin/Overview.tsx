"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Ctx, TabId } from "@/components/admin/AdminDashboard";
import { inr } from "@/lib/pricing";

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function Overview({ data, go }: Ctx) {
  const k = data.stats.kpis;
  const hours = k.avgResolutionHours;
  const cards = [
    { label: "Active rentals", value: String(k.activeRentals), sub: `${k.awaitingDelivery} waiting for delivery` },
    { label: "Monthly recurring revenue", value: inr(k.mrr), sub: `${inr(k.depositHeld)} deposits held` },
    { label: "Product utilization", value: pct(k.utilization), sub: "units out vs. all units owned" },
    { label: "Repeat customers", value: pct(k.repeatRate), sub: `${k.buyers} ${k.buyers === 1 ? "customer has" : "customers have"} ordered` },
    { label: "Repair resolution time", value: hours === null ? "No data" : hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : `${hours.toFixed(1)} hrs`, sub: `${k.resolvedRepairs} resolved, ${k.openRepairs} open` },
    { label: "Orders", value: String(k.totalOrders), sub: `${k.customers} registered customers` },
  ];

  const items: { text: string; n: number; tab: TabId }[] = [
    { text: "deliveries to make", n: k.deliveriesDue, tab: "schedule" },
    { text: "pickups booked", n: k.pickupsDue, tab: "schedule" },
    { text: "open repair requests", n: k.openRepairs, tab: "repairs" },
    { text: "damage charges under dispute", n: k.openDisputes, tab: "claims" },
    { text: "products low on stock", n: k.lowStock, tab: "inventory" },
  ];
  const attention = items.filter((a) => a.n > 0);

  const maxDay = Math.max(1, ...data.stats.ordersPerDay.map((d) => d.orders));
  const rows = data.stats.byProduct.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-3xl border border-line bg-paper p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-moss">{c.label}</p>
            <p className="font-display mt-2 text-3xl font-semibold text-forest">{c.value}</p>
            <p className="mt-1 text-xs text-ink-soft">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display flex items-center gap-2 text-xl font-semibold"><AlertTriangle className="h-5 w-5 text-coral" /> Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nothing is waiting on you right now.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {attention.map((a) => (
              <li key={a.text}>
                <button onClick={() => go(a.tab)} className="group flex w-full items-center justify-between rounded-2xl bg-sand px-4 py-3 text-left text-sm transition hover:bg-mint">
                  <span><span className="font-bold text-forest">{a.n}</span> {a.text}</span>
                  <ArrowRight className="h-4 w-4 text-moss transition-transform group-hover:translate-x-1" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-display text-xl font-semibold">Orders, last 7 days</h2>
          <div className="mt-5 flex h-40 items-end gap-2" role="img" aria-label={`Orders per day: ${data.stats.ordersPerDay.map((d) => d.orders).join(", ")}`}>
            {data.stats.ordersPerDay.map((d, i) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold text-forest">{d.orders}</span>
                <motion.div initial={{ height: 0 }} animate={{ height: `${(d.orders / maxDay) * 100}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.6 }} className="min-h-1 w-full rounded-t-xl bg-moss" />
                <span className="text-[10px] text-ink-soft">{new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-display text-xl font-semibold">Top products by rent</h2>
          {rows.every((r) => r.mrr === 0) ? (
            <p className="mt-3 text-sm text-ink-soft">No delivered rentals yet. Revenue appears once items are marked delivered.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.filter((r) => r.mrr > 0).map((r) => (
                <li key={r.pid}>
                  <div className="flex justify-between text-sm"><span className="truncate font-medium">{r.name}</span><span className="font-bold text-forest">{inr(r.mrr)}/mo</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(4, (r.mrr / Math.max(1, rows[0].mrr)) * 100)}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full bg-coral" />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">{r.unitsOut} out, {r.reserved} reserved, {r.onShelf} on the shelf ({pct(r.utilization)} utilized)</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
