import { fail, json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { addMonthsISO, todayISO } from "@/lib/rentals";
import { serializeRental } from "@/lib/rentalsServer";
import { OrderModel, RentalModel } from "@/models";

/** Admin only: record that a rental was delivered today. The plan clock starts on delivery. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const { id } = await ctx.params;
  const current = await RentalModel.findOne({ rentalId: id }).lean();
  if (!current) return fail("Rental not found.", 404);

  const today = todayISO();
  // The status and deliveredAt filter makes this happen once, even with a double click.
  const rental = await RentalModel.findOneAndUpdate(
    { rentalId: id, status: "Scheduled", deliveredAt: null },
    { $set: { startDate: today, endDate: addMonthsISO(today, current.months), deliveredAt: new Date() } },
    { new: true },
  );
  if (!rental) return fail("Only a scheduled, undelivered rental can be marked delivered.", 409);

  await OrderModel.updateOne({ orderId: rental.orderId, status: "Scheduled" }, { $set: { status: "Delivered" } });
  return json({ rental: serializeRental(rental.toObject()) });
}
