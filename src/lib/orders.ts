import type { TenureMonths } from "@/data/config";
import type { OrderStatus, TimelineEntry } from "@/lib/orderFlow";

export type { OrderStatus, TimelineEntry };

export type OrderLine = {
  productId: string;
  name: string;
  months: TenureMonths;
  qty: number;
  rentPerMonth: number;
  deposit: number;
};

export type Order = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  deliveryDate: string;
  slot: string;
  payment: string;
  lines: OrderLine[];
  rentPerMonth: number;
  deposit: number;
  status: OrderStatus;
  /** What happened to the order and when, oldest first. */
  timeline: TimelineEntry[];
  /** Who is bringing it, filled in when the order goes out for delivery. */
  partner: { name: string; phone: string } | null;
};

export function newOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RE-${t}-${r}`;
}
