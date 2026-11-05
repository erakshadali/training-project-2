import { z } from "zod";
import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { maintenanceCategories } from "@/data/config";
import { phaseOf } from "@/lib/rentals";
import { ensureRentals, newId, serializeRequest } from "@/lib/rentalsServer";
import { MaintenanceModel, RentalModel } from "@/models";

const schema = z.object({
  rentalId: z.string().min(1),
  category: z.enum(maintenanceCategories),
  description: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(500),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  await connectDb();
  const list = await MaintenanceModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
  return json({ requests: list.map((d) => serializeRequest(d as never)) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return fail(parsed.error.issues[0]?.message ?? "Please check your request.", 400, fields);
  }

  await connectDb();
  await ensureRentals(user.id);
  const rental = await RentalModel.findOne({ rentalId: parsed.data.rentalId, userId: user.id });
  if (!rental) return fail("Rental not found.", 404);

  const phase = phaseOf(rental);
  if (phase === "Awaiting delivery" || phase === "Cancelled" || phase === "Returned") {
    return fail("You can raise a request once the item has been delivered and until it is returned.", 409);
  }

  const open = await MaintenanceModel.countDocuments({ userId: user.id, rentalId: rental.rentalId, status: { $ne: "Resolved" } });
  if (open >= 3) return fail("You already have 3 open requests for this item. We will get to them first.", 409);

  const created = await MaintenanceModel.create({
    requestId: newId("MR"),
    userId: user.id,
    rentalId: rental.rentalId,
    productName: rental.name,
    category: parsed.data.category,
    description: parsed.data.description,
  });
  return json({ request: serializeRequest(created.toObject() as never) }, 201);
}
