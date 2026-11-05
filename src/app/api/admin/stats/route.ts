import { json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { addDaysISO, phaseOf, todayISO } from "@/lib/rentals";
import { ClaimModel, MaintenanceModel, OrderModel, ProductModel, RentalModel, UserModel } from "@/models";

/** Dashboard KPIs, all computed from live data. */
export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const today = todayISO();
  const [rentals, products, orders, repairs, claims, customers] = await Promise.all([
    RentalModel.find({}).lean(),
    ProductModel.find({}).lean(),
    OrderModel.find({}, { userId: 1, createdAt: 1, status: 1 }).lean(),
    MaintenanceModel.find({}).lean(),
    ClaimModel.find({}).lean(),
    UserModel.countDocuments({ role: "user" }),
  ]);

  const withCustomer = rentals.map((r) => ({ r, phase: phaseOf(r, today) }));
  const out = withCustomer.filter((x) => x.phase === "Active" || x.phase === "Plan ended" || x.phase === "Return scheduled");
  const awaiting = withCustomer.filter((x) => x.phase === "Awaiting delivery");

  const unitsOut = out.reduce((s, x) => s + x.r.qty, 0);
  const unitsAwaiting = awaiting.reduce((s, x) => s + x.r.qty, 0);
  const stockOnShelf = products.reduce((s, p) => s + p.stock, 0);
  const mrr = out.reduce((s, x) => s + x.r.rentPerMonth * x.r.qty, 0);
  const depositHeld = out.reduce((s, x) => s + x.r.deposit * x.r.qty, 0);

  const byProduct = products
    .map((p) => {
      const o = out.filter((x) => x.r.pid === p.pid);
      const a = awaiting.filter((x) => x.r.pid === p.pid);
      const outUnits = o.reduce((s, x) => s + x.r.qty, 0);
      const reserved = a.reduce((s, x) => s + x.r.qty, 0);
      const total = outUnits + reserved + p.stock;
      return {
        pid: p.pid,
        name: p.name,
        unitsOut: outUnits,
        reserved,
        onShelf: p.stock,
        utilization: total ? outUnits / total : 0,
        mrr: o.reduce((s, x) => s + x.r.rentPerMonth * x.r.qty, 0),
      };
    })
    .sort((a, b) => b.mrr - a.mrr || b.utilization - a.utilization);

  // Repeat customers: two or more orders, or any plan extension, out of customers who have ordered.
  const ordersBy = new Map<string, number>();
  for (const o of orders) if (o.status !== "Cancelled") ordersBy.set(String(o.userId), (ordersBy.get(String(o.userId)) ?? 0) + 1);
  const extended = new Set(rentals.filter((r) => (r.extensions?.length ?? 0) > 0).map((r) => String(r.userId)));
  const buyers = [...ordersBy.keys()];
  const repeat = buyers.filter((u) => (ordersBy.get(u) ?? 0) >= 2 || extended.has(u)).length;

  const resolved = repairs.filter((m) => m.status === "Resolved" && m.resolvedAt && m.createdAt);
  const avgResolutionHours = resolved.length
    ? resolved.reduce((s, m) => s + (new Date(m.resolvedAt as Date).getTime() - new Date(m.createdAt as Date).getTime()) / 3_600_000, 0) / resolved.length
    : null;

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
  const perDay = days.map((d) => ({
    date: d,
    orders: orders.filter((o) => o.createdAt && new Date(o.createdAt).toLocaleDateString("en-CA") === d).length,
  }));

  return json({
    kpis: {
      activeRentals: unitsOut,
      awaitingDelivery: unitsAwaiting,
      mrr,
      depositHeld,
      utilization: unitsOut + unitsAwaiting + stockOnShelf ? unitsOut / (unitsOut + unitsAwaiting + stockOnShelf) : 0,
      customers,
      buyers: buyers.length,
      repeatRate: buyers.length ? repeat / buyers.length : 0,
      openRepairs: repairs.filter((m) => m.status !== "Resolved").length,
      resolvedRepairs: resolved.length,
      avgResolutionHours,
      pickupsDue: rentals.filter((r) => r.status === "Return scheduled").length,
      deliveriesDue: awaiting.length,
      openDisputes: claims.filter((c) => c.status === "Disputed").length,
      claimsCharged: claims.filter((c) => c.status === "Charged" || c.status === "Upheld").reduce((s, c) => s + c.amount, 0),
      lowStock: products.filter((p) => p.active !== false && p.stock <= 3).length,
      totalOrders: orders.length,
      ordersToConfirm: orders.filter((o) => o.status === "Placed").length,
      ordersInTransit: orders.filter((o) => o.status === "Packed" || o.status === "Out for delivery").length,
    },
    byProduct,
    ordersPerDay: perDay,
  });
}
