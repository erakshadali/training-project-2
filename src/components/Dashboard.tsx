"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { CalendarClock, CheckCircle2, Loader2, PackageOpen, Repeat, Truck, Undo2, Wrench, XCircle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ProductArt } from "@/components/ProductArt";
import { useAuth } from "@/context/AuthContext";
import { useCatalog } from "@/context/CatalogContext";
import { maintenanceCategories, tenures } from "@/data/config";
import type { Product } from "@/data/products";
import type { Order } from "@/lib/orders";
import { refundFor, type Claim } from "@/lib/claims";
import { formatDate, inr, monthlyRent } from "@/lib/pricing";
import { addDaysISO, addMonthsISO, earlyClosureFee, returnSlots, tierFor, todayISO, type MaintenanceRequest, type Phase, type Rental } from "@/lib/rentals";

type Tab = "rentals" | "repairs" | "orders";
type Dialog = { kind: "repair" | "extend" | "return" | "cancel"; rental: Rental } | null;

const phaseStyle: Record<Phase, string> = {
  "Awaiting delivery": "bg-sun/25 text-[#7a5200]",
  Active: "bg-mint text-forest",
  "Plan ended": "bg-coral/15 text-coral-deep",
  "Return scheduled": "bg-[#dbe7f3] text-[#27506f]",
  Returned: "bg-sand text-ink-soft",
  Cancelled: "bg-sand text-ink-soft",
};

const requestStyle = {
  Open: "bg-coral/15 text-coral-deep",
  "In progress": "bg-sun/25 text-[#7a5200]",
  Resolved: "bg-mint text-forest",
} as const;

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  return { ok: res.ok, data };
}

export function Dashboard() {
  const { user } = useAuth();
  const { getProductById } = useCatalog();
  const [tab, setTab] = useState<Tab>("rentals");
  const [rentals, setRentals] = useState<Rental[] | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [disputing, setDisputing] = useState<Claim | null>(null);
  const [loadError, setLoadError] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, m, o, c] = await Promise.all([fetch("/api/rentals"), fetch("/api/maintenance"), fetch("/api/orders"), fetch("/api/claims")]);
      if (!r.ok || !m.ok || !o.ok || !c.ok) throw new Error("load");
      setRentals(((await r.json()) as { rentals: Rental[] }).rentals);
      setRequests(((await m.json()) as { requests: MaintenanceRequest[] }).requests);
      setOrders(((await o.json()) as { orders: Order[] }).orders);
      setClaims(((await c.json()) as { claims: Claim[] }).claims);
      setLoadError("");
    } catch {
      setLoadError("We could not load your rentals. Please refresh the page.");
      setRentals((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dashboard data once the user is known
    if (user) void load();
  }, [user, load]);

  function done(message: string) {
    setDialog(null);
    setNotice(message);
    void load();
    window.setTimeout(() => setNotice(""), 4500);
  }

  const stats = useMemo(() => {
    const live = (rentals ?? []).filter((r) => r.phase === "Active" || r.phase === "Plan ended" || r.phase === "Return scheduled");
    const upcoming = (rentals ?? []).filter((r) => r.phase === "Awaiting delivery");
    const nextEnd = live.filter((r) => r.phase !== "Plan ended").sort((a, b) => a.endDate.localeCompare(b.endDate))[0];
    return {
      live: live.reduce((s, r) => s + r.qty, 0),
      upcoming: upcoming.reduce((s, r) => s + r.qty, 0),
      monthly: live.reduce((s, r) => s + r.rentPerMonth * r.qty, 0),
      nextEnd,
      open: requests.filter((q) => q.status !== "Resolved").length,
    };
  }, [rentals, requests]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-semibold">Log in to see your rentals</h1>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login?next=/account" className="rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">Log in</Link>
          <Link href="/register?next=/account" className="rounded-full border border-forest px-6 py-3 font-semibold text-forest hover:bg-forest hover:text-white">Create account</Link>
        </div>
      </div>
    );
  }

  const current = (rentals ?? []).filter((r) => r.phase !== "Returned" && r.phase !== "Cancelled");
  const past = (rentals ?? []).filter((r) => r.phase === "Returned" || r.phase === "Cancelled");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">My rentals</h1>
          <p className="mt-1 text-ink-soft">Hello, {user.name}. Manage your plans, repairs and returns here.</p>
        </div>
        <Link href="/products" className="rounded-full border border-forest px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Rent something new</Link>
      </div>

      <AnimatePresence>
        {notice && (
          <m.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="mt-5 flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-forest">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </m.p>
        )}
      </AnimatePresence>
      {loadError && <p role="alert" className="mt-5 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{loadError}</p>}

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Items with you", value: String(stats.live), sub: stats.upcoming ? `${stats.upcoming} on the way` : "all delivered" },
          { label: "Monthly rent", value: inr(stats.monthly), sub: "for delivered items" },
          { label: "Next plan ends", value: stats.nextEnd ? formatDate(stats.nextEnd.endDate) : "None", sub: stats.nextEnd ? stats.nextEnd.name : "no active plans" },
          { label: "Open repairs", value: String(stats.open), sub: stats.open ? "we are on it" : "all clear" },
        ].map((s, i) => (
          <m.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-3xl border border-line bg-paper p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-moss">{s.label}</p>
            <p className="font-display mt-1 text-2xl font-semibold text-forest">{s.value}</p>
            <p className="mt-0.5 truncate text-xs text-ink-soft">{s.sub}</p>
          </m.div>
        ))}
      </div>

      <div className="mt-8 flex gap-2 overflow-x-auto" role="tablist" aria-label="Dashboard sections">
        {([
          ["rentals", `Rentals${current.length ? ` (${current.length})` : ""}`],
          ["repairs", `Repairs${requests.length ? ` (${requests.length})` : ""}`],
          ["orders", `Order history${orders.length ? ` (${orders.length})` : ""}`],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === id ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {rentals === null ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1].map((i) => (<div key={i} className="h-44 animate-pulse rounded-3xl bg-sand" />))}
          </div>
        ) : tab === "rentals" ? (
          <>
            {current.length === 0 && past.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line bg-paper p-12 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sand text-moss"><PackageOpen className="h-7 w-7" /></div>
                <p className="mt-4 font-semibold">No rentals yet</p>
                <p className="mt-1 text-sm text-ink-soft">Pick something for a few months and we will deliver it free.</p>
                <Link href="/products" className="mt-4 inline-block rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">Start renting</Link>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {current.map((r) => (<RentalCard key={r.id} rental={r} onAction={(kind) => setDialog({ kind, rental: r })} art={getProductById(r.productId)} claims={claims.filter((c) => c.rentalId === r.id)} onDispute={setDisputing} />))}
                </AnimatePresence>
                {past.length > 0 && (
                  <>
                    <h2 className="font-display pt-4 text-xl font-semibold">Past rentals</h2>
                    {past.map((r) => (<RentalCard key={r.id} rental={r} onAction={() => {}} art={getProductById(r.productId)} claims={claims.filter((c) => c.rentalId === r.id)} onDispute={setDisputing} />))}
                  </>
                )}
              </div>
            )}
          </>
        ) : tab === "repairs" ? (
          <Repairs requests={requests} />
        ) : (
          <Orders orders={orders} />
        )}
      </div>

      <Modal open={dialog?.kind === "repair"} onClose={() => setDialog(null)} title="Request a repair">
        {dialog?.kind === "repair" && <RepairForm rental={dialog.rental} onDone={() => done("Repair request sent. We will update the status here.")} />}
      </Modal>
      <Modal open={dialog?.kind === "extend"} onClose={() => setDialog(null)} title="Extend your plan">
        {dialog?.kind === "extend" && <ExtendForm rental={dialog.rental} onDone={() => done("Plan extended.")} />}
      </Modal>
      <Modal open={dialog?.kind === "return"} onClose={() => setDialog(null)} title={dialog?.rental.status === "Return scheduled" ? "Change pickup" : "Schedule a pickup"}>
        {dialog?.kind === "return" && <ReturnForm rental={dialog.rental} onDone={(m) => done(m)} />}
      </Modal>
      <Modal open={!!disputing} onClose={() => setDisputing(null)} title="Dispute this charge">
        {disputing && <DisputeForm claim={disputing} onDone={() => { setDisputing(null); done("Dispute sent. The amount is held until our team decides."); }} />}
      </Modal>
      <Modal open={dialog?.kind === "cancel"} onClose={() => setDialog(null)} title="Cancel this item?">
        {dialog?.kind === "cancel" && <CancelForm rental={dialog.rental} onClose={() => setDialog(null)} onDone={() => done("Item cancelled. Nothing is charged.")} />}
      </Modal>
    </div>
  );
}

function RentalCard({ rental: r, art, onAction, claims = [], onDispute }: { rental: Rental; art?: Product; onAction: (k: "repair" | "extend" | "return" | "cancel") => void; claims?: Claim[]; onDispute?: (c: Claim) => void }) {
  const live = r.phase === "Active" || r.phase === "Plan ended";
  const interactive = r.phase !== "Returned" && r.phase !== "Cancelled";
  return (
    <m.article layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="overflow-hidden rounded-3xl border border-line bg-paper">
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-sand sm:h-28 sm:w-28">
          {art ? <ProductArt kind={art.art} tint={art.tint} className="h-20 w-20 sm:h-24 sm:w-24" /> : <PackageOpen className="h-8 w-8 text-moss" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{r.qty > 1 ? `${r.qty} x ` : ""}{r.name}</h3>
              <p className="text-xs text-ink-soft">Order {r.orderId}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${phaseStyle[r.phase]}`}>{r.phase}</span>
          </div>

          <p className="mt-2 text-sm">
            <span className="font-bold text-forest">{inr(r.rentPerMonth * r.qty)}</span>
            <span className="text-ink-soft"> / month for {r.months} months. Deposit {inr(r.deposit * r.qty)}.</span>
          </p>

          {interactive && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-label="Plan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.progress * 100)}>
                <m.div className="h-full rounded-full bg-moss" initial={{ width: 0 }} animate={{ width: `${r.progress * 100}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
              </div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-xs text-ink-soft">
                <span>{r.phase === "Awaiting delivery" ? `Delivery ${formatDate(r.startDate)}` : `Started ${formatDate(r.startDate)}`}</span>
                <span>{r.phase === "Plan ended" ? `Ended ${formatDate(r.endDate)}` : `Ends ${formatDate(r.endDate)}${live ? ` (${r.daysLeft} days left)` : ""}`}</span>
              </div>
            </div>
          )}

          {r.returnRequest && r.phase === "Return scheduled" && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#dbe7f3] px-3 py-2 text-xs font-medium text-[#27506f]">
              <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Pickup on {formatDate(r.returnRequest.date)}, {r.returnRequest.slot}.{r.returnRequest.earlyClosureFee > 0 ? ` Early closure fee ${inr(r.returnRequest.earlyClosureFee)}.` : " No fee."} Your deposit is refunded after the return check.</span>
            </p>
          )}
          {r.extensions.length > 0 && <p className="mt-2 text-xs text-ink-soft">Extended {r.extensions.length} {r.extensions.length === 1 ? "time" : "times"}.</p>}

          {r.phase === "Returned" && (
            <RefundBlock rental={r} claims={claims} onDispute={onDispute} />
          )}
        </div>
      </div>

      {interactive && (
        <div className="flex flex-wrap gap-2 border-t border-line bg-cream/60 px-4 py-3 sm:px-5">
          {r.phase === "Awaiting delivery" ? (
            <button onClick={() => onAction("cancel")} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-coral hover:text-coral-deep"><XCircle className="h-4 w-4" /> Cancel item</button>
          ) : (
            <>
              <button onClick={() => onAction("repair")} className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral"><Wrench className="h-4 w-4" /> Request repair</button>
              {r.phase !== "Return scheduled" && (
                <button onClick={() => onAction("extend")} className="flex items-center gap-1.5 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white"><Repeat className="h-4 w-4" /> Extend</button>
              )}
              <button onClick={() => onAction("return")} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-moss hover:text-forest"><Undo2 className="h-4 w-4" /> {r.phase === "Return scheduled" ? "Change pickup" : "Return / pickup"}</button>
            </>
          )}
        </div>
      )}
    </m.article>
  );
}

const claimTone = { Charged: "text-[#7a5200]", Disputed: "text-coral-deep", Upheld: "text-ink", Waived: "text-forest" } as const;

function RefundBlock({ rental: r, claims, onDispute }: { rental: Rental; claims: Claim[]; onDispute?: (c: Claim) => void }) {
  const { refund, deducted, onHold } = refundFor(r.deposit * r.qty, claims);
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-sand px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Deposit refund</span>
        <span className="font-bold text-forest">{inr(refund)}{onHold > 0 && <span className="ml-1 text-xs font-medium text-coral-deep">({inr(onHold)} on hold)</span>}</span>
      </p>
      {deducted === 0 && onHold === 0 && claims.length === 0 && <p className="text-xs text-ink-soft">Returned in good condition. Your full deposit of {inr(r.deposit * r.qty)} is on its way.</p>}
      {claims.map((c) => (
        <div key={c.id} className="rounded-xl bg-paper px-3 py-2">
          <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold">Damage charge {inr(c.amount)}</span>
            <span className={`font-bold ${claimTone[c.status]}`}>{c.status}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">{c.note}</p>
          {c.disputeMessage && <p className="mt-1 text-xs text-ink-soft">You said: {c.disputeMessage}</p>}
          {c.resolutionNote && <p className="mt-1 text-xs font-medium text-forest">Our decision: {c.resolutionNote}</p>}
          {c.status === "Charged" && onDispute && <button onClick={() => onDispute(c)} className="mt-2 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-coral hover:text-coral-deep">Dispute this charge</button>}
        </div>
      ))}
    </div>
  );
}

function DisputeForm({ claim, onDone }: { claim: Claim; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, data } = await api(`/api/claims/${claim.id}/dispute`, "POST", { message });
    if (ok) return onDone();
    setError(data.error ?? "Could not send your dispute.");
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">{claim.productName}: {inr(claim.amount)} for <span className="font-semibold text-ink">{claim.note}</span>. Tell us why you disagree. The amount stays on hold while our team reviews it.</p>
      <label className="block text-sm font-semibold">Your reason
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={500} className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 font-normal outline-none focus:border-moss" />
      </label>
      <FormError message={error} />
      <Submit busy={busy}>Send dispute</Submit>
    </form>
  );
}

function Repairs({ requests }: { requests: MaintenanceRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line bg-paper p-12 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sand text-moss"><Wrench className="h-7 w-7" /></div>
        <p className="mt-4 font-semibold">No repair requests</p>
        <p className="mt-1 text-sm text-ink-soft">If something stops working, use Request repair on the item and it shows up here.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {requests.map((q, i) => (
        <m.li key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{q.productName} <span className="font-normal text-ink-soft">&middot; {q.category}</span></p>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${requestStyle[q.status]}`}>{q.status}</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">{q.description}</p>
          {q.note && <p className="mt-2 rounded-2xl bg-mint px-3 py-2 text-sm text-forest">Our team: {q.note}</p>}
          <p className="mt-2 text-xs text-ink-soft">{q.id} &middot; raised {q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
        </m.li>
      ))}
    </ul>
  );
}

function Orders({ orders }: { orders: Order[] }) {
  if (orders.length === 0) return <div className="rounded-3xl border border-dashed border-line bg-paper p-12 text-center text-ink-soft">No orders yet.</div>;
  return (
    <ul className="space-y-3">
      {orders.map((o, i) => (
        <m.li key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-3xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{o.id}</p>
            <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-forest">{o.status}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft"><CalendarClock className="h-3.5 w-3.5" /> Delivery {formatDate(o.deliveryDate)}, {o.slot}, {o.city}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {o.lines.map((l) => (<li key={l.productId}>{l.qty} x {l.name} <span className="text-ink-soft">({l.months} months, {inr(l.rentPerMonth * l.qty)}/mo)</span></li>))}
          </ul>
          <Link href={`/orders/${o.id}`} className="mt-3 inline-block text-sm font-semibold text-moss hover:underline">View order</Link>
        </m.li>
      ))}
    </ul>
  );
}

function FormError({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{message}</p> : null;
}

function Submit({ busy, children, tone = "coral" }: { busy: boolean; children: React.ReactNode; tone?: "coral" | "forest" }) {
  return (
    <button type="submit" disabled={busy} className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold text-white transition disabled:opacity-70 ${tone === "coral" ? "bg-coral hover:bg-coral-deep" : "bg-forest hover:bg-forest-deep"}`}>
      {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Please wait...</> : children}
    </button>
  );
}

function RepairForm({ rental, onDone }: { rental: Rental; onDone: () => void }) {
  const [category, setCategory] = useState<string>(maintenanceCategories[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, data } = await api("/api/maintenance", "POST", { rentalId: rental.id, category, description });
    if (ok) return onDone();
    setError(data.error ?? "Could not send your request.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">For your <span className="font-semibold text-ink">{rental.name}</span>. Repairs and replacements are free for normal wear and tear.</p>
      <label className="block text-sm font-semibold">What is wrong?
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-moss">
          {maintenanceCategories.map((c) => (<option key={c}>{c}</option>))}
        </select>
      </label>
      <label className="block text-sm font-semibold">Tell us more
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={500} placeholder="When did it start? Any sound, smell or error?" className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 font-normal outline-none focus:border-moss" />
        <span className="mt-1 block text-right text-xs font-normal text-ink-soft">{description.length}/500</span>
      </label>
      <FormError message={error} />
      <Submit busy={busy}>Send request</Submit>
    </form>
  );
}

function ExtendForm({ rental, onDone }: { rental: Rental; onDone: () => void }) {
  const { getProductById } = useCatalog();
  const product = getProductById(rental.productId);
  const [add, setAdd] = useState<3 | 6 | 12>(6);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = (m: number) => {
    const total = rental.months + m;
    const rent = product ? Math.min(rental.rentPerMonth, monthlyRent(product, tierFor(total))) : rental.rentPerMonth;
    return { total, rent, end: addMonthsISO(rental.endDate, m) };
  };
  const p = preview(add);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { ok, data } = await api(`/api/rentals/${rental.id}/extend`, "POST", { addMonths: add });
    if (ok) return onDone();
    setError(data.error ?? "Could not extend this plan.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">A longer plan can lower your monthly rent. Your current plan ends {formatDate(rental.endDate)}.</p>
      <div className="grid grid-cols-3 gap-3">
        {tenures.map((t) => {
          const pv = preview(t.months);
          const selected = add === t.months;
          return (
            <label key={t.months} className={`cursor-pointer rounded-2xl border-2 p-3 text-center transition ${selected ? "border-forest bg-mint/50" : "border-line hover:border-moss"}`}>
              <input type="radio" name="add" value={t.months} checked={selected} onChange={() => setAdd(t.months as 3 | 6 | 12)} className="sr-only" />
              <span className="block text-sm font-semibold">+{t.months} months</span>
              <span className="mt-1 block text-sm font-bold text-forest">{inr(pv.rent * rental.qty)}</span>
              <span className="block text-[11px] text-ink-soft">per month</span>
            </label>
          );
        })}
      </div>
      <dl className="space-y-1.5 rounded-2xl bg-sand px-4 py-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-soft">New plan length</dt><dd className="font-semibold">{p.total} months</dd></div>
        <div className="flex justify-between"><dt className="text-ink-soft">New end date</dt><dd className="font-semibold">{formatDate(p.end)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-soft">Monthly rent</dt><dd className="font-bold text-forest">{inr(p.rent * rental.qty)}{p.rent < rental.rentPerMonth && <span className="ml-1 text-xs font-medium text-moss">(was {inr(rental.rentPerMonth * rental.qty)})</span>}</dd></div>
      </dl>
      <FormError message={error} />
      <Submit busy={busy} tone="forest">Confirm extension</Submit>
    </form>
  );
}

function ReturnForm({ rental, onDone }: { rental: Rental; onDone: (message: string) => void }) {
  const today = todayISO();
  const min = addDaysISO(today, 1);
  const max = addDaysISO(rental.endDate > today ? rental.endDate : today, 30);
  const [date, setDate] = useState(rental.returnRequest?.date ?? "");
  const [slot, setSlot] = useState<string>(rental.returnRequest?.slot ?? returnSlots[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fee = date ? earlyClosureFee(rental, date) : 0;
  const scheduled = rental.status === "Return scheduled";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || date < min || date > max) return setError("Pick a date from tomorrow up to 30 days after your plan ends.");
    setBusy(true);
    setError("");
    const { ok, data } = await api(`/api/rentals/${rental.id}/return`, "POST", { date, slot });
    if (ok) return onDone(`Pickup booked for ${formatDate(date)}.`);
    setError(data.error ?? "Could not book the pickup.");
    setBusy(false);
  }

  async function cancelPickup() {
    setBusy(true);
    const { ok, data } = await api(`/api/rentals/${rental.id}/return`, "DELETE");
    if (ok) return onDone("Pickup cancelled. Your rental continues.");
    setError(data.error ?? "Could not cancel the pickup.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">We collect the item from your door. Your deposit of <span className="font-semibold text-ink">{inr(rental.deposit * rental.qty)}</span> is refunded after the return check.</p>
      <label className="block text-sm font-semibold">Pickup date
        <input type="date" value={date} min={min} max={max} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none focus:border-moss" />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">Time slot</legend>
        <div className="mt-1.5 grid gap-2">
          {returnSlots.map((s) => (
            <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition ${slot === s ? "border-forest bg-mint/50" : "border-line hover:border-moss"}`}>
              <input type="radio" name="slot" checked={slot === s} onChange={() => setSlot(s)} className="accent-[#0d3b33]" /> {s}
            </label>
          ))}
        </div>
      </fieldset>
      {date && (
        <p className={`rounded-2xl px-4 py-3 text-sm font-medium ${fee > 0 ? "bg-sun/25 text-[#7a5200]" : "bg-mint text-forest"}`}>
          {fee > 0 ? `Your plan runs until ${formatDate(rental.endDate)}, so closing early adds a one month rent fee of ${inr(fee)}.` : "Your plan has run its course, so there is no extra fee."}
        </p>
      )}
      <FormError message={error} />
      <Submit busy={busy}>{scheduled ? "Update pickup" : "Book pickup"}</Submit>
      {scheduled && <button type="button" onClick={cancelPickup} disabled={busy} className="w-full rounded-full border border-line py-3 text-sm font-semibold text-ink-soft transition hover:border-coral hover:text-coral-deep">Cancel pickup and keep renting</button>}
    </form>
  );
}

function CancelForm({ rental, onClose, onDone }: { rental: Rental; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError("");
    const { ok, data } = await api(`/api/rentals/${rental.id}/cancel`, "POST");
    if (ok) return onDone();
    setError(data.error ?? "Could not cancel this item.");
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{rental.qty > 1 ? `${rental.qty} x ` : ""}<span className="font-semibold text-ink">{rental.name}</span> is scheduled for delivery on {formatDate(rental.startDate)}. You can cancel free of charge until the day before.</p>
      <FormError message={error} />
      <button onClick={confirm} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep disabled:opacity-70">
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Cancelling...</> : "Yes, cancel this item"}
      </button>
      <button onClick={onClose} className="w-full rounded-full border border-line py-3 text-sm font-semibold text-ink-soft hover:border-moss">Keep it</button>
    </div>
  );
}
