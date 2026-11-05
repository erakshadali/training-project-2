import type { Order } from "@/lib/orders";
import { legacyTimeline, normalizeStatus, type TimelineEntry } from "@/lib/orderFlow";

type OrderLean = {
  orderId: string;
  createdAt?: Date;
  updatedAt?: Date;
  timeline?: { status: string; at: Date; by: string; note?: string }[];
  partner?: { name?: string; phone?: string } | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  deliveryDate: string;
  slot: string;
  payment: string;
  lines: { pid: string; name: string; months: number; qty: number; rentPerMonth: number; deposit: number }[];
  rentPerMonth: number;
  deposit: number;
  status: string;
};

/** Turns a Mongo order document into the plain JSON shape the browser uses. */
export function serialize(o: unknown): Order {
  const d = o as OrderLean;
  const created = d.createdAt ? new Date(d.createdAt).toISOString() : "";
  const updated = d.updatedAt ? new Date(d.updatedAt).toISOString() : created;
  const timeline: TimelineEntry[] = d.timeline?.length
    ? d.timeline.map((t) => ({ status: normalizeStatus(t.status), at: new Date(t.at).toISOString(), by: t.by as TimelineEntry["by"], note: t.note ?? "" }))
    : legacyTimeline(d.status, created, updated);
  return {
    id: d.orderId,
    createdAt: created,
    name: d.name,
    phone: d.phone,
    email: d.email,
    address: d.address,
    city: d.city,
    pincode: d.pincode,
    deliveryDate: d.deliveryDate,
    slot: d.slot,
    payment: d.payment,
    lines: d.lines.map((l) => ({
      productId: l.pid,
      name: l.name,
      months: l.months as Order["lines"][number]["months"],
      qty: l.qty,
      rentPerMonth: l.rentPerMonth,
      deposit: l.deposit,
    })),
    rentPerMonth: d.rentPerMonth,
    deposit: d.deposit,
    status: normalizeStatus(d.status),
    timeline,
    partner: d.partner?.name ? { name: d.partner.name, phone: d.partner.phone ?? "" } : null,
  };
}
