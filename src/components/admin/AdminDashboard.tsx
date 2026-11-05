"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { BarChart3, CalendarClock, CheckCircle2, ClipboardList, KeyRound, MapPin, Package, ShieldAlert, Users, Wrench } from "lucide-react";
import { Orders } from "@/components/admin/Orders";
import { Overview } from "@/components/admin/Overview";
import { Rentals } from "@/components/admin/Rentals";
import { Schedule } from "@/components/admin/Schedule";
import { Areas, Claims, Customers, Inventory, Repairs } from "@/components/admin/Tables";
import { adminApi, type AdminData } from "@/lib/adminTypes";

export type TabId = "overview" | "orders" | "rentals" | "schedule" | "inventory" | "repairs" | "claims" | "customers" | "areas";

export type Ctx = { data: AdminData; reload: () => Promise<void>; notify: (m: string) => void; go: (t: TabId, filter?: string) => void; preset?: string };

const tabs: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "rentals", label: "Rentals", icon: KeyRound },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "repairs", label: "Repairs", icon: Wrench },
  { id: "claims", label: "Claims", icon: ShieldAlert },
  { id: "customers", label: "Customers", icon: Users },
  { id: "areas", label: "Areas", icon: MapPin },
];

export function AdminDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preset, setPreset] = useState<string | undefined>();

  const reload = useCallback(async () => {
    try {
      const [s, r, p, m, c, u, a, o] = await Promise.all(
        ["stats", "rentals", "products", "maintenance", "claims", "users", "areas", "orders"].map((x) => adminApi(`/api/admin/${x}`)),
      );
      if (![s, r, p, m, c, u, a, o].every((x) => x.ok)) throw new Error("load");
      setData({
        stats: s.data as never,
        rentals: (r.data as never as { rentals: AdminData["rentals"] }).rentals,
        orders: (o.data as never as { orders: AdminData["orders"] }).orders,
        products: (p.data as never as { products: AdminData["products"] }).products,
        requests: (m.data as never as { requests: AdminData["requests"] }).requests,
        claims: (c.data as never as { claims: AdminData["claims"] }).claims,
        users: (u.data as never as { users: AdminData["users"] }).users,
        areas: (a.data as never as { areas: AdminData["areas"] }).areas,
      });
      setError("");
    } catch {
      setError("Could not load the dashboard data. Check that you are logged in as an admin and refresh.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load admin data on mount
    void reload();
  }, [reload]);

  const notify = useCallback((m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice(""), 4500);
  }, []);

  const badge = (id: TabId) => {
    if (!data) return 0;
    const k = data.stats.kpis;
    if (id === "orders") return k.ordersToConfirm;
    if (id === "schedule") return k.deliveriesDue + k.pickupsDue;
    if (id === "repairs") return k.openRepairs;
    if (id === "claims") return k.openDisputes;
    if (id === "inventory") return k.lowStock;
    return 0;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-coral-deep">Admin</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Operations dashboard</h1>
        </div>
        <button onClick={() => void reload()} className="rounded-full border border-forest px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Refresh</button>
      </div>

      <AnimatePresence>
        {notice && (
          <m.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="mt-5 flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-forest">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </m.p>
        )}
      </AnimatePresence>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{error}</p>}

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Admin sections">
        {tabs.map((t) => {
          const n = badge(t.id);
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setPreset(undefined); setTab(t.id); }} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
              {n > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${tab === t.id ? "bg-white text-forest" : "bg-coral text-white"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {!data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (<div key={i} className="h-28 animate-pulse rounded-3xl bg-sand" />))}
          </div>
        ) : (
          <m.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {(() => {
              const ctx: Ctx = { data, reload, notify, preset, go: (t, f) => { setPreset(f); setTab(t); } };
              switch (tab) {
                case "overview": return <Overview {...ctx} />;
                case "orders": return <Orders {...ctx} />;
                case "rentals": return <Rentals {...ctx} />;
                case "schedule": return <Schedule {...ctx} />;
                case "inventory": return <Inventory {...ctx} />;
                case "repairs": return <Repairs {...ctx} />;
                case "claims": return <Claims {...ctx} />;
                case "customers": return <Customers {...ctx} />;
                case "areas": return <Areas {...ctx} />;
              }
            })()}
          </m.div>
        )}
      </div>
    </div>
  );
}
