import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin, zodFields } from "@/lib/adminGuard";
import { phaseOf } from "@/lib/rentals";
import { newId, serializeRental } from "@/lib/rentalsServer";
import { ClaimModel, OrderModel, ProductModel, RentalModel } from "@/models";

const schema = z.object({
  damageCharge: z.number().int().min(0).max(1_000_000).default(0),
  damageNote: z.string().trim().max(500).default(""),
});

/**
 * Admin only: record the pickup and inspection. Stock goes back on the shelf and any damage
 * charge is raised as a claim against the deposit (the customer can dispute it).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Check the damage amount and note.", 400, zodFields(parsed.error.issues));
  const { damageCharge, damageNote } = parsed.data;
  if (damageCharge > 0 && damageNote.length < 5) return fail("Describe the damage so the customer can see why.", 400, { damageNote: "Describe the damage" });

  const { id } = await ctx.params;
  const current = await RentalModel.findOne({ rentalId: id }).lean();
  if (!current) return fail("Rental not found.", 404);
  const phase = phaseOf(current);
  if (phase === "Awaiting delivery" || phase === "Cancelled" || phase === "Returned") {
    return fail("Only a delivered rental that is still with the customer can be marked returned.", 409);
  }
  if (damageCharge > current.deposit * current.qty) return fail("The damage charge cannot be more than the deposit held.", 400, { damageCharge: "More than the deposit" });

  // The status filter makes this happen once even if two admins click at the same time.
  const rental = await RentalModel.findOneAndUpdate(
    { rentalId: id, status: { $in: ["Scheduled", "Return scheduled"] } },
    { $set: { status: "Returned", returnedAt: new Date() } },
    { new: true },
  );
  if (!rental) return fail("This rental was already processed.", 409);

  await ProductModel.updateOne({ pid: rental.pid }, { $inc: { stock: rental.qty } });

  let claim = null;
  if (damageCharge > 0) {
    claim = await ClaimModel.create({
      claimId: newId("CL"),
      rentalId: rental.rentalId,
      userId: rental.userId,
      productName: rental.name,
      amount: damageCharge,
      note: damageNote,
    });
  }

  const open = await RentalModel.countDocuments({ orderId: rental.orderId, status: { $nin: ["Returned", "Cancelled"] } });
  if (open === 0) {
    await OrderModel.updateOne(
      { orderId: rental.orderId },
      { $set: { status: "Closed" }, $push: { timeline: { status: "Closed", at: new Date(), by: "admin", note: "All items returned" } } },
    );
  }

  return json({ rental: serializeRental(rental.toObject()), claimId: claim?.claimId ?? null });
}
