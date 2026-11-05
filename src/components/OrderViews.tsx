"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { CalendarDays, CheckCircle2, FileText, MapPin, Printer, Truck, XCircle } from "lucide-react";
import { OrderHistory, OrderTracker, StatusPill } from "@/components/OrderTracker";
import { useAuth } from "@/context/AuthContext";
import type { Order } from "@/lib/orders";
import { formatDate, inr } from "@/lib/pricing";

type State<T> = { status: "loading" } | { status: "error"; message: string; code?: number } | { status: "ok"; data: T };

function useApi<T>(url: string, pick: (json: never) => T): State<T> {
  const [state, setState] = useState<State<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setState({ status: "error", message: json.error ?? "Something went wrong.", code: res.status });
        else setState({ status: "ok", data: pick(json as never) });
      })
      .catch(() => alive && setState({ status: "error", message: "Network problem. Please try again." }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick is a stable inline selector
  }, [url]);
  return state;
}

function LoginPrompt({ next }: { next: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Log in to see your rentals</h1>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={`/login?next=${next}`} className="rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">Log in</Link>
        <Link href={`/register?next=${next}`} className="rounded-full border border-forest px-6 py-3 font-semibold text-forest hover:bg-forest hover:text-white">Create account</Link>
      </div>
    </div>
  );
}

export function OrderConfirmation({ id }: { id: string }) {
  const { user } = useAuth();
  const state = useApi<Order>(user ? `/api/orders/${encodeURIComponent(id)}` : "/api/auth/me", (j: { order: Order }) => j.order);
  // Keep the tracker fresh while the order is still on its way.
  const [live, setLive] = useState<Order | null>(null);
  const status = live?.status ?? (state.status === "ok" ? state.data?.status : undefined);
  const finished = status === "Delivered" || status === "Closed" || status === "Cancelled";
  useEffect(() => {
    if (!user || state.status !== "ok" || finished) return;
    const t = window.setInterval(() => {
      fetch(`/api/orders/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.order && setLive(j.order)).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(t);
  }, [user, state.status, finished, id]);

  if (!user) return <LoginPrompt next={`/orders/${id}`} />;
  if (state.status === "loading") return <div className="mx-auto max-w-3xl px-4 py-20 text-ink-soft sm:px-6">Loading your order...</div>;
  if (state.status === "error" || !state.data?.id) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-semibold">We cannot find that order</h1>
        <p className="mt-2 text-ink-soft">It may belong to a different account. Open My rentals to see your orders.</p>
        <Link href="/account" className="mt-6 inline-block rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">My rentals</Link>
      </div>
    );
  }
  const order = live ?? state.data;
  const cancelled = order.status === "Cancelled";
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <m.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12 }} className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${cancelled ? "bg-coral/15 text-coral-deep" : "bg-mint text-forest"}`}>
        {cancelled ? <XCircle className="h-11 w-11" /> : <CheckCircle2 className="h-11 w-11" />}
      </m.div>
      <h1 className="font-display mt-6 text-center text-4xl font-semibold tracking-tight">{cancelled ? "Order cancelled" : order.status === "Placed" ? `Order placed, ${order.name.split(" ")[0]}!` : `Your order, ${order.name.split(" ")[0]}`}</h1>
      <p className="mt-2 text-center text-ink-soft">Order <span className="font-semibold text-ink">{order.id}</span>.{" "}
        {order.status === "Placed" ? "Our team will confirm it shortly. This page updates as it moves along." : order.status === "Out for delivery" ? "It is on its way." : cancelled ? "" : "Track every step below."}
      </p>

      <section className="mt-8 rounded-3xl border border-line bg-paper p-5 sm:p-6" aria-labelledby="track-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="track-h" className="font-display text-xl font-semibold">Order status</h2>
          <StatusPill status={order.status} />
        </div>
        <div className="mt-5"><OrderTracker status={order.status} timeline={order.timeline} /></div>
        {order.partner && order.status === "Out for delivery" && (
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-medium text-forest"><Truck className="h-4 w-4" /> Your delivery is with {order.partner.name}{order.partner.phone ? `, ${order.partner.phone}` : ""}.</p>
        )}
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer font-semibold text-moss">See the full history</summary>
          <div className="mt-3"><OrderHistory timeline={order.timeline} /></div>
        </details>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-moss"><CalendarDays className="h-4 w-4" /> Delivery</p>
          <p className="mt-2 font-semibold">{formatDate(order.deliveryDate)}</p>
          <p className="text-sm text-ink-soft">{order.slot}</p>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-moss"><MapPin className="h-4 w-4" /> Address</p>
          <p className="mt-2 text-sm">{order.address}</p>
          <p className="text-sm text-ink-soft">{order.city} {order.pincode}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-line bg-paper p-5">
        <h2 className="font-display text-xl font-semibold">Items</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {order.lines.map((l) => (
            <li key={l.productId} className="flex justify-between gap-4 py-3">
              <span>{l.qty} x {l.name} <span className="text-ink-soft">({l.months} months)</span></span>
              <span className="font-semibold">{inr(l.rentPerMonth * l.qty)}/mo</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Monthly rent</dt><dd className="font-bold">{inr(order.rentPerMonth)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Refundable deposit</dt><dd className="font-semibold">{inr(order.deposit)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Payment</dt><dd className="font-semibold">{order.payment}</dd></div>
        </dl>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account" className="rounded-full bg-forest px-6 py-3 font-semibold text-white hover:bg-coral">View my rentals</Link>
        <Link href={`/orders/${order.id}/invoice`} className="flex items-center gap-2 rounded-full border border-forest px-6 py-3 font-semibold text-forest hover:bg-forest hover:text-white"><FileText className="h-4 w-4" /> Invoice</Link>
        <Link href="/products" className="rounded-full border border-forest px-6 py-3 font-semibold text-forest hover:bg-forest hover:text-white">Keep shopping</Link>
      </div>
    </div>
  );
}

export function OrderInvoice({ id }: { id: string }) {
  const { user } = useAuth();
  const state = useApi<Order>(user ? `/api/orders/${encodeURIComponent(id)}` : "/api/auth/me", (j: { order: Order }) => j.order);
  if (!user) return <LoginPrompt next={`/orders/${id}/invoice`} />;
  if (state.status === "loading") return <div className="mx-auto max-w-3xl px-4 py-20 text-ink-soft sm:px-6">Loading your invoice...</div>;
  if (state.status === "error" || !state.data?.id) return <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6"><h1 className="font-display text-3xl font-semibold">We cannot find that order</h1></div>;
  const o = state.data;
  const placed = o.createdAt ? formatDate(o.createdAt.slice(0, 10)) : "";
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/orders/${o.id}`} className="text-sm font-semibold text-moss hover:underline">Back to order</Link>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral"><Printer className="h-4 w-4" /> Print or save as PDF</button>
      </div>
      <article className="mt-5 rounded-3xl border border-line bg-white p-6 text-ink sm:p-8 print:border-0 print:p-0" aria-label={`Invoice for order ${o.id}`}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="font-display text-2xl font-semibold">RentEase</p>
            <p className="text-sm text-ink-soft">Furniture and appliance rental</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-display text-xl font-semibold">Rental invoice</p>
            <p>No. <span className="font-semibold">{o.id}</span></p>
            <p className="text-ink-soft">Date {placed}</p>
            <p className="mt-1"><StatusPill status={o.status} /></p>
          </div>
        </header>
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-moss">Billed to</p>
            <p className="mt-1 font-semibold">{o.name}</p>
            <p className="text-ink-soft">{o.phone}</p>
            <p className="break-all text-ink-soft">{o.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-moss">Delivery</p>
            <p className="mt-1">{o.address}</p>
            <p className="text-ink-soft">{o.city} {o.pincode}</p>
            <p className="text-ink-soft">{formatDate(o.deliveryDate)}, {o.slot}</p>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft"><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3 text-right">Qty</th><th className="py-2 pr-3 text-right">Rent / month</th><th className="py-2 text-right">Deposit</th></tr></thead>
            <tbody className="divide-y divide-line">
              {o.lines.map((l) => (
                <tr key={l.productId}><td className="py-2.5 pr-3 font-medium">{l.name}</td><td className="py-2.5 pr-3">{l.months} months</td><td className="py-2.5 pr-3 text-right">{l.qty}</td><td className="py-2.5 pr-3 text-right">{inr(l.rentPerMonth * l.qty)}</td><td className="py-2.5 text-right">{inr(l.deposit * l.qty)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto mt-5 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">Monthly rent</dt><dd className="font-semibold">{inr(o.rentPerMonth)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Refundable deposit</dt><dd className="font-semibold">{inr(o.deposit)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-semibold">Due at start</dt><dd className="font-bold">{inr(o.rentPerMonth + o.deposit)}</dd></div>
        </dl>
        <p className="mt-6 text-xs text-ink-soft">Payment method: {o.payment}. The deposit is refunded after the items are returned in good condition, less any agreed damage charges. Free delivery and pickup. This is a summary of your rental order.</p>
      </article>
    </div>
  );
}
