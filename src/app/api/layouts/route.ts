import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { layoutSchema, MAX_LAYOUTS, summary } from "@/lib/layouts";
import { RoomLayoutModel } from "@/models";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  await connectDb();
  const list = await RoomLayoutModel.find({ userId: user.id }).select("-photo").sort({ updatedAt: -1 }).lean();
  return json({ layouts: list.map((d) => summary(d as never)), max: MAX_LAYOUTS });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);

  const parsed = layoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the layout.", 400);

  await connectDb();
  if ((await RoomLayoutModel.countDocuments({ userId: user.id })) >= MAX_LAYOUTS) {
    return fail(`You can keep up to ${MAX_LAYOUTS} layouts. Delete one to save a new one.`, 409);
  }
  const created = await RoomLayoutModel.create({ ...parsed.data, userId: user.id });
  return json({ layout: summary(created.toObject() as never) }, 201);
}
