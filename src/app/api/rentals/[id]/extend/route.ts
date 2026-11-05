import { z } from "zod";
import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { monthlyRent } from "@/lib/pricing";
import { toProduct } from "@/lib/catalog";
import { addMonthsISO, phaseOf, tierFor } from "@/lib/rentals";
import { serializeRental } from "@/lib/rentalsServer";
import { ProductModel, RentalModel } from "@/models";

const schema = z.object({ addMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Choose 3, 6 or 12 extra months.", 400);

  const { id } = await ctx.params;
  await connectDb();
  const rental = await RentalModel.findOne({ rentalId: id, userId: user.id });
  if (!rental) return fail("Rental not found.", 404);

  const phase = phaseOf(rental);
  if (phase !== "Active" && phase !== "Plan ended") return fail("Only a rental that has been delivered can be extended.", 409);

  const productDoc = await ProductModel.findOne({ pid: rental.pid }).lean();
  if (!productDoc) return fail("This product is no longer available to extend.", 409);

  // A longer total plan can lower the monthly rent for the whole rental.
  const totalMonths = rental.months + parsed.data.addMonths;
  const newRent = Math.min(rental.rentPerMonth, monthlyRent(toProduct(productDoc as never), tierFor(totalMonths)));

  rental.months = totalMonths;
  rental.rentPerMonth = newRent;
  rental.endDate = addMonthsISO(rental.endDate, parsed.data.addMonths);
  rental.extensions.push({ addedMonths: parsed.data.addMonths, rentPerMonth: newRent, at: new Date() });
  await rental.save();
  return json({ rental: serializeRental(rental.toObject()) });
}
