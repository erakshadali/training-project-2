import { z } from "zod";
import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { serializeClaim } from "@/lib/claims";
import { ClaimModel } from "@/models";

const schema = z.object({ message: z.string().trim().min(10, "Tell us why you disagree (at least 10 characters)").max(500) });

/** A customer challenges a damage charge. The deposit amount is held until an admin decides. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Add a message.", 400);

  const { id } = await ctx.params;
  await connectDb();
  const claim = await ClaimModel.findOneAndUpdate(
    { claimId: id, userId: user.id, status: "Charged" },
    { $set: { status: "Disputed", disputeMessage: parsed.data.message } },
    { new: true },
  );
  if (!claim) {
    const exists = await ClaimModel.exists({ claimId: id, userId: user.id });
    return fail(exists ? "This claim can no longer be disputed." : "Claim not found.", exists ? 409 : 404);
  }
  return json({ claim: serializeClaim(claim.toObject() as never) });
}
