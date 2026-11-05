"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Loader2, Mail, MapPin, Phone, Search, Truck } from "lucide-react";
import type { Ctx } from "@/components/admin/AdminDashboard";
import { Modal } from "@/components/Modal";
import { OrderHistory, OrderTracker, StatusPill, formatWhen } from "@/components/OrderTracker";
import { adminApi } from "@/lib/adminTypes";
import { actionLabels, actionsFor, canReschedule, type OrderAction, type OrderStatus } from "@/lib/orderFlow";
import type { Order } from "@/lib/orders";
import { formatDate, inr } from "@/lib/pricing";
import { addDaysISO, returnSlots, todayISO } from "@/lib/rentals";

const FILTERS: ("All" | OrderStatus)[] = ["All", "Placed", "Confirmed", "Packed", "Out for delivery", "Delivered", "Closed", "Cancelled"];

type Dialog = { kind: "cancel" | "dispatch" | "reschedule"; order: Order } | null;

const doneText: Record<OrderAction | "reschedule", string> = {
  confirm: "confirmed",
  pack: "marked as packed",
  dispatch: "sent out for delivery",
  deliver: "marked as delivered. The rental plans have started",
  cancel: "cancelled. Stock is back on the shelf",
  reschedule: "rescheduled",
};

export function Orders({ data, reload, notify }: Ctx) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: data.orders.length };
    for (const o of data.orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [data.orders]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.orders.filter((o) => (filter === "All" || o.status === filter) && (!term || [o.id, o.name, o.phone, o.email, o.city, o.pincode].some((v) => v.toLowerCase().includes(term))));
  }, [data.orders, filter, q]);

  async function act(order: Order, action: OrderAction | "reschedule", extra: Record<string, string> = {}) {
    setBusy(order.id + action);
    const { ok, data: d } = await adminApi(`/api/admin/orders/${order.id}`, "POST", { action, ...extra });
    setBusy("");
    notify(ok ? `Order ${order.id} ${doneText[action]}.` : String(d.error ?? "Could not update the order."));
    if (ok) {
      setDialog(null);
      await reload();
    }
    return { ok, d };
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order ID, name, phone, city" className="w-full rounded-full border border-line bg-paper py-2.5 pl-10 pr-4 text-sm outline-none focus:border-moss" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === f ? "bg-forest text-white" : "bg-sand text-ink-soft hover:bg-mint"}`}>
              {f} <span className={filter === f ? "text-white/80" : "text-moss"}>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-3xl border border-line bg-paper px-5 py-10 text-center text-sm text-ink-soft">{data.orders.length === 0 ? "No orders yet. They will appear here as soon as a customer checks out." : "No orders match this filter."}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((o) => {
            const actions = actionsFor(o.status);
            const isOpen = open === o.id;
            return (
              <li key={o.id} className="rounded-3xl border border-line bg-paper">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">{o.id}</span><StatusPill status={o.status} /></p>
                    <p className="mt-1 text-sm">{o.name} <span className="text-ink-soft">&middot; {o.city}</span></p>
                    <p className="text-xs text-ink-soft">Placed {formatWhen(o.createdAt)} &middot; {o.lines.reduce((s, l) => s + l.qty, 0)} items &middot; {inr(o.rentPerMonth)}/mo &middot; deposit {inr(o.deposit)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-moss"><CalendarClock className="h-3.5 w-3.5" /> Delivery {formatDate(o.deliveryDate)}, {o.slot}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {actions.map((a) => {
                      const primary = a !== "cancel";
                      const needsDialog = a === "cancel" || a === "dispatch";
                      return (
                        <button
                          key={a}
                          disabled={busy.startsWith(o.id)}
                          onClick={() => (needsDialog ? setDialog({ kind: a as "cancel" | "dispatch", order: o }) : void act(o, a))}
                          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${primary ? "bg-forest text-white hover:bg-coral" : "border border-line text-coral-deep hover:border-coral"}`}
                        >
                          {busy === o.id + a ? <Loader2 className="h-4 w-4 animate-spin" /> : a === "dispatch" ? <Truck className="h-4 w-4" /> : null} {actionLabels[a]}
                        </button>
                      );
                    })}
                    {canReschedule(o.status) && (
                      <button onClick={() => setDialog({ kind: "reschedule", order: o })} className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white">Change date</button>
                    )}
                    <button onClick={() => setOpen(isOpen ? null : o.id)} aria-expanded={isOpen} aria-label={`${isOpen ? "Hide" : "Show"} details for ${o.id}`} className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-soft hover:border-moss">
                      <ChevronDown className={`h-5 w-5 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-5 border-t border-line p-4 sm:p-5">
                    <OrderTracker status={o.status} timeline={o.timeline} />
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="space-y-1.5 text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-moss">Customer</p>
                        <p className="font-medium">{o.name}</p>
                        <p className="flex items-center gap-1.5 text-ink-soft"><Phone className="h-3.5 w-3.5" /> {o.phone}</p>
                        <p className="flex items-center gap-1.5 break-all text-ink-soft"><Mail className="h-3.5 w-3.5 shrink-0" /> {o.email}</p>
                        <p className="flex items-start gap-1.5 text-ink-soft"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {o.address}, {o.city} {o.pincode}</p>
                        {o.partner && <p className="flex items-center gap-1.5 font-medium text-forest"><Truck className="h-3.5 w-3.5" /> {o.partner.name}{o.partner.phone ? `, ${o.partner.phone}` : ""}</p>}
                      </div>
                      <div className="text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-moss">Items</p>
                        <ul className="mt-1.5 divide-y divide-line">
                          {o.lines.map((l) => (
                            <li key={l.productId} className="flex justify-between gap-3 py-1.5"><span>{l.qty} x {l.name} <span className="text-ink-soft">({l.months} mo)</span></span><span className="font-semibold">{inr(l.rentPerMonth * l.qty)}</span></li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-ink-soft">Payment: {o.payment}</p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-moss">History</p>
                        <OrderHistory timeline={o.timeline} viewer="admin" />
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ActionDialog dialog={dialog} busy={!!busy} onClose={() => setDialog(null)} act={act} />
    </div>
  );
}

type ActFn = (o: Order, a: OrderAction | "reschedule", extra?: Record<string, string>) => Promise<{ ok: boolean; d: Record<string, unknown> & { fields?: Record<string, string> } }>;

function ActionDialog({ dialog, busy, onClose, act }: { dialog: Dialog; busy: boolean; onClose: () => void; act: ActFn }) {
  const title = dialog?.kind === "cancel" ? "Reject or cancel this order" : dialog?.kind === "dispatch" ? "Send out for delivery" : "Change the delivery date";
  return (
    <Modal open={!!dialog} onClose={onClose} title={title}>
      {dialog && <DialogForm key={dialog.kind + dialog.order.id} dialog={dialog} busy={busy} onClose={onClose} act={act} />}
    </Modal>
  );
}

function DialogForm({ dialog, busy, onClose, act }: { dialog: NonNullable<Dialog>; busy: boolean; onClose: () => void; act: ActFn }) {
  const o = dialog.order;
  const [note, setNote] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [date, setDate] = useState(o.deliveryDate);
  const [slot, setSlot] = useState<string>(o.slot);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const extra: Record<string, string> =
      dialog.kind === "cancel" ? { note }
      : dialog.kind === "dispatch" ? { partnerName, partnerPhone, note }
      : { deliveryDate: date, slot, note };
    const { ok, d } = await act(o, dialog.kind, extra);
    if (!ok) setError(String(d.fields ? Object.values(d.fields)[0] : d.error ?? "Something went wrong."));
  }

  const input = "mt-1.5 w-full rounded-2xl border border-line bg-cream px-4 py-3 text-sm font-normal outline-none focus:border-moss";
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-ink-soft">Order <span className="font-semibold text-ink">{o.id}</span> for {o.name}.</p>
      {dialog.kind === "cancel" && (
        <>
          <label className="block text-sm font-semibold">Reason the customer will see<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={300} required className={input} placeholder="For example: this item is out of stock on that date" /></label>
          <p className="text-xs text-ink-soft">Cancelling puts every undelivered item back in stock.</p>
        </>
      )}
      {dialog.kind === "dispatch" && (
        <>
          <label className="block text-sm font-semibold">Delivery person (optional)<input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} maxLength={60} className={input} placeholder="Name" /></label>
          <label className="block text-sm font-semibold">Their phone (optional)<input value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value.replace(/[^\d+ ]/g, ""))} inputMode="tel" maxLength={20} className={input} placeholder="Phone number" /></label>
        </>
      )}
      {dialog.kind === "reschedule" && (
        <>
          <label className="block text-sm font-semibold">New delivery date<input type="date" value={date} min={todayISO()} max={addDaysISO(todayISO(), 90)} onChange={(e) => setDate(e.target.value)} required className={input} /></label>
          <label className="block text-sm font-semibold">Time slot
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={input}>{returnSlots.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label className="block text-sm font-semibold">Note for the customer (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={input} /></label>
        </>
      )}
      {error && <p role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-moss">Back</button>
        <button type="submit" disabled={busy} className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${dialog.kind === "cancel" ? "bg-coral-deep hover:bg-coral" : "bg-forest hover:bg-coral"}`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {dialog.kind === "cancel" ? "Cancel the order" : dialog.kind === "dispatch" ? "Send out" : "Save new date"}
        </button>
      </div>
    </form>
  );
}
