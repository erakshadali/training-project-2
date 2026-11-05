import { json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { serializeRental } from "@/lib/rentalsServer";
import { OrderModel, RentalModel, UserModel } from "@/models";

/** Every rental with the customer and delivery address, for the schedule board. */
export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const rentals = await RentalModel.find({}).sort({ startDate: 1 }).lean();
  const users = await UserModel.find({ _id: { $in: [...new Set(rentals.map((r) => String(r.userId)))] } }, { name: 1, email: 1, phone: 1 }).lean();
  const orders = await OrderModel.find({ orderId: { $in: [...new Set(rentals.map((r) => r.orderId))] } }, { orderId: 1, address: 1, city: 1, pincode: 1, slot: 1 }).lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const orderById = new Map(orders.map((o) => [o.orderId, o]));

  return json({
    rentals: rentals.map((r) => {
      const u = userById.get(String(r.userId));
      const o = orderById.get(r.orderId);
      return {
        ...serializeRental(r as never),
        customer: u ? { name: u.name, email: u.email, phone: u.phone ?? "" } : null,
        address: o ? `${o.address}, ${o.city} ${o.pincode}` : "",
        city: o?.city ?? "",
        slot: o?.slot ?? "",
        deliveredAt: r.deliveredAt ? new Date(r.deliveredAt).toISOString() : null,
        returnedAt: r.returnedAt ? new Date(r.returnedAt).toISOString() : null,
      };
    }),
  });
}
