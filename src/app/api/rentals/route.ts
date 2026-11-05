import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { ensureRentals, serializeRental } from "@/lib/rentalsServer";
import { RentalModel } from "@/models";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  await connectDb();
  await ensureRentals(user.id);
  const rentals = await RentalModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
  return json({ rentals: rentals.map((r) => serializeRental(r as never)) });
}
