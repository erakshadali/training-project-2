import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { ServiceAreaModel } from "@/models";

const schema = z.object({ active: z.boolean() });

/** Switch a city on or off. At least one city must stay on. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Send { active: true | false }.", 400);

  const { id } = await ctx.params;
  if (!/^[0-9a-f]{24}$/i.test(id)) return fail("City not found.", 404);
  const area = await ServiceAreaModel.findById(id);
  if (!area) return fail("City not found.", 404);

  if (!parsed.data.active && area.active && (await ServiceAreaModel.countDocuments({ active: true })) <= 1) {
    return fail("At least one city must stay active.", 409);
  }
  area.active = parsed.data.active;
  await area.save();
  return json({ area: { id: String(area._id), name: area.name, active: area.active } });
}
