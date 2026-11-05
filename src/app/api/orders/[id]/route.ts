import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { OrderModel } from "@/models";
import { serialize } from "@/lib/serializeOrder";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const { id } = await ctx.params;
  await connectDb();
  // Customers only ever see their own orders; admins can see any.
  const filter = user.role === "admin" ? { orderId: id } : { orderId: id, userId: user.id };
  const order = await OrderModel.findOne(filter).lean();
  if (!order) return fail("Order not found.", 404);
  return json({ order: serialize(order) });
}
