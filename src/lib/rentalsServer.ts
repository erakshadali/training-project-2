import { addMonthsISO, phaseOf, progressOf, daysBetween, todayISO, type MaintenanceRequest, type Rental } from "@/lib/rentals";
import { OrderModel, RentalModel, type MaintenanceDoc, type RentalDoc } from "@/models";

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

/**
 * Makes sure every item in the user's orders has a rental record.
 * Safe to call repeatedly: the unique (orderId, pid) index stops duplicates.
 */
export async function ensureRentals(userId: string) {
  const orders = await OrderModel.find({ userId }).lean();
  for (const o of orders) {
    for (const l of o.lines) {
      const exists = await RentalModel.exists({ orderId: o.orderId, pid: l.pid });
      if (exists) continue;
      try {
        await RentalModel.create({
          rentalId: newId("RN"),
          orderId: o.orderId,
          userId,
          pid: l.pid,
          name: l.name,
          qty: l.qty,
          months: l.months,
          rentPerMonth: l.rentPerMonth,
          deposit: l.deposit,
          startDate: o.deliveryDate,
          endDate: addMonthsISO(o.deliveryDate, l.months),
          status: o.status === "Cancelled" ? "Cancelled" : "Scheduled",
        });
      } catch (err) {
        // A parallel request created it first; that is fine.
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
  }
}

export function serializeRental(d: RentalDoc): Rental {
  const today = todayISO();
  return {
    id: d.rentalId,
    orderId: d.orderId,
    productId: d.pid,
    name: d.name,
    qty: d.qty,
    months: d.months,
    rentPerMonth: d.rentPerMonth,
    deposit: d.deposit,
    startDate: d.startDate,
    endDate: d.endDate,
    status: d.status,
    phase: phaseOf(d, today),
    daysLeft: Math.max(0, daysBetween(today, d.endDate)),
    progress: progressOf(d, today),
    extensions: (d.extensions ?? []).map((e) => ({ addedMonths: e.addedMonths, rentPerMonth: e.rentPerMonth, at: new Date(e.at).toISOString() })),
    returnRequest: d.returnRequest
      ? { date: d.returnRequest.date, slot: d.returnRequest.slot, earlyClosureFee: d.returnRequest.earlyClosureFee }
      : null,
  };
}

export function serializeRequest(d: MaintenanceDoc & { createdAt?: Date }): MaintenanceRequest {
  return {
    id: d.requestId,
    rentalId: d.rentalId,
    productName: d.productName,
    category: d.category,
    description: d.description,
    status: d.status,
    note: d.note ?? "",
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : "",
    resolvedAt: d.resolvedAt ? new Date(d.resolvedAt).toISOString() : null,
  };
}
