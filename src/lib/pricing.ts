import { tenures, type TenureMonths } from "@/data/config";
import type { Product } from "@/data/products";

export function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function discountFor(months: TenureMonths) {
  return tenures.find((t) => t.months === months)?.discount ?? 0;
}

/** Monthly rent for a product on a given tenure, rounded to whole rupees. */
export function monthlyRent(product: Product, months: TenureMonths) {
  return Math.round(product.rent * (1 - discountFor(months)));
}

export type CartLine = { productId: string; months: TenureMonths; qty: number };

export function lineTotals(product: Product, line: CartLine) {
  const rent = monthlyRent(product, line.months) * line.qty;
  const deposit = product.deposit * line.qty;
  return { rent, deposit };
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
