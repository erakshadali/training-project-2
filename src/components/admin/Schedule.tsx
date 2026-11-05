"use client";

import { useState } from "react";
import { Loader2, MapPin, Phone, Truck, Undo2 } from "lucide-react";
import type { Ctx } from "@/components/admin/AdminDashboard";
import { Modal } from "@/components/Modal";
import { adminApi, type AdminRental } from "@/lib/adminTypes";
import { formatDate, inr } from "@/lib/pricing";
import { todayISO } from "@/lib/rentals";

function Who({ r }: { r: AdminRental }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-ink-soft">
      <p className="font-medium text-ink">{r.customer?.name ?? "Customer"}</p>
      {r.customer?.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {r.customer.phone}</p>}
      {r.address && <p className="flex items-start gap-1"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {r.address}</p>}
    </div>
  );
}

export function Schedule({ data, reload, notify, go }: Ctx) {
  const [busy, setBusy] = useState("");
  const [ret, setRet] = useState<AdminRental | null>(null);
  const today = todayISO();

  const deliveries = data.rentals.filter((r) => r.phase === "Awaiting delivery").sort((a, b) => a.startDate.localeCompare(b.startDate));
  const pickups = data.rentals.filter((r) => r.phase === "Return scheduled").sort((a, b) => (a.returnRequest?.date ?? "").localeCompare(b.returnRequest?.date ?? ""));
  const ended = data.rentals.filter((r) => r.phase === "Plan ended");

  async function deliver(r: AdminRental) {
    setBusy(r.id);
    const { ok, data: d } = await adminApi(`/api/admin/rentals/${r.id}/deliver`, "POST");
    setBusy("");
    notify(ok ? `${r.name} marked delivered. The plan clock has started.` : String(d.error ?? "Could not mark delivered."));
    if (ok) await reload();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display flex items-center gap-2 text-xl font-semibold"><Truck className="h-5 w-5 text-moss" /> Deliveries ({deliveries.length})</h2>
        {deliveries.length === 0 ? <p className="mt-3 text-sm text-ink-soft">No deliveries waiting.</p> : (
          <ul className="mt-4 space-y-3">
            {deliveries.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.qty > 1 ? `${r.qty} x ` : ""}{r.name}</p>
                    <p className="text-xs text-moss">{formatDate(r.startDate)}{r.startDate === today ? " (today)" : r.startDate < today ? " (overdue)" : ""}, {r.slot} &middot; {r.months} months</p>
                  </div>
                  {r.orderStatus === "Out for delivery" ? (
                    <button onClick={() => deliver(r)} disabled={busy === r.id} className="flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral disabled:opacity-60">
                      {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Mark delivered
                    </button>
                  ) : (
                    <button onClick={() => go("orders")} className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Order is {r.orderStatus.toLowerCase()}: open Orders</button>
                  )}
                </div>
                <Who r={r} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <h2 className="font-display flex items-center gap-2 text-xl font-semibold"><Undo2 className="h-5 w-5 text-moss" /> Pickups ({pickups.length})</h2>
          {pickups.length === 0 ? <p className="mt-3 text-sm text-ink-soft">No pickups booked.</p> : (
            <ul className="mt-4 space-y-3">
              {pickups.map((r) => (
                <li key={r.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.qty > 1 ? `${r.qty} x ` : ""}{r.name}</p>
                      <p className="text-xs text-moss">{r.returnRequest ? `${formatDate(r.returnRequest.date)}, ${r.returnRequest.slot}` : ""}</p>
                      {r.returnRequest && r.returnRequest.earlyClosureFee > 0 && <p className="text-xs text-ink-soft">Early closure fee {inr(r.returnRequest.earlyClosureFee)}</p>}
                    </div>
                    <button onClick={() => setRet(r)} className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition hover:bg-coral">Process return</button>
                  </div>
                  <Who r={r} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {ended.length > 0 && (
          <div className="rounded-3xl border border-line bg-paper p-5">
            <h2 className="font-display text-xl font-semibold">Plans ended, no pickup booked ({ended.length})</h2>
            <ul className="mt-4 space-y-3">
              {ended.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-4">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-ink-soft">{r.customer?.name} &middot; ended {formatDate(r.endDate)}</p>
                  </div>
                  <button onClick={() => setRet(r)} className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Process return</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Modal open={!!ret} onClose={() => setRet(null)} title="Process return">
        {ret && <ReturnForm rental={ret} onDone={async (m) => { setRet(null); notify(m); await reload(); }} />}
      </Modal>
    </div>
  );
}

function ReturnForm({ rental, onDone }: { rental: AdminRental; onDone: (message: string) => void }) {
  const [charge, setCharge] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const held = rental.deposit * rental.qty;
  const amount = Number(charge || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(amount) || amount < 0) return setError("Enter a valid amount.");
    setBusy(true);
    setError("");
    const { ok, data: d } = await adminApi(`/api/admin/rentals/${rental.id}/return`, "POST", { damageCharge: Math.round(amount), damageNote: note });
    if (ok) return onDone(amount > 0 ? "Return recorded. A damage charge was raised and the customer can see it." : "Return recorded. The item is back in stock and the full deposit is due for refund.");
    setError(String(d.error ?? "Could not record the return."));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">{rental.qty > 1 ? `${rental.qty} x ` : ""}<span className="font-semibold text-ink">{rental.name}</span> from {rental.customer?.name}. Deposit held: <span className="font-semibold text-ink">{inr(held)}</span>. The item goes back into stock.</p>
      <label className="block text-sm font-semibold">Damage charge (optional)
        <input inputMode="numeric" value={charge} onChange={(e) => setCharge(e.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 font-normal outline-none focus:border-moss" />
      </label>
      {amount > 0 && (
        <label className="block text-sm font-semibold">What is damaged?
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 font-normal outline-none focus:border-moss" placeholder="The customer sees this and can dispute it." />
        </label>
      )}
      <p className="rounded-2xl bg-sand px-4 py-3 text-sm">Refund to customer: <span className="font-bold text-forest">{inr(Math.max(0, held - amount))}</span></p>
      {error && <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{error}</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-coral py-3.5 font-semibold text-white transition hover:bg-coral-deep disabled:opacity-70">
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : "Confirm return"}
      </button>
    </form>
  );
}
