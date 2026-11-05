import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { addMonthsISO, todayISO } from "@/lib/rentals";
import { serializeRental } from "@/lib/rentalsServer";
import { OrderModel, RentalModel } from "@/models";

/** Admin only: record that a rental was delivered today. The plan clock starts on delivery. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  if (user.role !== "admin") return fail("Admins only.", 403);

  const { id } = await ctx.params;
  await connectDb();
  const rental = await RentalModel.findOne({ rentalId: id });
  if (!rental) return fail("Rental not found.", 404);
  if (rental.status !== "Scheduled") return fail("Only a scheduled rental can be marked delivered.", 409);

  const today = todayISO();
  rental.startDate = today;
  rental.endDate = addMonthsISO(today, rental.months);
  await rental.save();
  await OrderModel.updateOne({ orderId: rental.orderId, status: "Scheduled" }, { $set: { status: "Delivered" } });
  return json({ rental: serializeRental(rental.toObject()) });
}
