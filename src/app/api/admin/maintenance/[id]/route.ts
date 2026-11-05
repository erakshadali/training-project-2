import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin, zodFields } from "@/lib/adminGuard";
import { serializeRequest } from "@/lib/rentalsServer";
import { MaintenanceModel } from "@/models";

const schema = z.object({
  status: z.enum(["Open", "In progress", "Resolved"]),
  note: z.string().trim().max(500).default(""),
});

/** Move a repair request along and leave a note the customer can read. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a status and keep the note under 500 characters.", 400, zodFields(parsed.error.issues));

  const { id } = await ctx.params;
  const doc = await MaintenanceModel.findOne({ requestId: id });
  if (!doc) return fail("Request not found.", 404);

  doc.status = parsed.data.status;
  doc.note = parsed.data.note;
  doc.resolvedAt = parsed.data.status === "Resolved" ? (doc.resolvedAt ?? new Date()) : null;
  await doc.save();
  return json({ request: serializeRequest(doc.toObject() as never) });
}
