import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin, zodFields } from "@/lib/adminGuard";
import { serializeClaim } from "@/lib/claims";
import { ClaimModel } from "@/models";

const schema = z.object({
  decision: z.enum(["Upheld", "Waived"]),
  note: z.string().trim().min(5, "Add a short reason the customer will see").max(500),
});

/** Settle a damage claim: uphold the charge, or waive it and refund the full deposit. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your decision.", 400, zodFields(parsed.error.issues));

  const { id } = await ctx.params;
  const claim = await ClaimModel.findOneAndUpdate(
    { claimId: id, status: { $in: ["Charged", "Disputed"] } },
    { $set: { status: parsed.data.decision, resolutionNote: parsed.data.note, resolvedAt: new Date() } },
    { new: true },
  );
  if (!claim) {
    const exists = await ClaimModel.exists({ claimId: id });
    return fail(exists ? "This claim is already settled." : "Claim not found.", exists ? 409 : 404);
  }
  return json({ claim: serializeClaim(claim.toObject() as never) });
}
