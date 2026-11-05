import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { UserModel } from "@/models";

const schema = z.object({ disabled: z.boolean() });

/** Suspend or restore a customer. Admin accounts cannot be suspended. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Send { disabled: true | false }.", 400);

  const { id } = await ctx.params;
  if (!/^[0-9a-f]{24}$/i.test(id)) return fail("User not found.", 404);
  const user = await UserModel.findById(id);
  if (!user) return fail("User not found.", 404);
  if (user.role === "admin") return fail("Admin accounts cannot be suspended.", 409);

  user.disabled = parsed.data.disabled;
  await user.save();
  return json({ ok: true, disabled: user.disabled });
}
