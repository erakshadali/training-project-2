"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, MapPin } from "lucide-react";
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
  const order = state.data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 12 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-mint text-forest">
        <CheckCircle2 className="h-11 w-11" />
      </motion.div>
      <h1 className="font-display mt-6 text-center text-4xl font-semibold tracking-tight">Order placed, {order.name.split(" ")[0]}!</h1>
      <p className="mt-2 text-center text-ink-soft">Order <span className="font-semibold text-ink">{order.id}</span>. A confirmation would go to {order.email} (demo).</p>

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
        <Link href="/products" className="rounded-full border border-forest px-6 py-3 font-semibold text-forest hover:bg-forest hover:text-white">Keep shopping</Link>
      </div>
    </div>
  );
}
