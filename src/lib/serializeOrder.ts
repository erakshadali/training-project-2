import type { Order } from "@/lib/orders";

type OrderLean = {
  orderId: string;
  createdAt?: Date;
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
  return {
    id: d.orderId,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : "",
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
    status: d.status as Order["status"],
  };
}
