import { json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { serializeClaim } from "@/lib/claims";
import { ClaimModel, UserModel } from "@/models";

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const list = await ClaimModel.find({}).sort({ createdAt: -1 }).lean();
  const users = await UserModel.find({ _id: { $in: [...new Set(list.map((c) => String(c.userId)))] } }, { name: 1 }).lean();
  const byId = new Map(users.map((u) => [String(u._id), u.name]));
  return json({ claims: list.map((c) => ({ ...serializeClaim(c as never), customer: byId.get(String(c.userId)) ?? "" })) });
}
