import { fail, json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { addMonthsISO, todayISO } from "@/lib/rentals";
import { serializeRental } from "@/lib/rentalsServer";
import { DELIVERABLE_STATUSES, entry } from "@/lib/orderServer";
import { OrderModel, RentalModel } from "@/models";

/**
 * Admin only: record that one item was delivered today. The plan clock starts on delivery.
 * The order must already be out for delivery. When the last waiting item is delivered, the order becomes Delivered.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  const current = await RentalModel.findOne({ rentalId: id }).lean();
  if (!current) return fail("Rental not found.", 404);

  const order = await OrderModel.findOne({ orderId: current.orderId }, { status: 1 }).lean();
  if (!order || !DELIVERABLE_STATUSES.includes(order.status)) {
    return fail(`This order is "${order?.status ?? "missing"}". Send it out for delivery from the Orders tab first.`, 409);
  }

  const today = todayISO();
  // The status and deliveredAt filter makes this happen once, even with a double click.
  const rental = await RentalModel.findOneAndUpdate(
    { rentalId: id, status: "Scheduled", deliveredAt: null },
    { $set: { startDate: today, endDate: addMonthsISO(today, current.months), deliveredAt: new Date() } },
    { new: true },
  );
  if (!rental) return fail("Only a scheduled, undelivered rental can be marked delivered.", 409);

  const stillWaiting = await RentalModel.countDocuments({ orderId: rental.orderId, status: "Scheduled", deliveredAt: null });
  if (stillWaiting === 0) {
    await OrderModel.updateOne(
      { orderId: rental.orderId, status: { $in: DELIVERABLE_STATUSES } },
      { $set: { status: "Delivered" }, $push: { timeline: entry("Delivered", "admin", "All items delivered") } },
    );
  }
  return json({ rental: serializeRental(rental.toObject()) });
}
