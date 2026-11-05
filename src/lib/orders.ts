import type { TenureMonths } from "@/data/config";

export type OrderLine = {
  productId: string;
  name: string;
  months: TenureMonths;
  qty: number;
  rentPerMonth: number;
  deposit: number;
};

export type OrderStatus = "Scheduled" | "Delivered" | "Closed" | "Cancelled";

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
};

export function newOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RE-${t}-${r}`;
}
