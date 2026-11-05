import { z } from "zod";
import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { addDaysISO, earlyClosureFee, phaseOf, returnSlots, todayISO } from "@/lib/rentals";
import { serializeRental } from "@/lib/rentalsServer";
import { RentalModel } from "@/models";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a pickup date"),
  slot: z.enum(returnSlots),
});

async function load(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: fail("Please log in.", 401) } as const;
  await connectDb();
  const rental = await RentalModel.findOne({ rentalId: id, userId: user.id });
  if (!rental) return { error: fail("Rental not found.", 404) } as const;
  return { rental } as const;
}

/** Schedule (or reschedule) the pickup for a delivered rental. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const rental = r.rental;

  const phase = phaseOf(rental);
  if (phase !== "Active" && phase !== "Plan ended" && phase !== "Return scheduled") {
    return fail("A pickup can only be scheduled after the item is delivered.", 409);
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a pickup date and time slot.", 400, { date: "Pick a pickup date" });

  const today = todayISO();
  const min = addDaysISO(today, 1);
  const max = addDaysISO(rental.endDate > today ? rental.endDate : today, 30);
  if (parsed.data.date < min || parsed.data.date > max) {
    return fail("Pick a date from tomorrow up to 30 days after your plan ends.", 400, { date: "Pick a valid pickup date" });
  }

  rental.status = "Return scheduled";
  rental.returnRequest = {
    date: parsed.data.date,
    slot: parsed.data.slot,
    earlyClosureFee: earlyClosureFee(rental, parsed.data.date),
    requestedAt: new Date(),
  };
  await rental.save();
  return json({ rental: serializeRental(rental.toObject()) });
}

/** Cancel a scheduled pickup and keep renting. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await load(id);
  if ("error" in r) return r.error;
  const rental = r.rental;
  if (rental.status !== "Return scheduled") return fail("There is no pickup to cancel.", 409);
  if (rental.returnRequest && rental.returnRequest.date <= todayISO()) return fail("It is too late to cancel this pickup.", 409);
  rental.status = "Scheduled";
  rental.returnRequest = null;
  await rental.save();
  return json({ rental: serializeRental(rental.toObject()) });
}
