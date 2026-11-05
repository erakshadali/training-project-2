import { z } from "zod";
import { fail, json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { ServiceAreaModel } from "@/models";

const schema = z.object({ name: z.string().trim().min(2, "Enter a city name").max(40).regex(/^[A-Za-z .'-]+$/, "Letters only") });

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const docs = await ServiceAreaModel.find({}).sort({ name: 1 }).lean();
  return json({ areas: docs.map((a) => ({ id: String(a._id), name: a.name, active: a.active })) });
}

export async function POST(req: Request) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a city name.", 400);
  const name = parsed.data.name.replace(/\s+/g, " ");
  if (await ServiceAreaModel.exists({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } })) {
    return fail("That city is already in the list.", 409);
  }
  const area = await ServiceAreaModel.create({ name, active: true });
  return json({ area: { id: String(area._id), name: area.name, active: area.active } }, 201);
}
