import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin, zodFields } from "@/lib/adminGuard";
import { applyAction, canReschedule, normalizeStatus, type OrderAction } from "@/lib/orderFlow";
import { cancelOrderRentals, deliverOrderRentals, entry, rescheduleOrderRentals } from "@/lib/orderServer";
import { addDaysISO, returnSlots, todayISO } from "@/lib/rentals";
import { serialize } from "@/lib/serializeOrder";
import { OrderModel, type OrderDoc } from "@/models";

const schema = z.object({
  action: z.enum(["confirm", "pack", "dispatch", "deliver", "cancel", "reschedule"]),
  note: z.string().trim().max(300).optional(),
  partnerName: z.string().trim().max(60).optional(),
  partnerPhone: z.string().trim().max(20).optional(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slot: z.enum(returnSlots).optional(),
});

/** The stored statuses that mean the same as a normalized status (old orders say "Scheduled" for "Confirmed"). */
const aliases = (s: string): OrderDoc["status"][] => (s === "Confirmed" ? ["Confirmed", "Scheduled"] : [s as OrderDoc["status"]]);

/**
 * Admin only: move an order along the pipeline, cancel or reject it, or change its delivery date.
 * Every change is checked against the current status and recorded in the order's timeline.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Check the details and try again.", 400, zodFields(parsed.error.issues));
  const { action, note = "", partnerName = "", partnerPhone = "", deliveryDate, slot } = parsed.data;

  const { id } = await ctx.params;
  const order = await OrderModel.findOne({ orderId: id }).lean();
  if (!order) return fail("Order not found.", 404);
  const current = normalizeStatus(order.status);
  const userId = String(order.userId);

  if (action === "reschedule") {
    if (!canReschedule(current)) return fail(`A ${current.toLowerCase()} order cannot be rescheduled.`, 409);
    const today = todayISO();
    if (!deliveryDate || deliveryDate < today || deliveryDate > addDaysISO(today, 90)) return fail("Pick a delivery date within the next 90 days.", 400, { deliveryDate: "Pick a date from today to 90 days away" });
    if (!slot) return fail("Pick a delivery time slot.", 400, { slot: "Pick a slot" });
    const updated = await OrderModel.findOneAndUpdate(
      { orderId: id, status: { $in: aliases(current) } },
      { $set: { deliveryDate, slot }, $push: { timeline: entry(current, "admin", `Delivery moved to ${deliveryDate}, ${slot}${note ? `. ${note}` : ""}`) } },
      { new: true },
    ).lean();
    if (!updated) return fail("This order changed while you were editing. Refresh and try again.", 409);
    await rescheduleOrderRentals(id, userId, deliveryDate);
    return json({ order: serialize(updated) });
  }

  const next = applyAction(current, action as OrderAction);
  if (!next) return fail(`A ${current.toLowerCase()} order cannot be moved that way.`, 409);
  if (action === "cancel" && note.length < 3) return fail("Give a short reason so the customer knows why.", 400, { note: "Add a reason" });

  // Items are delivered first, so if anything fails the order simply stays out for delivery and the admin can retry.
  if (action === "deliver") await deliverOrderRentals(id, userId);

  const set: Record<string, unknown> = { status: next };
  if (action === "dispatch") set.partner = partnerName ? { name: partnerName, phone: partnerPhone } : null;
  const label = { confirm: "Order confirmed", pack: "Packed and ready", dispatch: partnerName ? `Out for delivery with ${partnerName}` : "Out for delivery", deliver: "Delivered to the customer", cancel: "Cancelled" }[action];
  // The status filter makes each step happen once, even if two admins click at the same time.
  const updated = await OrderModel.findOneAndUpdate(
    { orderId: id, status: { $in: aliases(current) } },
    { $set: set, $push: { timeline: entry(next, "admin", action === "cancel" ? note : note ? `${label}. ${note}` : label) } },
    { new: true },
  ).lean();
  if (!updated) return fail("Someone already changed this order. Refresh to see its latest status.", 409);

  if (action === "cancel") await cancelOrderRentals(id, userId);
  return json({ order: serialize(updated) });
}
