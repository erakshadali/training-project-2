import { addMonthsISO, todayISO } from "@/lib/rentals";
import { ensureRentals } from "@/lib/rentalsServer";
import { ProductModel, RentalModel, type OrderDoc } from "@/models";

type Stored = OrderDoc["status"];

/** Order statuses in which the order can still be changed or delivered. "Scheduled" is the pre-pipeline name for Confirmed. */
export const OPEN_STATUSES: Stored[] = ["Placed", "Confirmed", "Packed", "Out for delivery", "Scheduled"];

/** The order status in which a single item may be marked delivered from the Schedule board. */
export const DELIVERABLE_STATUSES: Stored[] = ["Out for delivery", "Scheduled"];

export function entry(status: string, by: "customer" | "admin" | "system", note = "") {
  return { status, at: new Date(), by, note };
}

/** Marks every item of the order that is still waiting as delivered today. The plan clock starts now. */
export async function deliverOrderRentals(orderId: string, userId: string) {
  await ensureRentals(userId);
  const today = todayISO();
  const waiting = await RentalModel.find({ orderId, status: "Scheduled", deliveredAt: null }).lean();
  let delivered = 0;
  for (const r of waiting) {
    // The filter makes each item happen once, even with a double click.
    const res = await RentalModel.updateOne(
      { rentalId: r.rentalId, status: "Scheduled", deliveredAt: null },
      { $set: { startDate: today, endDate: addMonthsISO(today, r.months), deliveredAt: new Date() } },
    );
    delivered += res.modifiedCount;
  }
  return delivered;
}

/** Cancels every undelivered item of the order and puts its stock back on the shelf. */
export async function cancelOrderRentals(orderId: string, userId: string) {
  await ensureRentals(userId);
  const waiting = await RentalModel.find({ orderId, status: "Scheduled", deliveredAt: null }).lean();
  for (const r of waiting) {
    const res = await RentalModel.updateOne({ rentalId: r.rentalId, status: "Scheduled", deliveredAt: null }, { $set: { status: "Cancelled" } });
    // Only the request that actually cancelled the item restores the stock, so it can never be added twice.
    if (res.modifiedCount === 1) await ProductModel.updateOne({ pid: r.pid }, { $inc: { stock: r.qty } });
  }
}

/** Moves the delivery date of every undelivered item to match a rescheduled order. */
export async function rescheduleOrderRentals(orderId: string, userId: string, date: string) {
  await ensureRentals(userId);
  const waiting = await RentalModel.find({ orderId, status: "Scheduled", deliveredAt: null }).lean();
  for (const r of waiting) {
    await RentalModel.updateOne({ rentalId: r.rentalId, status: "Scheduled", deliveredAt: null }, { $set: { startDate: date, endDate: addMonthsISO(date, r.months) } });
  }
}
