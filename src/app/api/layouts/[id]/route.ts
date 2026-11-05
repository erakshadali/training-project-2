import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { full, layoutSchema, summary } from "@/lib/layouts";
import { RoomLayoutModel } from "@/models";

type Ctx = { params: Promise<{ id: string }> };

/** Every route only ever touches the signed-in customer's own layouts. */
async function validId(ctx: Ctx) {
  const { id } = await ctx.params;
  return /^[0-9a-f]{24}$/i.test(id) ? id : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const id = await validId(ctx);
  if (!id) return fail("Layout not found.", 404);
  await connectDb();
  const doc = await RoomLayoutModel.findOne({ _id: id, userId: user.id }).lean();
  if (!doc) return fail("Layout not found.", 404);
  return json({ layout: full(doc as never) });
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const id = await validId(ctx);
  if (!id) return fail("Layout not found.", 404);
  const parsed = layoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the layout.", 400);
  await connectDb();
  const doc = await RoomLayoutModel.findOneAndUpdate({ _id: id, userId: user.id }, { $set: parsed.data }, { new: true }).lean();
  if (!doc) return fail("Layout not found.", 404);
  return json({ layout: summary(doc as never) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const id = await validId(ctx);
  if (!id) return fail("Layout not found.", 404);
  await connectDb();
  const res = await RoomLayoutModel.deleteOne({ _id: id, userId: user.id });
  if (!res.deletedCount) return fail("Layout not found.", 404);
  return json({ ok: true });
}
