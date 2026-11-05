"use client";

import { Check, PackageCheck, PackageOpen, ShieldCheck, Truck, ClipboardCheck, XCircle } from "lucide-react";
import { trackSteps, type OrderStatus, type PipelineStage, type TimelineEntry } from "@/lib/orderFlow";

export const statusStyle: Record<OrderStatus, string> = {
  Placed: "bg-sun/25 text-[#7a5200]",
  Confirmed: "bg-mint text-forest",
  Packed: "bg-mint text-forest",
  "Out for delivery": "bg-forest text-white",
  Delivered: "bg-mint text-forest",
  Closed: "bg-sand text-ink-soft",
  Cancelled: "bg-coral/15 text-coral-deep",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${statusStyle[status]}`}>{status}</span>;
}

const icons: Record<PipelineStage, typeof Check> = {
  Placed: ClipboardCheck,
  Confirmed: ShieldCheck,
  Packed: PackageOpen,
  "Out for delivery": Truck,
  Delivered: PackageCheck,
};

const customerText: Record<PipelineStage, string> = {
  Placed: "We have your order",
  Confirmed: "Our team confirmed it",
  Packed: "Packed and ready",
  "Out for delivery": "On its way to you",
  Delivered: "At your door",
};

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** The five steps of an order, with the time each was reached. Reads left to right on wide screens and top to bottom on phones. */
export function OrderTracker({ status, timeline }: { status: OrderStatus; timeline: TimelineEntry[] }) {
  const { steps, cancelled } = trackSteps(status, timeline);
  const cancel = [...timeline].reverse().find((t) => t.status === "Cancelled");
  return (
    <div>
      <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0" aria-label="Order progress">
        {steps.map((s, i) => {
          const Icon = icons[s.stage];
          const last = i === steps.length - 1;
          return (
            <li key={s.stage} className="relative flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center" aria-current={s.state === "current" ? "step" : undefined}>
              {!last && <span aria-hidden className={`absolute left-5 top-10 h-[calc(100%-1rem)] w-0.5 sm:left-1/2 sm:top-5 sm:h-0.5 sm:w-full ${s.state === "done" ? "bg-forest" : "bg-line"}`} />}
              <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition ${s.state === "done" ? "border-forest bg-forest text-white" : s.state === "current" ? "border-coral bg-white text-coral-deep ring-4 ring-coral/20" : "border-line bg-paper text-ink-soft"}`}>
                {s.state === "done" ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 sm:mt-2 sm:px-1">
                <span className={`block text-sm font-semibold ${s.state === "upcoming" ? "text-ink-soft" : "text-ink"}`}>{s.stage}</span>
                <span className="block text-xs text-ink-soft">{s.at ? formatWhen(s.at) : s.state === "upcoming" ? customerText[s.stage] : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-deep">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This order was cancelled{cancel?.at ? ` on ${formatWhen(cancel.at)}` : ""}.{cancel?.note ? ` Reason: ${cancel.note}` : ""}</span>
        </p>
      )}
    </div>
  );
}

/** Every recorded event, newest first. */
export function OrderHistory({ timeline, viewer = "customer" }: { timeline: TimelineEntry[]; viewer?: "customer" | "admin" }) {
  return (
    <ul className="space-y-2 text-sm">
      {[...timeline].reverse().map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-28 shrink-0 text-xs text-ink-soft">{formatWhen(t.at)}</span>
          <span className="min-w-0">
            <span className="font-semibold">{t.status}</span>
            <span className="text-ink-soft"> by {t.by === "admin" ? "RentEase team" : t.by === "customer" ? (viewer === "admin" ? "the customer" : "you") : "system"}</span>
            {t.note && <span className="block text-ink-soft">{t.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
