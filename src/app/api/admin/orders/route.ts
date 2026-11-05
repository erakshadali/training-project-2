import { json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { serialize } from "@/lib/serializeOrder";
import { OrderModel } from "@/models";

/** Every order, newest first, for the Orders tab. */
export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const orders = await OrderModel.find({}).sort({ createdAt: -1 }).limit(500).lean();
  return json({ orders: orders.map((o) => serialize(o)) });
}
