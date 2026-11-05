import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { addDaysISO, todayISO } from "@/lib/rentals";
import { serializeRental } from "@/lib/rentalsServer";
import { OrderModel, ProductModel, RentalModel } from "@/models";

/** Cancel an order item before it is delivered. Stock goes back on the shelf. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const { id } = await ctx.params;
  await connectDb();

  // The status filter makes this atomic, so a double click cannot restore stock twice.
  const rental = await RentalModel.findOneAndUpdate(
    { rentalId: id, userId: user.id, status: "Scheduled", startDate: { $gte: addDaysISO(todayISO(), 1) } },
    { $set: { status: "Cancelled" } },
    { new: true },
  );
  if (!rental) {
    const exists = await RentalModel.exists({ rentalId: id, userId: user.id });
    return fail(exists ? "This item can only be cancelled until the day before delivery." : "Rental not found.", exists ? 409 : 404);
  }

  await ProductModel.updateOne({ pid: rental.pid }, { $inc: { stock: rental.qty } });

  const remaining = await RentalModel.countDocuments({ orderId: rental.orderId, status: { $ne: "Cancelled" } });
  if (remaining === 0) {
    await OrderModel.updateOne(
      { orderId: rental.orderId, status: { $nin: ["Cancelled", "Delivered", "Closed"] } },
      { $set: { status: "Cancelled" }, $push: { timeline: { status: "Cancelled", at: new Date(), by: "customer", note: "Cancelled by the customer" } } },
    );
  }

  return json({ rental: serializeRental(rental.toObject()) });
}
