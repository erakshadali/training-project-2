import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin, zodFields } from "@/lib/adminGuard";
import { toProduct } from "@/lib/catalog";
import { ProductModel } from "@/models";

const schema = z
  .object({
    name: z.string().trim().min(3).max(80),
    blurb: z.string().trim().min(10).max(160),
    description: z.string().trim().min(20).max(600),
    rent: z.number().int().min(50).max(50_000),
    deposit: z.number().int().min(0).max(200_000),
    stock: z.number().int().min(0).max(10_000),
    popular: z.boolean(),
    active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

/** Edit price, deposit, stock, visibility or copy. Prices only affect new orders; running rentals keep theirs. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the values.", 400, zodFields(parsed.error.issues));

  const { id } = await ctx.params;
  const doc = await ProductModel.findOneAndUpdate({ pid: id }, { $set: parsed.data }, { new: true });
  if (!doc) return fail("Product not found.", 404);
  return json({ product: { ...toProduct(doc.toObject() as never), active: doc.active !== false } });
}

/** Products are hidden, not deleted, so past orders keep their history. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { id } = await ctx.params;
  const doc = await ProductModel.findOneAndUpdate({ pid: id }, { $set: { active: false } }, { new: true });
  if (!doc) return fail("Product not found.", 404);
  return json({ ok: true });
}
