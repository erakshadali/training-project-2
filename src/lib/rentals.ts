import type { TenureMonths } from "@/data/config";

/** Pure helpers shared by the server and the browser. Dates are ISO strings (yyyy-mm-dd). */

export type RentalStatus = "Scheduled" | "Return scheduled" | "Returned" | "Cancelled";
export type Phase = "Awaiting delivery" | "Active" | "Plan ended" | "Return scheduled" | "Returned" | "Cancelled";

export type Rental = {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  qty: number;
  months: number;
  rentPerMonth: number;
  deposit: number;
  startDate: string;
  endDate: string;
  status: RentalStatus;
  phase: Phase;
  daysLeft: number;
  progress: number;
  extensions: { addedMonths: number; rentPerMonth: number; at: string }[];
  returnRequest: { date: string; slot: string; earlyClosureFee: number } | null;
};

export type MaintenanceRequest = {
  id: string;
  rentalId: string;
  productName: string;
  category: string;
  description: string;
  status: "Open" | "In progress" | "Resolved";
  note: string;
  createdAt: string;
  resolvedAt: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const fromISO = (iso: string) => new Date(iso + "T00:00:00");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function todayISO() {
  return toISO(new Date());
}

export function addDaysISO(iso: string, days: number) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonthsISO(iso: string, months: number) {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

/** The price tier that applies to a total plan length. */
export function tierFor(totalMonths: number): TenureMonths {
  return totalMonths >= 12 ? 12 : totalMonths >= 6 ? 6 : 3;
}

export function phaseOf(r: { status: RentalStatus; startDate: string; endDate: string }, today = todayISO()): Phase {
  if (r.status === "Cancelled") return "Cancelled";
  if (r.status === "Returned") return "Returned";
  if (r.status === "Return scheduled") return "Return scheduled";
  if (today < r.startDate) return "Awaiting delivery";
  if (today > r.endDate) return "Plan ended";
  return "Active";
}

export function progressOf(r: { startDate: string; endDate: string }, today = todayISO()) {
  const total = Math.max(1, daysBetween(r.startDate, r.endDate));
  const used = daysBetween(r.startDate, today);
  return Math.max(0, Math.min(1, used / total));
}

/** Fee for ending a plan before it runs out: one month of rent, as the FAQ says. */
export function earlyClosureFee(r: { endDate: string; rentPerMonth: number; qty: number }, pickupDate: string) {
  return pickupDate < r.endDate ? r.rentPerMonth * r.qty : 0;
}

export const returnSlots = ["9 AM to 12 PM", "12 PM to 3 PM", "3 PM to 6 PM"] as const;
