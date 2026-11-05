import { json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { OrderModel, RentalModel, UserModel } from "@/models";

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const users = await UserModel.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).lean();
  const orders = await OrderModel.aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$userId", n: { $sum: 1 } } }]);
  const active = await RentalModel.aggregate<{ _id: unknown; n: number }>([
    { $match: { status: { $in: ["Scheduled", "Return scheduled"] } } },
    { $group: { _id: "$userId", n: { $sum: "$qty" } } },
  ]);
  const o = new Map(orders.map((x) => [String(x._id), x.n]));
  const a = new Map(active.map((x) => [String(x._id), x.n]));
  return json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      role: u.role,
      disabled: !!u.disabled,
      orders: o.get(String(u._id)) ?? 0,
      itemsRented: a.get(String(u._id)) ?? 0,
      joined: u.createdAt ? new Date(u.createdAt as unknown as string).toISOString() : "",
    })),
  });
}
