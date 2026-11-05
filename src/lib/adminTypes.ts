import type { Claim } from "@/lib/claims";
import type { Product } from "@/data/products";
import type { MaintenanceRequest, Rental } from "@/lib/rentals";

export type AdminRental = Rental & {
  customer: { name: string; email: string; phone: string } | null;
  address: string;
  city: string;
  slot: string;
  deliveredAt: string | null;
  returnedAt: string | null;
};

export type AdminRequest = MaintenanceRequest & { customer: string; phone: string };
export type AdminClaim = Claim & { customer: string };
export type AdminProduct = Product & { active: boolean };
export type AdminArea = { id: string; name: string; active: boolean };

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "user" | "admin";
  disabled: boolean;
  orders: number;
  itemsRented: number;
  joined: string;
};

export type Stats = {
  kpis: {
    activeRentals: number;
    awaitingDelivery: number;
    mrr: number;
    depositHeld: number;
    utilization: number;
    customers: number;
    buyers: number;
    repeatRate: number;
    openRepairs: number;
    resolvedRepairs: number;
    avgResolutionHours: number | null;
    pickupsDue: number;
    deliveriesDue: number;
    openDisputes: number;
    claimsCharged: number;
    lowStock: number;
    totalOrders: number;
  };
  byProduct: { pid: string; name: string; unitsOut: number; reserved: number; onShelf: number; utilization: number; mrr: number }[];
  ordersPerDay: { date: string; orders: number }[];
};

export type AdminData = {
  stats: Stats;
  rentals: AdminRental[];
  products: AdminProduct[];
  requests: AdminRequest[];
  claims: AdminClaim[];
  users: AdminUser[];
  areas: AdminArea[];
};

export async function adminApi(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; fields?: Record<string, string> };
  return { ok: res.ok, status: res.status, data };
}
