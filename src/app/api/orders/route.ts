import { z } from "zod";
import { connectDb } from "@/lib/db";
import { fail, getSessionUser, json } from "@/lib/auth";
import { addDays, monthlyRent, toISODate } from "@/lib/pricing";
import { newOrderId } from "@/lib/orders";
import { serialize } from "@/lib/serializeOrder";
import { ensureRentals } from "@/lib/rentalsServer";
import { toProduct } from "@/lib/catalog";
import { OrderModel, ProductModel, ServiceAreaModel } from "@/models";

const slots = ["9 AM to 12 PM", "12 PM to 3 PM", "3 PM to 6 PM"] as const;
const payments = { cod: "Pay at delivery", upi: "UPI link" } as const;

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10 digit Indian mobile number"),
  email: z.email("Enter a valid email").max(120),
  address: z.string().trim().min(10, "Add your flat, building and area").max(300),
  city: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6 digit pincode"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a delivery date"),
  slot: z.enum(slots),
  payment: z.enum(["cod", "upi"]),
  lines: z
    .array(z.object({ productId: z.string().min(1), months: z.union([z.literal(3), z.literal(6), z.literal(12)]), qty: z.number().int().min(1).max(10) }))
    .min(1, "Your cart is empty")
    .max(20),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  await connectDb();
  const orders = await OrderModel.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
  return json({ orders: orders.map(serialize) });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in to place an order.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return fail(parsed.error.issues[0]?.message ?? "Please check your details.", 400, fields);
  }
  const data = parsed.data;

  const today = new Date();
  const min = toISODate(addDays(today, 2));
  const max = toISODate(addDays(today, 45));
  if (data.deliveryDate < min || data.deliveryDate > max) {
    return fail("Pick a delivery date between 2 and 45 days from today.", 400, { deliveryDate: "Pick a date in the next 45 days, at least 2 days away" });
  }

  await connectDb();
  if (!(await ServiceAreaModel.exists({ name: data.city, active: true }))) {
    return fail("We do not deliver to that city yet.", 400, { city: "Pick one of our service cities" });
  }

  // Merge duplicate lines, then price every line from the database, never from the client.
  const merged = new Map<string, { months: 3 | 6 | 12; qty: number }>();
  for (const l of data.lines) {
    const prev = merged.get(l.productId);
    merged.set(l.productId, { months: l.months, qty: Math.min((prev?.qty ?? 0) + l.qty, 10) });
  }

  const docs = await ProductModel.find({ pid: { $in: [...merged.keys()] }, active: { $ne: false } }).lean();
  const byPid = new Map(docs.map((d) => [d.pid, d]));

  const lines = [];
  for (const [pid, want] of merged) {
    const d = byPid.get(pid);
    if (!d) return fail("An item in your cart is no longer available.", 409);
    const p = toProduct(d as never);
    lines.push({ pid, name: p.name, months: want.months, qty: want.qty, rentPerMonth: monthlyRent(p, want.months), deposit: p.deposit });
  }

  // Reserve stock atomically. If any line is short, give back what we already took.
  const reserved: { pid: string; qty: number }[] = [];
  for (const l of lines) {
    const res = await ProductModel.updateOne({ pid: l.pid, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty } });
    if (res.modifiedCount !== 1) {
      for (const r of reserved) await ProductModel.updateOne({ pid: r.pid }, { $inc: { stock: r.qty } });
      return fail(`Sorry, ${l.name} does not have enough stock for ${l.qty}.`, 409);
    }
    reserved.push({ pid: l.pid, qty: l.qty });
  }

  try {
    const order = await OrderModel.create({
      orderId: newOrderId(),
      userId: user.id,
      name: data.name,
      phone: data.phone,
      email: data.email.toLowerCase(),
      address: data.address,
      city: data.city,
      pincode: data.pincode,
      deliveryDate: data.deliveryDate,
      slot: data.slot,
      payment: payments[data.payment],
      lines,
      rentPerMonth: lines.reduce((s, l) => s + l.rentPerMonth * l.qty, 0),
      deposit: lines.reduce((s, l) => s + l.deposit * l.qty, 0),
    });
    await ensureRentals(user.id);
    return json({ order: serialize(order.toObject()) }, 201);
  } catch (err) {
    for (const r of reserved) await ProductModel.updateOne({ pid: r.pid }, { $inc: { stock: r.qty } });
    console.error("[orders] create failed", err);
    return fail("We could not place your order. Please try again.", 500);
  }
}
